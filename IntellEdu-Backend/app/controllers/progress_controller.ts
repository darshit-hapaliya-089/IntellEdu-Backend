import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import User from '#models/user'
import QuizResult from '#models/quiz_result'

/*
|--------------------------------------------------------------------------
| ProgressController
|--------------------------------------------------------------------------
| Handles user progress tracking, streak calculation, and learning analytics.
*/
export default class ProgressController {

  /** GET /api/v1/progress — User's overall learning dashboard progress */
  async myProgress({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await user.load('courses')

    const totalQuizzes = await QuizResult.query()
      .where('user_id', user.id)
      .count('* as total')

    const avgAccuracy = await QuizResult.query()
      .where('user_id', user.id)
      .avg('accuracy as avg')

    const recentResults = await QuizResult.query()
      .where('user_id', user.id)
      .preload('quiz')
      .orderBy('created_at', 'desc')
      .limit(5)

    const enrolledCourses = user.courses.map((c: any) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      grade: c.grade,
      imageUrl: c.imageUrl,
      totalLessons: c.totalLessons,
      completedLessons: c.$extras.pivot_completed_lessons || 0,
      progressPercent: c.$extras.pivot_progress_percent || 0,
      isCompleted: Boolean(c.$extras.pivot_is_completed),
      lastAccessedAt: c.$extras.pivot_last_accessed_at,
    }))

    return response.ok({
      progress: {
        userId: user.id,
        points: user.points,
        streak: user.streak,
        badge: user.badge,
        coursesEnrolled: user.courses.length,
        coursesCompleted: enrolledCourses.filter((c: any) => c.isCompleted).length,
        quizzesTaken: Number(totalQuizzes[0].$extras.total || 0),
        averageAccuracy: Math.round(Number(avgAccuracy[0].$extras.avg || 0)),
        enrolledCourses,
        recentQuizActivity: recentResults,
      },
    })
  }

  /** GET /api/v1/progress/streak — Get streak details */
  async streak({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const today = DateTime.now().toISODate()
    const lastActive = user.lastActiveDate?.toISODate?.() ?? null

    const isActiveToday = lastActive === today

    return response.ok({
      streak: user.streak,
      isActiveToday,
      lastActiveDate: user.lastActiveDate,
      badge: user.badge,
    })
  }

  /** POST /api/v1/progress/streak/ping — Daily study activity ping */
  async pingStreak({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const today = DateTime.now().toISODate()
    const lastActive = user.lastActiveDate?.toISODate?.() ?? null

    let streakUpdated = false
    let currentStreak = user.streak

    if (lastActive !== today) {
      const yesterday = DateTime.now().minus({ days: 1 }).toISODate()
      currentStreak = lastActive === yesterday ? user.streak + 1 : 1

      // Bonus XP for maintaining streak
      const bonusXp = 25
      await user.merge({
        streak: currentStreak,
        lastActiveDate: DateTime.now(),
        points: user.points + bonusXp,
      }).save()

      streakUpdated = true
    }

    return response.ok({
      message: streakUpdated ? 'Streak updated for today! +25 XP bonus awarded.' : 'Streak already active for today.',
      streak: currentStreak,
      points: user.points,
    })
  }
}

