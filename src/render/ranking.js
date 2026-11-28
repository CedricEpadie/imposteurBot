// Classement du groupe en image : podium (1er au centre, plus haut) puis la suite en liste.
import { cleanName } from '../game/players.js'
import { count } from '../game/wording.js'
import { C, W } from './theme.js'
import { canvas, heading, t, rect, badge, emWidth } from './kit.js'

const MEDAL = [
  { fill: '#f0b429', text: '#12161f' }, // or
  { fill: '#c4ccd8', text: '#12161f' }, // argent
  { fill: '#d98b4c', text: '#12161f' }, // bronze
]
const nameOf = (r) => cleanName(r.name) || `+${r.num}`

// Podium : place 1 au centre, 2 à gauche, 3 à droite
const podium = (rows, y, mvp = false) => {
  const slots = [
    { idx: 1, h: 190, col: 0 },
    { idx: 0, h: 226, col: 1 },
    { idx: 2, h: 172, col: 2 },
  ]
  const cw = 262
  const gap = 14
  const x0 = (W - (3 * cw + 2 * gap)) / 2
  const base = y + 306 // bas des marches
  let out = ''
  for (const { idx, h, col } of slots) {
    const r = rows[idx]
    if (!r) continue
    const x = x0 + col * (cw + gap)
    const m = MEDAL[idx]
    const cx = x + cw / 2
    out +=
      t(cx, base - h - 64, nameOf(r), { size: 30, weight: 'bold', anchor: 'middle', maxW: cw + gap - 4, minSize: 20 }) +
      (mvp && idx === 0
        ? `<path d="M-24,14 L-24,-12 L-12,2 L0,-18 L12,2 L24,-12 L24,14 Z" fill="${m.fill}" transform="translate(${cx} ${base - h - 32})"/>`
        : badge(cx, base - h - 30, 22, String(idx + 1), { fill: m.fill, color: m.text, size: 26 })) +
      rect(x, base - h, cw, h, { r: 20, fill: m.fill }) +
      t(cx, base - h + 64, String(r.points), { size: 60, weight: 'bold', fill: m.text, anchor: 'middle', maxW: cw - 24 }) +
      t(cx, base - h + 96, r.points > 1 ? 'points' : 'point', { size: 26, weight: 'bold', fill: m.text, anchor: 'middle' }) +
      t(cx, base - h + 126, count(r.wins, 'victoire'), { size: 24, fill: m.text, anchor: 'middle', maxW: cw - 24 }) +
      t(cx, base - h + 154, count(r.games, 'partie'), { size: 24, fill: m.text, anchor: 'middle', maxW: cw - 24 })
  }
  return out
}

// rows = classement trié (saison, général…) ; opts = { title, subtitle }
export const rankingSvg = (rows, { title = 'CLASSEMENT', subtitle = 'Les meilleurs détectives du groupe', mvp = false } = {}) => {
  let y = 160
  let body = heading(title, subtitle, C.gold, { y: 80 })
  body += podium(rows, y, mvp)
  y += 340

  rows.slice(3).forEach((r, i) => {
    const stats = `${count(r.points, 'pt')} · ${count(r.wins, 'victoire')} / ${count(r.games, 'partie')}`
    const room = W - 58 - emWidth(stats) * 22 - 116 - 24 // place laissée au nom, à gauche des statistiques
    body +=
      rect(36, y, W - 72, 56, { r: 16, fill: i % 2 ? C.panel : C.panel2 }) +
      t(66, y + 38, `${i + 4}.`, { size: 26, weight: 'bold', fill: C.gold }) +
      t(116, y + 38, nameOf(r), { size: 28, maxW: room, minSize: 20 }) +
      t(W - 58, y + 38, stats, { size: 22, fill: C.muted, anchor: 'end' })
    y += 62
  })
  return canvas(y + 14, C.gold, body)
}
