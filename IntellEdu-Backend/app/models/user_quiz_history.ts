import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Quiz from '#models/quiz'

export default class UserQuizHistory extends BaseModel {
  static table = 'user_quiz_history'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare quizId: number

  @column({ prepare: (v) => v?.toISODate?.() ?? v })
  declare firstServedDate: DateTime | string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Quiz)
  declare quiz: BelongsTo<typeof Quiz>
}

