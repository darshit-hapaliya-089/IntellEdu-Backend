import { default as makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import type { WASocket, ConnectionState } from '@whiskeysockets/baileys'
import pino from 'pino'
import QRCode from 'qrcode'
import path from 'node:path'

class WhatsAppService {
  private socket: WASocket | null = null
  private isConnected = false
  private isConnecting = false
  private latestQr: string | null = null
  private latestQrDataUrl: string | null = null

  async init(): Promise<void> {
    if (this.socket || this.isConnecting) return
    this.isConnecting = true

    try {
      const authPath = path.resolve(process.cwd(), 'whatsapp_auth_info')
      const { state, saveCreds } = await useMultiFileAuthState(authPath)

      const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
      })

      sock.ev.on('creds.update', saveCreds)

      sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
          this.latestQr = qr
          try {
            this.latestQrDataUrl = await QRCode.toDataURL(qr)
            const terminalQr = await QRCode.toString(qr, { type: 'terminal', small: true })
            console.log('\n======================================================')
            console.log('📱 [IntellEdu WhatsApp Bot] Scan this QR Code with WhatsApp:')
            console.log('(Open WhatsApp > Linked Devices > Link a Device)')
            console.log('======================================================')
            console.log(terminalQr)
            console.log('======================================================\n')
          } catch (qrErr) {
            console.warn('[WhatsApp QR Error]:', qrErr)
          }
        }

        if (connection === 'open') {
          this.isConnected = true
          this.isConnecting = false
          this.latestQr = null
          this.latestQrDataUrl = null
          console.log('\n======================================================')
          console.log('✅ [IntellEdu WhatsApp Bot] Successfully Connected!')
          console.log('📱 Ready to send direct OTP messages to student WhatsApp numbers!')
          console.log('======================================================\n')
        }

        if (connection === 'close') {
          this.isConnected = false
          this.isConnecting = false
          const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut

          console.log(`[WhatsApp Bot] Connection closed (code ${statusCode}). Reconnecting: ${shouldReconnect}`)
          if (shouldReconnect) {
            setTimeout(() => this.init(), 3000)
          } else {
            this.socket = null
          }
        }
      })

      this.socket = sock
    } catch (err) {
      this.isConnecting = false
      console.warn('[WhatsApp Bot Init Failed]:', err)
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      hasQr: !!this.latestQrDataUrl,
      qrDataUrl: this.latestQrDataUrl,
    }
  }

  async sendOtpMessage(phoneNumber: string, code: string): Promise<boolean> {
    if (!this.isConnected || !this.socket) {
      console.warn(`[WhatsApp Bot] Not connected yet. Cannot send to ${phoneNumber}. Logging OTP to console.`)
      return false
    }

    try {
      const cleanDigits = phoneNumber.replace(/\D/g, '')
      const jid = `${cleanDigits}@s.whatsapp.net`

      const messageText = `🎓 *IntellEdu Verification*\n\nHello! Your 6-digit verification code is:\n\n👉 *${code}*\n\n⏱️ This code expires in 60 seconds.\n🔒 Do not share this OTP with anyone.\n\n— Team IntellEdu`

      await this.socket.sendMessage(jid, { text: messageText })
      console.log(`\n✅ [WHATSAPP OTP DELIVERED] Direct message sent to ${phoneNumber}!\n`)
      return true
    } catch (sendErr) {
      console.warn(`[WhatsApp Send Failed to ${phoneNumber}]:`, sendErr)
      return false
    }
  }
}

export const whatsappService = new WhatsAppService()
export default whatsappService

