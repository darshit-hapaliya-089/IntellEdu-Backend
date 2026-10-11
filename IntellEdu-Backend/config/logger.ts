import env from '#start/env'
import { defineConfig, targets } from '@adonisjs/core/logger'

const loggerConfig = defineConfig({
  default: 'app',
  loggers: {
    app: {
      enabled: true,
      name: env.get('APP_NAME', 'intelledu'),
      level: env.get('LOG_LEVEL', 'info'),
      transport: {
        targets: targets()
          .pushIf(!env.get('NODE_ENV') || env.get('NODE_ENV') === 'development', {
            target: 'pino/file',
            options: { destination: 1 },
          })
          .toArray(),
      },
    },
  },
})

export default loggerConfig

declare module '@adonisjs/core/types' {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}

