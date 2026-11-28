// Carte de profil d’un joueur (/imposteur stats) : bilan, rôles, séries et forme récente.
import { C, W } from './theme.js'
import { canvas, heading, section, t, rect, pill, bar, fit, clip, plain, emWidth } from './kit.js'
import { cleanName } from '../game/players.js'
import { count } from '../game/wording.js'
import { titlesOf, nextChallenge, styleOf } from '../game/titles.js'

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

const TIER_COLOR = ['#d98b4c', '#c4ccd8', '#f0b429'] // bronze, argent, or

// s = statistiques de la période affichée ; career = statistiques depuis le début (surnom, titres, séries de jours : toujours « de carrière »)
// opts = { career, period: 'week' | 'global', label (ex. « du 23 au 29 novembre »), challenges: [{ tier, text, goal, value }] }
export const profileSvg = (s, displayName, { career = s, period = 'global', label = '', challenges = [] } = {}) => {
  const name = clip(cleanName(displayName) || '', 22) || 'Joueur'
  const style = styleOf(career)
  let y = 168
  let body = heading('PROFIL DE JOUEUR', period === 'week' ? `Semaine ${label}` : 'Depuis le début', C.gold, { y: 80 })

  // Nom, surnom, explication du style et rang
  body +=
    rect(36, y, W - 72, 124, { r: 20, fill: C.panel2 }) +
    t(64, y + 44, name, { size: fit(name, 480, 38, 22), weight: 'bold', maxW: 500 }) +
    t(64, y + 76, `« ${style.nickname} »`, { size: 26, weight: 'bold', fill: C.gold, maxW: 520 }) +
    t(64, y + 106, style.why, { size: 20, fill: C.muted, maxW: W - 128 })
  if (s.rank) body += pill(W - 36 - 236, y + 20, 212, 52, `${ordinal(s.rank)} sur ${s.players}`, { fill: s.rank === 1 ? C.gold : C.line, color: s.rank === 1 ? C.bg : C.text, size: 26 })
  y += 148

  // Chiffres clés
  const tw = (W - 72 - 24) / 3
  body += tile(36, y, tw, 122, String(s.games), s.games > 1 ? 'parties' : 'partie') + tile(36 + tw + 12, y, tw, 122, `${pct(s.wins, s.games)} %`, `${count(s.wins, 'victoire')}`, C.green) + tile(36 + 2 * (tw + 12), y, tw, 122, String(s.points), s.points > 1 ? 'points' : 'point', C.gold)
  y += 146

  // Rôles
  const pw = (W - 72 - 14) / 2
  body += rolePanel(36, y, pw, 'EN IMPOSTEUR', s.impWins, s.asImposter, C.red) + rolePanel(36 + pw + 14, y, pw, 'EN CIVIL', s.civWins, s.civGames, C.green)
  y += 220

  // Séries : victoires d’affilée (sur la période), jours et semaines de suite (depuis le début)
  body += section(y, 'SÉRIES', C.blue)
  y += 36
  const hw = (W - 72 - 12) / 2
  const sm = (x, yy, v, label, record, color) => {
    const nw = emWidth(String(v), true) * 52
    const lx = x + 28 + nw + 18
    return rect(x, yy, hw, 96, { r: 18, fill: C.panel }) + t(x + 28, yy + 64, String(v), { size: 52, weight: 'bold', fill: v ? color : C.dim }) + t(lx, yy + 44, label, { size: 22, fill: C.text, maxW: x + hw - 16 - lx }) + (record ? t(lx, yy + 74, record, { size: 20, fill: C.muted, maxW: x + hw - 16 - lx }) : '')
  }
  const plural = (v, one, many) => (v > 1 ? many : one)
  body += sm(36, y, s.streak, plural(s.streak, 'victoire d’affilée', 'victoires d’affilée'), `record : ${s.bestStreak}`, C.gold) + sm(36 + hw + 12, y, career.dayStreak || 0, plural(career.dayStreak, 'jour de suite', 'jours de suite'), `record : ${career.bestDayStreak || 0}`, C.blue)
  y += 108
  body += sm(36, y, career.weekStreak || 0, plural(career.weekStreak, 'semaine de suite', 'semaines de suite'), `record : ${career.bestWeekStreak || 0}`, C.green) + sm(36 + hw + 12, y, career.defisDone || 0, plural(career.defisDone, 'défi relevé', 'défis relevés'), 'depuis le début', C.gold)
  y += 142

  // Défis de la semaine : trois barres de progression (bronze, argent, or)
  if (challenges.length) {
    body += section(y, 'DÉFIS DE LA SEMAINE', C.gold)
    y += 36
    for (const c of challenges) {
      const done = c.value >= c.goal
      body += `<circle cx="62" cy="${y + 20}" r="10" fill="${TIER_COLOR[c.level]}"/>` + t(86, y + 28, c.text, { size: 24, weight: 'bold', fill: done ? C.green : C.text, maxW: W - 86 - 190 })
      body += t(W - 48, y + 28, done ? 'RELEVÉ' : `${c.value} / ${c.goal}`, { size: 24, weight: 'bold', fill: done ? C.green : C.gold, anchor: 'end' })
      body += bar(48, y + 42, W - 96, 12, c.goal ? c.value / c.goal : 0, { fill: done ? C.green : TIER_COLOR[c.level] })
      y += 70
    }
    y += 30
  }

  // Style : les traits qui ressortent
  body += section(y, 'STYLE DE JEU', C.blue)
  y += 36
  if (!style.traits.length) {
    body += t(48, y + 28, style.novice ? style.why[0].toUpperCase() + style.why.slice(1) : 'Aucun trait ne se dégage encore.', { size: 22, fill: C.muted, maxW: W - 96 })
    y += 70
  } else {
    let x = 36
    for (const tr of style.traits) {
      const w = Math.round(44 + emWidth(tr.label, true) * 22)
      body += pill(x, y, w, 44, tr.label, { fill: C.panel2, color: C.blue, size: 22 })
      x += w + 10
    }
    y += 58
    body += t(48, y + 14, `Analyse sur ${count(career.games, 'partie')} · fiabilité ${Math.round(style.confidence * 100)} %`, { size: 20, fill: C.dim, maxW: W - 96 })
    y += 62
  }

  // Titres obtenus (pastilles : bronze, argent, or selon le palier) et prochain défi (barre de progression)
  body += section(y, 'TITRES', C.gold)
  y += 36
  const titles = titlesOf(career)
  if (!titles.length) {
    body += t(48, y + 28, 'Aucun titre pour l’instant : joue pour en débloquer !', { size: 22, fill: C.muted })
    y += 44
  } else {
    let x = 36
    for (const ti of titles) {
      const w = Math.round(44 + emWidth(ti.name, true) * 22)
      if (x + w > W - 36) {
        x = 36
        y += 56
      }
      body += pill(x, y, w, 44, ti.name, { fill: TIER_COLOR[Math.max(0, 2 - (ti.of - ti.tier))], color: C.bg, size: 22 })
      x += w + 10
    }
    y += 62
  }
  const next = nextChallenge(career)
  if (next) {
    body += t(48, y + 24, `Prochain titre : ${next.name}`, { size: 24, weight: 'bold', maxW: W - 220 }) + t(W - 48, y + 24, `${next.value} / ${next.goal}`, { size: 24, weight: 'bold', fill: C.gold, anchor: 'end' })
    body += bar(48, y + 40, W - 96, 14, next.value / next.goal, { fill: C.gold }) + t(48, y + 84, next.unit, { size: 22, fill: C.muted })
    y += 112
  }
  y += 30

  // Forme récente : un rond par partie (vert = gagnée, rouge = perdue), I = imposteur, C = civil
  if (s.form.length) {
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
  }
  return canvas(y + 10, C.gold, body)
}
