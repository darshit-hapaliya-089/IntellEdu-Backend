import env from '#start/env'
import { defineConfig } from '@adonisjs/core/http'

export const appKey = env.get('APP_KEY')

export const http = defineConfig({
  generateRequestId: true,
  allowMethodSpoofing: false,
  useAsyncLocalStorage: false,
  cookie: {
    domain: '',
    path: '/',
    maxAge: '2h',
    httpOnly: true,
    secure: env.get('NODE_ENV') === 'production',
    sameSite: 'lax',
  },
})

