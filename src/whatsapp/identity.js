import { getSocket } from './socket.js'
import { num, clean } from '../core/utils.js'

// Identité de l’expéditeur : WhatsApp peut fournir un jid « numéro » et/ou un jid « LID ».
// On garde les deux pour reconnaître la même personne en groupe comme en privé.
// Retourne { jid, dm, ids } ou null.
export const senderOf = (m) => {
  const sock = getSocket()
  const k = m.key
  const group = k.remoteJid.endsWith('@g.us')
  let jid
  let alt
  if (k.fromMe) {
    jid = sock?.user?.id
    alt = sock?.user?.lid
  } else if (group) {
    jid = k.participant
    alt = k.participantAlt || k.participantPn || k.senderPn
  } else {
    jid = k.remoteJid
    alt = k.remoteJidAlt || k.senderPn
  }
  if (!jid) return null
  jid = clean(jid)
  if (alt) alt = clean(alt)
  const ids = new Set([num(jid)])
  if (alt) ids.add(num(alt))
  const dm = [jid, alt].find((j) => j && j.endsWith('@s.whatsapp.net')) || jid
  return { jid, dm, ids, name: k.fromMe ? '' : m.pushName || '', fromMe: !!k.fromMe }
}
