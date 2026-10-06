import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class Course extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare category: string

  @column()
  declare grade: string

  @column()
  declare imageUrl: string | null

  @column()
  declare totalLessons: number

  @column()
  declare rating: number

  @column()
  declare isPublished: boolean

  @column()
  declare createdBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @manyToMany(() => User, {
    pivotTable: 'user_courses',
    pivotColumns: ['completed_lessons', 'progress_percent', 'is_completed', 'enrolled_at', 'last_accessed_at'],
  })
  declare enrolledStudents: ManyToMany<typeof User>
}

