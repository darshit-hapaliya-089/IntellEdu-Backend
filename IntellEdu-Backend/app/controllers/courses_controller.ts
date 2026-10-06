import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Course from '#models/course'
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
    if (grade)    query.where('grade', grade)
    if (category) query.where('category', category)

    const courses = await query.orderBy('created_at', 'desc').paginate(page, perPage)
    return response.ok(courses)
  }

  /** GET /api/v1/courses/:id */
  async show({ params, response }: HttpContext) {
    const course = await Course.find(params.id)
    if (!course) return response.notFound({ message: 'Course not found.' })
    return response.ok({ course })
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

    const schema = vine.compile(vine.object({
      completedLessons: vine.number(),
    }))
    const { completedLessons } = await request.validateUsing(schema)

    const progressPercent = Math.round((completedLessons / course.totalLessons) * 100)
    const isCompleted     = progressPercent >= 100

    await user.related('courses').sync({
      [course.id]: {
        completed_lessons: completedLessons,
        progress_percent:  progressPercent,
        is_completed:      isCompleted,
        last_accessed_at:  DateTime.now().toSQL(),
      },
    }, false)

    // Award XP for completion
    if (isCompleted) {
      await user.merge({ points: user.points + 500 }).save()
    }

    return response.ok({
      message:         'Progress updated.',
      progressPercent,
      isCompleted,
    })
  }
}

