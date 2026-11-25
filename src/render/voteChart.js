// Graphique du dépouillement : barres par suspect + qui a voté pour qui. Ne révèle aucun rôle (le suspense reste entier).
import { labelOf } from '../game/players.js'
import { count } from '../game/wording.js'
import { C, W } from './theme.js'
import { canvas, heading, section, t, rect, bar, fit, clip } from './kit.js'

// ranking = [[joueur, nombre de votes], …] trié ; abstainers = joueurs n’ayant pas voté
export const voteChartSvg = (g, ranking, abstainers = []) => {
  const top = ranking[0]?.[1] || 1
  const tie = ranking.length > 1 && ranking[1][1] === top
  const ROW = 64
  let y = 150
  let body = heading('DÉPOUILLEMENT', `${count(g.votes.size, 'vote')} exprimé${g.votes.size > 1 ? 's' : ''}` + (g.manche > 1 ? `  ·  Manche ${g.manche}` : ''), C.red, { y: 76 })

  ranking.forEach(([p, c], i) => {
    const leader = c === top
    const color = !leader ? C.blue : tie ? C.gold : C.red
    const name = clip(labelOf(p), 20)
    body +=
      rect(36, y, W - 72, ROW - 8, { r: 14, fill: i % 2 ? C.panel : C.panel2 }) +
      t(56, y + 38, name, { size: fit(name, 250, 26, 17) }) +
      bar(330, y + 16, 400, 24, c / top, { fill: color, back: C.bg }) +
      t(W - 56, y + 38, count(c, 'vote'), { size: 24, weight: 'bold', fill: color, anchor: 'end' })
    y += ROW
  })

  // Qui a voté pour qui
  y += 30
  body += section(y, 'QUI A VOTÉ POUR QUI', C.muted)
  y += 40
  const entries = [...g.votes.entries()]
  entries.forEach(([voter, target], i) => {
    const col = i % 2
    const x = 48 + col * ((W - 96) / 2)
    const line = `${clip(labelOf(voter), 14)}  →  ${clip(labelOf(target), 14)}`
    body += t(x, y + 22, line, { size: 20, fill: C.text })
    if (col === 1 || i === entries.length - 1) y += 34
  })
  if (abstainers.length) {
    y += 6
    body += t(48, y + 22, `N’ont pas voté : ${abstainers.map((p) => clip(labelOf(p), 14)).join(', ')}`, { size: 19, fill: C.dim })
    y += 34
  }
  return canvas(y + 16, tie ? C.gold : C.red, body)
}
