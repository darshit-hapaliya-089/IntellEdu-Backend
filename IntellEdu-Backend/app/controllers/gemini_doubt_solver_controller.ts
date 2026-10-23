import { randomUUID } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import DoubtSolverHistory from '#models/doubt_solver_history'
import env from '#start/env'
import { changeXpInTransaction } from '#services/xp_service'
import vine from '@vinejs/vine'

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  error?: { message?: string; code?: number; status?: string }
}

export function getAiBillingConfig() {
  const freeStreakTarget = Number(env.get('AI_FREE_STREAK_DAYS')) || 10
  const costXp = Number(env.get('AI_ANSWER_XP_COST')) || 10
  return { freeStreakTarget, costXp }
}

export function computeAiStatus(user: {
  points: number | string
  streak: number | string
  longest_streak?: number | string
  longestStreak?: number | string
  ai_paid_mode_at?: Date | string | null
  aiPaidModeAt?: Date | string | null
}) {
  const { freeStreakTarget, costXp } = getAiBillingConfig()
  const streak = Number(user.streak || 0)
  const longestStreak = Number(user.longest_streak ?? user.longestStreak ?? streak)
  const paidModeAt = user.ai_paid_mode_at ?? user.aiPaidModeAt ?? null

  const isPaid = Boolean(paidModeAt || longestStreak >= freeStreakTarget || streak >= freeStreakTarget)
  const xpAvailable = Number(user.points || 0)

  const mode: 'free' | 'paid' = isPaid ? 'paid' : 'free'
  const daysToUnlockPaid = isPaid ? 0 : Math.max(0, freeStreakTarget - longestStreak)
  const canAsk = isPaid ? xpAvailable >= costXp : true

  return {
    mode,
    streakDays: longestStreak,
    freeStreakTarget,
    daysToUnlockPaid,
    costXp: isPaid ? costXp : 0,
    xpAvailable,
    canAsk,
    // Legacy support for older clients
    xpBalance: xpAvailable,
    currentXpBalance: xpAvailable,
    xpCostPerQuestion: isPaid ? costXp : 0,
    trialActive: !isPaid,
    trialDay: longestStreak,
    trialDaysRemaining: daysToUnlockPaid,
  }
}

