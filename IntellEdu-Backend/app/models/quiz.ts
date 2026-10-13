import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Course from '#models/course'

export class QuizQuestion extends BaseModel {
  static table = 'quiz_questions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare quizId: number

  @column()
  declare question: string

  @column({
    prepare: (value: string[]) => JSON.stringify(value),
    consume: (value: string[] | string) => typeof value === 'string' ? JSON.parse(value) as string[] : value,
  })
  declare options: string[]

  @column()
  declare correctOption: number

  @column()
  declare explanation: string | null

  @column()
  declare sortOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

export default class Quiz extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare courseId: number | null

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare grade: string | null

  @column()
  declare subject: string | null

  @column()
  declare slug: string | null

  @column()
  declare difficulty: 'easy' | 'medium' | 'hard'

  @column()
  declare iconKey: string | null

  @column()
  declare xpReward: number

  @column()
  declare timeLimitMinutes: number

  @column()
  declare isPublished: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Course)
  declare course: BelongsTo<typeof Course>

  @hasMany(() => QuizQuestion, { foreignKey: 'quizId' })
  declare questions: HasMany<typeof QuizQuestion>
}
