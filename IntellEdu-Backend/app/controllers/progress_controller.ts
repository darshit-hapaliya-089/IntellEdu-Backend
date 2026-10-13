import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import QuizResult from '#models/quiz_result'
import { recordDailyActivity, getTodayIstString } from '#services/streak_service'

const APP_TZ = 'Asia/Kolkata'

/*
|--------------------------------------------------------------------------
| ProgressController
|--------------------------------------------------------------------------
| Handles user progress tracking, streak calculation, and learning analytics.
*/
export default class ProgressController {

  /** GET /api/v1/progress — User's overall learning dashboard progress */
  async myProgress({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await user.load('courses')

    const totalQuizzes = await QuizResult.query()
      .where('user_id', user.id)
      .count('* as total')

    const avgAccuracy = await QuizResult.query()
      .where('user_id', user.id)
      .avg('accuracy as avg')

    const recentResults = await QuizResult.query()
      .where('user_id', user.id)
      .preload('quiz')
      .orderBy('created_at', 'desc')
      .limit(5)

    const enrolledCourses = user.courses.map((c: any) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      grade: c.grade,
      imageUrl: c.imageUrl,
      totalLessons: c.totalLessons,
      rating: c.rating,
      completedLessons: c.$extras.pivot_completed_lessons || 0,
      progressPercent: c.$extras.pivot_progress_percent || 0,
      isCompleted: Boolean(c.$extras.pivot_is_completed),
      lastAccessedAt: c.$extras.pivot_last_accessed_at,
    }))

