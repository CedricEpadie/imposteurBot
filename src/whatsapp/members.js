// Membres d'un groupe WhatsApp, pour « taguer » tout le groupe sans afficher de @ (mentions invisibles dans la légende d'une image).
// La liste est mise en cache 10 minutes par groupe : une commande /top ne coûte pas un appel à WhatsApp à chaque fois.
import { getSocket } from './socket.js'

const TTL = 10 * 60_000
const TIMEOUT = 5000
const cache = new Map() // groupe → { at, jids }

export const groupMentions = async (chat, fallback = [], now = Date.now()) => {
  const hit = cache.get(chat)
  if (hit && now - hit.at < TTL) return hit.jids
  try {
    const meta = await Promise.race([getSocket().groupMetadata(chat), new Promise((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), TIMEOUT).unref?.())])
    const jids = [...new Set((meta?.participants || []).map((p) => p.id || p.jid).filter(Boolean))]
    if (jids.length) {
      cache.set(chat, { at: now, jids })
      return jids
    }
  } catch (e) {
    console.warn('[imposteur] membres du groupe indisponibles :', e.message)
  }
  return hit?.jids || fallback // en cas d'échec : la dernière liste connue, sinon les joueurs du classement
}

export const forgetMembers = (chat) => (chat ? cache.delete(chat) : cache.clear())
