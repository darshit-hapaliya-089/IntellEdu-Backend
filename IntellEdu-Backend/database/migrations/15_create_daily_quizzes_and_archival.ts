import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('quizzes', (table) => {
      table.string('slug').nullable().unique()
      table.string('difficulty').notNullable().defaultTo('medium') // easy | medium | hard
      table.string('icon_key').nullable()
      table.index(['grade', 'subject', 'difficulty'])
    })

    this.schema.createTable('daily_quizzes', (table) => {
      table.increments('id').primary()
      table.date('quiz_date').notNullable()
      table.string('grade').notNullable()
      table.integer('quiz_id').unsigned().notNullable().references('id').inTable('quizzes').onDelete('CASCADE')
      table.integer('slot_number').notNullable()
      table.timestamps(true, true)

      table.unique(['quiz_date', 'grade', 'slot_number'])
      table.index(['quiz_date', 'grade'])
    })

    this.schema.alterTable('quiz_results', (table) => {
      table.date('quiz_date').nullable()
      table.timestamp('archived_at', { useTz: true }).nullable()
      table.index(['user_id', 'created_at'])
      table.index(['user_id', 'quiz_date'])
      table.index(['archived_at'])
    })

    // Backfill quiz_date from created_at in existing quiz_results
    this.defer(async (db) => {
      await db.rawQuery('UPDATE quiz_results SET quiz_date = CAST(created_at AT TIME ZONE \'Asia/Kolkata\' AS DATE) WHERE quiz_date IS NULL')
    })
  }

  async down() {
    this.schema.alterTable('quiz_results', (table) => {
      table.dropIndex(['archived_at'])
      table.dropIndex(['user_id', 'quiz_date'])
      table.dropIndex(['user_id', 'created_at'])
      table.dropColumn('archived_at')
      table.dropColumn('quiz_date')
    })

    this.schema.dropTable('daily_quizzes')

    this.schema.alterTable('quizzes', (table) => {
      table.dropIndex(['grade', 'subject', 'difficulty'])
      table.dropColumn('icon_key')
      table.dropColumn('difficulty')
      table.dropColumn('slug')
    })
  }
}

