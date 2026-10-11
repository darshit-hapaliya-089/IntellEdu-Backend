import { randomUUID } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import DoubtSolverHistory from '#models/doubt_solver_history'
import env from '#start/env'
import { AI_QUESTION_XP_COST, changeXpInTransaction } from '#services/xp_service'
import vine from '@vinejs/vine'

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  error?: { message?: string }
}

function toDateTime(value: unknown): DateTime | null {
  if (!value) return null
  if (value instanceof DateTime) return value
  if (value instanceof Date) return DateTime.fromJSDate(value)
  const parsed = DateTime.fromISO(String(value))
  return parsed.isValid ? parsed : null
}

function trialDetails(firstUseValue: unknown, now = DateTime.now()) {
  const startedAt = toDateTime(firstUseValue)
  if (!startedAt) {
    return {
      trialActive: false,
      trialDay: null,
      trialStartedAt: null,
      trialExpiresAt: null,
      trialDaysRemaining: 10,
    }
  }
  const expiresAt = startedAt.plus({ days: 10 })
  const trialActive = now < expiresAt
  const day = Math.floor(Math.max(0, now.diff(startedAt).as('days'))) + 1
  return {
    trialActive,
    trialDay: trialActive ? Math.min(day, 10) : 11,
    trialStartedAt: startedAt.toISO(),
    trialExpiresAt: expiresAt.toISO(),
    trialDaysRemaining: trialActive ? Math.max(0, Math.ceil(expiresAt.diff(now).as('days'))) : 0,
  }
}

export default class GeminiDoubtSolverController {
  /** GET /api/v1/doubts/status [Protected] */
  async status({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const account = await db.from('users')
      .select('points', 'ai_first_used_at')
      .where('id', user.id)
      .first()
    if (!account) return response.notFound({ message: 'User not found.' })

    return response.ok({
      xpBalance: Number(account.points),
      currentXpBalance: Number(account.points),
      xpCostPerQuestion: AI_QUESTION_XP_COST,
      ...trialDetails(account.ai_first_used_at),
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
          .select('points', 'ai_first_used_at')
          .where('id', user.id)
          .first()
        return response.ok({
          id: previous.id,
          question: previous.question,
          answer: previous.answer,
          subject: previous.subject,
          createdAt: previous.createdAt,
          xpCost: previous.xpCost,
          xpBalance: Number(account.points),
          currentXpBalance: Number(account.points),
          ...trialDetails(account.ai_first_used_at),
        })
      }
    }

    const apiKey = env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return response.status(503).send({ message: 'Gemini AI is not configured.' })
    }

    const access = await db.transaction(async (trx) => {
      const account = await trx.from('users').where('id', user.id).forUpdate().first()
      if (!account) return null
      let firstUseAt = account.ai_first_used_at
      if (!firstUseAt) {
        firstUseAt = DateTime.now().toJSDate()
        await trx.from('users').where('id', user.id).update({
          ai_first_used_at: firstUseAt,
          updated_at: firstUseAt,
        })
      }
      return {
        points: Number(account.points),
        firstUseAt,
        trial: trialDetails(firstUseAt),
      }
    })
    if (!access) return response.notFound({ message: 'User not found.' })
    if (!access.trial.trialActive && access.points < AI_QUESTION_XP_COST) {
      return response.status(402).send({
        message: `This AI question costs ${AI_QUESTION_XP_COST} XP. Earn more XP to continue.`,
        requiredXp: AI_QUESTION_XP_COST,
        availableXp: access.points,
        xpBalance: access.points,
        currentXpBalance: access.points,
        ...access.trial,
      })
    }

    const endpoint = new URL(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
    )
    endpoint.searchParams.set('key', apiKey)

    let providerResponse: Response
    try {
      providerResponse = await fetch(endpoint, {
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
        signal: AbortSignal.timeout(20000),
      })
    } catch {
      return response.status(502).send({ message: 'Gemini AI could not be reached.' })
    }

    const providerData = (await providerResponse.json().catch(() => ({}))) as GeminiResponse
    const answer = providerData.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim()

    if (!providerResponse.ok || !answer) {
      return response.status(502).send({
        message: providerData.error?.message || 'Gemini AI did not return an answer.',
      })
    }

    const saved = await db.transaction(async (trx) => {
      const account = await trx.from('users').where('id', user.id).forUpdate().first()
      if (requestId) {
        const previous = await trx.from('doubt_solver_history')
          .where('user_id', user.id)
          .where('client_request_id', requestId)
          .first()
        if (previous) {
          if (previous.question !== question || previous.subject !== (subject || 'General')) {
            return { conflict: true as const, balance: Number(account.points) }
          }
          return { record: previous, xpCost: Number(previous.xp_cost), balance: Number(account.points), duplicate: true as const }
        }
      }

      let xpCost = 0
      let balance = Number(account.points)
      if (!access.trial.trialActive) {
        const charge = await changeXpInTransaction(trx, {
          userId: user.id,
          amount: -AI_QUESTION_XP_COST,
          reason: 'ai_doubt_question',
          sourceKey: `ai-question:${user.id}:${randomUUID()}`,
        })
        if (!charge.awarded) {
          return { insufficient: true as const, balance: charge.balance }
        }
        xpCost = AI_QUESTION_XP_COST
        balance = charge.balance
      }

      const [id] = await trx.table('doubt_solver_history').insert({
        user_id: user.id,
        question,
        answer,
        subject: subject || 'General',
        xp_cost: xpCost,
        client_request_id: requestId,
        created_at: DateTime.now().toJSDate(),
        updated_at: DateTime.now().toJSDate(),
      }).returning('id')
      const record = await trx.from('doubt_solver_history').where('id', typeof id === 'number' ? id : id.id).first()
      return { record, xpCost, balance, duplicate: false as const }
    })

    if ('conflict' in saved) {
      return response.conflict({ message: 'This Idempotency-Key was already used for a different question.' })
    }
    if ('insufficient' in saved) {
      return response.status(402).send({
        message: `This AI question costs ${AI_QUESTION_XP_COST} XP. Earn more XP to continue.`,
        requiredXp: AI_QUESTION_XP_COST,
        availableXp: saved.balance,
        xpBalance: saved.balance,
        currentXpBalance: saved.balance,
        ...trialDetails(access.firstUseAt),
      })
    }

    const body = {
      id: saved.record.id,
      question: saved.record.question,
      answer: saved.record.answer,
      subject: saved.record.subject,
      createdAt: saved.record.created_at ?? saved.record.createdAt,
      xpCost: saved.xpCost,
      xpBalance: saved.balance,
      currentXpBalance: saved.balance,
      ...access.trial,
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
