import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // 1. Alter quizzes table with AI source, review status, and active flag
    this.schema.alterTable('quizzes', (table) => {
      table.string('source').notNullable().defaultTo('seed') // 'seed' | 'ai'
      table.boolean('reviewed').notNullable().defaultTo(false)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.index(['grade', 'is_published', 'is_active'])
      table.index(['source', 'reviewed'])
    })

    // 2. Table: user_quiz_history (tracks quizzes served to each user to prevent repeats)
    this.schema.createTable('user_quiz_history', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.integer('quiz_id').unsigned().notNullable().references('id').inTable('quizzes').onDelete('CASCADE')
      table.date('first_served_date').notNullable()
      table.timestamps(true, true)

      table.unique(['user_id', 'quiz_id'])
      table.index(['user_id', 'first_served_date'])
    })

    // 3. Table: generation_logs (logs AI question generation batches)
    this.schema.createTable('generation_logs', (table) => {
      table.increments('id').primary()
      table.string('grade').notNullable()
      table.integer('requested').notNullable()
      table.integer('created').notNullable().defaultTo(0)
      table.integer('failed').notNullable().defaultTo(0)
      table.string('error_short', 1000).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
    })

    // 4. Table: quiz_generation_locks (prevents duplicate background top-ups)
    this.schema.createTable('quiz_generation_locks', (table) => {
      table.string('lock_key', 100).primary()
      table.timestamp('locked_at', { useTz: true }).notNullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable('quiz_generation_locks')
    this.schema.dropTable('generation_logs')
    this.schema.dropTable('user_quiz_history')

    this.schema.alterTable('quizzes', (table) => {
      table.dropIndex(['source', 'reviewed'])
      table.dropIndex(['grade', 'is_published', 'is_active'])
      table.dropColumn('is_active')
      table.dropColumn('reviewed')
      table.dropColumn('source')
    })
  }
}