export default class GeminiDoubtSolverController {
  /** GET /api/v1/doubts/status [Protected] */
  async status({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const account = await db.from('users')
      .select('points', 'streak', 'longest_streak', 'ai_paid_mode_at')
      .where('id', user.id)
      .first()
    if (!account) return response.notFound({ message: 'User not found.' })

    const apiKey = env.get('GEMINI_API_KEY')
    const aiAvailable = Boolean(apiKey && apiKey.trim().length > 0)

    const computed = computeAiStatus(account)
    return response.ok({
      ...computed,
      aiAvailable,
    })
  }

  /** POST /api/v1/doubts/ask [Protected] */
  async ask({ auth, request, response }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        question: vine.string().trim().minLength(3).maxLength(4000),
        subject: vine.string().trim().maxLength(80).optional(),
      })
    )
    const { question, subject } = await request.validateUsing(schema)
    const user = auth.getUserOrFail()

    // 1. Idempotency Key Check
    const requestId = request.header('Idempotency-Key')?.trim() || null
    if (requestId && requestId.length > 100) {
      return response.badRequest({ message: 'Idempotency-Key must be 100 characters or fewer.' })
    }

    if (requestId) {
      const previous = await DoubtSolverHistory.query()
        .where('user_id', user.id)
        .where('client_request_id', requestId)
        .first()
      if (previous) {
        if (previous.question !== question || previous.subject !== (subject || 'General')) {
          return response.conflict({ message: 'This Idempotency-Key was already used for a different question.' })
        }
        const account = await db.from('users')
          .select('points', 'streak', 'longest_streak', 'ai_paid_mode_at')
          .where('id', user.id)
          .first()
        const computed = computeAiStatus(account || user)
        return response.ok({
          id: previous.id,
          question: previous.question,
          answer: previous.answer,
          subject: previous.subject,
          createdAt: previous.createdAt,
          xpCost: previous.xpCost,
          ...computed,
        })
      }
    }

    // 2. Rate Limiting: 20 questions per user per hour
    const oneHourAgo = DateTime.now().minus({ hours: 1 }).toJSDate()
    const recentCountResult = await db.from('doubt_solver_history')
      .where('user_id', user.id)
      .where('created_at', '>=', oneHourAgo)
      .count('* as total')
    const recentCount = Number(recentCountResult[0]?.total ?? 0)

    if (recentCount >= 20) {
      return response.status(429).send({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'You have reached the limit of 20 questions per hour. Please take a break and try again later.',
      })
    }

    // 3. User check, auto-paid-mode lock & pre-flight XP check
    const { costXp, freeStreakTarget } = getAiBillingConfig()

    const account = await db.transaction(async (trx) => {
      const acc = await trx.from('users').where('id', user.id).forUpdate().first()
      if (!acc) return null

      // Check if user has reached paid threshold but ai_paid_mode_at is not recorded
      const streak = Number(acc.streak || 0)
      const longestStreak = Number(acc.longest_streak || 0)
      if ((longestStreak >= freeStreakTarget || streak >= freeStreakTarget) && !acc.ai_paid_mode_at) {
        const now = new Date()
        await trx.from('users').where('id', user.id).update({
          ai_paid_mode_at: now,
          updated_at: now,
        })
        acc.ai_paid_mode_at = now
      }
      return acc
    })

    if (!account) return response.notFound({ message: 'User not found.' })

    const computedStatus = computeAiStatus(account)
    const isPaid = computedStatus.mode === 'paid'

    // If paid and insufficient XP -> return 402 immediately without calling Gemini
    if (isPaid && computedStatus.xpAvailable < costXp) {
      return response.status(402).send({
        code: 'INSUFFICIENT_XP',
        required: costXp,
        available: computedStatus.xpAvailable,
        message: `You need ${costXp} XP to ask the AI. Solve quizzes to earn XP.`,
        ...computedStatus,
      })
    }

    // 4. Validate Gemini API Key
    const apiKey = env.get('GEMINI_API_KEY')?.trim()
    if (!apiKey) {
      console.warn('[GeminiDoubtSolver] GEMINI_API_KEY is not configured.')
      return response.status(503).send({
        code: 'AI_UNAVAILABLE',
        message: 'AI tutor is temporarily unavailable. You were not charged.',
      })
    }

    // 5. Call Gemini API with 15s timeout
    const model = env.get('GEMINI_MODEL') || 'gemini-2.5-flash'
    const endpoint = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    )
    endpoint.searchParams.set('key', apiKey)

    const abortController = new AbortController()
    const timeoutHandle = setTimeout(() => abortController.abort(), 15000)

    let providerResponse: Response
    try {
      providerResponse = await fetch(endpoint.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: 'You are IntellEdu AI Tutor, an encouraging educational assistant. Explain school and college topics clearly, step by step, with concepts, formulas, and examples. Ask a brief clarifying question if needed.',
            }],
          },
          contents: [{
            role: 'user',
            parts: [{ text: subject ? `Subject: ${subject}\n\nQuestion: ${question}` : question }],
          }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
        signal: abortController.signal,
      })
    } catch (fetchErr: any) {
      if (fetchErr?.name === 'AbortError' || abortController.signal.aborted) {
        console.warn('[GeminiDoubtSolver] Gemini request timed out after 15s.')
        return response.status(504).send({
          code: 'AI_TIMEOUT',
          message: 'AI response timed out. Please try again. You were not charged.',
        })
      }
      console.warn('[GeminiDoubtSolver] Network error reaching Gemini provider.')
      return response.status(503).send({
        code: 'AI_UNAVAILABLE',
        message: 'AI tutor is temporarily unavailable. You were not charged.',
      })
    } finally {
      clearTimeout(timeoutHandle)
    }

    if (!providerResponse.ok) {
      const status = providerResponse.status
      console.warn(`[GeminiDoubtSolver] Gemini API returned error status HTTP ${status}.`)

      if (status === 400 || status === 401 || status === 403) {
        // Invalid key, permission denied, or bad auth
        return response.status(503).send({
          code: 'AI_UNAVAILABLE',
          message: 'AI tutor is temporarily unavailable. You were not charged.',
        })
      }

      if (status === 429) {
        return response.status(429).send({
          code: 'AI_BUSY',
          message: 'AI is busy, try again in a minute.',
        })
      }

      return response.status(503).send({
        code: 'AI_UNAVAILABLE',
        message: 'AI tutor is temporarily unavailable. You were not charged.',
      })
    }

    const providerData = (await providerResponse.json().catch(() => ({}))) as GeminiResponse
    const answer = providerData.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim()

    if (!answer) {
      console.warn('[GeminiDoubtSolver] Gemini returned empty answer text.')
      return response.status(503).send({
        code: 'AI_UNAVAILABLE',
        message: 'AI tutor is temporarily unavailable. You were not charged.',
      })
    }

    // 6. Gemini succeeded! Now atomically deduct XP (if paid) and store in history
    const saved = await db.transaction(async (trx) => {
      const userAcc = await trx.from('users').where('id', user.id).forUpdate().first()

      // Double-check idempotency key inside lock
      if (requestId) {
        const previous = await trx.from('doubt_solver_history')
          .where('user_id', user.id)
          .where('client_request_id', requestId)
          .first()
        if (previous) {
          if (previous.question !== question || previous.subject !== (subject || 'General')) {
            return { conflict: true as const, balance: Number(userAcc.points) }
          }
          return {
            record: previous,
            xpCost: Number(previous.xp_cost),
            balance: Number(userAcc.points),
            duplicate: true as const,
          }
        }
      }

      let deductedCost = 0
      let balance = Number(userAcc.points)

      if (isPaid) {
        const charge = await changeXpInTransaction(trx, {
          userId: user.id,
          amount: -costXp,
          reason: 'ai_doubt_question',
          sourceKey: `ai-question:${user.id}:${requestId || randomUUID()}`,
        })

        if (!charge.awarded) {
          return { insufficient: true as const, balance: charge.balance }
        }
        deductedCost = costXp
        balance = charge.balance
      }

      const [id] = await trx.table('doubt_solver_history').insert({
        user_id: user.id,
        question,
        answer,
        subject: subject || 'General',
        xp_cost: deductedCost,
        client_request_id: requestId,
        created_at: DateTime.now().toJSDate(),
        updated_at: DateTime.now().toJSDate(),
      }).returning('id')

      const record = await trx.from('doubt_solver_history')
        .where('id', typeof id === 'number' ? id : id.id)
        .first()

      return { record, xpCost: deductedCost, balance, duplicate: false as const }
    })

    if ('conflict' in saved) {
      return response.conflict({ message: 'This Idempotency-Key was already used for a different question.' })
    }

    if ('insufficient' in saved) {
      return response.status(402).send({
        code: 'INSUFFICIENT_XP',
        required: costXp,
        available: saved.balance,
        message: `You need ${costXp} XP to ask the AI. Solve quizzes to earn XP.`,
        xpAvailable: saved.balance,
        xpBalance: saved.balance,
        currentXpBalance: saved.balance,
      })
    }

    const latestStatus = computeAiStatus({
      ...account,
      points: saved.balance,
    })

    const body = {
      id: saved.record.id,
      question: saved.record.question,
      answer: saved.record.answer,
      subject: saved.record.subject,
      createdAt: saved.record.created_at ?? saved.record.createdAt,
      xpCost: saved.xpCost,
      ...latestStatus,
    }

    return saved.duplicate ? response.ok(body) : response.created(body)
  }

  /** GET /api/v1/doubts/history [Protected] */
  async history({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const history = await DoubtSolverHistory.query()
      .where('user_id', user.id)
      .orderBy('created_at', 'desc')
      .limit(30)

    return response.ok({
      history: history.map((record) => ({
        id: record.id,
        question: record.question,
        answer: record.answer,
        subject: record.subject,
        xpCost: record.xpCost,
        createdAt: record.createdAt,
      })),
    })
  }
}
