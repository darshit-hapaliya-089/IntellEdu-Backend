import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import env from '#start/env'

const EMAIL_TIMEOUT_MS = 7000

export class EmailDeliveryError extends Error {
  constructor(message: string, public readonly statusCode = 502) {
    super(message)
    this.name = 'EmailDeliveryError'
  }
}

let smtpTransporter: Transporter | null = null

function emailContent(code: string) {
  return {
    subject: `${code} is your IntellEdu verification code`,
    text: `Your IntellEdu verification code is ${code}. It expires in 60 seconds. Do not share it with anyone.\n\n${code}\n\nIntellEdu`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8faff;border-radius:16px;border:1px solid #e0e7ff;color:#1e293b;text-align:center"><h2 style="color:#4f46e5">IntellEdu Verification</h2><p>Enter this code to verify your account. It expires in 60 seconds.</p><div style="background:#fff;border:2px solid #6366f1;border-radius:12px;padding:24px;font-family:monospace;font-size:36px;font-weight:900;letter-spacing:8px;color:#1e1b4b">${code}</div><p style="color:#64748b;font-size:12px">Never share this code with anyone.</p></div>`,
  }
}

function getSmtpTransporter(): Transporter {
  if (env.get('NODE_ENV') === 'production') {
    throw new EmailDeliveryError('SMTP is only available for local development. Configure Brevo for production email delivery.', 503)
  }

  const host = env.get('SMTP_HOST')
  const port = env.get('SMTP_PORT')
  const user = env.get('SMTP_USER')
  const pass = env.get('SMTP_PASS')
  if (!host || !port || !user || !pass) {
    throw new EmailDeliveryError('Local email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.', 503)
  }

  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 2,
      maxMessages: 100,
      host,
      port,
      secure: port === 465,
      auth: { user, pass: pass.replace(/\s+/g, '') },
      connectionTimeout: EMAIL_TIMEOUT_MS,
      greetingTimeout: EMAIL_TIMEOUT_MS,
      socketTimeout: EMAIL_TIMEOUT_MS,
    })
  }
  return smtpTransporter
}

function mapBrevoError(status: number, body: string): EmailDeliveryError {
  if (status === 401 || status === 403) {
    return new EmailDeliveryError('Email provider rejected the Brevo API key. Check BREVO_API_KEY.', 503)
  }
  if (status === 429) {
    return new EmailDeliveryError('Email provider is rate limiting requests. Wait briefly and try again.', 429)
  }
  if (status === 400 && /sender|verified/i.test(body)) {
    return new EmailDeliveryError('Brevo requires a verified sender. Verify EMAIL_FROM in your Brevo account.', 503)
  }
  if (status === 400 && /email|recipient/i.test(body)) {
    return new EmailDeliveryError('The email address was rejected. Check the address and try again.', 400)
  }
  return new EmailDeliveryError('The email provider could not accept this message. Check the Brevo sender configuration.', 502)
}

async function sendWithBrevo(to: string, code: string): Promise<void> {
  const apiKey = env.get('BREVO_API_KEY')
  const fromEmail = env.get('EMAIL_FROM')
  const fromName = env.get('EMAIL_FROM_NAME') || 'IntellEdu'
  if (!apiKey) throw new EmailDeliveryError('Brevo email is not configured. Set BREVO_API_KEY.', 503)
  if (!fromEmail) throw new EmailDeliveryError('Brevo email is not configured. Set EMAIL_FROM to a verified sender.', 503)

  const { subject, text, html } = emailContent(code)
  let result: Response
  try {
    result = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new EmailDeliveryError('Email provider timed out. Please retry in a moment.', 504)
    }
    throw new EmailDeliveryError('Could not reach the email provider. Please retry in a moment.', 502)
  }

  if (!result.ok) {
    throw mapBrevoError(result.status, await result.text())
  }
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const provider = env.get('EMAIL_PROVIDER') || 'brevo'
  if (provider === 'brevo') return sendWithBrevo(to, code)
  if (provider !== 'smtp') {
    throw new EmailDeliveryError('EMAIL_PROVIDER must be set to brevo or smtp.', 503)
  }

  try {
    await getSmtpTransporter().sendMail({
      from: `"${env.get('EMAIL_FROM_NAME') || 'IntellEdu'}" <${env.get('SMTP_USER')}>`,
      to,
      ...emailContent(code),
    })
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error
    const message = error instanceof Error ? error.message : ''
    if (/invalid.*(email|address)|recipient.*invalid/i.test(message)) {
      throw new EmailDeliveryError('Enter a valid email address.', 400)
    }
    throw new EmailDeliveryError('Local SMTP delivery failed. Check the SMTP settings and try again.', 502)
  }
}
