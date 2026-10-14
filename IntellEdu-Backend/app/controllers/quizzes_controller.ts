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
| Handles daily quizzes (25 per day, Asia/Kolkata 00:00 rollover, no repeats),
| practice bank (last 3 days only, 0 XP), quiz submission with single-attempt
| daily XP, and today-scoped saved attempts.
*/
export default class QuizzesController {

  /**
   * GET /api/v1/quizzes — Recent Practice Quizzes
   * Shows ONLY quizzes from the last 3 days of the grade that were already served,
   * max 30, newest first. 0 XP awarded on practice.
   */
  async index({ auth, request, response }: HttpContext) {
    let userGrade: string | undefined
    try {
      const user = auth.user
      if (user) userGrade = user.grade
    } catch {
      // unauthenticated
    }

    const gradeInput = request.input('grade') || userGrade || 'Class 10'
    const normalized = normalizeGrade(gradeInput)
    const today = getTodayIstString()
    const subject = request.input('subject')
    const search = request.input('search')

    const threeDaysAgo = DateTime.now()
      .setZone(getAppTimezone())
      .minus({ days: 3 })
      .toISODate()!

    // Fetch quiz IDs from the last 3 days of daily pools (prior to today)
    const recentDailyRows = await db
      .from('daily_quizzes')
      .where('grade', normalized)
      .where('quiz_date', '>=', threeDaysAgo)
      .where('quiz_date', '<', today)
      .orderBy('quiz_date', 'desc')
      .orderBy('slot_number', 'asc')
      .select('quiz_id')

    let practiceQuizIds = Array.from(new Set(recentDailyRows.map((r: any) => r.quiz_id)))

    // Fallback: If no recent daily quizzes exist yet (e.g. freshly seeded bank),
    // grab recent published quizzes for that grade as a seed bank up to 30
    if (practiceQuizIds.length === 0) {
      const fallbackRows = await Quiz.query()
        .where('is_published', true)
        .where('is_active', true)
        .where((b) => {
          b.where('grade', normalized).orWhereNull('grade')
        })
        .orderBy('created_at', 'desc')
        .limit(30)
        .select('id')
      practiceQuizIds = fallbackRows.map((q) => q.id)
    }

    if (practiceQuizIds.length === 0) {
      return response.ok({ quizzes: [] })
    }

    const query = Quiz.query()
      .whereIn('id', practiceQuizIds)
      .where('is_published', true)
      .where('is_active', true)
      .preload('course')
      .limit(30)

    if (subject && subject !== 'all') {
      query.whereRaw('LOWER(subject) = ?', [String(subject).toLowerCase()])
    }

    if (search) {
      const s = `%${String(search).toLowerCase().trim()}%`
      query.where((b) => {
        b.whereRaw('LOWER(title) LIKE ?', [s])
          .orWhereRaw('LOWER(description) LIKE ?', [s])
          .orWhereRaw('LOWER(subject) LIKE ?', [s])
      })
    }

    const quizzes = await query
    return response.ok({ quizzes })
  }

  /**
   * GET /api/v1/quizzes/daily — Today's 25 daily quizzes for student's grade
   * Changes deterministically at 00:00 IST. Records in user_quiz_history.
   */
  async daily({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const targetGrade = request.input('grade') || user.grade || 'Class 10'
    const today = getTodayIstString()
    const resetsAt = getNextMidnightIstIso()

    const dailyQuizzes = await getOrCreateDailyQuizzes(targetGrade, today, user.id)

    // Load today's attempts for these quizzes by the current user
    const quizIds = dailyQuizzes.map((q) => q.id)
    const todayAttempts = quizIds.length
      ? await QuizResult.query()
          .where('user_id', user.id)
          .whereIn('quiz_id', quizIds)
          .where('quiz_date', today)
      : []

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

    const completedCount = quizzesPayload.filter((q) => q.completedToday).length

    return response.ok({
      date: today,
      resetsAt,
      grade: normalizeGrade(targetGrade),
      total: quizzesPayload.length,
      completed: completedCount,
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
      questions: quiz.questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
      })),
    }

