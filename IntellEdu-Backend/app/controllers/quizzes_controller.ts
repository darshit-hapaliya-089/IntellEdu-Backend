import type { HttpContext } from '@adonisjs/core/http'
import Quiz from '#models/quiz'
import QuizResult from '#models/quiz_result'
import User from '#models/user'
import vine from '@vinejs/vine'

/*
|--------------------------------------------------------------------------
| QuizzesController
|--------------------------------------------------------------------------
*/
export default class QuizzesController {

  /** GET /api/v1/quizzes */
  async index({ response }: HttpContext) {
    const quizzes = await Quiz.query()
      .where('is_published', true)
      .preload('course')
      .orderBy('created_at', 'desc')
    return response.ok({ quizzes })
  }

  /** GET /api/v1/quizzes/:id */
  async show({ params, response }: HttpContext) {
    const quiz = await Quiz.query()
      .where('id', params.id)
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
      .preload('questions', (q) => q.orderBy('sort_order'))
      .firstOrFail()

    // Grade the quiz
    let correct = 0
    for (let i = 0; i < quiz.questions.length; i++) {
      if (answers[i] === quiz.questions[i].correctOption) correct++
    }

    const totalQuestions = quiz.questions.length
    const accuracy       = Math.round((correct / totalQuestions) * 100)
    const xpEarned       = Math.round((accuracy / 100) * quiz.xpReward)

    const user = auth.getUserOrFail()

    // Save result
    const result = await QuizResult.create({
      userId:           user.id,
      quizId:           quiz.id,
      score:            correct,
      totalQuestions,
      correctAnswers:   correct,
      accuracy,
      xpEarned,
      timeTakenSeconds: timeTakenSeconds ?? null,
    })

    // Award XP to user
    await User.query().where('id', user.id).increment('points', xpEarned)

    // Build answer explanations for review
    const review = quiz.questions.map((q, i) => ({
      question:      q.question,
      yourAnswer:    q.options[answers[i]] ?? 'No answer',
      correctAnswer: q.options[q.correctOption],
      isCorrect:     answers[i] === q.correctOption,
      explanation:   q.explanation,
    }))

    return response.created({
      message:         `Quiz completed! You scored ${accuracy}% and earned ${xpEarned} XP.`,
      score:           correct,
      totalQuestions,
      accuracy,
      xpEarned,
      resultId:        result.id,
      review,
    })
  }
}

