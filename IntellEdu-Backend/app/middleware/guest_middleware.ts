import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

/*
|--------------------------------------------------------------------------
| Guest Middleware
|--------------------------------------------------------------------------
| Ensures that authenticated users cannot access guest-only routes like login/signup.
*/
export default class GuestMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    for (const guard of options.guards || [ctx.auth.defaultGuard]) {
      if (await ctx.auth.use(guard).check()) {
        return ctx.response.badRequest({ message: 'User is already authenticated.' })
      }
    }
    return next()
  }
}

