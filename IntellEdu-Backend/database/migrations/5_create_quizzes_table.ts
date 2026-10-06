import { BaseSchema } from '@adonisjs/lucid/schema'

/*
|--------------------------------------------------------------------------
| Migration: create_quizzes_table
|--------------------------------------------------------------------------
*/
export default class extends BaseSchema {
  protected tableName = 'quizzes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('course_id').unsigned().references('id').inTable('courses').onDelete('CASCADE').nullable()
      table.string('title').notNullable()
      table.text('description').nullable()
      table.integer('xp_reward').defaultTo(50)
      table.integer('time_limit_minutes').defaultTo(5)
      table.boolean('is_published').defaultTo(true)
      table.timestamps(true, true)
    })

    // quiz_questions table
    this.schema.createTable('quiz_questions', (table) => {
      table.increments('id').primary()
      table.integer('quiz_id').unsigned().references('id').inTable('quizzes').onDelete('CASCADE')
      table.text('question').notNullable()
      table.json('options').notNullable()         // string[] of 4 options
      table.integer('correct_option').notNullable() // 0-indexed
      table.text('explanation').nullable()
      table.integer('sort_order').defaultTo(0)
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable('quiz_questions')
    this.schema.dropTable(this.tableName)
  }
}

