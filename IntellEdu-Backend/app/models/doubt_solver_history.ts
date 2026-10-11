import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class DoubtSolverHistory extends BaseModel {
  static table = 'doubt_solver_history'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare question: string

  @column()
  declare answer: string

  @column()
  declare subject: string | null

  @column()
  declare xpCost: number

  @column()
  declare clientRequestId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
