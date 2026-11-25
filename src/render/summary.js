// Bilan de fin de partie : vainqueur, imposteurs, mots, points de la partie et classement de session.
import { labelOf, isImposter } from '../game/players.js'
import { pointsOf } from '../game/scoring.js'
import { getMode } from '../game/modes/index.js'
import { count, ie } from '../game/wording.js'
import { C, W } from './theme.js'
import { canvas, heading, section, t, rect, pill, badge, wrap, plain, fit, clip } from './kit.js'

// session = [{ jid, name?, points }] ; sessionName(jid) retrouve le nom affichable
export const summarySvg = (g, winner, reason, session = [], nameOf = (r) => r.name || `+${String(r.jid).split('@')[0]}`) => {
  const civils = winner === 'civils'
  const accent = civils ? C.green : C.red
  const title = civils ? 'LES CIVILS GAGNENT' : ie(g, 'L’IMPOSTEUR GAGNE', 'LES IMPOSTEURS GAGNENT')
  let y = 164
  let body = heading(title, 'FIN DE PARTIE', accent, { y: 78 })

  const reasonLines = wrap(plain(reason), 62).slice(0, 3)
  body += reasonLines.map((l, i) => t(W / 2, y + i * 28, l, { size: 21, fill: C.muted, anchor: 'middle' })).join('')
  y += reasonLines.length * 28 + 22

  // Imposteurs + mots
  const reveal = getMode(g.mode).revealPlain?.(g) || []
  body += section(y, ie(g, 'L’IMPOSTEUR ÉTAIT', 'LES IMPOSTEURS ÉTAIENT'), C.red)
  y += 40
  body += g.imposters.map((p, i) => pill(36 + i * 230, y, 214, 42, clip(labelOf(p), 16), { fill: C.red, color: C.bg, size: 20 })).join('')
  y += 62
  for (const [label, value] of reveal) {
    body += rect(36, y, W - 72, 48, { r: 14, fill: C.panel }) + t(56, y + 32, label, { size: 20, fill: C.muted }) + t(W - 56, y + 32, plain(value), { size: fit(value, 420, 26, 16), weight: 'bold', anchor: 'end' })
    y += 56
  }
  body += t(W / 2, y + 22, `Catégorie : ${plain(g.category)}`, { size: 18, fill: C.dim, anchor: 'middle' })
  y += 58

  // Points de la partie
  const scored = g.players.map((p) => ({ p, pts: pointsOf(g, p) })).sort((a, b) => b.pts - a.pts)
  body += section(y, 'POINTS DE LA PARTIE', C.gold)
  y += 34
  scored.forEach(({ p, pts }, i) => {
    const imp = isImposter(g, p)
    const name = clip(labelOf(p), 18)
    body +=
      rect(36, y, W - 72, 48, { r: 14, fill: i % 2 ? C.panel : C.panel2 }) +
      t(60, y + 32, name, { size: fit(name, 340, 24, 16) }) +
      pill(440, y + 9, 130, 30, imp ? 'IMPOSTEUR' : 'CIVIL', { fill: imp ? C.red : C.green, color: C.bg, size: 15 }) +
      t(W - 56, y + 32, count(pts, 'pt'), { size: 24, weight: 'bold', fill: pts ? C.gold : C.dim, anchor: 'end' })
    y += 54
  })

  // Classement de la session
  if (session.length) {
    y += 20
    body += section(y, 'CLASSEMENT DE LA SESSION', C.blue)
    y += 34
    session.forEach((r, i) => {
      const name = clip(nameOf(r), 18)
      body += rect(36, y, W - 72, 48, { r: 14, fill: i % 2 ? C.panel : C.panel2 }) + badge(70, y + 24, 16, String(i + 1), { fill: i === 0 ? C.gold : C.line, color: C.bg, size: 17 }) + t(104, y + 32, name, { size: fit(name, 420, 24, 16) }) + t(W - 56, y + 32, count(r.points, 'pt'), { size: 24, weight: 'bold', fill: C.blue, anchor: 'end' })
      y += 54
    })
  }
  return canvas(y + 10, accent, body)
}
