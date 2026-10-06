import { BaseSchema } from '@adonisjs/lucid/schema'

/*
|--------------------------------------------------------------------------
| Migration: create_quiz_results_table
|--------------------------------------------------------------------------
*/
export default class extends BaseSchema {
  protected tableName = 'quiz_results'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('quiz_id').unsigned().references('id').inTable('quizzes').onDelete('CASCADE')
      table.integer('score').notNullable()           // raw score
      table.integer('total_questions').notNullable()
      table.integer('correct_answers').notNullable()
      table.decimal('accuracy', 5, 2).notNullable()  // percentage
      table.integer('xp_earned').defaultTo(0)
      table.integer('time_taken_seconds').nullable()
      table.timestamps(true, true)
    })

    // doubt_solver_history table
    this.schema.createTable('doubt_solver_history', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.text('question').notNullable()
      table.text('answer').notNullable()
      table.string('subject').nullable()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable('doubt_solver_history')
    this.schema.dropTable(this.tableName)
  }
}

