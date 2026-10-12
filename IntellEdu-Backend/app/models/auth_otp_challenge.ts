import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class AuthOtpChallenge extends BaseModel {
  static table = 'auth_otp_challenges'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare recipient: string

  @column()
  declare channel: 'email' | 'phone' | 'whatsapp'

  @column()
  declare flow: 'login' | 'signup'

  @column({ serializeAs: null })
  declare codeHash: string

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime()
  declare consumedAt: DateTime | null

  @column.dateTime()
  declare sentAt: DateTime

  @column.dateTime()
  declare windowStartedAt: DateTime

  @column()
  declare sendsInWindow: number

  @column()
  declare attempts: number

  @column()
  declare fullName: string | null

  @column()
  declare email: string | null

  @column()
  declare phone: string | null

  @column()
  declare grade: string | null

  @column()
  declare emailFallback: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
