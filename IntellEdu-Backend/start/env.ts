/*
|--------------------------------------------------------------------------
| Environment Variables Validation
|--------------------------------------------------------------------------
| AdonisJS validates environment variables at boot time to catch
| misconfigurations early and fail fast.
*/
import { Env } from '@adonisjs/core/env'

const appEnv = await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number.optional(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string.optional(),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),

  /*
  |-----------------------------------------------
  | Database
  |-----------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  /*
  |-----------------------------------------------
  | JWT Auth
  |-----------------------------------------------
  */
  JWT_SECRET: Env.schema.string(),

  /*
  |-----------------------------------------------
  | AI API Keys (optional)
  |-----------------------------------------------
  */
  OPENAI_API_KEY: Env.schema.string.optional(),
  GEMINI_API_KEY: Env.schema.string.optional(),
  FIREBASE_API_KEY: Env.schema.string.optional(),
  FIREBASE_PROJECT_ID: Env.schema.string.optional(),
  TWILIO_ACCOUNT_SID: Env.schema.string.optional(),
  TWILIO_AUTH_TOKEN: Env.schema.string.optional(),
  TWILIO_FROM_NUMBER: Env.schema.string.optional(),
  FAST2SMS_API_KEY: Env.schema.string.optional(),
  SMTP_HOST: Env.schema.string.optional(),
  SMTP_PORT: Env.schema.number.optional(),
  SMTP_USER: Env.schema.string.optional(),
  SMTP_PASS: Env.schema.string.optional(),
  SMTP_FROM_EMAIL: Env.schema.string.optional(),
  EMAIL_PROVIDER: Env.schema.string.optional(),
  BREVO_API_KEY: Env.schema.string.optional(),
  EMAIL_FROM: Env.schema.string.optional(),
  EMAIL_FROM_NAME: Env.schema.string.optional(),
  EMAIL_LOGO_URL: Env.schema.string.optional(),
  WHATSAPP_ENABLED: Env.schema.string.optional(),
  WHATSAPP_AUTH_DIR: Env.schema.string.optional(),
  APP_TIMEZONE: Env.schema.string.optional(),
  DAILY_QUIZ_COUNT: Env.schema.number.optional(),
  QUIZ_BANK_MIN_UNUSED: Env.schema.number.optional(),
  GEMINI_MODEL: Env.schema.string.optional(),
  // Cloudinary (for profile photo uploads)
  CLOUDINARY_CLOUD_NAME: Env.schema.string.optional(),
  CLOUDINARY_API_KEY: Env.schema.string.optional(),
  CLOUDINARY_API_SECRET: Env.schema.string.optional(),
  CLOUDINARY_UPLOAD_PRESET: Env.schema.string.optional(),
})

const port = appEnv.get('PORT') ?? 3333
const host = appEnv.get('HOST') ?? (appEnv.get('NODE_ENV') === 'production' ? '0.0.0.0' : '127.0.0.1')
appEnv.set('PORT', port)
appEnv.set('HOST', host)
process.env.PORT ??= String(port)
process.env.HOST ??= host

export default appEnv
