import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { DateTime } from 'luxon'

/*
|--------------------------------------------------------------------------
| LeaderboardController
|--------------------------------------------------------------------------
*/
export default class LeaderboardController {

  /** GET /api/v1/leaderboard — Global top 50 by XP points */
  async global({ response }: HttpContext) {
    const leaders = await User.query()
      .where('role', 'student')
      .orderBy('points', 'desc')
      .limit(50)
      .select(['id', 'full_name', 'grade', 'points', 'streak', 'badge', 'avatar_url'])

    return response.ok({
      leaderboard: leaders.map((u, idx) => ({
        rank:      idx + 1,
        id:        u.id,
        name:      u.fullName,
        grade:     u.grade,
        points:    u.points,
        streak:    u.streak,
        badge:     u.badge,
        avatarUrl: u.avatarUrl,
      })),
    })
  }

  /** GET /api/v1/leaderboard/weekly — Top 20 by XP gained this week */
  async weekly({ response }: HttpContext) {
    const weekStart = DateTime.now().startOf('week').toSQL()

    // In a full implementation, you'd track weekly XP separately.
    // For now, filter recently active users as a proxy.
    const leaders = await User.query()
      .where('role', 'student')
      .where('last_active_date', '>=', weekStart!)
      .orderBy('points', 'desc')
      .limit(20)
      .select(['id', 'full_name', 'grade', 'points', 'streak', 'badge', 'avatar_url'])

    return response.ok({
      period: 'weekly',
      leaderboard: leaders.map((u, idx) => ({
        rank:      idx + 1,
        id:        u.id,
        name:      u.fullName,
        grade:     u.grade,
        points:    u.points,
        streak:    u.streak,
        badge:     u.badge,
        avatarUrl: u.avatarUrl,
      })),
    })
  }

  /** GET /api/v1/leaderboard/class/:grade — Leaderboard for a specific grade */
  async byGrade({ params, response }: HttpContext) {
    const grade   = decodeURIComponent(params.grade)
    const leaders = await User.query()
      .where('role', 'student')
      .where('grade', grade)
      .orderBy('points', 'desc')
      .limit(30)
      .select(['id', 'full_name', 'grade', 'points', 'streak', 'badge', 'avatar_url'])

    return response.ok({
      grade,
      leaderboard: leaders.map((u, idx) => ({
        rank:      idx + 1,
        id:        u.id,
        name:      u.fullName,
        points:    u.points,
        streak:    u.streak,
        badge:     u.badge,
        avatarUrl: u.avatarUrl,
      })),
    })
  }
}

