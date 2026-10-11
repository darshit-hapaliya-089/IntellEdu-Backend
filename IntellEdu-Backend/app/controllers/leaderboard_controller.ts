import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import { DateTime } from 'luxon'

/*
|--------------------------------------------------------------------------
| LeaderboardController
|--------------------------------------------------------------------------
*/
export default class LeaderboardController {

  /** GET /api/v1/leaderboard — Worldwide top 50 by XP points */
  async global({ response }: HttpContext) {
    const leaders = await User.query()
      .where('role', 'student')
      .orderBy('points', 'desc')
      .limit(50)
      .select(['id', 'full_name', 'grade', 'points', 'streak', 'badge', 'avatar_url'])

    return response.ok({
      scope: 'worldwide',
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

  /** GET /api/v1/leaderboard/friends [Protected] */
  async friends({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const relations = await db.from('user_friends')
      .where((query) => query.where('user_id', user.id).orWhere('friend_id', user.id))
      .select('user_id', 'friend_id')
    const friendIds = relations.map((relation) =>
      Number(relation.user_id) === user.id ? Number(relation.friend_id) : Number(relation.user_id)
    )
    const accountIds = [...new Set([user.id, ...friendIds])]
    const leaders = await User.query()
      .whereIn('id', accountIds)
      .where('role', 'student')
      .orderBy('points', 'desc')
      .orderBy('id', 'asc')
      .select(['id', 'full_name', 'grade', 'points', 'streak', 'badge', 'avatar_url'])
    const leaderboard = leaders.map((account, index) => ({
      rank: index + 1,
      id: account.id,
      name: account.fullName,
      grade: account.grade,
      points: account.points,
      streak: account.streak,
      badge: account.badge,
      avatarUrl: account.avatarUrl,
      isCurrentUser: account.id === user.id,
    }))
    return response.ok({
      scope: 'friends',
      currentUserRank: leaderboard.find((entry) => entry.isCurrentUser)?.rank ?? null,
      leaderboard,
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
