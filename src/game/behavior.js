// Comportement des joueurs pendant une partie : compteurs enregistrés avec le résultat, qui servent aux surnoms et aux titres.
// g.stats = { <numéro du joueur>: { votes, right, wrong, received, abstain, talk, clues, missed, stolen, clen, fast, herd, fell, caught, ejected } }
import { findPlayer } from './players.js'

export const FIELDS = ['votes', 'right', 'wrong', 'received', 'abstain', 'talk', 'clues', 'missed', 'stolen', 'clen', 'fast', 'herd', 'fell', 'caught', 'ejected']
const TALK_CAP = 40 // un joueur qui spamme ne fausse pas son profil

export const bump = (g, p, key, n = 1) => {
  if (!p) return
  g.stats ??= {}
  const s = (g.stats[p.num] ??= {})
  s[key] = (s[key] || 0) + n
}

export const statsOf = (g, p) => {
  const s = g.stats?.[p.num] || {}
  return Object.fromEntries(FIELDS.map((f) => [f, Math.min(s[f] || 0, f === 'talk' ? TALK_CAP : Infinity)]))
}

// Un message du groupe pendant le débat ou le vote : le joueur « parle »
export const countTalk = (g, me) => {
  const p = findPlayer(g, me.ids)
  if (p && (g.stats?.[p.num]?.talk || 0) < TALK_CAP) bump(g, p, 'talk')
}

// Après un dépouillement : qui a voté pour qui, qui a été accusé, qui s'est abstenu.
// `isImp(p)` / `alive` sont fournis par l'appelant pour éviter une dépendance circulaire.
export const tallyVotes = (g, { isImp, alive }) => {
  for (const [voter, target] of g.votes) {
    bump(g, voter, 'votes')
    bump(g, target, 'received')
    if (!isImp(voter)) bump(g, voter, isImp(target) ? 'right' : 'wrong')
  }
  for (const p of alive) if (!g.votes.has(p)) bump(g, p, 'abstain')
}
