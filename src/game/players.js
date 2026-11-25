import { num, tag } from '../core/utils.js'

export const toPlayer = (s) => ({ num: num(s.jid), jid: s.jid, dm: s.dm, ids: s.ids, name: s.name || '' })
export const hasId = (p, ids) => !!p && [...ids].some((i) => p.ids.has(i))
export const findPlayer = (g, ids) => g.players.find((p) => hasId(p, ids))

// Joueurs encore en lice (le format « plusieurs manches » élimine des joueurs ; le format classique n’élimine personne)
export const isAlive = (g, p) => !g.eliminated.has(p)
export const alivePlayers = (g) => g.players.filter((p) => !g.eliminated.has(p))
export const findAlive = (g, ids) => alivePlayers(g).find((p) => hasId(p, ids))

export const isImposter = (g, p) => g.imposters.includes(p)
export const aliveImposters = (g) => g.imposters.filter((p) => !g.eliminated.has(p))

export const jidsOf = (g) => g.players.map((p) => p.jid) // pour les mentions : tout le monde
export const listOf = (g) => alivePlayers(g).map((p) => tag(p.jid)).join(', ')

// Nom lisible dans une image (WhatsApp ne permet pas de @mention dans une image)
export const labelOf = (p) => {
  const name = String(p.name || '').replace(/[^\p{L}\p{N}\s'’.-]/gu, '').replace(/\s+/g, ' ').trim()
  return name || `+${p.num}`
}
