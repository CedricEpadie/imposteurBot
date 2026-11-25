// Carte d’état de la partie (/imposteur etat).
import { config } from '../config.js'
import { alivePlayers, labelOf } from '../game/players.js'
import { phaseName } from '../game/phases-meta.js'
import { getMode } from '../game/modes/index.js'
import { modeLabel } from '../game/wording.js'
import { C, W } from './theme.js'
import { canvas, heading, section, t, rect, pill, bar, plain, fit, clip } from './kit.js'

export const statusSvg = (g) => {
  const { maxPlayers } = config.game
  const left = g.deadline ? Math.max(0, Math.ceil((g.deadline - Date.now()) / 1000)) : null
  const total = g.phaseTotal || left || 0
  const mode = getMode(g.mode)
  let y = 140
  let body = heading('ÉTAT DE LA PARTIE', phaseName(g), C.blue, { y: 76 })

  const infoRow = (label, value) => {
    const r = rect(36, y, W - 72, 52, { r: 14, fill: C.panel }) + t(60, y + 34, label, { size: 20, fill: C.muted }) + t(W - 60, y + 34, value, { size: fit(value, 520, 22, 14), weight: 'bold', anchor: 'end' })
    y += 60
    return r
  }
  body += infoRow('Mode', plain(modeLabel(g, mode).split(':')[0]))
  body += infoRow('Format', g.format === 'rounds' ? 'Plusieurs manches' : 'Un seul vote')
  if (g.imposters?.length) body += infoRow('Imposteurs', g.imposters.length === 1 ? '1' : String(g.imposters.length))

  if (left !== null) {
    body += rect(36, y, W - 72, 66, { r: 14, fill: C.panel }) + t(60, y + 30, 'Temps restant pour cette étape', { size: 18, fill: C.muted }) + t(W - 60, y + 30, `${left} s`, { size: 24, weight: 'bold', fill: C.gold, anchor: 'end' }) + bar(60, y + 44, W - 120, 12, total ? left / total : 0, { fill: C.gold, back: C.bg })
    y += 76
  }
  if (g.phase === 'clues' && g.turns?.[g.turnIdx]) {
    body += rect(36, y, W - 72, 52, { r: 14, fill: C.panel, stroke: C.gold }) + t(60, y + 34, 'À parler', { size: 20, fill: C.muted }) + t(W - 60, y + 34, labelOf(g.turns[g.turnIdx]), { size: 24, weight: 'bold', fill: C.gold, anchor: 'end' })
    y += 60
  }
  if (g.phase === 'vote') {
    const alive = alivePlayers(g).length
    body += rect(36, y, W - 72, 66, { r: 14, fill: C.panel }) + t(60, y + 30, 'Votes reçus', { size: 18, fill: C.muted }) + t(W - 60, y + 30, `${g.votes?.size || 0}/${alive}`, { size: 24, weight: 'bold', fill: C.red, anchor: 'end' }) + bar(60, y + 44, W - 120, 12, alive ? (g.votes?.size || 0) / alive : 0, { fill: C.red, back: C.bg })
    y += 76
  }

  y += 30
  body += section(y, `JOUEURS (${g.players.length}/${maxPlayers})`, C.blue)
  y += 34
  const cw = (W - 72 - 12) / 2
  g.players.forEach((p, i) => {
    const dead = g.eliminated.has(p)
    const x = 36 + (i % 2) * (cw + 12)
    const name = clip(labelOf(p), 18)
    body += `<g opacity="${dead ? 0.45 : 1}">` + rect(x, y, cw, 46, { r: 23, fill: C.panel2 }) + t(x + 24, y + 31, name, { size: fit(name, cw - 120, 22, 15), deco: dead ? 'line-through' : '' }) + (dead ? pill(x + cw - 100, y + 8, 84, 30, 'éliminé', { fill: C.red, color: C.bg, size: 15 }) : '') + '</g>'
    if (i % 2 === 1 || i === g.players.length - 1) y += 54
  })
  return canvas(y + 12, C.blue, body)
}
