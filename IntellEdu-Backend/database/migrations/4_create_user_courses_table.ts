import { BaseSchema } from '@adonisjs/lucid/schema'

/*
|--------------------------------------------------------------------------
| Migration: create_user_courses_table
|--------------------------------------------------------------------------
| Pivot table: tracks enrollment + progress per user per course.
*/
export default class extends BaseSchema {
  protected tableName = 'user_courses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('course_id').unsigned().references('id').inTable('courses').onDelete('CASCADE')
      table.integer('completed_lessons').defaultTo(0)
      table.integer('progress_percent').defaultTo(0)
      table.boolean('is_completed').defaultTo(false)
      table.timestamp('enrolled_at', { useTz: true }).notNullable()
      table.timestamp('last_accessed_at', { useTz: true }).nullable()
      table.timestamps(true, true)
      table.unique(['user_id', 'course_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

