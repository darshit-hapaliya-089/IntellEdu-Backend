import { default as makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import type { WASocket, ConnectionState } from '@whiskeysockets/baileys'
import pino from 'pino'
import QRCode from 'qrcode'
import path from 'node:path'
import env from '#start/env'

class WhatsAppService {
  private socket: WASocket | null = null
  private connected = false
  private isConnecting = false
  private latestQrDataUrl: string | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  isEnabled(): boolean {
    return env.get('WHATSAPP_ENABLED')?.toLowerCase() === 'true'
  }

  isConnected(): boolean {
    return this.isEnabled() && this.connected
  }

  async init(): Promise<void> {
    if (!this.isEnabled()) return
    if (this.socket || this.isConnecting) return
    this.isConnecting = true

    try {
      const authPath = path.resolve(process.cwd(), env.get('WHATSAPP_AUTH_DIR') || './storage/whatsapp-auth')
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
          try {
            this.latestQrDataUrl = await QRCode.toDataURL(qr)
            console.info('[WhatsApp] Local device-link QR is ready.')
          } catch {
            console.warn('[WhatsApp] Could not prepare a device-link QR.')
          }
        }

        if (connection === 'open') {
          this.connected = true
          this.isConnecting = false
          this.latestQrDataUrl = null
          console.info('[WhatsApp] Connected.')
        }

        if (connection === 'close') {
          this.connected = false
          this.isConnecting = false
          this.socket = null
          const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode
          if (statusCode === DisconnectReason.connectionReplaced) {
            console.warn('[WhatsApp] Connection replaced; automatic reconnect stopped.')
            return
          }
          if (statusCode === DisconnectReason.loggedOut) {
            console.warn('[WhatsApp] Logged out; automatic reconnect stopped.')
            return
          }

          console.warn(`[WhatsApp] Connection closed${statusCode ? ` (${statusCode})` : ''}; reconnecting shortly.`)
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            void this.init()
          }, 3000)
        }
      })

      this.socket = sock
    } catch {
      this.isConnecting = false
      console.warn('[WhatsApp] Initialization failed.')
    }
  }

  getStatus() {
    return {
      isConnected: this.connected,
      hasQr: !!this.latestQrDataUrl,
      qrDataUrl: this.latestQrDataUrl,
    }
  }

  async sendOtpMessage(phoneNumber: string, code: string): Promise<boolean> {
    if (!this.isEnabled() || !this.connected || !this.socket) return false

    try {
      const cleanDigits = phoneNumber.replace(/\D/g, '')
      const jid = `${cleanDigits}@s.whatsapp.net`

      const messageText = `🎓 *IntellEdu Verification*\n\nHello! Your 6-digit verification code is:\n\n👉 *${code}*\n\n⏱️ This code expires in 60 seconds.\n🔒 Do not share this OTP with anyone.\n\n— Team IntellEdu`

      await this.socket.sendMessage(jid, { text: messageText })
      return true
    } catch {
      console.warn('[WhatsApp] OTP delivery failed.')
      return false
    }
  }
}

export const whatsappService = new WhatsAppService()
export default whatsappService
