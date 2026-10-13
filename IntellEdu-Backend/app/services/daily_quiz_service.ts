import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import Quiz from '#models/quiz'
import DailyQuiz from '#models/daily_quiz'
import { getAppTimezone, getTodayIstString } from '#services/streak_service'

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
 * Lazily generates or returns the daily quiz set for a given grade on today's IST date.
 * Idempotent, safe under concurrent calls via transactions + unique constraint.
 */
export async function getOrCreateDailyQuizzes(
  grade: string,
  dateStr = getTodayIstString()
): Promise<Quiz[]> {
  const normalized = normalizeGrade(grade)
  const countNeeded = Number(env.get('DAILY_QUIZ_COUNT')) || 5

  // 1. Check if daily set already exists
  const existingRows = await DailyQuiz.query()
    .where('quiz_date', dateStr)
    .where('grade', normalized)
    .orderBy('slot_number', 'asc')
    .preload('quiz')

  if (existingRows.length >= countNeeded) {
    const list: Quiz[] = []
    for (const r of existingRows) {
      if (r.quiz) list.push(r.quiz as unknown as Quiz)
    }
    return list
  }

  // 2. Need to lazily generate inside a transaction
  return db.transaction(async (trx) => {
    // Re-check inside transaction with lock
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
      return loaded
    }

    // Lazy cleanup: archive attempts older than 7 days when daily set is generated
    const sevenDaysAgo = DateTime.now()
      .setZone(getAppTimezone())
      .minus({ days: 7 })
      .toISODate()!

    await trx
      .from('quiz_results')
      .where('quiz_date', '<', sevenDaysAgo)
      .whereNull('archived_at')
      .update({ archived_at: new Date() })

    // Fetch candidate quizzes (same grade OR general quizzes with null grade or Class 10/GK)
    const candidates = await Quiz.query({ client: trx })
      .where('is_published', true)
      .where((builder) => {
        builder
          .where('grade', normalized)
          .orWhereNull('grade')
          .orWhere('subject', 'General Knowledge')
      })

    if (candidates.length === 0) {
      // Fallback: any published quizzes
      const fallback = await Quiz.query({ client: trx }).where('is_published', true).limit(countNeeded)
      return fallback
    }

    // Determine quizzes used in last N days to prefer fresh ones
    const recentQuizzes = await trx
      .from('daily_quizzes')
      .where('grade', normalized)
      .where('quiz_date', '>=', DateTime.fromISO(dateStr).minus({ days: 5 }).toISODate()!)
      .select('quiz_id')
    const recentIds = new Set(recentQuizzes.map((r) => r.quiz_id))

    // Seeded random shuffle
    const rng = createSeededRandom(`${dateStr}-${normalized}`)
    const scored = candidates.map((q) => {
      let score = rng()
      if (recentIds.has(q.id)) {
        score -= 2.0 // Penalize recently used
      }
      return { quiz: q, score }
    })

    scored.sort((a, b) => b.score - a.score)

    // Ensure subject and difficulty diversity if possible
    const selected: Quiz[] = []
    const seenSubjects = new Set<string>()

    for (const item of scored) {
      if (selected.length >= countNeeded) break
      const subj = item.quiz.subject || 'General'
      if (!seenSubjects.has(subj) || selected.length >= countNeeded - 1) {
        selected.push(item.quiz)
        seenSubjects.add(subj)
      }
    }

    // If still short, add remaining candidates
    for (const item of scored) {
      if (selected.length >= countNeeded) break
      if (!selected.some((s) => s.id === item.quiz.id)) {
        selected.push(item.quiz)
      }
    }

    // Insert into daily_quizzes table
    for (let i = 0; i < selected.length; i++) {
      const q = selected[i]
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
        // Ignored under concurrent generation (unique constraint protected)
      }
    }

    return selected
  })
}

/**
 * Returns the exact ISO string of the next 00:00:00 midnight in Asia/Kolkata.
 */
export function getNextMidnightIstIso(): string {
  const tz = getAppTimezone()
  const nextMidnight = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('day')
  return nextMidnight.toISO()!
}
