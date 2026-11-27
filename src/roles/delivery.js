// Envoi des rôles en privé : carte image ou texte, auto-destruction, effacement de la conversation.
// Le contenu d’un rôle n’est jamais écrit dans les logs.
import { config } from '../config.js'
import { getSocket } from '../whatsapp/socket.js'
import { num, clean, sleep } from '../core/utils.js'
import { getMode } from '../game/modes/index.js'
import { renderCard } from '../render/card.js'

const { delivery, selfDestruct, wipeDmChat } = config.roles

// Efface la conversation privée côté bot (le téléphone du bot n’en garde pas de trace)
const wipeChat = async (jid, sent) => {
  if (!wipeDmChat || !sent?.key) return
  try {
    await getSocket().chatModify(
      { delete: true, lastMessages: [{ key: sent.key, messageTimestamp: Number(sent.messageTimestamp) }] },
      jid
    )
  } catch (e) {
    console.warn('[imposteur] effacement de la conversation impossible :', e.message)
  }
}

// Envoie une carte (ou un texte) au premier jid qui fonctionne.
// Retourne { ok: true } ou { ok: false, error }.
const sendCard = async (jids, spec, fallbackText) => {
  const sock = getSocket()
  let content
  try {
    if (delivery === 'text') content = { text: fallbackText }
    else content = { image: await renderCard(spec), mimetype: 'image/jpeg', ...(delivery === 'image' ? { viewOnce: true } : {}) }
  } catch (e) {
    console.error('[imposteur] génération de la carte impossible :', e.message)
    return { ok: false, error: `génération de la carte impossible (${e.message})` }
  }
  let lastError = 'erreur inconnue'
  for (const jid of [...new Set(jids.filter(Boolean))]) {
    const kind = jid.endsWith('@lid') ? 'LID' : 'numéro'
    try {
      const sent = await sock.sendMessage(jid, content)
      console.log(`[imposteur] envoi privé accepté par WhatsApp (destinataire : ${kind})`)
      setTimeout(() => wipeChat(jid, sent).catch(() => {}), 3000) // différé : on laisse le message partir complètement
      if (selfDestruct > 0 && sent?.key) {
        setTimeout(async () => {
          try {
            await sock.sendMessage(jid, { delete: sent.key })
          } catch {}
        }, selfDestruct * 1000)
      }
      return { ok: true }
    } catch (e) {
      lastError = e?.message || String(e)
      console.error(`[imposteur] envoi privé impossible (destinataire : ${kind}) :`, lastError)
    }
  }
  return { ok: false, error: lastError }
}

// Envoie son rôle (ou mot secret) au joueur p, selon le mode de la partie
export const deliverRole = async (g, p) => {
  const mode = getMode(g.mode)
  const isImp = g.imposters.includes(p)
  const spec = mode.card(g, isImp)
  const text = mode.roleText(g, isImp)
  // Un échec ponctuel (réseau, WhatsApp occupé) ne doit pas priver un joueur de son rôle : on réessaie avec une attente croissante
  let r = await sendCard([p.dm, p.jid], spec, text)
  for (let i = 1; !r.ok && i <= config.game.dmRetries; i++) {
    await sleep(2000 * i)
    r = await sendCard([p.dm, p.jid], spec, text)
  }
  return r
}

// Si un joueur n’est connu que par son identifiant LID, retrouve son numéro via les infos du groupe
export const resolveDms = async (key, g) => {
  const lids = g.players.filter((p) => p.dm.endsWith('@lid'))
  if (!lids.length) return
  try {
    const meta = await getSocket().groupMetadata(key)
    for (const p of lids) {
      const m = (meta.participants || []).find((x) => [x.id, x.lid, x.jid, x.phoneNumber].some((v) => v && num(v) === num(p.dm)))
      const pn = m && [m.phoneNumber, m.jid, m.id].find((v) => v && String(v).endsWith('@s.whatsapp.net'))
      if (pn) {
        p.dm = clean(pn)
        p.ids.add(num(pn))
      }
    }
  } catch (e) {
    console.warn('[imposteur] résolution des numéros impossible :', e.message)
  }
}
