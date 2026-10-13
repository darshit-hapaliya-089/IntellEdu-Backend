import type { HttpContext } from '@adonisjs/core/http'
import crypto from 'node:crypto'
import User from '#models/user'
import env from '#start/env'

/*
|--------------------------------------------------------------------------
| UsersController
|--------------------------------------------------------------------------
*/
export default class UsersController {

  /** GET /api/v1/users/:id/stats [Protected] */
  async stats({ params, response }: HttpContext) {
    const user = await User.find(params.id)
    if (!user) {
      return response.notFound({ message: 'User not found.' })
    }

    await user.load('courses')
    await user.load('quizResults')

    const totalQuizzes = user.quizResults.length
    const totalAccuracy = totalQuizzes > 0
      ? user.quizResults.reduce((acc, r) => acc + Number(r.accuracy), 0) / totalQuizzes
      : 0

    return response.ok({
      stats: {
        id: user.id,
        fullName: user.fullName,
        grade: user.grade,
        points: user.points,
        streak: user.streak,
        badge: user.badge,
        enrolledCoursesCount: user.courses.length,
        quizzesTaken: totalQuizzes,
        averageAccuracy: Math.round(totalAccuracy),
      },
    })
  }

  /**
   * POST /api/v1/users/me/avatar [Protected]
   *
   * Body: { imageBase64: string, mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }
   *
   * Strategy:
   *  - If CLOUDINARY_CLOUD_NAME is configured → use Cloudinary signed upload (REST, no SDK).
   *  - Otherwise → store the base64 data URI directly on avatarUrl (useful for dev/testing).
   *
   * Cloudinary transformation: c_fill,g_face,w_512,h_512,f_auto,q_auto
   */
  async uploadAvatar({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const { imageBase64, mimeType } = request.only(['imageBase64', 'mimeType'])

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return response.badRequest({ message: 'imageBase64 is required.' })
    }
    if (imageBase64.length > 2_000_000) { // ~1.5 MB raw base64 → ~1 MB image
      return response.badRequest({ message: 'Image is too large. Please use an image under 1 MB.' })
    }

    const cloudName = env.get('CLOUDINARY_CLOUD_NAME')
    const apiKey = env.get('CLOUDINARY_API_KEY')
    const apiSecret = env.get('CLOUDINARY_API_SECRET')

    let avatarUrl: string

    if (cloudName && apiKey && apiSecret) {
      // ── Cloudinary signed upload ─────────────────────────────────────────
      const timestamp = Math.floor(Date.now() / 1000)
      const folder = 'intelledu/avatars'
      const publicId = `user_${user.id}_avatar`
      const transformation = 'c_fill,g_face,w_512,h_512,f_auto,q_auto'

      // Build the signature string (alphabetical params)
      const signatureParams = [
        `folder=${folder}`,
        `public_id=${publicId}`,
        `timestamp=${timestamp}`,
        `transformation=${transformation}`,
      ].join('&')
      const signature = crypto
        .createHash('sha256')
        .update(signatureParams + apiSecret)
        .digest('hex')

      // Data URI for upload
      const safeType = (mimeType as string) || 'image/jpeg'
      const dataUri = imageBase64.startsWith('data:')
        ? imageBase64
        : `data:${safeType};base64,${imageBase64}`

      const formData = new URLSearchParams()
      formData.set('file', dataUri)
      formData.set('api_key', apiKey)
      formData.set('timestamp', String(timestamp))
      formData.set('signature', signature)
      formData.set('folder', folder)
      formData.set('public_id', publicId)
      formData.set('transformation', transformation)
      formData.set('overwrite', 'true')

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: formData }
      )
      const uploadData = (await uploadRes.json()) as any
      if (!uploadRes.ok || !uploadData.secure_url) {
        return response.internalServerError({
          message: 'Cloudinary upload failed.',
          detail: uploadData?.error?.message ?? 'Unknown error',
        })
      }
      avatarUrl = uploadData.secure_url as string
    } else {
      // ── Fallback: store data URI directly (dev / no Cloudinary) ─────────
      const safeType = (mimeType as string) || 'image/jpeg'
      avatarUrl = imageBase64.startsWith('data:')
        ? imageBase64
        : `data:${safeType};base64,${imageBase64}`
    }

    user.avatarUrl = avatarUrl
    await user.save()

    return response.ok({
      message: 'Profile photo updated.',
      avatarUrl,
    })
  }

  /**
   * DELETE /api/v1/users/me/avatar [Protected]
   * Resets avatar_url to null (preset avatar chosen on frontend).
   */
  async removeAvatar({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    user.avatarUrl = null
    await user.save()
    return response.ok({ message: 'Profile photo removed. Preset avatar is now active.' })
  }
}
