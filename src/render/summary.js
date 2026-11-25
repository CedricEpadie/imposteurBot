// Bilan de fin de partie : vainqueur, imposteurs, mots, points de la partie et classement de session.
import { labelOf, isImposter } from '../game/players.js'
import { pointsOf } from '../game/scoring.js'
import { getMode } from '../game/modes/index.js'
import { count, ie } from '../game/wording.js'
import { C, W } from './theme.js'
import { canvas, heading, section, t, rect, pill, badge, wrap, plain, fit, clip } from './kit.js'

// session = [{ num, points }] ; nameOf(r) retrouve le nom affichable
export const summarySvg = (g, winner, reason, session = [], nameOf = (r) => r.name || `+${r.num}`) => {
  const civils = winner === 'civils'
  const accent = civils ? C.green : C.red
  const title = civils ? 'LES CIVILS GAGNENT' : ie(g, 'L’IMPOSTEUR GAGNE', 'LES IMPOSTEURS GAGNENT')
  let y = 170
  let body = heading(title, 'FIN DE PARTIE', accent, { y: 80 })

  const reasonLines = wrap(plain(reason), 50).slice(0, 3)
  body += reasonLines.map((l, i) => t(W / 2, y + i * 32, l, { size: 25, fill: C.text, anchor: 'middle', opacity: 0.85 })).join('')
  y += reasonLines.length * 32 + 30

  // Imposteurs
  body += section(y, ie(g, 'L’IMPOSTEUR ÉTAIT', 'LES IMPOSTEURS ÉTAIENT'), C.red)
  y += 40
  const pw = Math.min(260, (W - 72 - 14 * (g.imposters.length - 1)) / g.imposters.length)
  body += g.imposters.map((p, i) => pill(36 + i * (pw + 14), y, pw, 52, clip(labelOf(p), 13), { fill: C.red, color: C.bg, size: 26 })).join('')
  y += 76

  // Mots révélés
  const reveal = getMode(g.mode).revealPlain?.(g) || []
  for (const [label, value] of reveal) {
    body += rect(36, y, W - 72, 60, { r: 16, fill: C.panel }) + t(58, y + 40, label, { size: 24, fill: C.muted }) + t(W - 58, y + 41, plain(value), { size: fit(value, 460, 34, 20), weight: 'bold', anchor: 'end' })
    y += 70
  }
  body += t(W / 2, y + 22, `Catégorie : ${plain(g.category)}`, { size: 22, fill: C.dim, anchor: 'middle' })
  y += 66

  // Points : on détaille ceux qui ont marqué (et les imposteurs) ; les autres tiennent sur une ligne
  const scored = g.players.map((p) => ({ p, pts: pointsOf(g, p), imp: isImposter(g, p) })).sort((a, b) => b.pts - a.pts)
  const shown = scored.filter((r) => r.pts > 0 || r.imp)
  const rest = scored.filter((r) => !shown.includes(r))
  body += section(y, 'POINTS DE LA PARTIE', C.gold)
  y += 38
  shown.forEach(({ p, pts, imp }, i) => {
    const name = clip(labelOf(p), 16)
    body +=
      rect(36, y, W - 72, 58, { r: 16, fill: i % 2 ? C.panel : C.panel2 }) +
      t(58, y + 39, name, { size: fit(name, 330, 28, 18) }) +
      pill(410, y + 11, 170, 36, imp ? 'IMPOSTEUR' : 'CIVIL', { fill: imp ? C.red : C.green, color: C.bg, size: 20 }) +
      t(W - 58, y + 40, count(pts, 'pt'), { size: 30, weight: 'bold', fill: pts ? C.gold : C.dim, anchor: 'end' })
    y += 66
  })
  if (rest.length) {
    const lines = wrap(`Sans point : ${rest.map((r) => clip(labelOf(r.p), 12)).join(', ')}`, 46)
    body += lines.map((l, k) => t(58, y + 28 + k * 32, l, { size: 23, fill: C.dim })).join('')
    y += lines.length * 32 + 20
  }

  // Classement de la session (top 5)
  if (session.length) {
    y += 20
    body += section(y, 'CLASSEMENT DE LA SESSION', C.blue)
    y += 38
    session.slice(0, 5).forEach((r, i) => {
      const name = clip(nameOf(r), 16)
      body += rect(36, y, W - 72, 58, { r: 16, fill: i % 2 ? C.panel : C.panel2 }) + badge(76, y + 29, 20, String(i + 1), { fill: i === 0 ? C.gold : C.line, color: i === 0 ? C.bg : C.text, size: 22 }) + t(116, y + 39, name, { size: fit(name, 470, 28, 18) }) + t(W - 58, y + 40, count(r.points, 'pt'), { size: 30, weight: 'bold', fill: C.blue, anchor: 'end' })
      y += 66
    })
  }
  return canvas(y + 12, accent, body)
}
