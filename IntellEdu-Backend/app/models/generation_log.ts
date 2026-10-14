import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class GenerationLog extends BaseModel {
  static table = 'generation_logs'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare grade: string

  @column()
  declare requested: number

  @column()
  declare created: number

  @column()
  declare failed: number

  @column()
  declare errorShort: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}

