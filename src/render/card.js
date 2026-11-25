// Rendu des cartes de rôle (SVG → JPEG via sharp).
import { esc } from '../core/utils.js'
import { svgToJpeg, FONT } from './svg.js'

export const renderCard = async ({ title, color, category, big, lines }) => {
  const size = Math.max(34, Math.min(84, Math.floor(820 / (Math.max(big.length, 1) * 0.6))))
  const font = FONT
  const footer = lines
    .map(
      (l, i) =>
        `<text x="450" y="${470 + i * 44}" text-anchor="middle" font-family="${font}" font-size="28" fill="#c7cdd6">${esc(l)}</text>`
    )
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <rect width="900" height="600" rx="36" fill="#14181f"/>
  <rect x="24" y="24" width="852" height="552" rx="26" fill="none" stroke="${color}" stroke-width="4"/>
  <text x="450" y="130" text-anchor="middle" font-family="${font}" font-size="46" font-weight="bold" fill="${color}">${esc(title)}</text>
  <text x="450" y="205" text-anchor="middle" font-family="${font}" font-size="30" fill="#9aa4b2">${esc(category)}</text>
  <text x="450" y="355" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="bold" fill="#ffffff">${esc(big)}</text>
  ${footer}
</svg>`
  return svgToJpeg(svg)
}

// Vérifie au démarrage que les cartes peuvent être générées (lève une erreur sinon)
export const checkCardRendering = () =>
  renderCard({ title: 'TEST', color: '#ffffff', category: 'Catégorie : Test', big: 'Test', lines: ['ok'] })
