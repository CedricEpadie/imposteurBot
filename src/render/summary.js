// Bilan de fin de partie : vainqueur, imposteurs, mots, points de la partie et total de chaque participant.
import { labelOf, isImposter } from '../game/players.js'
import { pointsOf } from '../game/scoring.js'
import { getMode } from '../game/modes/index.js'
import { ie } from '../game/wording.js'
import { C, W } from './theme.js'
import { canvas, heading, section, t, rect, pill, wrapPx, plain, fit } from './kit.js'

// totals = Map(numéro → total de points du joueur après la partie)
export const summarySvg = (g, winner, reason, totals = new Map()) => {
  const civils = winner === 'civils'
  const accent = civils ? C.green : C.red
  const title = civils ? 'LES CIVILS GAGNENT' : ie(g, 'L’IMPOSTEUR GAGNE', 'LES IMPOSTEURS GAGNENT')
  let y = 170
  let body = heading(title, 'FIN DE PARTIE', accent, { y: 80 })

  const reasonLines = wrapPx(plain(reason), W - 100, 25).slice(0, 3)
  body += reasonLines.map((l, i) => t(W / 2, y + i * 32, l, { size: 25, fill: C.text, anchor: 'middle', opacity: 0.85 })).join('')
  y += reasonLines.length * 32 + 30

  // Imposteurs
  body += section(y, ie(g, 'L’IMPOSTEUR ÉTAIT', 'LES IMPOSTEURS ÉTAIENT'), C.red)
  y += 40
  const pw = Math.min(260, (W - 72 - 14 * (g.imposters.length - 1)) / g.imposters.length)
  body += g.imposters.map((p, i) => pill(36 + i * (pw + 14), y, pw, 52, labelOf(p), { fill: C.red, color: C.bg, size: 26 })).join('')
  y += 76

  // Mots révélés
  const reveal = getMode(g.mode).revealPlain?.(g) || []
  for (const [label, value] of reveal) {
    body += rect(36, y, W - 72, 60, { r: 16, fill: C.panel }) + t(58, y + 40, label, { size: 24, fill: C.muted }) + t(W - 58, y + 41, plain(value), { size: 34, minSize: 20, maxW: 560, weight: 'bold', anchor: 'end' })
    y += 70
  }
  body += t(W / 2, y + 22, `Catégorie : ${plain(g.category)}`, { size: 22, fill: C.dim, anchor: 'middle' })
  y += 66

  // Points de chaque participant : ceux de la partie et le total (tous les points du groupe, parties comprises)
  const scored = g.players.map((p) => ({ p, pts: pointsOf(g, p), imp: isImposter(g, p), total: totals.get(p.num) ?? pointsOf(g, p) })).sort((a, b) => b.pts - a.pts || b.total - a.total)
  body += section(y, 'POINTS', C.gold)
  body += t(690, y, 'PARTIE', { size: 22, weight: 'bold', fill: C.muted, anchor: 'end' }) + t(W - 58, y, 'TOTAL', { size: 22, weight: 'bold', fill: C.muted, anchor: 'end' })
  y += 30
  scored.forEach(({ p, pts, imp, total }, i) => {
    body +=
      rect(36, y, W - 72, 50, { r: 14, fill: i % 2 ? C.panel : C.panel2 }) +
      t(58, y + 34, labelOf(p), { size: 26, maxW: 290, minSize: 18 }) +
      pill(364, y + 8, 168, 34, imp ? 'IMPOSTEUR' : 'CIVIL', { fill: imp ? C.red : C.green, color: C.bg, size: 20 }) +
      t(690, y + 35, pts ? `+${pts}` : '0', { size: 28, weight: 'bold', fill: pts ? C.gold : C.dim, anchor: 'end' }) +
      t(W - 58, y + 35, String(total), { size: 28, weight: 'bold', fill: C.text, anchor: 'end' })
    y += 56
  })
  return canvas(y + 6, accent, body)
}
