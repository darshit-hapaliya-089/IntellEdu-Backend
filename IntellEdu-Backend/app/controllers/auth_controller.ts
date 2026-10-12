import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { randomBytes } from 'node:crypto'
import User from '#models/user'
import { changeXp } from '#services/xp_service'
import hash from '@adonisjs/core/services/hash'
import env from '#start/env'
import vine from '@vinejs/vine'
import { parsePhoneNumberFromString } from 'libphonenumber-js'

const PHONE_FIREBASE_RATE_LIMIT = 10
const PHONE_FIREBASE_RATE_WINDOW_MS = 10 * 60 * 1000
const phoneFirebaseRequests = new Map<string, number[]>()

type FirebaseLookupResponse = {
  users?: Array<{
    localId: string
    phoneNumber?: string
    providerUserInfo?: Array<{ providerId: string }>
  }>
}

function isPhoneFirebaseRateLimited(ip: string, now: number): boolean {
  const recentRequests = (phoneFirebaseRequests.get(ip) ?? [])
    .filter((timestamp) => now - timestamp < PHONE_FIREBASE_RATE_WINDOW_MS)
  if (recentRequests.length >= PHONE_FIREBASE_RATE_LIMIT) {
    phoneFirebaseRequests.set(ip, recentRequests)
    return true
  }

  recentRequests.push(now)
  phoneFirebaseRequests.set(ip, recentRequests)
  if (phoneFirebaseRequests.size > 5000) {
    for (const [address, timestamps] of phoneFirebaseRequests) {
      if (!timestamps.some((timestamp) => now - timestamp < PHONE_FIREBASE_RATE_WINDOW_MS)) {
        phoneFirebaseRequests.delete(address)
      }
    }
  }
  return false
}

function firebaseTokenMatchesProject(idToken: string, projectId: string): boolean {
  try {
    const payload = idToken.split('.')[1]
    if (!payload) return false
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { aud?: unknown }
    return claims.aud === projectId
  } catch {
    return false
  }
}

/*
|--------------------------------------------------------------------------
| AuthController
|--------------------------------------------------------------------------
| Handles registration, login, logout and profile management.
*/
export default class AuthController {

  /** GET /api/v1/auth/channels */
  async channels({ response }: HttpContext) {
    const provider = env.get('EMAIL_PROVIDER') || 'brevo'
    const email = provider === 'brevo'
      ? Boolean(env.get('BREVO_API_KEY') && env.get('EMAIL_FROM'))
      : provider === 'smtp' &&
        env.get('NODE_ENV') !== 'production' &&
        Boolean(env.get('SMTP_HOST') && env.get('SMTP_PORT') && env.get('SMTP_USER') && env.get('SMTP_PASS'))

    return response.ok({ email, sms: Boolean(env.get('FIREBASE_API_KEY')) })
  }

  /** POST /api/v1/auth/phone/firebase-verify */
  async phoneFirebaseVerify({ request, response }: HttpContext) {
    if (isPhoneFirebaseRateLimited(request.ip(), Date.now())) {
      return response.tooManyRequests({ message: 'Too many verification attempts. Please wait 10 minutes and try again.' })
    }

    const schema = vine.compile(
      vine.object({
        idToken: vine.string().trim().minLength(20),
        mode: vine.enum(['login', 'signup'] as const),
        fullName: vine.string().trim().minLength(2).maxLength(120).optional(),
        grade: vine.string().trim().minLength(1).maxLength(100).optional(),
        email: vine.string().trim().email().maxLength(254).optional(),
        password: vine.string().minLength(6).maxLength(100).optional(),
      })
    )
    const data = await request.validateUsing(schema)
    if (data.mode === 'signup' && (!data.fullName || !data.grade || !data.password)) {
      return response.badRequest({ message: 'Enter your name, grade, and a password of at least 6 characters to sign up.' })
    }

    const apiKey = env.get('FIREBASE_API_KEY')
    if (!apiKey) {
      return response.status(503).send({ message: 'Phone verification is not configured. Contact the administrator.' })
    }

    let lookupResponse: Response
    const abortController = new AbortController()
    const lookupTimeout = setTimeout(() => abortController.abort(), 8000)
    let identity: FirebaseLookupResponse | null = null
    let invalidLookupResponse = false
    try {
      lookupResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: data.idToken }),
          signal: abortController.signal,
        }
      )
      if (lookupResponse.ok) {
        try {
          identity = await lookupResponse.json() as FirebaseLookupResponse
        } catch {
          invalidLookupResponse = true
        }
      }
    } catch {
      return response.status(502).send({ message: 'Could not verify the phone identity with Firebase. Please retry.' })
    } finally {
      clearTimeout(lookupTimeout)
    }

    if (!lookupResponse.ok) {
      if (lookupResponse.status === 400 || lookupResponse.status === 401) {
        return response.unauthorized({ message: 'Phone verification expired or is invalid. Request a new SMS code.' })
      }
      if (lookupResponse.status === 403) {
        return response.status(503).send({ message: 'Firebase phone verification is misconfigured. Check the backend API key.' })
      }
      if (lookupResponse.status === 429) {
        return response.tooManyRequests({ message: 'Firebase is temporarily limiting verification requests. Please try again later.' })
      }
      return response.status(502).send({ message: 'Firebase could not verify this phone identity. Please retry.' })
    }

    if (invalidLookupResponse || !identity) {
      return response.status(502).send({ message: 'Firebase returned an invalid verification response. Please retry.' })
    }

    const firebaseUser = identity.users?.[0]
    const isPhoneIdentity = firebaseUser?.providerUserInfo?.some((provider) => provider.providerId === 'phone')
    const parsedPhone = firebaseUser?.phoneNumber
      ? parsePhoneNumberFromString(firebaseUser.phoneNumber)
      : undefined
    if (!firebaseUser || !isPhoneIdentity || !parsedPhone?.isValid()) {
      return response.unauthorized({ message: 'Firebase did not confirm a valid phone number for this account.' })
    }

    const projectId = env.get('FIREBASE_PROJECT_ID')
    if (projectId && !firebaseTokenMatchesProject(data.idToken, projectId)) {
      return response.unauthorized({ message: 'This phone verification belongs to a different Firebase project.' })
    }

    const phone = parsedPhone.number
    const email = data.email?.trim().toLowerCase() || `phone-${firebaseUser.localId}@phone.intelledu.invalid`
    let user = await User.findBy('phone', phone)

    if (data.mode === 'login') {
      if (!user) {
        return response.notFound({ message: 'No account uses this verified phone number. Sign up first.' })
      }
      user.phoneVerified = true
      await user.save()
    } else {
      if (user) {
        return response.conflict({ message: 'An account with this phone number already exists. Sign in instead.' })
      }
      if (await User.findBy('email', email)) {
        return response.conflict({
          message: data.email
            ? 'This email address already belongs to another account.'
            : 'An account with this verified phone identity already exists. Sign in instead.',
        })
      }

      user = await User.create({
        fullName: data.fullName!,
        email,
        emailVerified: false,
        phone,
        phoneVerified: true,
        password: data.password!,
        grade: data.grade!,
        role: 'student',
        points: 0,
        streak: 1,
        badge: '🌟 Newcomer',
        lastActiveDate: DateTime.now(),
      })
      const initialXp = await changeXp({
        userId: user.id,
        amount: 100,
        reason: 'new_account_bonus',
        sourceKey: `signup:${user.id}`,
      })
      user.points = initialXp.balance
    }

    const token = await User.accessTokens.create(user)
    return response.ok({
      message: data.mode === 'signup' ? 'Account created and phone verified.' : 'Phone verified. Login successful.',
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
