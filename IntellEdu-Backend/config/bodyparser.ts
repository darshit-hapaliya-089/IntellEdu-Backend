import { defineConfig } from '@adonisjs/core/bodyparser'

const bodyParserConfig = defineConfig({
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  form: {
    types: ['application/x-www-form-urlencoded'],
    convertEmptyStringsToNull: true,
  },
  json: {
    types: [
      'application/json',
      'application/json-patch+json',
      'application/vnd.api+json',
      'application/csp-report',
    ],
    convertEmptyStringsToNull: true,
  },
  raw: {
    types: ['text/*'],
  },
  multipart: {
    autoProcess: true,
    processManually: [],
    types: ['multipart/form-data'],
    convertEmptyStringsToNull: true,
  },
})

export default bodyParserConfig

