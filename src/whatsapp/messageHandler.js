// Réception d’un message WhatsApp : extraction du texte, puis commande ou message de jeu.
import { normalizeMessageContent } from '@whiskeysockets/baileys'
import { config } from '../config.js'
import { isOwnEcho } from './messenger.js'
import { senderOf } from './identity.js'
import { handleCommand } from '../commands/router.js'
import { handleGameText } from '../game/phases/index.js'
import { getGame } from '../game/store.js'

const P = config.prefix

// WhatsApp peut renvoyer des messages déjà reçus (reconnexion, resynchronisation) : un indice ne doit pas compter deux fois.
const SEEN_TTL_MS = 10 * 60_000
const SEEN_MAX = 3000
const seen = new Map() // « chat|id » → heure de réception
export const isDuplicate = (m, now = Date.now()) => {
  const id = m.key?.id
  if (!id) return false
  const k = `${m.key.remoteJid}|${id}`
  if (seen.has(k)) return true
  seen.set(k, now)
  if (seen.size > SEEN_MAX) for (const [key, t] of seen) if (now - t > SEEN_TTL_MS || seen.size > SEEN_MAX) seen.delete(key)
  return false
}
export const _resetSeen = () => seen.clear() // pour les tests

export const onMessage = async (m) => {
  if (!m.message || !m.key?.remoteJid) return
  if (isDuplicate(m)) return
  const chat = m.key.remoteJid
  if (chat === 'status@broadcast' || chat.endsWith('@broadcast') || chat.endsWith('@newsletter')) return

  const c = normalizeMessageContent(m.message)
  const text = String(
    c?.conversation || c?.extendedTextMessage?.text || c?.imageMessage?.caption || c?.videoMessage?.caption || ''
  ).trim()
  if (!text) return
  if (m.key.fromMe && isOwnEcho(text)) return // textes envoyés par le bot lui-même

  const me = senderOf(m)
  if (!me) return
  const isGroup = chat.endsWith('@g.us')
  const mentioned = c?.extendedTextMessage?.contextInfo?.mentionedJid || []

  if (text.startsWith(P)) return handleCommand(chat, isGroup, me, text, mentioned)
  if (isGroup) return handleGameText(chat, me, text, mentioned, getGame(chat))
}
