// Classement du groupe en image : podium (1er au centre, plus haut) puis la suite en liste, et la session en cours.
import { cleanName } from '../game/players.js'
import { count } from '../game/wording.js'
import { C, W } from './theme.js'
import { canvas, heading, section, t, rect, badge, fit, clip } from './kit.js'

const MEDAL = [
  { fill: '#f0b429', text: '#12161f' }, // or
  { fill: '#c4ccd8', text: '#12161f' }, // argent
  { fill: '#d98b4c', text: '#12161f' }, // bronze
]
const nameOf = (r) => cleanName(r.name) || `+${r.num}`

// Podium : place 1 au centre, 2 à gauche, 3 à droite
const podium = (rows, y) => {
  const slots = [
    { idx: 1, h: 168, col: 0 },
    { idx: 0, h: 204, col: 1 },
    { idx: 2, h: 150, col: 2 },
  ]
  const cw = 262
  const gap = 14
  const x0 = (W - (3 * cw + 2 * gap)) / 2
  const base = y + 300 // bas des marches
  let out = ''
  for (const { idx, h, col } of slots) {
    const r = rows[idx]
    if (!r) continue
    const x = x0 + col * (cw + gap)
    const m = MEDAL[idx]
    const name = clip(nameOf(r), 18)
    out +=
      t(x + cw / 2, base - h - 64, name, { size: fit(name, cw - 10, 30, 18), weight: 'bold', anchor: 'middle' }) +
      badge(x + cw / 2, base - h - 30, 22, String(idx + 1), { fill: m.fill, color: m.text, size: 26 }) +
      rect(x, base - h, cw, h, { r: 20, fill: m.fill }) +
      t(x + cw / 2, base - h + 66, String(r.points), { size: 60, weight: 'bold', fill: m.text, anchor: 'middle' }) +
      t(x + cw / 2, base - h + 98, r.points > 1 ? 'points' : 'point', { size: 26, weight: 'bold', fill: m.text, anchor: 'middle' }) +
      t(x + cw / 2, base - h + 124, `${count(r.wins, 'victoire')} · ${count(r.games, 'partie')}`, { size: 22, fill: m.text, anchor: 'middle', opacity: 0.8 })
  }
  return out
}

// rows = classement général trié ; session = classement de la session en cours (peut être vide)
export const rankingSvg = (rows, session = []) => {
  let y = 160
  let body = heading('CLASSEMENT', 'Les meilleurs détectives du groupe', C.gold, { y: 80 })
  body += podium(rows, y)
  y += 330

  const rest = rows.slice(3)
  if (rest.length) {
    rest.forEach((r, i) => {
      const name = clip(nameOf(r), 18)
      body +=
        rect(36, y, W - 72, 56, { r: 16, fill: i % 2 ? C.panel : C.panel2 }) +
        t(66, y + 38, `${i + 4}.`, { size: 26, weight: 'bold', fill: C.gold }) +
        t(116, y + 38, name, { size: fit(name, 380, 28, 18) }) +
        t(W - 58, y + 38, `${count(r.points, 'pt')} · ${count(r.wins, 'victoire')} / ${count(r.games, 'partie')}`, { size: 22, fill: C.muted, anchor: 'end' })
      y += 62
    })
    y += 6
  }

  if (session.length) {
    y += 28
    body += section(y, 'SESSION EN COURS', C.blue)
    y += 36
    session.slice(0, 5).forEach((r, i) => {
      const name = clip(nameOf(r), 18)
      body +=
        rect(36, y, W - 72, 54, { r: 16, fill: i % 2 ? C.panel : C.panel2 }) +
        badge(72, y + 27, 18, String(i + 1), { fill: i === 0 ? C.blue : C.line, color: i === 0 ? C.bg : C.text, size: 20 }) +
        t(110, y + 37, name, { size: fit(name, 400, 28, 18) }) +
        t(W - 58, y + 37, count(r.points, 'pt'), { size: 28, weight: 'bold', fill: C.blue, anchor: 'end' })
      y += 60
    })
  }
  return canvas(y + 14, C.gold, body)
}
