/*
|--------------------------------------------------------------------------
| HTTP Kernel — Middleware Registration
|--------------------------------------------------------------------------
| This file registers global, named, and router middleware for the
| IntellEdu AdonisJS HTTP server.
*/
import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

/*
|--------------------------------------------------------------------------
| Global Middleware
| Runs on every HTTP request
|--------------------------------------------------------------------------
*/
server.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
])

/*
|--------------------------------------------------------------------------
| Named Middleware
| Referenced inside route definitions using .use([middleware.auth()])
|--------------------------------------------------------------------------
*/
export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
  guest: () => import('#middleware/guest_middleware'),
})

