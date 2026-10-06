/*
|--------------------------------------------------------------------------
| JavaScript entrypoint for running ace commands
|--------------------------------------------------------------------------
*/
import 'reflect-metadata'
import { register } from 'node:module'

/**
 * Register TypeScript loader hook
 */
register('ts-node/esm', import.meta.url)

/**
 * Import and run console binary
 */
await import('./bin/console.js').catch(async () => {
  await import('./bin/console.ts')
})

