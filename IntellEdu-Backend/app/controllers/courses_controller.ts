import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Course from '#models/course'
import CourseResource from '#models/course_resource'
import {
  changeXpInTransaction,
  LEARNING_XP_PER_MINUTE,
  MAX_LEARNING_MINUTES_PER_DAY,
  MAX_LEARNING_MINUTES_PER_SESSION,
} from '#services/xp_service'
import vine from '@vinejs/vine'

/*
|--------------------------------------------------------------------------
| CoursesController
|--------------------------------------------------------------------------
*/
export default class CoursesController {

  /** GET /api/v1/courses */
  async index({ request, response }: HttpContext) {
    const page    = request.input('page', 1)
    const perPage = request.input('per_page', 12)
    const grade   = request.input('grade')
    const category = request.input('category')

    const query = Course.query().where('is_published', true)
    if (grade) {
      const gradeNumber = grade.match(/(?:class|grade)?\s*(\d{1,2})/i)?.[1]
      if (gradeNumber && Number(gradeNumber) >= 5 && Number(gradeNumber) <= 12) {
        query.where((scope) => scope
          .whereRaw('LOWER(TRIM(grade)) = ?', [gradeNumber])
          .orWhereRaw('LOWER(TRIM(grade)) LIKE ?', [`class ${gradeNumber}%`])
          .orWhereRaw('LOWER(TRIM(grade)) = ?', [`grade ${gradeNumber}`]))
      } else {
        query.whereRaw('LOWER(grade) = ?', [grade.toLowerCase()])
      }
    }
    if (category) query.where('category', category)

    const courses = await query.orderBy('created_at', 'desc').paginate(page, perPage)
    return response.ok(courses)
  }

  /** GET /api/v1/courses/:id */
  async show({ params, response }: HttpContext) {
    const course = await Course.query()
      .where('id', params.id)
      .preload('creator', (query) => query.select(['id', 'full_name']))
      .first()
    if (!course) return response.notFound({ message: 'Course not found.' })
    const resources = await CourseResource.query()
      .where('course_id', course.id)
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
    return response.ok({ course, resources })
  }

  /** GET /api/v1/courses/:id/resources */
  async resources({ params, response }: HttpContext) {
    const course = await Course.query()
      .where('id', params.id)
      .first()
    if (!course) return response.notFound({ message: 'Course not found.' })
    const resources = await CourseResource.query()
      .where('course_id', course.id)
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
    return response.ok({ courseId: course.id, resources })
  }

