import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.timestamp('ai_paid_mode_at', { useTz: true }).nullable()
      table.index(['ai_paid_mode_at'])
    })

    // Backfill: Any existing user with longest_streak >= 10 is marked as paid mode immediately
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE users 
        SET ai_paid_mode_at = NOW() 
        WHERE (longest_streak >= 10 OR streak >= 10) 
          AND ai_paid_mode_at IS NULL
      `)
    })
  }

  async down() {
    this.schema.alterTable('users', (table) => {
      table.dropIndex(['ai_paid_mode_at'])
      table.dropColumn('ai_paid_mode_at')
    })
  }
}

