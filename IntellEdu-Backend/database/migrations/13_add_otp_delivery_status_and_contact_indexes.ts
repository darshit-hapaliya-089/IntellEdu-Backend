import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('auth_otp_challenges', (table) => {
      table.string('delivery_status').notNullable().defaultTo('sent')
      table.string('delivery_error').nullable()
      table.index(['recipient', 'created_at'], 'auth_otp_recipient_created_idx')
      table.index(['email', 'created_at'], 'auth_otp_email_created_idx')
      table.index(['phone', 'created_at'], 'auth_otp_phone_created_idx')
    })
  }

  async down() {
    this.schema.alterTable('auth_otp_challenges', (table) => {
      table.dropIndex(['recipient', 'created_at'], 'auth_otp_recipient_created_idx')
      table.dropIndex(['email', 'created_at'], 'auth_otp_email_created_idx')
      table.dropIndex(['phone', 'created_at'], 'auth_otp_phone_created_idx')
      table.dropColumn('delivery_error')
      table.dropColumn('delivery_status')
    })
  }
}
