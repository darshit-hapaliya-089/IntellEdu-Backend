import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'

export default class FriendsController {
  /** GET /api/v1/friends [Protected] */
  async index({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const relations = await db.from('user_friends')
      .where((query) => query.where('user_id', user.id).orWhere('friend_id', user.id))
      .select('user_id', 'friend_id')
    const friendIds = relations.map((relation) =>
      Number(relation.user_id) === user.id ? Number(relation.friend_id) : Number(relation.user_id)
    )

    const selectColumns = ['id', 'full_name', 'grade', 'points', 'streak', 'badge', 'avatar_url'] as const
    const friends = friendIds.length
      ? await User.query().whereIn('id', friendIds).where('role', 'student').select([...selectColumns])
      : []
    const suggestionsQuery = User.query()
      .where('role', 'student')
      .whereNot('id', user.id)
      .orderBy('points', 'desc')
      .limit(20)
      .select([...selectColumns])
    if (friendIds.length) suggestionsQuery.whereNotIn('id', friendIds)
    const suggestions = await suggestionsQuery

    const serialize = (account: User) => ({
      id: account.id,
      name: account.fullName,
      grade: account.grade,
      points: account.points,
      streak: account.streak,
      badge: account.badge,
      avatarUrl: account.avatarUrl,
    })
    return response.ok({
      friends: friends.map(serialize),
      suggestions: suggestions.map(serialize),
    })
  }

  /** POST /api/v1/friends/:id [Protected] */
  async store({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const friendId = Number(params.id)
    if (!Number.isSafeInteger(friendId) || friendId < 1 || friendId === user.id) {
      return response.badRequest({ message: 'Choose a valid student account to add.' })
    }

    const friend = await User.query().where('id', friendId).where('role', 'student').first()
    if (!friend) return response.notFound({ message: 'Student account not found.' })

    const [userId, otherId] = user.id < friend.id
      ? [user.id, friend.id]
      : [friend.id, user.id]
    const alreadyFriends = await db.from('user_friends')
      .where('user_id', userId)
      .where('friend_id', otherId)
      .first()
    if (alreadyFriends) return response.conflict({ message: 'This student is already your friend.' })

    await db.table('user_friends').insert({ user_id: userId, friend_id: otherId })
    return response.created({ message: `${friend.fullName} was added to your friends.` })
  }

  /** DELETE /api/v1/friends/:id [Protected] */
  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const friendId = Number(params.id)
    if (!Number.isSafeInteger(friendId) || friendId < 1 || friendId === user.id) {
      return response.badRequest({ message: 'Choose a valid student account to remove.' })
    }

    const [userId, otherId] = user.id < friendId
      ? [user.id, friendId]
      : [friendId, user.id]
    await db.from('user_friends')
      .where('user_id', userId)
      .where('friend_id', otherId)
      .delete()
    return response.ok({ message: 'Friend removed.' })
  }
}
