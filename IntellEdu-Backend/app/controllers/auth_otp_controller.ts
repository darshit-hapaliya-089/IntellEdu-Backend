import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import nodemailer from 'nodemailer'
import app from '@adonisjs/core/services/app'
import AuthOtpChallenge from '#models/auth_otp_challenge'
import User from '#models/user'
import { changeXp } from '#services/xp_service'
import env from '#start/env'
import vine from '@vinejs/vine'

const OTP_LIFETIME_SECONDS = 60
const OTP_RESEND_SECONDS = 60
const OTP_MAX_ATTEMPTS = 5
const OTP_SEND_LIMIT = 3
const OTP_SEND_WINDOW_MINUTES = 15

function hashCode(challengeId: string, recipient: string, code: string): Buffer {
  return createHmac('sha256', env.get('APP_KEY'))
    .update(`${challengeId}:${recipient}:${code}`)
    .digest()
}

function makePhoneAccountEmail(phone: string): string {
  return `phone-${phone.replace(/\D/g, '')}@phone.intelledu.invalid`
}

function hasEmailOtpSettings(): boolean {
  return Boolean(env.get('SMTP_HOST') && env.get('SMTP_PORT') && env.get('SMTP_USER') && env.get('SMTP_PASS'))
}

async function sendEmailOtp(recipient: string, code: string): Promise<void> {
  const host = env.get('SMTP_HOST')
  const port = env.get('SMTP_PORT') || 465
  const user = env.get('SMTP_USER')
  const pass = env.get('SMTP_PASS')
  if (!host || !user || !pass) throw new Error('Email OTP is not configured.')

  const from = env.get('SMTP_FROM_EMAIL') || user
  const mailer = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: pass.replace(/\s+/g, '') },
  })
  await mailer.sendMail({
    from: `"IntellEdu" <${from}>`,
    replyTo: from,
    to: recipient,
    subject: `${code} is your IntellEdu verification code`,
    text: `Your IntellEdu verification code is ${code}. The six-digit code is shown by itself below. Select only those six digits to copy. It expires in 60 seconds. Do not share it with anyone.\n\n${code}\n\nIntellEdu`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8faff;border-radius:16px;border:1px solid #e0e7ff;color:#1e293b;">
        <div style="text-align:center;margin-bottom:24px;">
          <img src="cid:intelledu-logo" alt="IntellEdu" width="96" height="96" style="display:block;margin:0 auto 12px;border-radius:22px;" />
          <h2 style="color:#4f46e5;margin:0;">IntellEdu Verification</h2>
        </div>
        <p style="color:#475569;margin:0 0 24px;font-size:14px;text-align:center;">Enter the code below to verify your account.</p>
        <div style="background:#ffffff;border:2px solid #6366f1;border-radius:12px;padding:24px;text-align:center;">
          <span style="display:inline-block;font-family:monospace;font-size:36px;font-weight:900;letter-spacing:8px;color:#1e1b4b;-webkit-user-select:all;user-select:all;">${code}</span>
        </div>
        <p style="color:#64748b;font-size:12px;margin:12px 0 0;text-align:center;">Select only the six digits above to copy the OTP.</p>
        <p style="color:#64748b;font-size:12px;margin:20px 0 0;text-align:center;">This code expires in <strong>60 seconds</strong>. Never share this code with anyone.</p>
        <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;text-align:center;">IntellEdu · Smarter Learning for a Brighter Future</p>
      </div>
    `,
    attachments: [{
      filename: 'intelledu-logo.png',
      path: app.makePath('public/intelledu-logo.png'),
      cid: 'intelledu-logo',
    }],
  })
}

export default class AuthOtpController {
  /** POST /api/v1/auth/otp/send */
  async send({ request, response }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        channel: vine.enum(['email', 'phone', 'whatsapp'] as const),
        flow: vine.enum(['login', 'signup'] as const),
        recipient: vine.string().trim().maxLength(254),
        fullName: vine.string().trim().minLength(2).maxLength(120).optional(),
        email: vine.string().trim().email().maxLength(254).optional(),
        phone: vine.string().trim().regex(/^\+[1-9]\d{7,14}$/).optional(),
        grade: vine.string().trim().maxLength(100).optional(),
      })
    )
    const data = await request.validateUsing(schema)
    const recipient = data.channel === 'email' ? data.recipient.toLowerCase() : data.recipient

    if (
      (data.channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) ||
      ((data.channel === 'phone' || data.channel === 'whatsapp') && !/^\+[1-9]\d{7,14}$/.test(recipient))
    ) {
      return response.badRequest({
        message: data.channel === 'email'
          ? 'Enter a valid email address.'
          : 'Enter a phone number in international format, for example +919876543210.',
      })
    }

    if (data.flow === 'signup') {
      if (!data.fullName || !data.grade) {
        return response.badRequest({ message: 'Enter your name and grade before requesting a signup code.' })
      }
      if ((data.channel === 'phone' || data.channel === 'whatsapp') && data.phone && data.phone !== recipient) {
        return response.badRequest({ message: 'Verify the same phone number entered in your profile.' })
      }
      if (data.channel === 'email' && data.email?.toLowerCase() !== recipient) {
        return response.badRequest({ message: 'Verify the same email address entered in your profile.' })
      }

      const duplicate = data.channel === 'email'
        ? await User.findBy('email', recipient)
        : await User.findBy('phone', recipient)
      if (duplicate) {
        return response.conflict({ message: 'An account with this verified contact already exists. Sign in instead.' })
      }

      if (data.channel === 'phone' && data.email) {
        const emailOwner = await User.findBy('email', data.email.toLowerCase())
        if (emailOwner) {
          return response.conflict({ message: 'This email already belongs to another account.' })
        }
      }
      if (data.channel === 'email' && data.phone) {
        const phoneOwner = await User.findBy('phone', data.phone)
        if (phoneOwner) {
          return response.conflict({ message: 'This phone number already belongs to another account.' })
        }
      }
    } else {
      const existing = data.channel === 'email'
        ? await User.findBy('email', recipient)
        : await User.findBy('phone', recipient)
      if (!existing) {
        return response.badRequest({
          message: 'No IntellEdu account is registered with this email or phone number. Create an account first, then request a login OTP.',
        })
      }
    }

    const now = DateTime.now()
    const windowStart = now.minus({ minutes: OTP_SEND_WINDOW_MINUTES })
    await AuthOtpChallenge.query().where('created_at', '<', now.minus({ days: 1 }).toSQL()!).delete()
    const latest = await AuthOtpChallenge.query()
      .where('channel', data.channel)
      .where('recipient', recipient)
      .orderBy('created_at', 'desc')
      .first()

    if (latest && latest.sentAt.plus({ seconds: OTP_RESEND_SECONDS }) > now) {
      const retryAfterSeconds = Math.ceil(latest.sentAt.plus({ seconds: OTP_RESEND_SECONDS }).diff(now, 'seconds').seconds)
      return response.status(429).send({
        message: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
        retryAfterSeconds,
      })
    }

    const sentInWindow = await AuthOtpChallenge.query()
      .where('channel', data.channel)
      .where('recipient', recipient)
      .where('created_at', '>', windowStart.toSQL()!)
      .count('* as total')
    const sends = Number(sentInWindow[0].$extras.total)
    if (sends >= OTP_SEND_LIMIT) {
      return response.status(429).send({
        message: 'Too many codes were requested. Try again in 15 minutes.',
      })
    }

    const fast2smsKey = env.get('FAST2SMS_API_KEY')
    const twilioAccountSid = env.get('TWILIO_ACCOUNT_SID')
    const twilioAuthToken = env.get('TWILIO_AUTH_TOKEN')
    const twilioFromNumber = env.get('TWILIO_FROM_NUMBER')
    const emailProviderReady = hasEmailOtpSettings()
    let emailFallbackRecipient: string | null = null
    if (data.channel === 'whatsapp') {
      if (data.flow === 'signup') {
        emailFallbackRecipient = data.email?.trim().toLowerCase() || null
      } else {
        const phoneAccount = await User.findBy('phone', recipient)
        if (phoneAccount?.email && !phoneAccount.email.endsWith('@phone.intelledu.invalid')) {
          emailFallbackRecipient = phoneAccount.email
        }
      }
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
        ? data.email?.toLowerCase() ?? (data.channel === 'email' ? recipient : null)
        : null,
      phone: data.flow === 'signup'
        ? data.phone ?? (data.channel === 'phone' ? recipient : null)
        : null,
      grade: data.flow === 'signup' ? data.grade ?? null : null,
    })

    let deliveryChannel: 'email' | 'phone' | 'whatsapp' = data.channel
    let deliveryRecipient = recipient
    try {
      if (data.channel === 'email') {
        if (!emailProviderReady) {
          await challenge.delete()
          return response.status(503).send({ message: 'Email OTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS.' })
        }
        await sendEmailOtp(recipient, code)
      } else if (data.channel === 'whatsapp') {
        let whatsappSent = false
        if (env.get('WHATSAPP_ENABLED')?.toLowerCase() === 'true') {
          try {
            const { whatsappService } = await import('#services/whatsapp_service')
            whatsappSent = await whatsappService.sendOtpMessage(recipient, code)
          } catch {
            console.warn('[WhatsApp] Service unavailable; trying email fallback.')
          }
        }

        if (!whatsappSent) {
          if (!emailFallbackRecipient || !emailProviderReady) {
            await challenge.delete()
            return response.status(503).send({
              message: !emailFallbackRecipient
                ? 'WhatsApp is unavailable and this account has no email address for OTP fallback.'
                : 'WhatsApp is unavailable and email fallback is not configured. Configure SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS.',
              channels: { whatsapp: 'unavailable', email: emailProviderReady ? 'no-recipient' : 'not-configured' },
            })
          }
          await sendEmailOtp(emailFallbackRecipient, code)
          challenge.emailFallback = true
          await challenge.save()
          deliveryChannel = 'email'
          deliveryRecipient = emailFallbackRecipient
          console.info('[OTP] WhatsApp unavailable; OTP sent using email fallback.')
        }
      } else {
        if (fast2smsKey) {
          const phoneDigits10 = recipient.replace(/^\+91/, '').replace(/\D/g, '').slice(-10)
          const f2sResponse = await fetch('https://www.fast2sms.com/dev/bulkV2', {
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
              numbers: phoneDigits10,
            }),
            signal: AbortSignal.timeout(15000),
          })
          const f2sBody = await f2sResponse.json() as { return?: boolean }
          if (!f2sResponse.ok || !f2sBody.return) throw new Error('Phone OTP provider rejected the request.')
        } else if (twilioAccountSid && twilioAuthToken && twilioFromNumber) {
          const form = new URLSearchParams({
            From: twilioFromNumber,
            To: recipient,
            Body: `Your IntellEdu OTP is ${code}. Valid 60 sec. Do not share. -IntellEdu`,
          })
          const smsResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioAccountSid)}/Messages.json`,
            {
              method: 'POST',
              headers: {
                Authorization: `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: form,
              signal: AbortSignal.timeout(15000),
            }
          )
          if (!smsResponse.ok) throw new Error('Phone OTP provider rejected the request.')
        } else {
          await challenge.delete()
          return response.status(503).send({ message: 'Phone OTP is not configured. Set FAST2SMS_API_KEY or the Twilio credentials.' })
        }
      }
    } catch {
      await challenge.delete()
      console.warn(`[OTP] ${data.channel} delivery failed.`)
      return response.status(502).send({
        message: data.channel === 'whatsapp' && deliveryChannel !== 'email'
          ? 'WhatsApp OTP could not be sent and email fallback was unavailable. Check the WhatsApp connection and SMTP settings.'
          : `${deliveryChannel === 'email' ? 'Email' : 'Phone'} OTP could not be delivered. Check the provider configuration and try again.`,
      })
    }

    return response.ok({
      challengeId,
      channel: deliveryChannel,
      expiresInSeconds: OTP_LIFETIME_SECONDS,
      expiresAt: challenge.expiresAt.toISO()!,
      message: deliveryChannel === 'email' && data.channel === 'whatsapp'
        ? `WhatsApp is unavailable. A 6-digit verification code was sent to your registered email address.`
        : `A 6-digit verification code was sent to ${deliveryRecipient}. Please check your ${deliveryChannel === 'email' ? 'email inbox' : 'messages'} and enter the code.`,
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
