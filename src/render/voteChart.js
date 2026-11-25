// Graphique du dépouillement : une barre par suspect, avec en dessous ceux qui ont voté pour lui.
// Ne révèle aucun rôle (le suspense reste entier).
import { labelOf } from '../game/players.js'
import { count } from '../game/wording.js'
import { C, W } from './theme.js'
import { canvas, heading, t, rect, bar, fit, clip, wrap } from './kit.js'

// ranking = [[joueur, nombre de votes], …] trié ; abstainers = joueurs n’ayant pas voté
export const voteChartSvg = (g, ranking, abstainers = []) => {
  const top = ranking[0]?.[1] || 1
  const tie = ranking.length > 1 && ranking[1][1] === top
  const accent = tie ? C.gold : C.red
  let y = 156
  let body = heading('DÉPOUILLEMENT', `${count(g.votes.size, 'vote')} exprimé${g.votes.size > 1 ? 's' : ''}` + (g.manche > 1 ? `  ·  Manche ${g.manche}` : '') + (tie ? '  ·  Égalité' : ''), accent, { y: 80 })

  ranking.forEach(([p, c]) => {
    const color = c === top ? accent : C.blue
    const name = clip(labelOf(p), 18)
    const voters = [...g.votes.entries()].filter(([, target]) => target === p).map(([v]) => clip(labelOf(v), 12))
    const lines = wrap(voters.join(', '), 44)
    const h = 70 + lines.length * 32
    body +=
      rect(36, y, W - 72, h, { r: 18, fill: C.panel }) +
      t(58, y + 46, name, { size: fit(name, 270, 30, 20), weight: 'bold' }) +
      bar(350, y + 20, 330, 30, c / top, { fill: color, back: C.bg }) +
      t(W - 58, y + 46, count(c, 'vote'), { size: 28, weight: 'bold', fill: color, anchor: 'end' }) +
      lines.map((l, k) => t(58, y + 84 + k * 32, l, { size: 23, fill: C.muted })).join('')
    y += h + 14
  })

  if (abstainers.length) {
    const lines = wrap(`N’ont pas voté : ${abstainers.map((p) => clip(labelOf(p), 12)).join(', ')}`, 46)
    body += lines.map((l, k) => t(58, y + 28 + k * 32, l, { size: 23, fill: C.dim })).join('')
    y += lines.length * 32 + 20
  }
  return canvas(y + 10, accent, body)
}
