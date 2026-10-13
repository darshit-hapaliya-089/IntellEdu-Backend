import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Quiz from '#models/quiz'

export default class DailyQuiz extends BaseModel {
  static table = 'daily_quizzes'

  @column({ isPrimary: true })
  declare id: number

  @column({ prepare: (v) => v?.toISODate?.() ?? v })
  declare quizDate: DateTime | string

  @column()
  declare grade: string

  @column()
  declare quizId: number

  @column()
  declare slotNumber: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Quiz, { foreignKey: 'quizId' })
  declare quiz: BelongsTo<typeof Quiz> & Quiz
}
