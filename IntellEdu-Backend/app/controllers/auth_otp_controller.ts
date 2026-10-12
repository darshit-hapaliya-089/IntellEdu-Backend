import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import AuthOtpChallenge from '#models/auth_otp_challenge'
import User from '#models/user'
import { changeXp } from '#services/xp_service'
import { EmailDeliveryError, sendOtpEmail } from '#services/email_service'
import env from '#start/env'
import vine from '@vinejs/vine'

const OTP_LIFETIME_SECONDS = 60
const OTP_RESEND_SECONDS = 45
const OTP_MAX_ATTEMPTS = 5
const OTP_SEND_LIMIT = 5
const OTP_SEND_WINDOW_MINUTES = 10
const OTP_DELIVERY_TIMEOUT_MS = 8000

function hashCode(challengeId: string, recipient: string, code: string): Buffer {
  return createHmac('sha256', env.get('APP_KEY'))
    .update(`${challengeId}:${recipient}:${code}`)
    .digest()
}

function makePhoneAccountEmail(phone: string): string {
  return `phone-${phone.replace(/\D/g, '')}@phone.intelledu.invalid`
}

function normalizePhoneNumber(value: string): string | null {
  const parsed = parsePhoneNumberFromString(value, 'IN')
  return parsed?.isValid() ? parsed.number : null
}

const validPhoneNumber = vine.createRule((value, _options, field) => {
  if (typeof value === 'string' && !normalizePhoneNumber(value)) {
    field.report(
      'Enter a valid phone number with its country code, for example +919876543210.',
      'phoneNumber',
      field
    )
  }
})

const validRecipient = vine.createRule((value, _options, field) => {
  if (typeof value !== 'string') return
  const isEmail = value.includes('@')
  const valid = isEmail
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    : Boolean(normalizePhoneNumber(value))
  if (!valid) {
    field.report(
      isEmail
        ? 'Enter a valid email address.'
        : 'Enter a valid phone number with its country code, for example +919876543210.',
      'validRecipient',
      field
    )
  }
})

const validEmailAddress = vine.createRule((value, _options, field) => {
  if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    field.report('Enter a valid email address.', 'email', field)
  }
})

function withDeliveryTimeout<T>(task: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('OTP delivery timed out. Please retry in a moment.')), OTP_DELIVERY_TIMEOUT_MS)
    task.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

async function sendSmsOtp(recipient: string, code: string): Promise<void> {
  const fast2smsKey = env.get('FAST2SMS_API_KEY')
  const twilioAccountSid = env.get('TWILIO_ACCOUNT_SID')
  const twilioAuthToken = env.get('TWILIO_AUTH_TOKEN')
  const twilioFromNumber = env.get('TWILIO_FROM_NUMBER')

  if (fast2smsKey) {
    const parsed = parsePhoneNumberFromString(recipient)
    if (parsed?.country !== 'IN') {
      throw new Error('SMS delivery is only configured for Indian phone numbers. Choose WhatsApp or email instead.')
    }
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: fast2smsKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        route: 'q',
        message: `Your IntellEdu OTP is ${code}. Valid 60 sec. Do not share. -IntellEdu`,
        language: 'english',
        flash: 0,
        numbers: parsed.nationalNumber,
      }),
      signal: AbortSignal.timeout(7000),
    })
    const body = await response.json() as { return?: boolean }
    if (!response.ok || !body.return) throw new Error('SMS provider rejected the request. Check your SMS provider configuration.')
    return
  }

  if (twilioAccountSid && twilioAuthToken && twilioFromNumber) {
    const form = new URLSearchParams({
      From: twilioFromNumber,
      To: recipient,
      Body: `Your IntellEdu OTP is ${code}. Valid 60 sec. Do not share. -IntellEdu`,
    })
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioAccountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
        signal: AbortSignal.timeout(7000),
      }
    )
    if (!response.ok) throw new Error('SMS provider rejected the request. Check your SMS provider configuration.')
    return
  }
  throw new Error('SMS is not configured. Choose WhatsApp or email, or configure an SMS provider.')
}

