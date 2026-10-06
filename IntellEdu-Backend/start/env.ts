/*
|--------------------------------------------------------------------------
| Environment Variables Validation
|--------------------------------------------------------------------------
| AdonisJS validates environment variables at boot time to catch
| misconfigurations early and fail fast.
*/
import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
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
})

