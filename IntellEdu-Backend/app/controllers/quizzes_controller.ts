import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Quiz from '#models/quiz'
import QuizResult from '#models/quiz_result'
import { changeXpInTransaction } from '#services/xp_service'
import { getTodayIstString, getAppTimezone } from '#services/streak_service'
import { getOrCreateDailyQuizzes, getNextMidnightIstIso, normalizeGrade } from '#services/daily_quiz_service'
import vine from '@vinejs/vine'

/*
|--------------------------------------------------------------------------
| QuizzesController
|--------------------------------------------------------------------------
*/
export default class QuizzesController {

  /** GET /api/v1/quizzes — All published practice quizzes */
  async index({ request, response }: HttpContext) {
    const query = Quiz.query()
      .where('is_published', true)
      .preload('course')
      .orderBy('grade', 'asc')
      .orderBy('subject', 'asc')
      .orderBy('created_at', 'desc')
    const grade = request.input('grade')
    const subject = request.input('subject')
    if (grade) {
      const numericGrade = String(grade).match(/(?:class|grade)?\s*(\d{1,2})/i)?.[1]
      query.whereRaw('LOWER(grade) = ?', [
        numericGrade ? `class ${numericGrade}` : String(grade).toLowerCase(),
      ])
    }
    if (subject) query.whereRaw('LOWER(subject) = ?', [String(subject).toLowerCase()])
    const quizzes = await query
    return response.ok({ quizzes })
  }

