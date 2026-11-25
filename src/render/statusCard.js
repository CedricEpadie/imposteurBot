// Carte d’état de la partie (/imposteur etat).
import { config } from '../config.js'
import { alivePlayers, labelOf } from '../game/players.js'
import { phaseName } from '../game/phases-meta.js'
import { getMode } from '../game/modes/index.js'
import { modeLabel } from '../game/wording.js'
import { C, W } from './theme.js'
import { canvas, heading, section, t, rect, bar, plain, fit, clip } from './kit.js'

export const statusSvg = (g) => {
  const { maxPlayers } = config.game
  const left = g.deadline ? Math.max(0, Math.ceil((g.deadline - Date.now()) / 1000)) : null
  const total = g.phaseTotal || left || 0
  const mode = getMode(g.mode)
  let y = 160
  let body = heading('ÉTAT DE LA PARTIE', plain(phaseName(g)), C.blue, { y: 80 })

  const row = (label, value, { color = C.text, outline = '' } = {}) => {
    const r = rect(36, y, W - 72, 60, { r: 16, fill: C.panel, stroke: outline }) + t(58, y + 40, label, { size: 24, fill: C.muted }) + t(W - 58, y + 40, value, { size: fit(value, 480, 28, 18), weight: 'bold', fill: color, anchor: 'end' })
    y += 70
    return r
  }
  const meter = (label, value, fraction, color) => {
    const r = rect(36, y, W - 72, 86, { r: 16, fill: C.panel }) + t(58, y + 38, label, { size: 24, fill: C.muted }) + t(W - 58, y + 38, value, { size: 30, weight: 'bold', fill: color, anchor: 'end' }) + bar(58, y + 54, W - 116, 16, fraction, { fill: color, back: C.bg })
    y += 98
    return r
  }

  body += row('Mode', plain(modeLabel(g, mode).split(':')[0]))
  body += row('Format', g.format === 'rounds' ? 'Plusieurs manches' : 'Un seul vote')
  if (g.imposters?.length) body += row(g.imposters.length > 1 ? 'Imposteurs' : 'Imposteur', String(g.imposters.length), { color: C.red })
  if (left !== null) body += meter('Temps restant', `${left} s`, total ? left / total : 0, C.gold)
  if (g.phase === 'clues' && g.turns?.[g.turnIdx]) body += row('À parler', clip(labelOf(g.turns[g.turnIdx]), 18), { color: C.gold, outline: C.gold })
  if (g.phase === 'vote') {
    const alive = alivePlayers(g).length
    body += meter('Votes reçus', `${g.votes?.size || 0}/${alive}`, alive ? (g.votes?.size || 0) / alive : 0, C.red)
  }

  y += 16
  body += section(y, `JOUEURS (${g.players.length}/${maxPlayers})`, C.blue)
  y += 38
  const cw = (W - 72 - 12) / 2
  g.players.forEach((p, i) => {
    const dead = g.eliminated.has(p)
    const x = 36 + (i % 2) * (cw + 12)
    const name = clip(labelOf(p), 16)
    body += `<g opacity="${dead ? 0.6 : 1}">` + rect(x, y, cw, 54, { r: 27, fill: C.panel2 }) + t(x + 26, y + 37, dead ? '✕' : '', { size: 24, fill: C.red }) + t(x + (dead ? 58 : 26), y + 37, name, { size: fit(name, cw - 90, 26, 18), deco: dead ? 'line-through' : '' }) + '</g>'
    if (i % 2 === 1 || i === g.players.length - 1) y += 64
  })
  return canvas(y + 12, C.blue, body)
}
