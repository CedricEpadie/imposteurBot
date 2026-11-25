// Connexion WhatsApp (Baileys) : QR / code de jumelage, reconnexion automatique, réception des messages.
import fs from 'node:fs'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import { config } from '../config.js'
import { num } from '../core/utils.js'
import { setSocket } from './socket.js'
import { onMessage } from './messageHandler.js'
import { resumeGames } from '../game/resume.js'

const { authDir, pairingNumber, prefix } = config
let pairingRequested = false
let resumed = false // les parties interrompues ne sont reprises qu’une fois par lancement du bot

export const startConnection = async () => {
  const { state, saveCreds } = await useMultiFileAuthState(authDir)

  let version
  try {
    ;({ version } = await fetchLatestBaileysVersion())
  } catch (e) {
    console.warn('Version WhatsApp Web introuvable, version par défaut utilisée :', e.message)
  }

  const current = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  })
  setSocket(current)

  current.ev.on('creds.update', saveCreds)

  current.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      if (pairingNumber && !state.creds.registered) {
        if (!pairingRequested) {
          pairingRequested = true
          try {
            const code = await current.requestPairingCode(pairingNumber)
            console.log(`\n🔗 Code de jumelage : ${code}\nWhatsApp → Appareils connectés → Connecter un appareil → Lier avec le numéro de téléphone.\n`)
          } catch (e) {
            pairingRequested = false
            console.error('Impossible d’obtenir le code de jumelage :', e.message)
          }
        }
      } else {
        console.log('\n📱 Scanne ce QR code avec WhatsApp → Appareils connectés :\n')
        qrcode.generate(qr, { small: true })
      }
    }

    if (connection === 'open') {
      pairingRequested = false
      console.log(`✅ Bot connecté (${num(current.user?.id)}). Préfixe : ${prefix} • Rôles : ${config.roles.delivery}`)
      if (!resumed) {
        resumed = true
        resumeGames()
          .then((n) => n && console.log(`♻️ ${n} partie(s) reprise(s) après redémarrage`))
          .catch((e) => console.error('[imposteur] reprise des parties :', e))
      }
    }

    if (connection === 'close') {
      pairingRequested = false
      const code = lastDisconnect?.error?.output?.statusCode
      if (code === DisconnectReason.loggedOut) {
        console.error('🔒 Session déconnectée par WhatsApp (401). Session supprimée : une nouvelle liaison est nécessaire.')
        fs.rmSync(authDir, { recursive: true, force: true })
        setTimeout(() => startConnection().catch(console.error), 2000)
      } else {
        console.warn(`⚠️ Connexion fermée (code ${code ?? '?'}), reconnexion…`)
        setTimeout(() => startConnection().catch(console.error), 3000)
      }
    }
  })

  current.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const m of messages) {
      try {
        await onMessage(m)
      } catch (e) {
        console.error('[imposteur] erreur :', e)
      }
    }
  })
}
