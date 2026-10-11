import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('auth_otp_challenges', (table) => {
      table.string('copy_token_hash', 64).nullable()
      table.text('code_ciphertext').nullable()
      table.string('code_iv', 32).nullable()
      table.string('code_auth_tag', 32).nullable()
    })
  }

  async down() {
    this.schema.alterTable('auth_otp_challenges', (table) => {
      table.dropColumn('copy_token_hash')
      table.dropColumn('code_ciphertext')
      table.dropColumn('code_iv')
      table.dropColumn('code_auth_tag')
    })
  }
}
