import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.timestamp('ai_first_used_at', { useTz: true }).nullable()
    })

    this.schema.alterTable('doubt_solver_history', (table) => {
      table.integer('xp_cost').notNullable().defaultTo(0)
      table.string('client_request_id').nullable()
      table.unique(['user_id', 'client_request_id'])
    })

    this.schema.alterTable('quizzes', (table) => {
      table.string('grade').nullable()
      table.string('subject').nullable()
    })

    this.schema.createTable('xp_transactions', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.integer('amount').notNullable()
      table.string('reason').notNullable()
      table.string('source_key').notNullable().unique()
      table.integer('balance_after').notNullable()
      table.timestamps(true, true)
      table.index(['user_id', 'created_at'])
    })

    this.schema.createTable('course_resources', (table) => {
      table.increments('id').primary()
      table.integer('course_id').unsigned().notNullable().references('id').inTable('courses').onDelete('CASCADE')
      table.string('title').notNullable()
      table.string('resource_type').notNullable()
      table.text('resource_url').notNullable()
      table.integer('estimated_minutes').nullable()
      table.integer('sort_order').notNullable().defaultTo(0)
      table.timestamps(true, true)
      table.index(['course_id', 'sort_order'])
    })

    this.schema.createTable('learning_sessions', (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.integer('course_id').unsigned().notNullable().references('id').inTable('courses').onDelete('CASCADE')
      table.integer('resource_id').unsigned().notNullable().references('id').inTable('course_resources').onDelete('CASCADE')
      table.timestamp('started_at', { useTz: true }).notNullable()
      table.timestamp('completed_at', { useTz: true }).nullable()
      table.integer('elapsed_seconds').notNullable().defaultTo(0)
      table.integer('awarded_minutes').notNullable().defaultTo(0)
      table.integer('xp_earned').notNullable().defaultTo(0)
      table.timestamps(true, true)
      table.index(['user_id', 'completed_at'])
    })

    this.defer(async (client) => {
      const accounts = await client.from('users').select('id', 'points')
      const now = new Date()
      const openingBalances = accounts
        .filter((account) => Number(account.points) !== 0)
        .map((account) => ({
          user_id: account.id,
          amount: Number(account.points),
          reason: 'opening_balance',
          source_key: `opening-balance:${account.id}`,
          balance_after: Number(account.points),
          created_at: now,
          updated_at: now,
        }))
      for (let offset = 0; offset < openingBalances.length; offset += 500) {
        await client.table('xp_transactions').insert(openingBalances.slice(offset, offset + 500))
      }
    })
  }

  async down() {
    this.schema.dropTable('learning_sessions')
    this.schema.dropTable('course_resources')
    this.schema.dropTable('xp_transactions')
    this.schema.alterTable('doubt_solver_history', (table) => {
      table.dropUnique(['user_id', 'client_request_id'])
      table.dropColumn('client_request_id')
      table.dropColumn('xp_cost')
    })
    this.schema.alterTable('quizzes', (table) => {
      table.dropColumn('subject')
      table.dropColumn('grade')
    })
    this.schema.alterTable('users', (table) => {
      table.dropColumn('ai_first_used_at')
    })
  }
}
