/*
|--------------------------------------------------------------------------
| AdonisJS Application Entrypoint — app.ts
|--------------------------------------------------------------------------
| This file is the main entry point of an AdonisJS application. It registers
| providers, middleware, and configures the application.
*/
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  /*
  |--------------------------------------------------------------------------
  | Directories
  |--------------------------------------------------------------------------
  */
  directories: {
    config: 'config',
    commands: 'commands',
    migrations: 'database/migrations',
    seeders: 'database/seeders',
    factories: 'database/factories',
    views: 'resources/views',
  },

  /*
  |--------------------------------------------------------------------------
  | Service Providers
  |--------------------------------------------------------------------------
  | Providers are used to register services into the IoC container.
  */
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl'],
    },
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/cors/cors_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/auth/auth_provider'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Preloads
  |--------------------------------------------------------------------------
  | Files to load before the HTTP server starts. These are good for
  | registering routes, middleware, event listeners etc.
  */
  preloads: [
    () => import('#start/routes'),
    () => import('#start/kernel'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Tests
  |--------------------------------------------------------------------------
  */
  tests: {
    suites: [
      {
        files: ['tests/unit/**/*.spec(.ts|.js)'],
        name: 'unit',
        timeout: 2000,
      },
      {
        files: ['tests/functional/**/*.spec(.ts|.js)'],
        name: 'functional',
        timeout: 30000,
      },
    ],
  },
})

