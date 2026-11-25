// Carte de rôle (secret envoyé en privé) — construite sur la charte.
import { svgToJpeg } from './svg.js'
import { C } from './theme.js'
import { canvas, heading, t, rect, fit, plain, wrap } from './kit.js'

export const cardSvg = ({ title, color = C.gold, category, big, lines = [] }) => {
  const bigText = plain(big) || String(big)
  const rows = lines.flatMap((l) => wrap(plain(l), 46)).slice(0, 4)
  const body =
    heading(plain(title) || title, plain(category), color, { y: 96 }) +
    rect(60, 190, 780, 160, { r: 24, fill: C.panel, stroke: color, sw: 2 }) +
    t(450, 290 + fit(bigText, 720, 84, 36) * 0.18, bigText, { size: fit(bigText, 720, 84, 36), weight: 'bold', anchor: 'middle' }) +
    rows.map((l, i) => t(450, 400 + i * 38, l, { size: 26, fill: C.muted, anchor: 'middle' })).join('')
  return canvas(520, color, body)
}

export const renderCard = (card) => svgToJpeg(cardSvg(card))

// Vérifie au démarrage que les cartes peuvent être générées (lève une erreur sinon)
export const checkCardRendering = () => renderCard({ title: 'TEST', color: C.gold, category: 'Catégorie : Test', big: 'Test', lines: ['ok'] })
