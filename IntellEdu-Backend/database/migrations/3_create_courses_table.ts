import { BaseSchema } from '@adonisjs/lucid/schema'

/*
|--------------------------------------------------------------------------
| Migration: create_courses_table
|--------------------------------------------------------------------------
*/
export default class extends BaseSchema {
  protected tableName = 'courses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('title').notNullable()
      table.text('description').nullable()
      table.string('category').notNullable()  // e.g. 'Chemistry', 'Physics'
      table.string('grade').notNullable()      // e.g. 'Class 10'
      table.string('image_url').nullable()
      table.integer('total_lessons').defaultTo(0)
      table.decimal('rating', 2, 1).defaultTo(4.5)
      table.boolean('is_published').defaultTo(true)
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

