import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.boolean('email_verified').notNullable().defaultTo(false)
      table.boolean('phone_verified').notNullable().defaultTo(false)
      table.unique(['phone'])
    })

    this.schema.createTable('auth_otp_challenges', (table) => {
      table.uuid('id').primary()
      table.string('recipient').notNullable()
      table.string('channel').notNullable()
      table.string('flow').notNullable()
      table.string('code_hash').notNullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('sent_at', { useTz: true }).notNullable()
      table.timestamp('window_started_at', { useTz: true }).notNullable()
      table.integer('sends_in_window').notNullable().defaultTo(1)
      table.integer('attempts').notNullable().defaultTo(0)
      table.string('full_name').nullable()
      table.string('email').nullable()
      table.string('phone').nullable()
      table.string('grade').nullable()
      table.timestamp('consumed_at', { useTz: true }).nullable()
      table.timestamps(true, true)
      table.index(['channel', 'recipient', 'created_at'])
      table.index(['expires_at'])
    })
  }

  async down() {
    this.schema.dropTable('auth_otp_challenges')
    this.schema.alterTable('users', (table) => {
      table.dropUnique(['phone'])
      table.dropColumn('email_verified')
      table.dropColumn('phone_verified')
    })
  }
}