    return response.ok({ quiz: safeQuiz })
  }

  /**
   * GET /api/v1/quizzes/my-results
   * Shows ONLY attempts made on the current IST day when ?scope=today (default),
   * starts completely empty after 00:00 IST. Supports ?scope=all for Progress & Stats.
   */
  async myResults({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const scope = request.input('scope', 'today')
    const page = Number(request.input('page')) || 1
    const limit = Number(request.input('limit')) || 20
    const today = getTodayIstString()

    // Lazy cleanup: archive attempts older than today IST
    await db.rawQuery(
      `UPDATE quiz_results 
       SET archived_at = NOW() 
       WHERE user_id = ? AND quiz_date < ? AND archived_at IS NULL`,
      [user.id, today]
    )

    const query = QuizResult.query().where('user_id', user.id).preload('quiz').orderBy('created_at', 'desc')

    if (scope === 'today') {
      query.where('quiz_date', today)
    }

    const resultsPagination = await query.paginate(page, limit)

    return response.ok({
      scope,
      date: today,
      results: resultsPagination.all(),
      meta: resultsPagination.getMeta(),
    })
  }

  /** POST /api/v1/quizzes/:id/submit [Protected] */
  async submit({ auth, params, request, response }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        answers: vine.array(vine.number()),
        timeTakenSeconds: vine.number().optional(),
      })
    )

    const { answers, timeTakenSeconds } = await request.validateUsing(schema)

    const quiz = await Quiz.query()
      .where('id', params.id)
      .where('is_published', true)
      .preload('questions', (q) => q.orderBy('sort_order', 'asc'))
      .firstOrFail()

    if (quiz.questions.length === 0) {
      return response.badRequest({ message: 'This quiz does not have any questions yet.' })
    }
    if (
      answers.length !== quiz.questions.length ||
      answers.some(
        (answer, index) =>
          !Number.isInteger(answer) || answer < 0 || answer >= (quiz.questions[index]?.options.length ?? 0)
      )
    ) {
      return response.badRequest({ message: 'Select one valid option for every quiz question.' })
    }

    // Grade the quiz
    let correct = 0
    for (let i = 0; i < quiz.questions.length; i++) {
      if (answers[i] === quiz.questions[i].correctOption) correct++
    }

    const totalQuestions = quiz.questions.length
    const accuracy = Math.round((correct / totalQuestions) * 100)
    const rawXpEarned = Math.round((accuracy / 100) * quiz.xpReward)

    const user = auth.getUserOrFail()
    const today = getTodayIstString()
    const normalizedUserGrade = normalizeGrade(user.grade)

    // Check if this quiz is in today's daily pool for the user's grade
    const isDailyQuiz = await db
      .from('daily_quizzes')
      .where('quiz_date', today)
      .where('quiz_id', quiz.id)
      .where('grade', normalizedUserGrade)
      .first()

    const transactionResult = await db.transaction(async (trx) => {
      await trx.from('users').where('id', user.id).forUpdate().first()

      // XP Rule: Awarded only on the first attempt of a daily quiz on that day.
      // Retakes of daily quizzes and practice quizzes award 0 XP.
      let earned = 0
      const sourceKey = `daily-quiz-attempt:${user.id}:${quiz.id}:${today}`

      if (isDailyQuiz) {
        const previouslyAwarded = await trx
          .from('xp_transactions')
          .where('source_key', sourceKey)
          .first()

        if (!previouslyAwarded && rawXpEarned > 0) {
          earned = rawXpEarned
        }
      }

      const result = await QuizResult.create(
        {
          userId: user.id,
          quizId: quiz.id,
          score: correct,
          totalQuestions,
          correctAnswers: correct,
          accuracy,
          xpEarned: earned,
          timeTakenSeconds: timeTakenSeconds ?? null,
          quizDate: today,
        },
        { client: trx }
      )

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

    // Build answer review explanations
    const review = quiz.questions.map((q, i) => ({
      question: q.question,
      yourAnswer: q.options[answers[i]] ?? 'No answer',
      correctAnswer: q.options[q.correctOption],
      isCorrect: answers[i] === q.correctOption,
      explanation: q.explanation,
    }))

    const msg = isDailyQuiz
      ? earned > 0
        ? `Quiz completed! You scored ${accuracy}% and earned +${earned} XP.`
        : `Quiz completed with ${accuracy}%. (Daily XP already claimed on your first attempt).`
      : `Practice quiz completed with ${accuracy}%. Practice quizzes award 0 XP.`

    return response.created({
      message: msg,
      score: correct,
      totalQuestions,
      accuracy,
      xpEarned: earned,
      currentXpBalance: balance,
      resultId: result.id,
      review,
    })
  }
}