export default class AuthOtpController {
  /** POST /api/v1/auth/otp/send */
  async send({ request, response }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        channel: vine.enum(['email', 'phone', 'whatsapp'] as const),
        flow: vine.enum(['login', 'signup'] as const),
        recipient: vine.string().trim().maxLength(254).use(validRecipient()),
        fullName: vine.string().trim().minLength(2).maxLength(120).optional(),
        email: vine.string().trim().maxLength(254).use(validEmailAddress()).optional(),
        phone: vine.string().trim().maxLength(32).use(validPhoneNumber()).optional(),
        grade: vine.string().trim().maxLength(100).optional(),
      })
    )
    const data = await request.validateUsing(schema)
    const normalizedEmail = data.email?.trim().toLowerCase() || null
    const normalizedProfilePhone = data.phone ? normalizePhoneNumber(data.phone) : null
    const normalizedRecipient = data.channel === 'email'
      ? data.recipient.toLowerCase()
      : normalizePhoneNumber(data.recipient)

    if (data.channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedRecipient ?? '')) {
      return response.badRequest({ success: false, message: 'Enter a valid email address.' })
    }
    if (data.channel !== 'email' && !normalizedRecipient) {
      return response.badRequest({
        success: false,
        message: 'Enter a valid phone number with its country code, for example +919876543210.',
      })
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail ?? '')) {
      return response.badRequest({ success: false, message: 'Enter a valid email address for email fallback.' })
    }
    if (data.phone && !normalizedProfilePhone) {
      return response.badRequest({
        success: false,
        message: 'Enter a valid phone number. Choose its country in the phone selector and enter the local number.',
      })
    }
    const recipient = normalizedRecipient ?? ''

    let existingUser: User | null = null
    if (data.flow === 'signup') {
      if (!data.fullName || !data.grade) {
        return response.badRequest({ success: false, message: 'Enter your name and grade before requesting a signup code.' })
      }
      if (data.channel !== 'email' && normalizedProfilePhone && normalizedProfilePhone !== recipient) {
        return response.badRequest({ success: false, message: 'Verify the same phone number entered in your profile.' })
      }
      if (data.channel === 'email' && normalizedEmail !== recipient) {
        return response.badRequest({ success: false, message: 'Verify the same email address entered in your profile.' })
      }

      const duplicate = data.channel === 'email'
        ? await User.findBy('email', recipient)
        : await User.findBy('phone', recipient)
      if (duplicate) {
        return response.conflict({ success: false, message: 'An account with this verified contact already exists. Sign in instead.' })
      }

      if (data.channel !== 'email' && normalizedEmail) {
        const emailOwner = await User.findBy('email', normalizedEmail)
        if (emailOwner) {
          return response.conflict({ success: false, message: 'This email already belongs to another account.' })
        }
      }
      if (data.channel === 'email' && normalizedProfilePhone) {
        const phoneOwner = await User.findBy('phone', normalizedProfilePhone)
        if (phoneOwner) {
          return response.conflict({ success: false, message: 'This phone number already belongs to another account.' })
        }
      }
    } else {
      existingUser = data.channel === 'email'
        ? await User.findBy('email', recipient)
        : await User.findBy('phone', recipient)
      if (!existingUser) {
        return response.badRequest({
          success: false,
          message: 'No IntellEdu account is registered with this email or phone number. Create an account first, then request a login OTP.',
        })
      }
    }

    const now = DateTime.now()
    const windowStart = now.minus({ minutes: OTP_SEND_WINDOW_MINUTES })
    const latest = await AuthOtpChallenge.query()
      .where((query) => query
        .where('recipient', recipient)
        .orWhere('email', recipient)
        .orWhere('phone', recipient))
      .orderBy('created_at', 'desc')
      .first()

    if (latest && latest.sentAt.plus({ seconds: OTP_RESEND_SECONDS }) > now) {
      const retryAfterSeconds = Math.ceil(latest.sentAt.plus({ seconds: OTP_RESEND_SECONDS }).diff(now, 'seconds').seconds)
      return response.status(429).send({
        success: false,
        message: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
        retryAfterSeconds,
      })
    }

    const sentInWindow = await AuthOtpChallenge.query()
      .where((query) => query
        .where('recipient', recipient)
        .orWhere('email', recipient)
        .orWhere('phone', recipient))
      .where('created_at', '>', windowStart.toSQL()!)
      .count('* as total')
    const sends = Number(sentInWindow[0].$extras.total)
    if (sends >= OTP_SEND_LIMIT) {
      return response.status(429).send({
        success: false,
        message: 'Too many codes were requested for this contact. Try again in 10 minutes.',
      })
    }

    let emailFallbackRecipient: string | null = null
    if (data.channel === 'whatsapp') {
      if (data.flow === 'signup') {
        emailFallbackRecipient = normalizedEmail
      } else if (existingUser?.email && !existingUser.email.endsWith('@phone.intelledu.invalid')) {
        emailFallbackRecipient = existingUser.email
      }
    }

    let whatsappService: typeof import('#services/whatsapp_service').whatsappService | null = null
    let whatsappReady = false
    if (data.channel === 'whatsapp' && env.get('WHATSAPP_ENABLED')?.toLowerCase() === 'true') {
      try {
        const service = await import('#services/whatsapp_service')
        whatsappService = service.whatsappService
        whatsappReady = whatsappService.isConnected()
      } catch {
        console.warn('[WhatsApp] Service unavailable; using email fallback when configured.')
      }
    }
    if (data.channel === 'whatsapp' && !whatsappReady && !emailFallbackRecipient) {
      return response.status(503).send({
        success: false,
        channel: null,
        message: 'WhatsApp OTP is unavailable. Enter an email address for fallback or choose Email OTP.',
      })
    }

    const challengeId = randomUUID()
    const code = randomInt(100000, 1000000).toString()
    const challenge = await AuthOtpChallenge.create({
      id: challengeId,
      recipient,
      channel: data.channel,
      flow: data.flow,
      codeHash: hashCode(challengeId, recipient, code).toString('hex'),
      expiresAt: now.plus({ seconds: OTP_LIFETIME_SECONDS }),
      sentAt: now,
      windowStartedAt: latest && latest.windowStartedAt > windowStart ? latest.windowStartedAt : now,
      sendsInWindow: sends + 1,
      attempts: 0,
      fullName: data.flow === 'signup' ? data.fullName ?? null : null,
      email: data.flow === 'signup'
        ? normalizedEmail ?? (data.channel === 'email' ? recipient : null)
        : emailFallbackRecipient,
      phone: data.flow === 'signup'
        ? normalizedProfilePhone ?? (data.channel !== 'email' ? recipient : null)
        : data.channel !== 'email' ? recipient : null,
      grade: data.flow === 'signup' ? data.grade ?? null : null,
      emailFallback: false,
      deliveryStatus: 'pending',
      deliveryError: null,
    })

    let deliveryChannel: 'email' | 'phone' | 'whatsapp' = data.channel
    try {
      if (data.channel === 'email') {
        await withDeliveryTimeout(sendOtpEmail(recipient, code))
      } else if (data.channel === 'whatsapp') {
        const deliveryTasks: Array<Promise<'whatsapp' | 'email'>> = []
        if (whatsappReady && whatsappService) {
          deliveryTasks.push(withDeliveryTimeout(whatsappService.sendOtpMessage(recipient, code).then((sent) => {
            if (!sent) throw new Error('WhatsApp delivery is currently unavailable.')
            return 'whatsapp' as const
          })))
        }
        if (emailFallbackRecipient) {
          deliveryTasks.push(withDeliveryTimeout(sendOtpEmail(emailFallbackRecipient, code).then(() => 'email' as const)))
        }

        const outcomes = await Promise.allSettled(deliveryTasks)
        const successfulChannels = outcomes.flatMap((outcome) =>
          outcome.status === 'fulfilled' ? [outcome.value] : []
        )
        const whatsappSent = successfulChannels.includes('whatsapp')
        if (!whatsappSent && !successfulChannels.includes('email')) {
          const failure = outcomes.find(
            (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected'
          )
          if (failure?.reason instanceof Error) throw failure.reason
          throw new Error('Neither WhatsApp nor email could deliver this OTP.')
        }

        if (whatsappSent) {
          deliveryChannel = 'whatsapp'
        } else {
          deliveryChannel = 'email'
          challenge.emailFallback = true
        }
      } else {
        await withDeliveryTimeout(sendSmsOtp(recipient, code))
      }

      challenge.expiresAt = DateTime.now().plus({ seconds: OTP_LIFETIME_SECONDS })
      challenge.deliveryStatus = 'sent'
      challenge.deliveryError = null
      await challenge.save()
    } catch (error) {
      const message = error instanceof EmailDeliveryError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'OTP delivery failed. Please retry in a moment.'
      challenge.deliveryStatus = 'failed'
      challenge.deliveryError = message
      await challenge.save()
      console.warn(`[OTP] ${data.channel} delivery failed.`)
      const statusCode = error instanceof EmailDeliveryError ? error.statusCode : 502
      return response.status(statusCode).send({
        success: false,
        channel: null,
        message,
      })
    }

    return response.ok({
      success: true,
      challengeId,
      channel: deliveryChannel,
      expiresInSeconds: OTP_LIFETIME_SECONDS,
      expiresAt: challenge.expiresAt.toISO()!,
      message: deliveryChannel === 'email' && data.channel === 'whatsapp'
        ? 'WhatsApp is unavailable. A 6-digit OTP was sent via email.'
        : `A 6-digit OTP was sent via ${deliveryChannel === 'whatsapp' ? 'WhatsApp' : deliveryChannel === 'email' ? 'email' : 'SMS'}.`,
    })
  }

  /** POST /api/v1/auth/otp/verify */
  async verify({ request, response }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        challengeId: vine.string().trim().minLength(36).maxLength(36),
        code: vine.string().trim().regex(/^\d{6}$/),
        password: vine.string().minLength(6).optional(),
      })
    )
    const { challengeId, code, password } = await request.validateUsing(schema)
    const challenge = await AuthOtpChallenge.find(challengeId)

    if (!challenge || challenge.consumedAt) {
      return response.badRequest({ message: 'This verification code is invalid or has already been used.' })
    }
    if (challenge.deliveryStatus === 'pending') {
      return response.status(503).send({ message: 'OTP delivery is still processing. Wait a moment and try again.' })
    }
    if (challenge.deliveryStatus === 'failed') {
      return response.status(502).send({
        message: challenge.deliveryError || 'OTP delivery failed. Request a new code and try again.',
      })
    }
    if (challenge.expiresAt.toMillis() <= DateTime.now().toMillis()) {
      return response.status(410).send({ message: 'This code expired. Request a new 6-digit code.' })
    }
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      return response.status(429).send({ message: 'Too many incorrect codes. Request a new code in 60 seconds.' })
    }

    const expectedHash = Buffer.from(challenge.codeHash, 'hex')
    const submittedHash = hashCode(challenge.id, challenge.recipient, code)
    if (expectedHash.length !== submittedHash.length || !timingSafeEqual(expectedHash, submittedHash)) {
      challenge.attempts += 1
      await challenge.save()
      const attemptsRemaining = OTP_MAX_ATTEMPTS - challenge.attempts
      return response.status(challenge.attempts >= OTP_MAX_ATTEMPTS ? 429 : 400).send({
        message: attemptsRemaining > 0
          ? `Incorrect code. ${attemptsRemaining} attempts remaining.`
          : 'Too many incorrect codes. Request a new code in 60 seconds.',
      })
    }

    if (challenge.flow === 'signup') {
      if (!password || !challenge.fullName || !challenge.grade) {
        return response.badRequest({ message: 'Signup details are missing. Please request a new code.' })
      }

      const email = challenge.email || makePhoneAccountEmail(challenge.recipient)
      const duplicateEmail = await User.findBy('email', email)
      if (duplicateEmail) {
        return response.conflict({ message: 'This email already belongs to another account.' })
      }
      const phone = challenge.phone
      if (phone && await User.findBy('phone', phone)) {
        return response.conflict({ message: 'This phone number already belongs to an account.' })
      }

      const user = await User.create({
        fullName: challenge.fullName,
        email,
        emailVerified: (challenge.channel === 'email' && email === challenge.recipient) || challenge.emailFallback,
        phone,
        phoneVerified: !challenge.emailFallback && (challenge.channel === 'phone' || challenge.channel === 'whatsapp') && phone === challenge.recipient,
        password,
        grade: challenge.grade,
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
      challenge.consumedAt = DateTime.now()
      await challenge.save()
      return this.issueSession(user, response, 'Account created and contact verified.')
    }

    const user = challenge.channel === 'email'
      ? await User.findBy('email', challenge.recipient)
      : await User.findBy('phone', challenge.recipient)
    if (!user) {
      return response.notFound({ message: 'No account was found for this verified contact.' })
    }

    if (challenge.channel === 'email' || challenge.emailFallback) user.emailVerified = true
    if (challenge.channel !== 'email' && !challenge.emailFallback) user.phoneVerified = true
    challenge.consumedAt = DateTime.now()
    await user.save()
    await challenge.save()
    return this.issueSession(user, response, 'Verification successful. You are signed in.')
  }

  private async issueSession(user: User, response: HttpContext['response'], message: string) {
    const token = await User.accessTokens.create(user)
    return response.ok({
      message,
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
}
