import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import vine from '@vinejs/vine'
import Quiz, { QuizQuestion } from '#models/quiz'
import GenerationLog from '#models/generation_log'
import { normalizeGrade } from '#services/daily_quiz_service'

/*
|--------------------------------------------------------------------------
| Quiz Generator Service (Google Gemini AI Pipeline)
|--------------------------------------------------------------------------
| Generates age-appropriate, syllabus-accurate (CBSE/NCERT) quizzes with
| strict VineJS schema validation, deduplication, retry loops, and
| background non-blocking replenishment.
*/

export interface RawAiQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface RawAiQuiz {
  title: string
  description: string
  subject: string
  grade: string
  difficulty: 'easy' | 'medium' | 'hard'
  xpReward?: number
  estimatedMinutes?: number
  iconKey?: string
  questions: RawAiQuestion[]
}

// VineJS schema for strict AI payload validation
const quizValidationSchema = vine.compile(
  vine.object({
    quizzes: vine.array(
      vine.object({
        title: vine.string().trim().minLength(5).maxLength(180),
        description: vine.string().trim().minLength(10).maxLength(400),
        subject: vine.string().trim().minLength(2).maxLength(80),
        grade: vine.string().trim(),
        difficulty: vine.enum(['easy', 'medium', 'hard'] as const),
        xpReward: vine.number().min(30).max(150).optional(),
        estimatedMinutes: vine.number().min(2).max(15).optional(),
        iconKey: vine.string().trim().optional(),
        questions: vine
          .array(
            vine.object({
              question: vine.string().trim().minLength(8).maxLength(400),
              options: vine.array(vine.string().trim().minLength(1).maxLength(200)),
              correctIndex: vine.number().min(0).max(3),
              explanation: vine.string().trim().minLength(5).maxLength(500),
            })
          )
          .minLength(5)
          .maxLength(5),
      })
    ),
  })
)

/**
 * Standardizes subject icons and XP rewards according to difficulty
 */
export function getSubjectIconKey(subject: string): string {
  const s = subject.toLowerCase()
  if (s.includes('math')) return 'maths'
  if (s.includes('physic')) return 'physics'
  if (s.includes('chem')) return 'chemistry'
  if (s.includes('bio')) return 'biology'
  if (s.includes('computer') || s.includes('code') || s.includes('tech')) return 'cs'
  if (s.includes('commerce') || s.includes('account') || s.includes('econom') || s.includes('business')) return 'commerce'
  if (s.includes('english') || s.includes('grammar') || s.includes('literature')) return 'english'
  return 'gk'
}

export function getDefaultXpReward(difficulty: 'easy' | 'medium' | 'hard'): number {
  switch (difficulty) {
    case 'easy':
      return Math.floor(Math.random() * 21) + 30 // 30-50 XP
    case 'hard':
      return Math.floor(Math.random() * 51) + 100 // 100-150 XP
    case 'medium':
    default:
      return Math.floor(Math.random() * 31) + 60 // 60-90 XP
  }
}

/**
 * Normalizes title for deduplication comparison
 */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').trim()
}

/**
 * Generates a clean URL-friendly unique slug
 */
