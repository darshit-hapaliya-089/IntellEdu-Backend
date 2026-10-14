import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class QuizzesDeactivate extends BaseCommand {
  static commandName = 'quizzes:deactivate'
  static description = 'Deactivate a quiz by slug or id for review safety'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Quiz slug to deactivate' })
  declare slug?: string

  @flags.number({ description: 'Quiz ID to deactivate' })
  declare id?: number

  async run() {
    if (!this.slug && !this.id) {
      this.logger.error('Specify either --slug=<slug> or --id=<id>')
      return
    }

    const { default: Quiz } = await import('#models/quiz')

    const query = Quiz.query()
    if (this.slug) query.where('slug', this.slug)
    if (this.id) query.where('id', this.id)

    const quiz = await query.first()
    if (!quiz) {
      this.logger.error('Quiz not found.')
      return
    }

    quiz.isActive = false
    quiz.isPublished = false
    await quiz.save()

    this.logger.success(`Deactivated quiz ID ${quiz.id} ("${quiz.title}").`)
  }
}

