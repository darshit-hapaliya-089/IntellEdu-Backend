import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

/*
|--------------------------------------------------------------------------
| UsersController
|--------------------------------------------------------------------------
*/
export default class UsersController {

  /** GET /api/v1/users/:id/stats [Protected] */
  async stats({ params, response }: HttpContext) {
    const user = await User.find(params.id)
    if (!user) {
      return response.notFound({ message: 'User not found.' })
    }

    await user.load('courses')
    await user.load('quizResults')

    const totalQuizzes = user.quizResults.length
    const totalAccuracy = totalQuizzes > 0
      ? user.quizResults.reduce((acc, r) => acc + Number(r.accuracy), 0) / totalQuizzes
      : 0

    return response.ok({
      stats: {
        id: user.id,
        fullName: user.fullName,
        grade: user.grade,
        points: user.points,
        streak: user.streak,
        badge: user.badge,
        enrolledCoursesCount: user.courses.length,
        quizzesTaken: totalQuizzes,
        averageAccuracy: Math.round(totalAccuracy),
      },
    })
  }
}