    return response.ok({
      progress: {
        userId: user.id,
        points: user.points,
        streak: user.streak,
        longestStreak: user.longestStreak || user.streak,
        badge: user.badge,
        coursesEnrolled: user.courses.length,
        coursesCompleted: enrolledCourses.filter((c: any) => c.isCompleted).length,
        quizzesTaken: Number(totalQuizzes[0].$extras.total || 0),
        averageAccuracy: Math.round(Number(avgAccuracy[0].$extras.avg || 0)),
        enrolledCourses,
        recentQuizActivity: recentResults,
      },
    })
  }

  /** GET /api/v1/progress/overview — Aggregated dashboard overview (heatmap, XP chart, subject accuracy) */
  async overview({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await user.load('courses')

    const today = DateTime.now().setZone(APP_TZ).startOf('day')
    const thirtyDaysAgo = today.minus({ days: 29 })

    // ── 1. Quiz results for last 30 IST days ─────────────────────────────────
    const results = await QuizResult.query()
      .where('user_id', user.id)
      .where('created_at', '>=', thirtyDaysAgo.toUTC().toISO()!)
      .preload('quiz')
      .orderBy('created_at', 'desc')

    // ── 2. Build 30-day heatmap ───────────────────────────────────────────────
    const heatmapMap = new Map<string, { active: boolean; xpEarned: number; quizCount: number }>()
    for (let i = 0; i < 30; i++) {
      const d = today.minus({ days: 29 - i }).toISODate()!
      heatmapMap.set(d, { active: false, xpEarned: 0, quizCount: 0 })
    }

    // XP by day from quiz results
    const xpByDayMap = new Map<string, number>()
    for (let i = 0; i < 30; i++) {
      xpByDayMap.set(today.minus({ days: 29 - i }).toISODate()!, 0)
    }

    // Subject accuracy accumulator
    const subjectMap = new Map<string, { totalAccuracy: number; count: number }>()

    for (const r of results) {
      const istDate = DateTime.fromJSDate(
        r.createdAt instanceof DateTime ? r.createdAt.toJSDate() : new Date(r.createdAt as any)
      ).setZone(APP_TZ).toISODate()!

      if (heatmapMap.has(istDate)) {
        const entry = heatmapMap.get(istDate)!
        entry.active = true
        entry.xpEarned += r.xpEarned
        entry.quizCount += 1
        heatmapMap.set(istDate, entry)
      }

      if (xpByDayMap.has(istDate)) {
        xpByDayMap.set(istDate, (xpByDayMap.get(istDate) ?? 0) + r.xpEarned)
      }

      const subject = (r.quiz as any)?.subject?.toLowerCase?.() || 'general'
      const existing = subjectMap.get(subject) ?? { totalAccuracy: 0, count: 0 }
      existing.totalAccuracy += r.accuracy
      existing.count += 1
      subjectMap.set(subject, existing)
    }

    // ── 3. Also mark streak activity dates as active (login activity, no quiz needed) ──
    // We rely on quiz results for the heatmap (quiz activity = learning activity)
    // If user was active but no quiz that day, we check lastActiveDate for today only
    const todayStr = getTodayIstString()
    const lastActiveStr = (() => {
      const raw = user.lastActiveDate
      if (!raw) return null
      if (raw instanceof DateTime) return raw.toISODate()
      return String(raw).slice(0, 10)
    })()
    if (lastActiveStr && heatmapMap.has(lastActiveStr)) {
      const entry = heatmapMap.get(lastActiveStr)!
      if (!entry.active) {
        entry.active = true // login activity counts even without quiz
        heatmapMap.set(lastActiveStr, entry)
      }
    }

    // ── 4. Lifetime totals (all rows, including archived) ────────────────────
    const [totalQuizzesRow] = await QuizResult.query()
      .where('user_id', user.id)
      .count('* as total')
    const [avgAccRow] = await QuizResult.query()
      .where('user_id', user.id)
      .avg('accuracy as avg')

    // ── 5. Enrolled courses ───────────────────────────────────────────────────
    const enrolledCourses = user.courses.map((c: any) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      grade: c.grade,
      imageUrl: c.imageUrl,
      totalLessons: c.totalLessons,
      completedLessons: c.$extras.pivot_completed_lessons || 0,
      progressPercent: c.$extras.pivot_progress_percent || 0,
      isCompleted: Boolean(c.$extras.pivot_is_completed),
    }))

    // ── 6. Recent quiz activity (last 5, preloaded above) ────────────────────
    const recentQuizActivity = results.slice(0, 5).map((r) => ({
      id: r.id,
      score: r.score,
      totalQuestions: r.totalQuestions,
      accuracy: r.accuracy,
      xpEarned: r.xpEarned,
      createdAt: r.createdAt,
      quiz: {
        id: (r.quiz as any)?.id,
        title: (r.quiz as any)?.title || 'Quiz',
        subject: (r.quiz as any)?.subject,
      },
    }))

    return response.ok({
      overview: {
        totalXp: user.points,
        currentStreak: user.streak,
        longestStreak: user.longestStreak || user.streak,
        lastActivityDate: lastActiveStr,
        isActiveToday: lastActiveStr === todayStr,
        quizzesTaken: Number(totalQuizzesRow.$extras.total || 0),
        averageAccuracy: Math.round(Number(avgAccRow.$extras.avg || 0)),
        coursesEnrolled: user.courses.length,
        coursesCompleted: enrolledCourses.filter((c) => c.isCompleted).length,
        heatmap: [...heatmapMap.entries()].map(([date, v]) => ({ date, ...v })),
        xpByDay: [...xpByDayMap.entries()].map(([date, xp]) => ({ date, xp })),
        accuracyBySubject: [...subjectMap.entries()].map(([subject, v]) => ({
          subject,
          accuracy: Math.round(v.totalAccuracy / v.count),
          quizCount: v.count,
        })),
        enrolledCourses,
        recentQuizActivity,
      },
    })
  }

  /** GET /api/v1/progress/streak — Get streak details */
  async streak({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const today = getTodayIstString()
    const lastActiveRaw = user.lastActiveDate
    const lastActive = lastActiveRaw instanceof Date
      ? lastActiveRaw.toISOString().slice(0, 10)
      : lastActiveRaw
        ? String(lastActiveRaw).slice(0, 10)
        : null

    const isActiveToday = lastActive === today

    return response.ok({
      streak: user.streak,
      currentStreak: user.streak,
      longestStreak: user.longestStreak || user.streak,
      lastActivityDate: lastActive,
      lastActiveDate: lastActive,
      isActiveToday,
      streakIncreasedToday: false,
      badge: user.badge,
    })
  }

  /** POST /api/v1/progress/streak/ping — Daily study activity ping (idempotent, Asia/Kolkata) */
  async pingStreak({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const record = await recordDailyActivity(user.id)
    await user.refresh()

    return response.ok({
      message: record.streakIncreasedToday
        ? `🔥 Streak alive! Day ${record.currentStreak} logged.`
        : 'Streak already confirmed for today.',
      currentStreak: record.currentStreak,
      streak: record.currentStreak,
      longestStreak: record.longestStreak,
      lastActivityDate: record.lastActivityDate,
      streakIncreasedToday: record.streakIncreasedToday,
      milestoneBonusXp: record.milestoneBonusXp,
      points: user.points,
      currentXpBalance: user.points,
    })
  }
}
