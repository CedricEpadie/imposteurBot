// Tableau des indices en image, affiché pendant le débat — construit sur la charte.
import { config } from '../config.js'
import { labelOf } from '../game/players.js'
import { svgToJpeg } from './svg.js'
import { C, W } from './theme.js'
import { canvas, heading, t, rect, plain } from './kit.js'

const ROW_H = 62

// Construit le SVG du tableau (séparé du rendu pour pouvoir être testé)
export const boardSvg = (g) => {
  const rounds = config.game.clueRounds
  const alive = g.order.filter((p) => !g.eliminated.has(p))
  const out = g.players.filter((p) => g.eliminated.has(p))
  const rows = [...alive, ...out]
  const firstCol = 400
  const colW = (W - 40 - firstCol) / rounds
  const clueOf = (p, round) => g.clues.find((c) => c.manche === g.manche && c.round === round && c.p === p)

  const header = Array.from({ length: rounds }, (_, r) => t(firstCol + colW * r + colW / 2, 168, `Tour ${r + 1}`, { size: 26, weight: 'bold', fill: C.gold, anchor: 'middle' })).join('')

  const body = rows
    .map((p, i) => {
      const y = 186 + i * ROW_H
      const dead = g.eliminated.has(p)
      const cells = Array.from({ length: rounds }, (_, r) => {
        const c = clueOf(p, r + 1)
        const text = c ? c.text || '…' : '—'
        return t(firstCol + colW * r + colW / 2, y + 40, text, { size: 32, minSize: 18, maxW: colW - 16, weight: 'bold', fill: c?.text ? C.text : C.dim, anchor: 'middle' })
      }).join('')
      return `<g opacity="${dead ? 0.6 : 1}">
  ${rect(24, y, W - 48, ROW_H - 6, { r: 12, fill: i % 2 ? C.panel : C.panel2 })}
  ${t(44, y + 40, dead ? '✕' : alive.indexOf(p) + 1 + '.', { size: 26, fill: dead ? C.red : C.gold })}
  ${t(96, y + 40, labelOf(p), { size: 30, minSize: 20, maxW: firstCol - 96 - 14, deco: dead ? 'line-through' : '' })}
  ${cells}
</g>`
    })
    .join('\n')

  const sub = `Catégorie : ${plain(g.category)}` + (g.manche > 1 ? `  ·  Manche ${g.manche}` : '')
  return canvas(190 + rows.length * ROW_H, C.gold, heading('TABLEAU DES INDICES', sub, C.gold, { y: 76 }) + header + body)
}

export const renderBoard = (g) => svgToJpeg(boardSvg(g))