  /** GET /api/v1/quizzes/daily — Today's daily quiz set for student's grade (changes at 00:00 IST) */
  async daily({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const targetGrade = request.input('grade') || user.grade || 'Class 10'
    const today = getTodayIstString()
    const resetsAt = getNextMidnightIstIso()

    const dailyQuizzes = await getOrCreateDailyQuizzes(targetGrade, today)

    // Load today's attempts for these quizzes by the current user
    const quizIds = dailyQuizzes.map((q) => q.id)
    const todayAttempts = await QuizResult.query()
      .where('user_id', user.id)
      .whereIn('quiz_id', quizIds)
      .where('quiz_date', today)

    const attemptsMap = new Map<number, { completedToday: boolean; bestScoreToday: number }>()
    for (const att of todayAttempts) {
      const existing = attemptsMap.get(att.quizId)
      if (!existing || att.score > existing.bestScoreToday) {
        attemptsMap.set(att.quizId, {
          completedToday: true,
          bestScoreToday: att.score,
        })
      }
    }

    const quizzesPayload = dailyQuizzes.map((q) => {
      const stat = attemptsMap.get(q.id)
      return {
        id: q.id,
        title: q.title,
        description: q.description,
        subject: q.subject,
        grade: q.grade,
        difficulty: q.difficulty || 'medium',
        xpReward: q.xpReward,
        minutes: q.timeLimitMinutes,
        timeLimitMinutes: q.timeLimitMinutes,
        iconKey: q.iconKey,
        completedToday: Boolean(stat?.completedToday),
        bestScoreToday: stat?.bestScoreToday ?? null,
      }
    })

    return response.ok({
      date: today,
      resetsAt,
      grade: normalizeGrade(targetGrade),
      quizzes: quizzesPayload,
    })
  }

  /** GET /api/v1/quizzes/:id — Get quiz with questions (omits correctOption) */
  async show({ params, response }: HttpContext) {
    const quiz = await Quiz.query()
      .where('id', params.id)
      .where('is_published', true)
      .preload('questions', (q) => q.orderBy('sort_order', 'asc'))
      .preload('course')
      .firstOrFail()

    // Strip correct_option before sending to client
    const safeQuiz = {
      ...quiz.serialize(),
      questions: quiz.questions.map(q => ({
        id:       q.id,
        question: q.question,
        options:  q.options,
        // correctOption intentionally omitted
      })),
    }

    return response.ok({ quiz: safeQuiz })
  }

  /** GET /api/v1/quizzes/my-results — Last 7 days of attempts (IST date), newest first, paginated 20/page */
  async myResults({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const page = Number(request.input('page')) || 1
    const limit = 20

    const sevenDaysAgo = DateTime.now()
      .setZone(getAppTimezone())
      .minus({ days: 7 })
      .toISODate()!

    const resultsPagination = await QuizResult.query()
      .where('user_id', user.id)
      .where((b) => {
        b.where('quiz_date', '>=', sevenDaysAgo)
          .orWhere('created_at', '>=', DateTime.fromISO(sevenDaysAgo).startOf('day').toJSDate())
      })
      .preload('quiz')
      .orderBy('created_at', 'desc')
      .paginate(page, limit)

    return response.ok({
      results: resultsPagination.all(),
      meta: resultsPagination.getMeta(),
    })
  }

  /** POST /api/v1/quizzes/:id/submit [Protected] */
  async submit({ auth, params, request, response }: HttpContext) {
    const schema = vine.compile(vine.object({
      answers:          vine.array(vine.number()),  // index of selected option per question
      timeTakenSeconds: vine.number().optional(),
    }))

    const { answers, timeTakenSeconds } = await request.validateUsing(schema)

    const quiz = await Quiz.query()
      .where('id', params.id)
      .where('is_published', true)
      .preload('questions', (q) => q.orderBy('sort_order', 'asc'))
      .firstOrFail()

    if (quiz.questions.length === 0) {
      return response.badRequest({ message: 'This quiz does not have any questions yet.' })
    }
    if (answers.length !== quiz.questions.length || answers.some((answer, index) =>
      !Number.isInteger(answer) || answer < 0 || answer >= (quiz.questions[index]?.options.length ?? 0)
    )) {
      return response.badRequest({ message: 'Select one valid option for every quiz question.' })
    }

    // Grade the quiz
    let correct = 0
    for (let i = 0; i < quiz.questions.length; i++) {
      if (answers[i] === quiz.questions[i].correctOption) correct++
    }

    const totalQuestions = quiz.questions.length
    const accuracy       = Math.round((correct / totalQuestions) * 100)
    const rawXpEarned    = Math.round((accuracy / 100) * quiz.xpReward)

    const user = auth.getUserOrFail()
    const today = getTodayIstString()

    const transactionResult = await db.transaction(async (trx) => {
      await trx.from('users').where('id', user.id).forUpdate().first()

      // XP is awarded on the first attempt of that quiz on that day only; repeating gives 0 XP
      const sourceKey = `daily-quiz-attempt:${user.id}:${quiz.id}:${today}`
      const previouslyAwarded = await trx.from('xp_transactions')
        .where('source_key', sourceKey)
        .first()
      const earned = previouslyAwarded || rawXpEarned < 1 ? 0 : rawXpEarned

      const result = await QuizResult.create({
        userId: user.id,
        quizId: quiz.id,
        score: correct,
        totalQuestions,
        correctAnswers: correct,
        accuracy,
        xpEarned: earned,
        timeTakenSeconds: timeTakenSeconds ?? null,
        quizDate: today,
      }, { client: trx })

      let balance = Number((await trx.from('users').select('points').where('id', user.id).first()).points)
      if (earned > 0) {
        const change = await changeXpInTransaction(trx, {
          userId: user.id,
          amount: earned,
          reason: `quiz_completion_${quiz.subject || 'general'}`,
          sourceKey,
        })
        balance = change.balance
      }

      return { result, earned, balance }
    })
    const { result, earned, balance } = transactionResult

    // Build answer explanations for review
    const review = quiz.questions.map((q, i) => ({
      question:      q.question,
      yourAnswer:    q.options[answers[i]] ?? 'No answer',
      correctAnswer: q.options[q.correctOption],
      isCorrect:     answers[i] === q.correctOption,
      explanation:   q.explanation,
    }))

    return response.created({
      message:         `Quiz completed! You scored ${accuracy}% and earned ${earned} XP.`,
      score:           correct,
      totalQuestions,
      accuracy,
      xpEarned:        earned,
      currentXpBalance: balance,
      resultId:        result.id,
      review,
    })
  }
}
