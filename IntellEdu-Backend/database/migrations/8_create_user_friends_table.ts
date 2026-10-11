import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_friends'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE')
      table.integer('friend_id').unsigned().notNullable().references('users.id').onDelete('CASCADE')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['user_id', 'friend_id'])
      table.check('user_id < friend_id')
      table.index(['friend_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
