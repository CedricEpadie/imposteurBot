// Tableau des indices en image, affiché pendant le débat.
import { config } from '../config.js'
import { esc } from '../core/utils.js'
import { labelOf } from '../game/players.js'
import { svgToJpeg, FONT } from './svg.js'

const ROW_H = 62
const fit = (text, width, max, min) => Math.max(min, Math.min(max, Math.floor(width / (Math.max(text.length, 1) * 0.62))))

// Construit le SVG du tableau (séparé du rendu pour pouvoir être testé)
export const boardSvg = (g) => {
  const rounds = config.game.clueRounds
  const alive = g.order.filter((p) => !g.eliminated.has(p))
  const out = g.players.filter((p) => g.eliminated.has(p))
  const rows = [...alive, ...out]
  const width = 900
  const height = 216 + rows.length * ROW_H
  const firstCol = 400
  const colW = (width - 40 - firstCol) / rounds

  const clueOf = (p, round) => g.clues.find((c) => c.manche === g.manche && c.round === round && c.p === p)

  const header = Array.from(
    { length: rounds },
    (_, r) => `<text x="${firstCol + colW * r + colW / 2}" y="168" text-anchor="middle" font-family="${FONT}" font-size="22" fill="#9aa4b2">Tour ${r + 1}</text>`
  ).join('')

  const body = rows
    .map((p, i) => {
      const y = 186 + i * ROW_H
      const dead = g.eliminated.has(p)
      const name = labelOf(p).slice(0, 20)
      const cells = Array.from({ length: rounds }, (_, r) => {
        const c = clueOf(p, r + 1)
        const text = c ? c.text || '…' : '—'
        const size = fit(text, colW - 16, 30, 16)
        const fill = c?.text ? '#ffffff' : '#5c6674'
        return `<text x="${firstCol + colW * r + colW / 2}" y="${y + 40}" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="bold" fill="${fill}">${esc(text)}</text>`
      }).join('')
      return `<g opacity="${dead ? 0.45 : 1}">
  <rect x="24" y="${y}" width="${width - 48}" height="${ROW_H - 6}" rx="12" fill="${i % 2 ? '#1a2029' : '#1e2530'}"/>
  <text x="44" y="${y + 40}" font-family="${FONT}" font-size="26" fill="#c7cdd6">${dead ? '✕' : alive.indexOf(p) + 1 + '.'}</text>
  <text x="96" y="${y + 40}" font-family="${FONT}" font-size="${fit(name, 290, 28, 18)}" fill="#ffffff"${dead ? ' text-decoration="line-through"' : ''}>${esc(name)}</text>
  ${cells}
</g>`
    })
    .join('\n')

  const sub = `Catégorie : ${String(g.category).replace(/[^\p{L}\p{N}\s'’-]/gu, '').trim()}` + (g.manche > 1 ? `  ·  Manche ${g.manche}` : '')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="30" fill="#14181f"/>
  <rect x="14" y="14" width="${width - 28}" height="${height - 28}" rx="22" fill="none" stroke="#f0b429" stroke-width="3"/>
  <text x="${width / 2}" y="76" text-anchor="middle" font-family="${FONT}" font-size="42" font-weight="bold" fill="#f0b429">TABLEAU DES INDICES</text>
  <text x="${width / 2}" y="116" text-anchor="middle" font-family="${FONT}" font-size="24" fill="#9aa4b2">${esc(sub)}</text>
  ${header}
  ${body}
</svg>`
}

export const renderBoard = (g) => svgToJpeg(boardSvg(g))
