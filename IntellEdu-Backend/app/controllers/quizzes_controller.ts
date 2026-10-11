import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Quiz from '#models/quiz'
import QuizResult from '#models/quiz_result'
import { changeXpInTransaction } from '#services/xp_service'
import vine from '@vinejs/vine'

/*
|--------------------------------------------------------------------------
| QuizzesController
|--------------------------------------------------------------------------
*/
export default class QuizzesController {

  /** GET /api/v1/quizzes */
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

  /** GET /api/v1/quizzes/:id */
  async show({ params, response }: HttpContext) {
    const quiz = await Quiz.query()
      .where('id', params.id)
      .where('is_published', true)
      .preload('questions')
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

  /** GET /api/v1/quizzes/my-results  [Protected] */
  async myResults({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const results = await QuizResult.query()
      .where('user_id', user.id)
      .preload('quiz')
      .orderBy('created_at', 'desc')
      .limit(20)
    return response.ok({ results })
  }

  /** POST /api/v1/quizzes/:id/submit  [Protected] */
  async submit({ auth, params, request, response }: HttpContext) {
    const schema = vine.compile(vine.object({
      answers:          vine.array(vine.number()),  // index of selected option per question
      timeTakenSeconds: vine.number().optional(),
    }))

    const { answers, timeTakenSeconds } = await request.validateUsing(schema)

    const quiz = await Quiz.query()
      .where('id', params.id)
      .where('is_published', true)
      .preload('questions', (q) => q.orderBy('sort_order'))
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
    const xpEarned       = Math.round((accuracy / 100) * quiz.xpReward)

    const user = auth.getUserOrFail()

    const transactionResult = await db.transaction(async (trx) => {
      await trx.from('users').where('id', user.id).forUpdate().first()
      const sourceKey = `quiz-completion:${user.id}:${quiz.id}`
      const previouslyAwarded = await trx.from('xp_transactions')
        .where('source_key', sourceKey)
        .first()
      const earned = previouslyAwarded || xpEarned < 1 ? 0 : xpEarned

      const result = await QuizResult.create({
        userId: user.id,
        quizId: quiz.id,
        score: correct,
        totalQuestions,
        correctAnswers: correct,
        accuracy,
        xpEarned: earned,
        timeTakenSeconds: timeTakenSeconds ?? null,
      }, { client: trx })

      let balance = Number((await trx.from('users').select('points').where('id', user.id).first()).points)
      if (earned > 0) {
        const change = await changeXpInTransaction(trx, {
          userId: user.id,
          amount: earned,
          reason: 'quiz_completion',
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
