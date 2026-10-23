import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { changeXpInTransaction } from '#services/xp_service'

export interface DailyActivityRecord {
  currentStreak: number
  longestStreak: number
  lastActivityDate: string
  streakIncreasedToday: boolean
  milestoneBonusXp?: number
}

// Milestone bonus definition: awards given once when reaching streak milestones
const STREAK_MILESTONES: Record<number, number> = {
  3: 50,
  7: 100,
  14: 250,
  30: 500,
}

export function getAppTimezone(): string {
  return env.get('APP_TIMEZONE') || 'Asia/Kolkata'
}

export function getTodayIstString(): string {
  return DateTime.now().setZone(getAppTimezone()).toISODate()!
}

export function getYesterdayIstString(): string {
  return DateTime.now().setZone(getAppTimezone()).minus({ days: 1 }).toISODate()!
}

/**
 * Idempotently records daily activity for a user based on Asia/Kolkata calendar day.
 * - If last_activity_date == today(IST): do nothing.
 * - If last_activity_date == yesterday(IST): current_streak += 1.
 * - Else: current_streak = 1 (streak broken or fresh start).
 * - Updates longest_streak, sets last_activity_date = today(IST).
 * - Safe under concurrent requests via DB transaction + row lock (forUpdate).
 * - Optionally awards streak milestone bonus XP once per milestone.
 */
export async function recordDailyActivity(userId: number): Promise<DailyActivityRecord> {
  const tz = getAppTimezone()
  const nowInZone = DateTime.now().setZone(tz)
  const today = nowInZone.toISODate()!
  const yesterday = nowInZone.minus({ days: 1 }).toISODate()!

  return db.transaction(async (trx) => {
    const userRow = await trx.from('users').where('id', userId).forUpdate().first()
    if (!userRow) {
      throw new Error(`User not found: ${userId}`)
    }

    const lastActiveRaw = userRow.last_active_date
    const lastActiveDateStr = lastActiveRaw instanceof Date
      ? lastActiveRaw.toISOString().slice(0, 10)
      : lastActiveRaw
        ? String(lastActiveRaw).slice(0, 10)
        : null

    let currentStreak = Number(userRow.streak || 0)
    let longestStreak = Number(userRow.longest_streak || 0)
    let streakIncreasedToday = false
    let milestoneBonusXp = 0

    if (lastActiveDateStr === today) {
      // Already active today; streak does not change
      return {
        currentStreak,
        longestStreak: Math.max(longestStreak, currentStreak),
        lastActivityDate: today,
        streakIncreasedToday: false,
      }
    }

    if (lastActiveDateStr === yesterday) {
      currentStreak += 1
      streakIncreasedToday = true
    } else {
      // Streak broken or brand new user
      currentStreak = 1
      streakIncreasedToday = true
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak
    }

    const freeStreakTarget = Number(env.get('AI_FREE_STREAK_DAYS')) || 10
    const entersPaidMode = (longestStreak >= freeStreakTarget || currentStreak >= freeStreakTarget) && !userRow.ai_paid_mode_at

    const updatePayload: Record<string, any> = {
      streak: currentStreak,
      longest_streak: longestStreak,
      last_active_date: today,
      updated_at: new Date(),
    }

    if (entersPaidMode) {
      updatePayload.ai_paid_mode_at = new Date()
    }

    await trx.from('users').where('id', userId).update(updatePayload)

    // Check for streak milestone bonuses (3, 7, 14, 30 days)
    const milestoneXp = STREAK_MILESTONES[currentStreak]
    if (milestoneXp && streakIncreasedToday) {
      const milestoneKey = `streak-milestone:${userId}:${currentStreak}`
      const awarded = await changeXpInTransaction(trx, {
        userId,
        amount: milestoneXp,
        reason: `streak_milestone_${currentStreak}_days`,
        sourceKey: milestoneKey,
      })
      if (awarded.awarded) {
        milestoneBonusXp = milestoneXp
      }
    }

    return {
      currentStreak,
      longestStreak,
      lastActivityDate: today,
      streakIncreasedToday,
      milestoneBonusXp: milestoneBonusXp > 0 ? milestoneBonusXp : undefined,
    }
  })
}

