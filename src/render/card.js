// Carte de rôle (secret envoyé en privé) — construite sur la charte.
import { svgToJpeg } from './svg.js'
import { C } from './theme.js'
import { canvas, heading, t, rect, plain, wrapPx, pill, emWidth } from './kit.js'

export const cardSvg = ({ title, color = C.gold, category, big, lines = [] }) => {
  const bigText = plain(big) || String(big)
  const rows = lines.flatMap((l) => wrapPx(plain(l), 760, 30)).slice(0, 4)
  // Mot secret : une ligne ; s'il est trop long pour rester gros, 2 puis 3 lignes plus petites (jamais de mot tronqué sans nécessité)
  let bigSize = 92
  let bigLines = [bigText]
  if (emWidth(bigText, true) * bigSize > 740) {
    for (const size of [52, 42]) {
      bigSize = size
      bigLines = wrapPx(bigText, 740, size, true)
      if (bigLines.length <= (size === 52 ? 2 : 3)) break
    }
    bigLines = bigLines.slice(0, 3)
  }
  const step = Math.round(bigSize * 1.2)
  const boxH = Math.max(170, bigLines.length * step + 56)
  const chip = plain(category) // « Catégorie : Foot »
  const chipW = Math.min(780, 60 + Math.round(emWidth(chip, true) * 26))
  const midY = 206 + boxH / 2
  const textY = 206 + boxH + 56 // première ligne de consigne
  const body =
    heading(plain(title) || title, '', color, { y: 98 }) +
    (chip ? pill(450 - chipW / 2, 124, chipW, 46, chip, { fill: C.panel2, color: C.muted, size: 26 }) : '') +
    rect(50, 206, 800, boxH, { r: 26, fill: C.panel, stroke: color, sw: 4 }) +
    bigLines.map((l, i) => t(450, midY + bigSize * 0.36 + (i - (bigLines.length - 1) / 2) * step, l, { size: bigSize, minSize: 34, maxW: 740, weight: 'bold', anchor: 'middle' })).join('') +
    rows.map((l, i) => t(450, textY + i * 42, l, { size: 30, fill: C.text, anchor: 'middle', opacity: 0.85 })).join('')
  return canvas(textY + Math.max(rows.length - 1, 0) * 42 + 44, color, body)
}

export const renderCard = (card) => svgToJpeg(cardSvg(card))

// Vérifie au démarrage que les cartes peuvent être générées (lève une erreur sinon)
export const checkCardRendering = () => renderCard({ title: 'TEST', color: C.gold, category: 'Catégorie : Test', big: 'Test', lines: ['ok'] })
