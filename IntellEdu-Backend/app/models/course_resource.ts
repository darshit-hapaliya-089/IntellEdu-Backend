import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Course from '#models/course'

export default class CourseResource extends BaseModel {
  static table = 'course_resources'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare courseId: number

  @column()
  declare title: string

  @column()
  declare resourceType: 'video' | 'reading'

  @column()
  declare resourceUrl: string

  @column()
  declare estimatedMinutes: number | null

  @column()
  declare sortOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Course)
  declare course: BelongsTo<typeof Course>
}
