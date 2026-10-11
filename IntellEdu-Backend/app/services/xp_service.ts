import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export const AI_QUESTION_XP_COST = 10
export const LEARNING_XP_PER_MINUTE = 5
export const MAX_LEARNING_MINUTES_PER_SESSION = 60
export const MAX_LEARNING_MINUTES_PER_DAY = 120

type XpChange = {
  userId: number
  amount: number
  reason: string
  sourceKey: string
}

export async function changeXpInTransaction(
  trx: TransactionClientContract,
  { userId, amount, reason, sourceKey }: XpChange
) {
  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error('XP changes must be non-zero integer amounts.')
  }

  const user = await trx.from('users').where('id', userId).forUpdate().first()
  if (!user) throw new Error('User not found while updating XP.')

  const existing = await trx.from('xp_transactions').where('source_key', sourceKey).first()
  if (existing) {
    return {
      awarded: false,
      balance: Number(user.points),
      amount: Number(existing.amount),
    }
  }

  const balance = Number(user.points)
  if (balance + amount < 0) {
    return { awarded: false, balance, amount: 0 }
  }

  const newBalance = balance + amount
  await trx.from('users').where('id', userId).update({ points: newBalance })
  await trx.table('xp_transactions').insert({
    user_id: userId,
    amount,
    reason,
    source_key: sourceKey,
    balance_after: newBalance,
  })

  return { awarded: true, balance: newBalance, amount }
}

export async function changeXp(change: XpChange) {
  return db.transaction((trx) => changeXpInTransaction(trx, change))
}
