import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createOtpEmail } from '../build/app/services/email_templates/otp_email.js'

const outputPath = resolve(process.cwd(), 'storage/email-preview.html')
await mkdir(dirname(outputPath), { recursive: true })
const { html } = createOtpEmail('123456', 60, process.env.EMAIL_LOGO_URL)
await writeFile(outputPath, html, 'utf8')
process.stdout.write(`OTP email preview written to ${outputPath}\n`)
