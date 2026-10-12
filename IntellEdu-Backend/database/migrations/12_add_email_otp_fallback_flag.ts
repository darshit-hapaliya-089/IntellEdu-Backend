import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('auth_otp_challenges', (table) => {
      table.boolean('email_fallback').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable('auth_otp_challenges', (table) => {
      table.dropColumn('email_fallback')
    })
  }
}
