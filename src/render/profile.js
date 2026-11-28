// Carte de profil d’un joueur (/imposteur stats) : bilan, rôles, séries et forme récente.
import { C, W } from './theme.js'
import { canvas, heading, section, t, rect, pill, bar, fit, clip, plain, emWidth } from './kit.js'
import { cleanName } from '../game/players.js'
import { count } from '../game/wording.js'
import { titlesOf, nextChallenge, nicknameOf } from '../game/titles.js'

const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0)
export const ordinal = (n) => (n === 1 ? '1er' : `${n}e`)

// Une tuile : grand chiffre + légende
const tile = (x, y, w, h, value, label, color = C.text) =>
  rect(x, y, w, h, { r: 18, fill: C.panel }) + t(x + w / 2, y + h * 0.56, value, { size: fit(value, w - 20, 48, 26), weight: 'bold', fill: color, anchor: 'middle' }) + t(x + w / 2, y + h * 0.86, label, { size: 22, fill: C.muted, anchor: 'middle' })

// Panneau d’un rôle : victoires / parties + barre + pourcentage
const rolePanel = (x, y, w, title, wins, games, color) =>
  rect(x, y, w, 170, { r: 18, fill: C.panel, stroke: color, sw: 3 }) +
  t(x + w / 2, y + 40, title, { size: 24, weight: 'bold', fill: color, anchor: 'middle' }) +
  t(x + w / 2, y + 100, games ? `${wins}/${games}` : '—', { size: 52, weight: 'bold', anchor: 'middle' }) +
  t(x + w / 2, y + 130, games ? `${count(wins, 'victoire')} · ${pct(wins, games)} %` : 'aucune partie', { size: 22, fill: C.muted, anchor: 'middle' }) +
  bar(x + 24, y + 144, w - 48, 14, games ? wins / games : 0, { fill: color, back: C.bg })

export const profileSvg = (s, displayName) => {
  const name = clip(cleanName(displayName) || '', 22) || 'Joueur'
  let y = 150
  let body = heading('PROFIL DE JOUEUR', '', C.gold, { y: 80 })

  // Nom + rang
  body +=
    rect(36, y, W - 72, 92, { r: 20, fill: C.panel2 }) +
    t(64, y + 46, name, { size: fit(name, 480, 38, 22), weight: 'bold' }) +
    t(64, y + 76, `« ${nicknameOf(s)} »`, { size: 22, fill: C.gold })
  if (s.rank) body += pill(W - 36 - 236, y + 20, 212, 52, `${ordinal(s.rank)} sur ${s.players}`, { fill: s.rank === 1 ? C.gold : C.line, color: s.rank === 1 ? C.bg : C.text, size: 26 })
  y += 116

  // Chiffres clés
  const tw = (W - 72 - 24) / 3
  body += tile(36, y, tw, 122, String(s.games), 'parties') + tile(36 + tw + 12, y, tw, 122, `${pct(s.wins, s.games)} %`, `${count(s.wins, 'victoire')}`, C.green) + tile(36 + 2 * (tw + 12), y, tw, 122, String(s.points), 'points', C.gold)
  y += 146

  // Rôles
  const pw = (W - 72 - 14) / 2
  body += rolePanel(36, y, pw, 'EN IMPOSTEUR', s.impWins, s.asImposter, C.red) + rolePanel(36 + pw + 14, y, pw, 'EN CIVIL', s.civWins, s.civGames, C.green)
  y += 220

  // Séries
  body += section(y, 'SÉRIES', C.blue)
  y += 36
  const hw = (W - 72 - 12) / 2
  body += tile(36, y, hw, 122, String(s.streak), s.streak > 1 ? 'victoires d’affilée' : 'victoire d’affilée', s.streak ? C.gold : C.dim) + tile(36 + hw + 12, y, hw, 122, String(s.bestStreak), 'meilleure série', C.blue)
  y += 170

  // Titres obtenus (pastilles) et prochain défi (barre de progression)
  body += section(y, 'TITRES', C.gold)
  y += 36
  const titles = titlesOf(s)
  if (!titles.length) {
    body += t(48, y + 28, 'Aucun titre pour l’instant : joue pour en débloquer !', { size: 22, fill: C.muted })
    y += 44
  } else {
    let x = 36
    for (const ti of titles) {
      const label = ti.name
      const w = Math.round(44 + emWidth(label) * 22)
      if (x + w > W - 36) {
        x = 36
        y += 56
      }
      body += pill(x, y, w, 44, label, { fill: ti.tier >= ti.of ? C.gold : C.panel2, color: ti.tier >= ti.of ? C.bg : C.gold, size: 22 })
      x += w + 10
    }
    y += 62
  }
  const next = nextChallenge(s)
  if (next) {
    body += t(48, y + 24, `Prochain défi : ${next.name}`, { size: 24, weight: 'bold' }) + t(W - 48, y + 24, `${next.value} / ${next.goal}`, { size: 24, weight: 'bold', fill: C.gold, anchor: 'end' })
    body += bar(48, y + 40, W - 96, 14, next.value / next.goal, { fill: C.gold }) + t(48, y + 84, next.unit, { size: 22, fill: C.muted })
    y += 112
  }
  y += 18

  // Forme récente : un rond par partie (vert = gagnée, rouge = perdue), I = imposteur, C = civil
  body += section(y, `FORME (${count(s.form.length, 'dernière partie', 'dernières parties')})`, C.gold)
  y += 44
  const step = 74
  const x0 = (W - step * s.form.length) / 2 + step / 2
  s.form.forEach((r, i) => {
    const cx = x0 + i * step
    const col = r.won ? C.green : C.red
    body += `<circle cx="${cx}" cy="${y + 28}" r="28" fill="${col}"/>` + t(cx, y + 38, r.role === 'imposteur' ? 'I' : 'C', { size: 28, weight: 'bold', fill: C.bg, anchor: 'middle' })
  })
  y += 78
  body += t(W / 2, y + 16, 'I = imposteur · C = civil · la plus récente est à droite', { size: 22, fill: C.dim, anchor: 'middle' })
  y += 40
  return canvas(y + 10, C.gold, body)
}
