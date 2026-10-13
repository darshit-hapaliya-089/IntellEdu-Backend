import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.integer('longest_streak').notNullable().defaultTo(0)
    })

    // Backfill longest_streak with existing streak value
    this.defer(async (db) => {
      await db.rawQuery('UPDATE users SET longest_streak = streak WHERE longest_streak < streak')
    })
  }

  async down() {
    this.schema.alterTable('users', (table) => {
      table.dropColumn('longest_streak')
    })
  }
}