export function generateSlug(title: string, grade: string): string {
  const base = `${grade}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
  return `${base}-${randomUUID().slice(0, 8)}`
}

/**
 * Calls Gemini API to generate multiple quizzes for a grade
 */
export async function generateQuizzesWithGemini(
  grade: string,
  countToGenerate: number,
  preferredSubjects?: string[]
): Promise<RawAiQuiz[]> {
  const apiKey = env.get('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment.')
  }

  const model = env.get('GEMINI_MODEL') || 'gemini-2.5-flash'
  const endpoint = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`)
  endpoint.searchParams.set('key', apiKey)

  const subjectsHint = preferredSubjects?.length
    ? `Focus on subjects: ${preferredSubjects.join(', ')}.`
    : `Include an authentic mix of subjects appropriate for ${grade} (such as Mathematics, Physics, Chemistry, Biology, English, Computer Science, Commerce/Accountancy, General Knowledge).`

  const prompt = `You are an expert Indian curriculum (CBSE/NCERT) educational content developer.
Generate exactly ${countToGenerate} distinct, high-quality multiple choice quizzes for students in ${grade}.
${subjectsHint}

CRITICAL RULES:
1. Each quiz must have:
   - title: informative and clear (e.g. "Newton's Laws of Motion in Action", "Quadratic Equations Real World Problems")
   - description: 1-2 sentence overview of learning objectives
   - subject: subject name (Mathematics, Physics, Chemistry, Biology, English, Computer Science, Commerce, General Knowledge)
   - grade: "${grade}"
   - difficulty: "easy", "medium", or "hard" (mix evenly)
   - estimatedMinutes: 5
   - questions: EXACTLY 5 multiple choice questions.
2. For each question:
   - question: clear, factually correct, unambiguous problem statement.
   - options: EXACTLY 4 distinct plausible answer options. NO duplicates. NO "None of the above" or "All of the above".
   - correctIndex: index (0, 1, 2, or 3) of the single correct option.
   - explanation: short, educational explanation of why the correct answer is right.
3. Content must strictly match the intellectual and syllabus level of ${grade} students in India.
4. Output STRICT JSON only. Format:
{
  "quizzes": [
    {
      "title": "...",
      "description": "...",
      "subject": "...",
      "grade": "${grade}",
      "difficulty": "medium",
      "questions": [
        {
          "question": "...",
          "options": ["A", "B", "C", "D"],
          "correctIndex": 0,
          "explanation": "..."
        }
      ]
    }
  ]
}`

  let attempt = 0
  let lastError: Error | null = null

  while (attempt < 3) {
    attempt++
    try {
      const response = await fetch(endpoint.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.6 + (attempt * 0.1),
            maxOutputTokens: 8192,
          },
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Gemini API HTTP ${response.status}: ${errText.slice(0, 300)}`)
      }

      const resJson = (await response.json()) as any
      const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!rawText) {
        throw new Error('Gemini returned an empty response candidate.')
      }

      // Parse JSON
      let parsed: any
      try {
        parsed = JSON.parse(rawText)
      } catch {
        // Strip possible markdown fences if returned
        const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
        parsed = JSON.parse(cleaned)
      }

      // Validate using VineJS
      const validated = await quizValidationSchema.validate(parsed)

      // Filter out quizzes with invalid question counts or duplicate options
      const validQuizzes: RawAiQuiz[] = []
      for (const q of validated.quizzes) {
        if (q.questions.length !== 5) continue

        let hasOptionError = false
        for (const question of q.questions) {
          if (question.options.length !== 4) {
            hasOptionError = true
            break
          }
          const uniqueOptions = new Set(question.options.map((opt) => opt.trim().toLowerCase()))
          if (uniqueOptions.size !== 4) {
            hasOptionError = true // duplicate choices in same question
            break
          }
          if (question.correctIndex < 0 || question.correctIndex > 3) {
            hasOptionError = true
            break
          }
        }

        if (!hasOptionError) {
          validQuizzes.push(q as RawAiQuiz)
        }
      }

      if (validQuizzes.length > 0) {
        return validQuizzes
      }

      throw new Error(`None of the generated quizzes passed strict option/question validation on attempt ${attempt}.`)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[QuizGenerator] Attempt ${attempt} failed: ${lastError.message}`)
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
      }
    }
  }

  throw lastError || new Error('Failed to generate valid quizzes from Gemini.')
}

/**
 * Saves validated AI quizzes to the database, ensuring no duplicate titles for that grade.
 */
export async function persistAiQuizzes(
  quizzes: RawAiQuiz[],
  grade: string
): Promise<{ created: number; skippedDuplicates: number }> {
  const normalizedGrade = normalizeGrade(grade)

  // Load existing titles for this grade to avoid near-duplicates
  const existingRows = await Quiz.query()
    .where('grade', normalizedGrade)
    .select('title', 'slug')

  const existingTitleSet = new Set(existingRows.map((r) => normalizeTitle(r.title)))
  const existingSlugSet = new Set(existingRows.map((r) => r.slug).filter(Boolean))

  let createdCount = 0
  let skippedDuplicates = 0

  for (const raw of quizzes) {
    const norm = normalizeTitle(raw.title)
    if (existingTitleSet.has(norm)) {
      skippedDuplicates++
      continue
    }

    const slug = generateSlug(raw.title, normalizedGrade)
    if (existingSlugSet.has(slug)) {
      skippedDuplicates++
      continue
    }

    const diff = raw.difficulty || 'medium'
    const xpReward = raw.xpReward && raw.xpReward >= 30 ? raw.xpReward : getDefaultXpReward(diff)
    const iconKey = raw.iconKey || getSubjectIconKey(raw.subject)

    try {
      await db.transaction(async (trx) => {
        const quiz = await Quiz.create(
          {
            title: raw.title.trim(),
            description: raw.description?.trim() || `Quiz on ${raw.subject} for ${normalizedGrade}`,
            grade: normalizedGrade,
            subject: raw.subject.trim(),
            slug,
            difficulty: diff,
            xpReward,
            timeLimitMinutes: raw.estimatedMinutes || 5,
            iconKey,
            isPublished: true,
            isActive: true,
            source: 'ai',
            reviewed: false,
          },
          { client: trx }
        )

        const questionsData = raw.questions.map((q, idx) => ({
          quizId: quiz.id,
          question: q.question.trim(),
          options: q.options.map((opt) => opt.trim()),
          correctOption: q.correctIndex,
          explanation: q.explanation.trim(),
          sortOrder: idx + 1,
        }))

        await QuizQuestion.createMany(questionsData, { client: trx })
      })

      existingTitleSet.add(norm)
      existingSlugSet.add(slug)
      createdCount++
    } catch (saveErr) {
      console.error(`[QuizGenerator] Failed to save quiz "${raw.title}":`, saveErr)
    }
  }

  return { created: createdCount, skippedDuplicates }
}

