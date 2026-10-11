import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import QuizResult from '#models/quiz_result'
import { changeXpInTransaction } from '#services/xp_service'

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
      rating: c.rating,
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
    const now = DateTime.now()
    const result = await db.transaction(async (trx) => {
      const current = await trx.from('users').where('id', user.id).forUpdate().first()
      const lastActive = current.last_active_date instanceof Date
        ? current.last_active_date.toISOString().slice(0, 10)
        : current.last_active_date
          ? String(current.last_active_date).slice(0, 10)
          : null
      let currentStreak = Number(current.streak)
      let balance = Number(current.points)
      let streakUpdated = false

      if (lastActive !== today) {
        const yesterday = now.minus({ days: 1 }).toISODate()
        currentStreak = lastActive === yesterday ? currentStreak + 1 : 1
        await trx.from('users').where('id', user.id).update({
          streak: currentStreak,
          last_active_date: today,
          updated_at: now.toJSDate(),
        })
        balance = (await changeXpInTransaction(trx, {
          userId: user.id,
          amount: 25,
          reason: 'daily_streak',
          sourceKey: `daily-streak:${user.id}:${today}`,
        })).balance
        streakUpdated = true
      }

      return { streakUpdated, currentStreak, balance }
    })

    return response.ok({
      message: result.streakUpdated ? 'Streak updated for today! +25 XP bonus awarded.' : 'Streak already active for today.',
      streak: result.currentStreak,
      points: result.balance,
      currentXpBalance: result.balance,
    })
  }
}
