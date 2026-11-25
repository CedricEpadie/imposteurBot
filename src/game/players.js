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
// Tous les alphabets, symboles et emojis sont conservés (les polices embarquées les affichent) ;
// on normalise les lettres « décoratives » (𝐃𝐄𝐍𝐄𝐌, ＤＥＮＥＭ → DENEM) et on retire ce qui ne se dessine pas :
// caractères de contrôle, invisibles, sélecteurs de variante, et empilements d’accents (« Zalgo »).
export const cleanName = (raw) => {
  let s = String(raw || '').normalize('NFKC')
  s = s.replace(/[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\u2800\u115F\u1160\u3164\uFFA0\uFE0E\uFE0F]/gu, '') // contrôles, invisibles, variantes, braille vide
  s = s.replace(/(\p{M})\p{M}+/gu, '$1') // au plus un signe combinant à la suite
  s = s.replace(/[\p{Zs}]+/gu, ' ').trim()
  return s
}

export const labelOf = (p) => cleanName(p.name) || `+${p.num}`
