// Points d’une partie. Le grand livre (g.ledger) enregistre chaque gain ; les barèmes sont dans config.scoring.
//
//   vote juste            civil qui vote pour un imposteur            (à chaque vote)
//   victoire des civils   chaque civil quand les civils gagnent
//   imposteur gagnant     chaque imposteur encore en jeu quand les imposteurs gagnent
//   mot deviné            bonus de l’imposteur démasqué qui devine le mot
import { config } from '../config.js'
import { tag } from '../core/utils.js'
import { isImposter, isAlive, alivePlayers } from './players.js'
import { tallyVotes, statsOf, bump } from './behavior.js'
import { count } from './wording.js'

const S = config.scoring

export const award = (g, p, pts, reason) => {
  if (pts) g.ledger.push({ p, pts, reason, manche: g.manche })
}

export const pointsOf = (g, p) => g.ledger.filter((e) => e.p === p).reduce((n, e) => n + e.pts, 0)

// Après un vote : +points aux civils qui ont accusé un imposteur
export const scoreVotes = (g) => {
  tallyVotes(g, { isImp: (p) => isImposter(g, p), alive: alivePlayers(g) })
  for (const [voter, target] of g.votes) {
    if (!isImposter(g, voter) && isImposter(g, target)) award(g, voter, S.rightVote, 'vote juste')
  }
}

// Lignes « • @joueur : +1 (vote juste) » des points gagnés pendant la manche en cours
export const mancheLines = (g) => {
  const byPlayer = new Map()
  for (const e of g.ledger.filter((x) => x.manche === g.manche)) {
    const cur = byPlayer.get(e.p) || { pts: 0, why: [] }
    cur.pts += e.pts
    cur.why.push(e.reason)
    byPlayer.set(e.p, cur)
  }
  return [...byPlayer.entries()].map(([p, v]) => `• ${tag(p.jid)} : +${v.pts} (${v.why.join(', ')})`)
}

// Fin de partie : attribue les points de victoire et retourne une ligne par joueur pour la base.
// winner = 'civils' | 'imposteur' ; viaGuess = l’imposteur a volé la victoire en devinant le mot.
export const finalizeScores = (g, winner, viaGuess = false) => {
  const impWin = winner === 'imposteur'
  if (impWin && viaGuess) bump(g, g.guesser, 'stolen')
  for (const p of g.players) {
    if (isImposter(g, p)) {
      if (impWin && (isAlive(g, p) || p === g.guesser)) award(g, p, S.imposterWin, 'imposteur gagnant')
      if (impWin && viaGuess && p === g.guesser) award(g, p, S.imposterGuess, 'mot deviné')
    } else if (!impWin) {
      award(g, p, S.civilsWin, 'victoire des civils')
    }
  }
  return g.players.map((p) => ({
    num: p.num,
    jid: p.jid,
    name: p.name,
    role: isImposter(g, p) ? 'imposteur' : 'civil',
    won: isImposter(g, p) ? impWin : !impWin,
    points: pointsOf(g, p),
    ...statsOf(g, p),
  }))
}

// Récapitulatif des points de la partie (joueurs ayant marqué, du plus au moins)
export const gameLines = (g) =>
  g.players
    .map((p) => ({ p, pts: pointsOf(g, p) }))
    .filter((x) => x.pts > 0)
    .sort((a, b) => b.pts - a.pts)
    .map(({ p, pts }) => `• ${tag(p.jid)} : ${count(pts, 'pt')}`)
