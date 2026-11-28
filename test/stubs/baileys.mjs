// Faux Baileys : un socket qui enregistre tout ce que le bot envoie
const handlers = {}
let n = 0
export default function makeWASocket() {
  const sock = {
    sent: [],
    failFor: new Set(),
    groupParticipants: [],
    user: { id: '237699999999:5@s.whatsapp.net', lid: '99999999@lid' },
    ev: {
      on(name, fn) {
        ;(handlers[name] ||= []).push(fn)
      },
      async emit(name, payload) {
        for (const fn of handlers[name] || []) await fn(payload)
      },
    },
    async sendMessage(jid, content) {
      if (sock.failFor.has(jid)) throw new Error('not-acceptable ' + jid)
      globalThis.__onSend?.(jid, content) // (outils de contrôle visuel : accès aux images brutes)
      const rec = { jid, content: JSON.parse(JSON.stringify(content, (k, v) => (v && v.type === 'Buffer' ? Buffer.from(v.data).toString() : v))) }
      sock.sent.push(rec)
      return { key: { id: 'M' + ++n, remoteJid: jid, fromMe: true }, messageTimestamp: 1700000000 }
    },
    async sendPresenceUpdate() {},
    async chatModify() {},
    async groupMetadata() {
      return { participants: sock.groupParticipants }
    },
    async requestPairingCode() {
      return 'ABCD-EFGH'
    },
  }
  globalThis.__sock = sock
  return sock
}
export const useMultiFileAuthState = async () => ({ state: { creds: { registered: true } }, saveCreds() {} })
export const DisconnectReason = { loggedOut: 401 }
export const fetchLatestBaileysVersion = async () => ({ version: [2, 0, 0] })
export const Browsers = { ubuntu: () => ['Ubuntu', 'Chrome', '1'] }
export const normalizeMessageContent = (m) => m
