import { BaseSchema } from '@adonisjs/lucid/schema'

/*
|--------------------------------------------------------------------------
| Migration: create_users_table
|--------------------------------------------------------------------------
| Stores student and admin accounts for IntellEdu.
*/
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('full_name').notNullable()
      table.string('email').unique().notNullable()
      table.string('phone').nullable()
      table.string('password').notNullable()
      table.string('grade').notNullable().defaultTo('Class 10')
      table.string('role').notNullable().defaultTo('student') // student | admin
      table.string('avatar_url').nullable()

      // Gamification
      table.integer('points').defaultTo(0).notNullable()
      table.integer('streak').defaultTo(0).notNullable()
      table.string('badge').nullable()
      table.date('last_active_date').nullable()

      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
