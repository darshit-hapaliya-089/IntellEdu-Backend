import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, beforeSave, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import QuizResult from '#models/quiz_result'
import Course from '#models/course'
import DoubtSolverHistory from '#models/doubt_solver_history'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string

  @column()
  declare email: string

  @column()
  declare emailVerified: boolean

  @column()
  declare phone: string | null

  @column()
  declare phoneVerified: boolean

  @column({ serializeAs: null })   // never expose password in API responses
  declare password: string

  @column()
  declare grade: string

  @column()
  declare role: 'student' | 'admin'

  @column()
  declare avatarUrl: string | null

  // Gamification
  @column()
  declare points: number

  @column()
  declare streak: number

  @column()
  declare longestStreak: number

  @column()
  declare badge: string | null

  @column({ prepare: (v) => v?.toISODate?.() ?? v })
  declare lastActiveDate: DateTime | null

  @column.dateTime()
  declare aiFirstUsedAt: DateTime | null

  @column.dateTime()
  declare aiPaidModeAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @hasMany(() => QuizResult)
  declare quizResults: HasMany<typeof QuizResult>

  @hasMany(() => DoubtSolverHistory)
  declare doubtHistory: HasMany<typeof DoubtSolverHistory>

  @manyToMany(() => Course, {
    pivotTable: 'user_courses',
    pivotColumns: ['completed_lessons', 'progress_percent', 'is_completed', 'enrolled_at', 'last_accessed_at'],
    pivotTimestamps: true,
  })
  declare courses: ManyToMany<typeof Course>

  // JWT Access Token Provider
  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '30 days',
    prefix: 'ie_',
    table: 'auth_access_tokens',
    type: 'auth_token',
    tokenSecretLength: 40,
  })

  @beforeSave()
  static async hashUserPassword(user: User) {
    if (user.$dirty.password) {
      user.password = await hash.use('scrypt').make(user.password)
    }
  }
}