/**
 * Counts unused quizzes for a given grade
 */
export async function getUnusedQuizCount(grade: string): Promise<number> {
  const normalized = normalizeGrade(grade)
  const result = await db.rawQuery(
    `SELECT COUNT(*)::int as count 
     FROM quizzes 
     WHERE grade = ? 
       AND is_published = true 
       AND is_active = true 
       AND id NOT IN (SELECT quiz_id FROM daily_quizzes WHERE grade = ?)`,
    [normalized, normalized]
  )
  return Number(result.rows?.[0]?.count ?? 0)
}

/**
 * Attempts to acquire a generation lock for a grade (expires in 5 minutes)
 */
async function acquireGenerationLock(lockKey: string): Promise<boolean> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000) // 5 minutes

  try {
    const existing = await db
      .from('quiz_generation_locks')
      .where('lock_key', lockKey)
      .first()

    if (existing) {
      if (new Date(existing.expires_at) > now) {
        return false // Lock active
      }
      // Lock expired, update it
      await db
        .from('quiz_generation_locks')
        .where('lock_key', lockKey)
        .update({ locked_at: now, expires_at: expiresAt })
      return true
    }

    // Insert new lock
    await db.table('quiz_generation_locks').insert({
      lock_key: lockKey,
      locked_at: now,
      expires_at: expiresAt,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Releases a generation lock
 */
async function releaseGenerationLock(lockKey: string): Promise<void> {
  try {
    await db.from('quiz_generation_locks').where('lock_key', lockKey).delete()
  } catch {
    // ignore
  }
}

/**
 * Non-blocking background replenishment job.
 * If unused quizzes for grade are below QUIZ_BANK_MIN_UNUSED (default 60),
 * generates batches until threshold is satisfied.
 */
export async function checkAndReplenishQuizBank(grade: string): Promise<void> {
  const normalized = normalizeGrade(grade)
  const minThreshold = Number(env.get('QUIZ_BANK_MIN_UNUSED')) || 60

  const unusedCount = await getUnusedQuizCount(normalized)
  if (unusedCount >= minThreshold) {
    return // Already healthy
  }

  const lockKey = `topup_${normalized}`
  const acquired = await acquireGenerationLock(lockKey)
  if (!acquired) {
    return // Another top-up is already running
  }

  // Fire and forget background worker
  ;(async () => {
    let totalGenerated = 0
    let totalFailed = 0
    let lastErrorShort: string | null = null

    try {
      const deficit = minThreshold - unusedCount
      const batches = Math.ceil(deficit / 5) // Generate in batches of 5 to avoid timeouts & rate limits

      for (let b = 0; b < Math.min(batches, 6); b++) {
        try {
          const generated = await generateQuizzesWithGemini(normalized, 5)
          const result = await persistAiQuizzes(generated, normalized)
          totalGenerated += result.created
          // Short delay between batches
          await new Promise((r) => setTimeout(r, 2000))
        } catch (bErr) {
          totalFailed += 5
          lastErrorShort = bErr instanceof Error ? bErr.message.slice(0, 500) : String(bErr)
          break
        }
      }

      await GenerationLog.create({
        grade: normalized,
        requested: deficit,
        created: totalGenerated,
        failed: totalFailed,
        errorShort: lastErrorShort,
      })
    } catch (err) {
      console.error(`[QuizGenerator] Background topup failed for ${normalized}:`, err)
    } finally {
      await releaseGenerationLock(lockKey)
    }
  })().catch(() => {})
}

