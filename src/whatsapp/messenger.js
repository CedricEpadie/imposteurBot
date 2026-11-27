// Envoi de messages dans un chat (groupe ou privé).
import { config } from '../config.js'
import { getSocket } from './socket.js'
import { sleep } from '../core/utils.js'

const sentTexts = [] // derniers textes envoyés par le bot (évite de les prendre pour des indices)

// Vrai si ce texte vient d’être envoyé par le bot lui-même (écho d’un message sortant)
export const isOwnEcho = (text) => sentTexts.includes(text)

export const say = async (chat, text, mentions = []) => {
  sentTexts.push(text)
  if (sentTexts.length > 40) sentTexts.shift()
  try {
    return await getSocket().sendMessage(chat, { text, mentions })
  } catch (e) {
    console.error('[imposteur] envoi impossible :', e.message)
    return null
  }
}

// Envoie une image avec légende ; retourne null en cas d’échec (l’appelant peut alors envoyer un texte)
export const sayImage = async (chat, image, caption, mentions = []) => {
  sentTexts.push(caption)
  if (sentTexts.length > 40) sentTexts.shift()
  try {
    return await getSocket().sendMessage(chat, { image, mimetype: 'image/jpeg', caption, mentions })
  } catch (e) {
    console.error('[imposteur] envoi de l’image impossible :', e.message)
    return null
  }
}

// Message privé aux admins du bot (ADMIN_NUMBERS) : incidents techniques qui ne regardent pas le groupe. Sans effet si aucun admin n’est défini.
export const notifyAdmins = async (text) => {
  for (const n of config.admins) {
    try {
      await getSocket().sendMessage(`${n}@s.whatsapp.net`, { text })
    } catch (e) {
      console.warn('[imposteur] alerte admin impossible :', e.message)
    }
  }
}

export const editMsg = async (chat, sent, text, mentions = []) => {
  if (!sent?.key) return
  try {
    await getSocket().sendMessage(chat, { text, edit: sent.key, mentions })
  } catch {
    /* l’édition est un plus : on ignore les erreurs */
  }
}

export const typing = async (chat, ms) => {
  try {
    const sock = getSocket()
    await sock.sendPresenceUpdate('composing', chat)
    await sleep(ms)
    await sock.sendPresenceUpdate('paused', chat)
  } catch {}
}
