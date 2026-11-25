// Réception d’un message WhatsApp : extraction du texte, puis commande ou message de jeu.
import { normalizeMessageContent } from '@whiskeysockets/baileys'
import { config } from '../config.js'
import { isOwnEcho } from './messenger.js'
import { senderOf } from './identity.js'
import { handleCommand } from '../commands/router.js'
import { handleGameText } from '../game/phases/index.js'
import { getGame } from '../game/store.js'

const P = config.prefix

export const onMessage = async (m) => {
  if (!m.message || !m.key?.remoteJid) return
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
