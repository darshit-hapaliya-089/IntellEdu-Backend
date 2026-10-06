import { defineConfig } from '@adonisjs/core/hash'
import { drivers } from '@adonisjs/core/hash'

const hashConfig = defineConfig({
  default: 'scrypt',
  list: {
    scrypt: drivers.scrypt({
      cost: 16384,
      blockSize: 8,
      parallelization: 1,
      saltSize: 16,
      maxMemory: 33554432,
      keyLength: 64,
    }),
  },
})

export default hashConfig

declare module '@adonisjs/core/types' {
  interface HashersList extends InferHashers<typeof hashConfig> {}
}