  /** POST /api/v1/courses/:id/resources [Protected] */
  async addResource({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (user.role !== 'admin') {
      return response.forbidden({ message: 'Only administrators can add course resources.' })
    }
    const course = await Course.find(params.id)
    if (!course) return response.notFound({ message: 'Course not found.' })
    const schema = vine.compile(vine.object({
      title: vine.string().trim().minLength(1).maxLength(200),
      resourceType: vine.string().trim(),
      resourceUrl: vine.string().trim().url(),
      estimatedMinutes: vine.number().optional(),
      sortOrder: vine.number().optional(),
    }))
    const data = await request.validateUsing(schema)
    if (!['video', 'reading'].includes(data.resourceType)) {
      return response.badRequest({ message: 'resourceType must be either "video" or "reading".' })
    }
    if (data.estimatedMinutes !== undefined &&
      (!Number.isInteger(data.estimatedMinutes) || data.estimatedMinutes < 1 || data.estimatedMinutes > 1440)) {
      return response.badRequest({ message: 'estimatedMinutes must be an integer from 1 to 1440.' })
    }
    const resource = await CourseResource.create({
      courseId: course.id,
      title: data.title,
      resourceType: data.resourceType as 'video' | 'reading',
      resourceUrl: data.resourceUrl,
      estimatedMinutes: data.estimatedMinutes ?? null,
      sortOrder: data.sortOrder ?? 0,
    })
    return response.created({ resource })
  }

  /** POST /api/v1/courses/:id/resources/:resourceId/sessions [Protected] */
  async startLearningSession({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const course = await Course.find(params.id)
    if (!course) return response.notFound({ message: 'Course not found.' })
    const resource = await CourseResource.query()
      .where('id', params.resourceId)
      .where('course_id', course.id)
      .first()
    if (!resource) return response.notFound({ message: 'Course resource not found.' })

    const enrolled = await db.from('user_courses')
      .where('user_id', user.id)
      .where('course_id', course.id)
      .first()
    if (!enrolled) {
      return response.conflict({ message: 'Enroll in this course before tracking study time.' })
    }

    const startedAt = DateTime.now()
    const session = await db.transaction(async (trx) => {
      await trx.from('users').where('id', user.id).forUpdate().first()
      const active = await trx.from('learning_sessions')
        .where('user_id', user.id)
        .whereNull('completed_at')
        .forUpdate()
        .first()
      if (active) return null

      const [id] = await trx.table('learning_sessions').insert({
        user_id: user.id,
        course_id: course.id,
        resource_id: resource.id,
        started_at: startedAt.toJSDate(),
        created_at: startedAt.toJSDate(),
        updated_at: startedAt.toJSDate(),
      }).returning('id')
      return typeof id === 'number' ? id : Number(id.id)
    })
    if (session === null) {
      return response.conflict({ message: 'Complete your active learning session before starting another.' })
    }
    return response.created({
      sessionId: session,
      courseId: course.id,
      resourceId: resource.id,
      startedAt: startedAt.toISO(),
      maxSessionMinutes: MAX_LEARNING_MINUTES_PER_SESSION,
    })
  }

  /** POST /api/v1/courses/:id/resources/:resourceId/sessions/:sessionId/complete [Protected] */
  async completeLearningSession({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const courseId = Number(params.id)
    const resourceId = Number(params.resourceId)
    const sessionId = Number(params.sessionId)
    if (![courseId, resourceId, sessionId].every((value) => Number.isSafeInteger(value) && value > 0)) {
      return response.badRequest({ message: 'Course, resource, and session IDs must be valid integers.' })
    }

    const now = DateTime.now()
    const result = await db.transaction(async (trx) => {
      const lockedUser = await trx.from('users').where('id', user.id).forUpdate().first()
      const session = await trx.from('learning_sessions')
        .where('id', sessionId)
        .where('user_id', user.id)
        .where('course_id', courseId)
        .where('resource_id', resourceId)
        .forUpdate()
        .first()
      if (!session) return { missing: true as const }
      if (session.completed_at) {
        return { duplicate: true as const, balance: Number(lockedUser.points) }
      }

      const rawElapsed = Math.max(0, Math.floor((now.toMillis() - new Date(session.started_at).getTime()) / 1000))
      const elapsedSeconds = Math.min(rawElapsed, MAX_LEARNING_MINUTES_PER_SESSION * 60)
      const elapsedMinutes = Math.floor(elapsedSeconds / 60)
      const dayStart = now.startOf('day').toJSDate()
      const daily = await trx.from('learning_sessions')
        .where('user_id', user.id)
        .whereNotNull('completed_at')
        .where('completed_at', '>=', dayStart)
        .sum('awarded_minutes as total')
        .first()
      const dailyUsed = Number(daily?.total ?? 0)
      const awardedMinutes = Math.min(elapsedMinutes, Math.max(0, MAX_LEARNING_MINUTES_PER_DAY - dailyUsed))
      const xpEarned = awardedMinutes * LEARNING_XP_PER_MINUTE

      await trx.from('learning_sessions').where('id', sessionId).update({
        completed_at: now.toJSDate(),
        elapsed_seconds: elapsedSeconds,
        awarded_minutes: awardedMinutes,
        xp_earned: xpEarned,
        updated_at: now.toJSDate(),
      })

      let balance = Number(lockedUser.points)
      if (xpEarned > 0) {
        balance = (await changeXpInTransaction(trx, {
          userId: user.id,
          amount: xpEarned,
          reason: 'verified_learning_time',
          sourceKey: `learning-session:${sessionId}`,
        })).balance
      }
      return { elapsedSeconds, awardedMinutes, xpEarned, balance }
    })

    if ('missing' in result) return response.notFound({ message: 'Learning session not found.' })
    if ('duplicate' in result) {
      return response.conflict({
        message: 'This learning session has already been completed.',
        xpEarned: 0,
        currentXpBalance: result.balance,
      })
    }
    return response.ok({
      message: 'Learning time recorded.',
      elapsedSeconds: result.elapsedSeconds,
      awardedMinutes: result.awardedMinutes,
      xpEarned: result.xpEarned,
      currentXpBalance: result.balance,
      limits: {
        maxMinutesPerSession: MAX_LEARNING_MINUTES_PER_SESSION,
        maxMinutesPerDay: MAX_LEARNING_MINUTES_PER_DAY,
        xpPerMinute: LEARNING_XP_PER_MINUTE,
      },
    })
  }

  /** POST /api/v1/courses  [Protected] */
  async store({ auth, request, response }: HttpContext) {
    const schema = vine.compile(vine.object({
      title:        vine.string().trim(),
      description:  vine.string().optional(),
      category:     vine.string().trim(),
      grade:        vine.string().trim(),
      imageUrl:     vine.string().url().optional(),
      totalLessons: vine.number().optional(),
    }))

    const data = await request.validateUsing(schema)
    const user = auth.getUserOrFail()

    const course = await Course.create({ ...data, createdBy: user.id })
    return response.created({ message: 'Course created.', course })
  }

  /** PUT /api/v1/courses/:id  [Protected] */
  async update({ params, request, response }: HttpContext) {
    const course = await Course.find(params.id)
    if (!course) return response.notFound({ message: 'Course not found.' })

    const schema = vine.compile(vine.object({
      title:        vine.string().trim().optional(),
      description:  vine.string().optional(),
      category:     vine.string().optional(),
      grade:        vine.string().optional(),
      imageUrl:     vine.string().url().optional(),
      totalLessons: vine.number().optional(),
      isPublished:  vine.boolean().optional(),
    }))

    const data = await request.validateUsing(schema)
    await course.merge(data).save()
    return response.ok({ message: 'Course updated.', course })
  }

  /** DELETE /api/v1/courses/:id  [Protected] */
  async destroy({ params, response }: HttpContext) {
    const course = await Course.find(params.id)
    if (!course) return response.notFound({ message: 'Course not found.' })
    await course.delete()
    return response.ok({ message: 'Course deleted.' })
  }

  /** POST /api/v1/courses/:id/enroll  [Protected] */
  async enroll({ auth, params, response }: HttpContext) {
    const user   = auth.getUserOrFail()
    const course = await Course.find(params.id)
    if (!course) return response.notFound({ message: 'Course not found.' })

    // Check if already enrolled
    const alreadyEnrolled = await user.related('courses').query().where('course_id', course.id).first()
    if (alreadyEnrolled) {
      return response.conflict({ message: 'Already enrolled in this course.' })
    }

    await user.related('courses').attach({
      [course.id]: {
        enrolled_at:       DateTime.now().toSQL(),
        completed_lessons: 0,
        progress_percent:  0,
        is_completed:      false,
      },
    })

    return response.created({ message: `Enrolled in "${course.title}" successfully!` })
  }

  /** PUT /api/v1/courses/:id/progress  [Protected] */
  async updateProgress({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const course = await Course.find(params.id)
    if (!course) return response.notFound({ message: 'Course not found.' })
    if (course.totalLessons < 1) {
      return response.badRequest({ message: 'Course lesson count is not configured.' })
    }

    const schema = vine.compile(vine.object({
      completedLessons: vine.number(),
    }))
    const { completedLessons } = await request.validateUsing(schema)
    if (!Number.isInteger(completedLessons) || completedLessons < 0 || completedLessons > course.totalLessons) {
      return response.badRequest({ message: `completedLessons must be an integer between 0 and ${course.totalLessons}.` })
    }

    const enrollment = await user.related('courses').query().where('courses.id', course.id).first()
    if (!enrollment) {
      return response.conflict({ message: 'Enroll in this course before updating its progress.' })
    }

    const progressPercent = Math.round((completedLessons / course.totalLessons) * 100)
    const isCompleted = progressPercent >= 100
    const now = DateTime.now()
    const updated = await db.transaction(async (trx) => {
      const lockedUser = await trx.from('users').where('id', user.id).forUpdate().first()
      const current = await trx.from('user_courses')
        .where('user_id', user.id)
        .where('course_id', course.id)
        .forUpdate()
        .first()
      if (!current) return null
      const wasCompleted = Boolean(current.is_completed)

      await trx.from('user_courses')
        .where('user_id', user.id)
        .where('course_id', course.id)
        .update({
          completed_lessons: completedLessons,
          progress_percent: progressPercent,
          is_completed: isCompleted,
          last_accessed_at: now.toJSDate(),
          updated_at: now.toJSDate(),
        })

      let balance = Number(lockedUser.points)
      let xpEarned = 0
      if (isCompleted && !wasCompleted) {
        const change = await changeXpInTransaction(trx, {
          userId: user.id,
          amount: 500,
          reason: 'course_completion',
          sourceKey: `course-completion:${user.id}:${course.id}`,
        })
        balance = change.balance
        xpEarned = change.awarded ? 500 : 0
      }
      return { balance, xpEarned }
    })
    if (!updated) {
      return response.conflict({ message: 'Enroll in this course before updating its progress.' })
    }

    return response.ok({
      message:         'Progress updated.',
      progressPercent,
      isCompleted,
      xpEarned: updated.xpEarned,
      currentXpBalance: updated.balance,
    })
  }
}
