import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class QuizzesGenerate extends BaseCommand {
  static commandName = 'quizzes:generate'
  static description = 'Generate quizzes using Gemini AI for a grade or all grades'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Target grade, e.g. 10, "Class 10", 12' })
  declare grade?: string

  @flags.number({ description: 'Number of quizzes to generate per grade', default: 25 })
  declare count: number

  @flags.boolean({ description: 'Generate for all grades 1 to 12' })
  declare allGrades: boolean

  async run() {
    const {
      generateQuizzesWithGemini,
      persistAiQuizzes,
      getUnusedQuizCount,
    } = await import('#services/quiz_generator')
    const { normalizeGrade } = await import('#services/daily_quiz_service')
    const { default: GenerationLog } = await import('#models/generation_log')

    const gradesToProcess: string[] = []

    if (this.allGrades) {
      for (let g = 1; g <= 12; g++) {
        gradesToProcess.push(`Class ${g}`)
      }
    } else if (this.grade) {
      gradesToProcess.push(normalizeGrade(this.grade))
    } else {
      this.logger.error('Specify either --grade=<grade> (e.g. --grade=10) or --all-grades')
      return
    }

    this.logger.info(`Starting AI quiz generation for ${gradesToProcess.length} grade(s). Target: ${this.count} quizzes each.`)

    for (const g of gradesToProcess) {
      this.logger.info(`\nProcessing ${g}...`)
      let remaining = this.count
      let totalCreated = 0

      while (remaining > 0) {
        const batchSize = Math.min(remaining, 5) // 5 per call for maximum reliability
        this.logger.info(`Requesting batch of ${batchSize} quizzes for ${g} from Gemini...`)

        try {
          const generated = await generateQuizzesWithGemini(g, batchSize)
          const result = await persistAiQuizzes(generated, g)
          totalCreated += result.created
          remaining -= result.created

          this.logger.success(`+ ${result.created} created (${result.skippedDuplicates} duplicate titles skipped). Progress: ${totalCreated}/${this.count}`)

          if (result.created === 0 && result.skippedDuplicates > 0) {
            remaining -= result.skippedDuplicates
          }

          // Delay to stay comfortably within rate limits
          if (remaining > 0) {
            await new Promise((r) => setTimeout(r, 2000))
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          this.logger.error(`Batch failed: ${msg}`)

          await GenerationLog.create({
            grade: g,
            requested: this.count,
            created: totalCreated,
            failed: remaining,
            errorShort: msg.slice(0, 500),
          })
          break
        }
      }

      const totalUnused = await getUnusedQuizCount(g)
      this.logger.info(`Done for ${g}. Total unused question bank stock for ${g}: ${totalUnused}`)
    }

    this.logger.success('\nAll requested generations completed!')
  }
}

