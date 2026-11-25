import { tag } from '../core/utils.js'

// Indices d’un tour de la manche en cours, un par ligne
export const clueLines = (g, round) =>
  g.clues.filter((c) => c.manche === g.manche && c.round === round).map((c) => `• ${tag(c.p.jid)} : ${c.text || '…'}`)

// Tous les indices de chaque joueur pour la manche en cours, dans l’ordre de passage
export const fullRecap = (g) =>
  g.order
    .map((p) => {
      const mine = g.clues.filter((c) => c.manche === g.manche && c.p === p).map((c) => c.text || '…')
      return `• ${tag(p.jid)} : ${mine.length ? mine.join(' → ') : '—'}`
    })
    .join('\n')

// Indices de toute la partie (toutes manches), pour le récap final
export const gameRecap = (g) =>
  g.players
    .map((p) => {
      const mine = g.clues.filter((c) => c.p === p).map((c) => c.text || '…')
      return `• ${tag(p.jid)} : ${mine.length ? mine.join(' → ') : '—'}`
    })
    .join('\n')
