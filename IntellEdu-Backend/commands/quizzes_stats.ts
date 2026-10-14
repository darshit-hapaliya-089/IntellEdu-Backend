import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class QuizzesStats extends BaseCommand {
  static commandName = 'quizzes:stats'
  static description = 'Show statistics of unused and total quizzes per grade and subject'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Analyzing IntellEdu Quiz Bank Stock...\n')

    const { default: db } = await import('@adonisjs/lucid/services/db')

    // 1. Quizzes per grade (total vs unused)
    const gradeStats = await db.rawQuery(`
      SELECT 
        COALESCE(q.grade, 'Unassigned') as grade,
        COUNT(q.id)::int as total,
        COUNT(CASE WHEN q.is_published = true AND q.is_active = true THEN 1 END)::int as active,
        COUNT(CASE 
          WHEN q.is_published = true 
           AND q.is_active = true 
           AND q.id NOT IN (SELECT quiz_id FROM daily_quizzes WHERE grade = q.grade)
          THEN 1 
        END)::int as unused
      FROM quizzes q
      GROUP BY q.grade
      ORDER BY q.grade ASC
    `)

    const table = this.ui
      .table()
      .head(['Grade', 'Total in Bank', 'Active', 'Unused (Stock Available)'])

    for (const r of gradeStats.rows) {
      table.row([r.grade, String(r.total), String(r.active), String(r.unused)])
    }
    table.render()

    // 2. Subject distribution
    const subjectStats = await db.rawQuery(`
      SELECT 
        COALESCE(subject, 'General') as subject,
        COUNT(*)::int as count
      FROM quizzes
      WHERE is_published = true AND is_active = true
      GROUP BY subject
      ORDER BY count DESC
    `)

    this.logger.info('\nSubject Distribution across Active Bank:')
    const subjTable = this.ui.table().head(['Subject', 'Count'])
    for (const r of subjectStats.rows) {
      subjTable.row([r.subject, String(r.count)])
    }
    subjTable.render()
  }
}

