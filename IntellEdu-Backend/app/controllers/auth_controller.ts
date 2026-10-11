import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { randomBytes } from 'node:crypto'
import User from '#models/user'
import { changeXp } from '#services/xp_service'
import hash from '@adonisjs/core/services/hash'
import env from '#start/env'
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
    if (!user.emailVerified) {
      return response.forbidden({ message: 'Verify your email with the 6-digit OTP before signing in.' })
    }

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

  /** POST /api/v1/auth/firebase */
  async firebase({ request, response }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        idToken: vine.string().trim().minLength(20),
        mode: vine.enum(['login', 'signup'] as const),
        fullName: vine.string().trim().minLength(2).optional(),
        grade: vine.string().trim().optional(),
      })
    )
    const data = await request.validateUsing(schema)
    const apiKey = env.get('FIREBASE_API_KEY')

    if (!apiKey) {
      return response.status(503).send({ message: 'Firebase authentication is not configured.' })
    }

    let lookupResponse: Response
    try {
      lookupResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: data.idToken }),
          signal: AbortSignal.timeout(10000),
        }
      )
    } catch {
      return response.status(502).send({ message: 'Could not verify the Firebase identity.' })
    }

    if (!lookupResponse.ok) {
      return response.unauthorized({ message: 'Firebase identity token is invalid or expired.' })
    }

    const identity = (await lookupResponse.json()) as {
      users?: Array<{
        localId: string
        email?: string
        emailVerified?: boolean
        displayName?: string
        phoneNumber?: string
        photoUrl?: string
        providerUserInfo?: Array<{ providerId: string }>
      }>
    }
    const firebaseUser = identity.users?.[0]
    const providerIds = firebaseUser?.providerUserInfo?.map((provider) => provider.providerId) ?? []
    const isGoogleIdentity = providerIds.includes('google.com')
    const isPhoneIdentity = providerIds.includes('phone')

    if (
      !firebaseUser ||
      (!isGoogleIdentity && !isPhoneIdentity) ||
      (isGoogleIdentity && (!firebaseUser.email || !firebaseUser.emailVerified)) ||
      (isPhoneIdentity && !firebaseUser.phoneNumber)
    ) {
      return response.unauthorized({ message: 'Use a verified Google account or phone number.' })
    }

    const email = firebaseUser.email?.toLowerCase() ?? `phone-${firebaseUser.localId}@phone.intelledu.invalid`
    let user = firebaseUser.phoneNumber ? await User.findBy('phone', firebaseUser.phoneNumber) : null
    user ??= firebaseUser.email ? await User.findBy('email', email) : null

    if (user && data.mode === 'signup') {
      return response.conflict({ message: 'An account with this verified identity already exists.' })
    }
    if (!user && data.mode === 'login') {
      return response.notFound({ message: 'No IntellEdu account is linked to this verified identity. Sign up first.' })
    }

    if (!user) {
      user = await User.create({
        fullName: data.fullName || firebaseUser.displayName || 'Student',
        email,
        emailVerified: isGoogleIdentity,
        phone: firebaseUser.phoneNumber ?? null,
        phoneVerified: isPhoneIdentity,
        password: randomBytes(32).toString('hex'),
        grade: data.grade || 'Class 10 Science',
        role: 'student',
        points: 0,
        streak: 1,
        badge: '🌟 Newcomer',
        lastActiveDate: DateTime.now(),
        avatarUrl: firebaseUser.photoUrl ?? null,
      })
      const initialXp = await changeXp({
        userId: user.id,
        amount: 100,
        reason: 'new_account_bonus',
        sourceKey: `signup:${user.id}`,
      })
      user.points = initialXp.balance
    } else {
      if (isGoogleIdentity) user.emailVerified = true
      if (isPhoneIdentity) user.phoneVerified = true
      await user.save()
    }

    const token = await User.accessTokens.create(user)
    return response.ok({
      message: data.mode === 'signup' ? 'Account created successfully.' : 'Login successful.',
      token: token.value!.release(),
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        grade: user.grade,
        points: user.points,
        streak: user.streak,
        badge: user.badge,
        role: user.role,
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

  async updatePassword({ auth, request, response }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        currentPassword: vine.string().minLength(1),
        newPassword: vine.string().minLength(6).maxLength(128),
      })
    )
    const { currentPassword, newPassword } = await request.validateUsing(schema)
    const user = auth.getUserOrFail()
    const currentPasswordValid = await hash.use('scrypt').verify(user.password, currentPassword)

    if (!currentPasswordValid) {
      return response.badRequest({ message: 'Current password is incorrect.' })
    }

    user.password = newPassword
    await user.save()
    return response.ok({ message: 'Password updated successfully.' })
  }
}
