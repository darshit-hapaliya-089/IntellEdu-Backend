import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import User from '#models/user'
import vine from '@vinejs/vine'

/*
|--------------------------------------------------------------------------
| AuthController
|--------------------------------------------------------------------------
| Handles registration, login, logout and profile management.
*/
export default class AuthController {

  /*
  |──────────────────────────────────────────────────────────────────────────
  | POST /api/v1/auth/register
  |──────────────────────────────────────────────────────────────────────────
  */
  async register({ request, response }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        fullName:  vine.string().trim().minLength(2),
        email:     vine.string().trim().email(),
        phone:     vine.string().optional(),
        password:  vine.string().minLength(6),
        grade:     vine.string().trim(),
      })
    )

    const data = await request.validateUsing(schema)

    // Check for duplicate email
    const existing = await User.findBy('email', data.email)
    if (existing) {
      return response.conflict({ message: 'An account with this email already exists.' })
    }

    const user = await User.create({
      fullName:  data.fullName,
      email:     data.email,
      phone:     data.phone ?? null,
      password:  data.password,
      grade:     data.grade,
      role:      'student',
      points:    100,   // welcome bonus XP
      streak:    1,
      badge:     '🌟 Newcomer',
      lastActiveDate: DateTime.now(),
    })

    const token = await User.accessTokens.create(user)

    return response.created({
      message: 'Account created successfully! Welcome to IntellEdu.',
      token:   token.value!.release(),
      user: {
        id:       user.id,
        fullName: user.fullName,
        email:    user.email,
        grade:    user.grade,
        points:   user.points,
        streak:   user.streak,
        badge:    user.badge,
        role:     user.role,
        avatarUrl: user.avatarUrl,
      },
    })
  }

  /*
  |──────────────────────────────────────────────────────────────────────────
  | POST /api/v1/auth/login
  |──────────────────────────────────────────────────────────────────────────
  */
  async login({ request, response }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        email:    vine.string().trim().email(),
        password: vine.string(),
      })
    )

    const { email, password } = await request.validateUsing(schema)

    const user = await User.verifyCredentials(email, password)

    // Update streak logic
    const today = DateTime.now().toISODate()
    const lastActive = user.lastActiveDate?.toISODate?.() ?? null

    if (lastActive !== today) {
      const yesterday = DateTime.now().minus({ days: 1 }).toISODate()
      const newStreak  = lastActive === yesterday ? user.streak + 1 : 1
      await user.merge({ streak: newStreak, lastActiveDate: DateTime.now() }).save()
    }

    const token = await User.accessTokens.create(user)

    return response.ok({
      message: 'Login successful! Welcome back.',
      token:   token.value!.release(),
      user: {
        id:        user.id,
        fullName:  user.fullName,
        email:     user.email,
        grade:     user.grade,
        points:    user.points,
        streak:    user.streak,
        badge:     user.badge,
        role:      user.role,
        avatarUrl: user.avatarUrl,
      },
    })
  }

  /*
  |──────────────────────────────────────────────────────────────────────────
  | POST /api/v1/auth/logout   [Protected]
  |──────────────────────────────────────────────────────────────────────────
  */
  async logout({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await User.accessTokens.delete(user, auth.user!.currentAccessToken.identifier)
    return response.ok({ message: 'Logged out successfully.' })
  }

  /*
  |──────────────────────────────────────────────────────────────────────────
  | GET /api/v1/auth/me   [Protected]
  |──────────────────────────────────────────────────────────────────────────
  */
  async me({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await user.load('courses')

    return response.ok({
      user: {
        id:          user.id,
        fullName:    user.fullName,
        email:       user.email,
        phone:       user.phone,
        grade:       user.grade,
        role:        user.role,
        avatarUrl:   user.avatarUrl,
        points:      user.points,
        streak:      user.streak,
        badge:       user.badge,
        coursesCount: user.courses?.length ?? 0,
        createdAt:   user.createdAt,
      },
    })
  }

  /*
  |──────────────────────────────────────────────────────────────────────────
  | PUT /api/v1/auth/me   [Protected]
  |──────────────────────────────────────────────────────────────────────────
  */
  async updateProfile({ auth, request, response }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        fullName:  vine.string().trim().optional(),
        phone:     vine.string().trim().optional(),
        grade:     vine.string().trim().optional(),
        avatarUrl: vine.string().url().optional(),
      })
    )

    const data = await request.validateUsing(schema)
    const user = auth.getUserOrFail()
    await user.merge(data).save()

    return response.ok({ message: 'Profile updated successfully.', user })
  }
}

