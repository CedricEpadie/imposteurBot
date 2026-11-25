// Carte de rôle (secret envoyé en privé) — construite sur la charte.
import { svgToJpeg } from './svg.js'
import { C } from './theme.js'
import { canvas, heading, t, rect, fit, plain, wrap, pill } from './kit.js'

export const cardSvg = ({ title, color = C.gold, category, big, lines = [] }) => {
  const bigText = plain(big) || String(big)
  const rows = lines.flatMap((l) => wrap(plain(l), 38)).slice(0, 4)
  const bigSize = fit(bigText, 700, 92, 40)
  const chip = plain(category) // « Catégorie : Foot »
  const chipW = Math.min(780, 60 + chip.length * 16)
  const body =
    heading(plain(title) || title, '', color, { y: 98 }) +
    (chip ? pill(450 - chipW / 2, 124, chipW, 46, chip, { fill: C.panel2, color: C.muted, size: 26 }) : '') +
    rect(50, 206, 800, 170, { r: 26, fill: C.panel, stroke: color, sw: 4 }) +
    t(450, 291 + bigSize * 0.36, bigText, { size: bigSize, weight: 'bold', anchor: 'middle' }) +
    rows.map((l, i) => t(450, 432 + i * 42, l, { size: 30, fill: C.text, anchor: 'middle', opacity: 0.85 })).join('')
  return canvas(432 + Math.max(rows.length - 1, 0) * 42 + 44, color, body)
}

export const renderCard = (card) => svgToJpeg(cardSvg(card))

// Vérifie au démarrage que les cartes peuvent être générées (lève une erreur sinon)
export const checkCardRendering = () => renderCard({ title: 'TEST', color: C.gold, category: 'Catégorie : Test', big: 'Test', lines: ['ok'] })
