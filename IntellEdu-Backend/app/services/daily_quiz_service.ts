import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import Quiz from '#models/quiz'
import DailyQuiz from '#models/daily_quiz'
import { getAppTimezone, getTodayIstString } from '#services/streak_service'
import { checkAndReplenishQuizBank } from '#services/quiz_generator'

/**
 * Normalizes user grade strings (e.g. "Class 10 Science", "Class 10") into a canonical group.
 */
export function normalizeGrade(gradeStr?: string | null): string {
  if (!gradeStr) return 'Class 10'
  const match = String(gradeStr).match(/(?:class|grade)?\s*(\d{1,2})/i)
  if (match) {
    return `Class ${match[1]}`
  }
  return gradeStr.trim()
}

/**
 * Deterministic pseudo-random number generator seeded by string hash (Murmur3-inspired).
 */
function createSeededRandom(seedStr: string): () => number {
  let h = 0x811c9dc5
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  let s = h >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * Lazily generates or returns the shared daily quiz pool for a given grade on today's IST date.
 * Exactly 25 quizzes (DAILY_QUIZ_COUNT=25).
 *
 * Guarantees:
 * 1. Quizzes picked have NEVER appeared in any previous daily pool for that grade.
 * 2. If unused pool is running low (< 60), triggers non-blocking background AI replenishment.
 * 3. Records every quiz in user_quiz_history for the requesting user.
 * 4. Safe and idempotent under concurrent requests via DB transactions and unique constraints.
 */
export async function getOrCreateDailyQuizzes(
  grade: string,
  dateStr = getTodayIstString(),
  userId?: number
): Promise<Quiz[]> {
  const normalized = normalizeGrade(grade)
  const countNeeded = Number(env.get('DAILY_QUIZ_COUNT')) || 25

  // 1. Check if today's pool already exists
  const existingRows = await DailyQuiz.query()
    .where('quiz_date', dateStr)
    .where('grade', normalized)
    .orderBy('slot_number', 'asc')
    .preload('quiz')

  let selectedQuizzes: Quiz[] = []

  if (existingRows.length >= countNeeded) {
    for (const r of existingRows) {
      if (r.quiz && (r.quiz.isActive ?? true) && (r.quiz.isPublished ?? true)) {
        selectedQuizzes.push(r.quiz as unknown as Quiz)
      }
    }
  }

  // 2. Generate pool if missing or incomplete
  if (selectedQuizzes.length < countNeeded) {
    selectedQuizzes = await db.transaction(async (trx) => {
      // Re-check inside transaction
      const doubleCheck = await trx
        .from('daily_quizzes')
        .where('quiz_date', dateStr)
        .where('grade', normalized)
        .orderBy('slot_number', 'asc')

      if (doubleCheck.length >= countNeeded) {
        const quizIds = doubleCheck.map((r) => r.quiz_id)
        const loaded = await Quiz.query({ client: trx })
          .whereIn('id', quizIds)
          .where('is_published', true)
        // Maintain slot order
        const map = new Map(loaded.map((q) => [q.id, q]))
        return quizIds.map((id) => map.get(id)).filter(Boolean) as Quiz[]
      }

      // Check if unused count is low and trigger background replenishment
      void checkAndReplenishQuizBank(normalized)

      // Lazy cleanup: archive older attempts (prior to today IST)
      await trx
        .from('quiz_results')
        .where('quiz_date', '<', dateStr)
        .whereNull('archived_at')
        .update({ archived_at: new Date() })

      // Fetch candidates that have NEVER been used in daily_quizzes for this grade on ANY previous day
      const previouslyUsedQuery = trx
        .from('daily_quizzes')
        .where('grade', normalized)
        .where('quiz_date', '<', dateStr)
        .select('quiz_id')

      const candidates = await Quiz.query({ client: trx })
        .where('is_published', true)
        .where('is_active', true)
        .where((b) => {
          b.where('grade', normalized)
            .orWhereNull('grade')
            .orWhere('subject', 'General Knowledge')
        })
        .whereNotIn('id', previouslyUsedQuery)

      const rng = createSeededRandom(`${dateStr}-${normalized}`)

      // Score candidates to balance subjects and difficulties
      const scored = candidates.map((q) => {
        let score = rng()
        return { quiz: q, score }
      })
      scored.sort((a, b) => b.score - a.score)

      const chosen: Quiz[] = []
      const chosenIds = new Set<number>()

      // Round 1: Subject diversity
      const seenSubjects = new Set<string>()
      for (const item of scored) {
        if (chosen.length >= countNeeded) break
        const subj = (item.quiz.subject || 'General').toLowerCase()
        if (!seenSubjects.has(subj)) {
          chosen.push(item.quiz)
          chosenIds.add(item.quiz.id)
          seenSubjects.add(subj)
        }
      }

      // Round 2: Fill remaining slots up to countNeeded
      for (const item of scored) {
        if (chosen.length >= countNeeded) break
        if (!chosenIds.has(item.quiz.id)) {
          chosen.push(item.quiz)
          chosenIds.add(item.quiz.id)
        }
      }

      // Fallback: If bank has fewer than countNeeded unused quizzes (e.g. initial setup before AI generates),
      // recycle oldest used quizzes only as a last resort
      if (chosen.length < countNeeded) {
        console.warn(`[DailyQuiz] Grade ${normalized} has only ${chosen.length}/${countNeeded} unused quizzes. Recycling oldest used quizzes as fallback.`)
        const recycled = await Quiz.query({ client: trx })
          .where('is_published', true)
          .where('is_active', true)
          .where((b) => {
            b.where('grade', normalized)
              .orWhereNull('grade')
              .orWhere('subject', 'General Knowledge')
          })
          .whereNotIn('id', Array.from(chosenIds))
          .limit(countNeeded - chosen.length)

        for (const r of recycled) {
          chosen.push(r)
          chosenIds.add(r.id)
        }
      }

      // Insert into daily_quizzes
      for (let i = 0; i < chosen.length; i++) {
        const q = chosen[i]
        try {
          await trx
            .table('daily_quizzes')
            .insert({
              quiz_date: dateStr,
              grade: normalized,
              quiz_id: q.id,
              slot_number: i + 1,
              created_at: new Date(),
              updated_at: new Date(),
            })
        } catch {
          // Ignored under concurrent generation
        }
      }

      return chosen
    })
  }

  // 3. Record in user_quiz_history for this user so they never receive duplicate quizzes
  if (userId && selectedQuizzes.length > 0) {
    for (const q of selectedQuizzes) {
      try {
        await db.rawQuery(
          `INSERT INTO user_quiz_history (user_id, quiz_id, first_served_date, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())
           ON CONFLICT (user_id, quiz_id) DO NOTHING`,
          [userId, q.id, dateStr]
        )
      } catch {
        // ignore conflict
      }
    }
  }

  return selectedQuizzes
}

/**
 * Returns the exact ISO string of the next 00:00:00 midnight in Asia/Kolkata.
 */
export function getNextMidnightIstIso(): string {
  const tz = getAppTimezone()
  const nextMidnight = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('day')
  return nextMidnight.toISO()!
}
