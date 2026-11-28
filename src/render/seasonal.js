// Cartes de fête : décor et couleur d'accent selon la date (heure locale du serveur).
// Halloween, Noël, Nouvel An, Saint-Valentin, Pâques, fête de l'Unité (Cameroun), Ramadan, Aïd el-Fitr et Tabaski (Aïd el-Adha).
// Les fêtes musulmanes suivent le calendrier lunaire : leurs dates viennent du calendrier hégirien (Intl, umm al-Qura ; ±1 jour selon l'observation locale).
// Le décor ne touche que les marges et le bandeau du bas : jamais le contenu. THEME=<nom>|none dans .env force un thème (essais).
import { config } from '../config.js'
import { C } from './theme.js'

export const THEMES = {
  halloween: { accent: '#ff9f1c', hello: '🎃 *Joyeux Halloween* à tous !' },
  noel: { accent: '#ff6b6b', hello: '🎄 *Joyeux Noël* à tous !' },
  nouvelan: { accent: '#ffe066', hello: '🎆 *Bonne année* à tous !' },
  valentin: { accent: '#ff5d8f', hello: '💘 *Joyeuse Saint-Valentin* !' },
  paques: { accent: '#c3a6ff', hello: '🐣 *Joyeuses Pâques* à tous !' },
  cameroun: { accent: '#2fbf71', hello: '🇨🇲 *Bonne fête de l’Unité* !' },
  ramadan: { accent: '#7aa2ff', hello: '🌙 *Ramadan Moubarak* à tous !' },
  aid: { accent: '#3ddc97', hello: '🌙 *Aïd Moubarak* à tous ! Joie et paix pour vos familles.' },
  tabaski: { accent: '#e0a458', hello: '🐑 *Bonne Tabaski* à tous !' },
}
export const greeting = (theme) => THEMES[theme]?.hello || ''

// Dimanche de Pâques (calendrier grégorien, algorithme de Meeus/Jones/Butcher)
export const easter = (year) => {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

// Date du calendrier hégirien : { month (1..12), day } ou null si l'environnement ne gère pas ce calendrier
let hijriFmt
export const hijri = (d) => {
  try {
    hijriFmt ??= new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' })
    const parts = Object.fromEntries(hijriFmt.formatToParts(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12)).map((p) => [p.type, p.value]))
    const month = Number(parts.month)
    const day = Number(parts.day)
    return month >= 1 && month <= 12 && day >= 1 ? { month, day } : null
  } catch {
    return null
  }
}

const dayDiff = (a, b) => Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 86_400_000)

// Thème actif à la date `d` (ou forcé par config.theme). Priorité : Halloween, Nouvel An, Noël, Aïd, Tabaski, Ramadan, Pâques, Saint-Valentin, fête de l'Unité.
export const activeTheme = (d = new Date(Date.now()), forced = config.theme) => {
  if (forced === 'none') return null
  if (THEMES[forced]) return forced
  const m = d.getMonth() + 1
  const day = d.getDate()
  if ((m === 10 && day >= 15) || (m === 11 && day <= 2)) return 'halloween'
  if ((m === 12 && day >= 30) || (m === 1 && day <= 2)) return 'nouvelan'
  if (m === 12 || (m === 1 && day <= 6)) return 'noel'
  const h = hijri(d)
  if (h) {
    if (h.month === 10 && h.day <= 3) return 'aid' // Aïd el-Fitr
    if (h.month === 12 && h.day >= 9 && h.day <= 12) return 'tabaski' // Aïd el-Adha
    if (h.month === 9) return 'ramadan'
  }
  const toEaster = dayDiff(d, easter(d.getFullYear()))
  if (toEaster >= -3 && toEaster <= 1) return 'paques' // du vendredi saint au lundi de Pâques
  if (m === 2 && day >= 12 && day <= 15) return 'valentin'
  if (m === 5 && day >= 19 && day <= 21) return 'cameroun'
  return null
}

// ── Formes ───────────────────────────────────────────────────────────────────────────────────────────
const snowflake = (x, y, r, o = 0.8) =>
  [0, 60, 120].map((a) => `<line x1="${x - r}" y1="${y}" x2="${x + r}" y2="${y}" stroke="#dff3ff" stroke-width="2.5" stroke-linecap="round" opacity="${o}" transform="rotate(${a} ${x} ${y})"/>`).join('')

const bat = (x, y, s) =>
  `<path d="M0,6 C-6,-6 -22,-8 -32,0 C-26,0 -22,4 -20,10 C-14,6 -8,8 0,14 C8,8 14,6 20,10 C22,4 26,0 32,0 C22,-8 6,-6 0,6 Z" fill="#2b2140" stroke="#ff9f1c" stroke-width="1.5" transform="translate(${x} ${y}) scale(${s})"/>`

const pumpkin = (x, y, s) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="22" ry="17" fill="#ff8a1f"/><ellipse cx="-11" cy="0" rx="10" ry="16" fill="#ff9f3d" opacity="0.7"/><ellipse cx="11" cy="0" rx="10" ry="16" fill="#ff9f3d" opacity="0.7"/>` +
  `<rect x="-3" y="-24" width="6" height="9" rx="2" fill="#4a7c2f"/><path d="M-11,-4 l6,-6 l4,8 z M3,-2 l4,-8 l6,6 z" fill="#2b1a05"/><path d="M-9,7 q9,8 18,0 q-9,3 -18,0 z" fill="#2b1a05"/></g>`

const star = (x, y, r, fill, o = 1) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.42 : r
    return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`
  }).join(' ')
  return `<polygon points="${pts}" fill="${fill}" opacity="${o}"/>`
}
const crescent = (x, y, r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/><circle cx="${x + r * 0.42}" cy="${y - r * 0.1}" r="${r * 0.82}" fill="${C.bg}"/>`
const lantern = (x, y, s, fill) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><line x1="0" y1="-22" x2="0" y2="-12" stroke="${fill}" stroke-width="2"/><rect x="-6" y="-12" width="12" height="3" rx="1.5" fill="${fill}"/>` +
  `<path d="M-7,-9 Q-11,2 -7,12 L7,12 Q11,2 7,-9 Z" fill="${fill}" opacity="0.9"/><rect x="-6" y="12" width="12" height="3" rx="1.5" fill="${fill}"/><path d="M-3,-6 Q-5,2 -3,10 M3,-6 Q5,2 3,10" stroke="${C.bg}" stroke-width="1.6" fill="none" opacity="0.7"/></g>`
const dome = (x, y, s, fill) =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="${fill}"><path d="M-14,10 L-14,0 Q-14,-12 0,-16 Q14,-12 14,0 L14,10 Z"/><rect x="-1.2" y="-26" width="2.4" height="11"/><circle cx="0" cy="-27" r="2.4"/><rect x="-20" y="-6" width="5" height="16"/><path d="M-20,-6 l2.5,-6 l2.5,6 Z"/><rect x="15" y="-6" width="5" height="16"/><path d="M15,-6 l2.5,-6 l2.5,6 Z"/></g>`
const egg = (x, y, s, fill, band) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="9" ry="12" fill="${fill}"/><path d="M-8.6,-2 Q0,3 8.6,-2 L8.2,2 Q0,7 -8.2,2 Z" fill="${band}" opacity="0.85"/><circle cx="-3" cy="-6" r="1.6" fill="${band}" opacity="0.85"/><circle cx="3" cy="-5" r="1.4" fill="${band}" opacity="0.85"/></g>`
const heart = (x, y, s, fill, o = 1) => `<path d="M0,6 C-12,-2 -9,-12 0,-6 C9,-12 12,-2 0,6 Z" fill="${fill}" opacity="${o}" transform="translate(${x} ${y}) scale(${s})"/>`
const dot = (x, y, r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`
const spark = (x, y, r, fill) => `<g stroke="${fill}" stroke-width="2.4" stroke-linecap="round"><line x1="${x - r}" y1="${y}" x2="${x + r}" y2="${y}"/><line x1="${x}" y1="${y - r}" x2="${x}" y2="${y + r}"/><line x1="${x - r * 0.6}" y1="${y - r * 0.6}" x2="${x + r * 0.6}" y2="${y + r * 0.6}"/><line x1="${x - r * 0.6}" y1="${y + r * 0.6}" x2="${x + r * 0.6}" y2="${y - r * 0.6}"/></g>`

// Emplacements : marges gauche et droite (petits motifs, jamais sur le contenu), coins du haut et du bas (motifs plus grands)
const slots = (h) => {
  const side = [120, 190, 260, 330, 400, 470, 540, 610, 680, 750].filter((y) => y < h - 90)
  return {
    side: side.flatMap((y, i) => [[25, y + (i % 2) * 14], [875, y + ((i + 1) % 2) * 14]]),
    top: [[62, 40], [838, 40]],
    bottom: [[50, h - 32], [850, h - 32]],
  }
}
const GREEN = '#2fbf71'
const RED = '#e8505b'
const YELLOW = '#f6c945'

// Décor d'une image de hauteur h (SVG à insérer après le cadre)
export const decor = (theme, w, h) => {
  const { side, top, bottom } = slots(h)
  const each = (list, fn) => list.map(([x, y], i) => fn(x, y, i)).join('')
  let art = ''
  switch (theme) {
    case 'noel':
      art = each(side, (x, y, i) => snowflake(x, y, 8 + (i % 2), 0.85)) + each([...top, ...bottom], (x, y) => snowflake(x, y, 14))
      break
    case 'halloween':
      art = bat(66, 42, 1.0) + bat(834, 44, 0.9) + pumpkin(60, h - 34, 1.0) + pumpkin(w - 60, h - 34, 1.0)
      break
    case 'nouvelan':
      art =
        each(side, (x, y, i) => (i % 3 === 0 ? star(x, y, 9, '#ffe066') : i % 3 === 1 ? dot(x, y, 4, '#ff6b6b') : spark(x, y, 7, '#7dd3fc'))) +
        each([...top, ...bottom], (x, y, i) => (i % 2 ? star(x, y, 15, '#ffe066') : spark(x, y, 13, '#ff9ecb')))
      break
    case 'valentin':
      art = each(side, (x, y, i) => heart(x, y, 0.8 + (i % 3) * 0.12, i % 2 ? '#ff5d8f' : '#ff9ecb')) + each([...top, ...bottom], (x, y) => heart(x, y, 1.5, '#ff5d8f'))
      break
    case 'paques': {
      const cols = [['#ffd6e7', '#ff8fb8'], ['#d6f5e3', '#6bcf9a'], ['#fff0b3', '#f0b429'], ['#d9ccff', '#8f6bff']]
      art = each(side, (x, y, i) => egg(x, y, 0.75, cols[i % 4][0], cols[i % 4][1])) + each([...top, ...bottom], (x, y, i) => egg(x, y, 1.35, cols[(i + 1) % 4][0], cols[(i + 1) % 4][1]))
      break
    }
    case 'cameroun': {
      const c = [GREEN, RED, YELLOW]
      art = each(side, (x, y, i) => dot(x, y, 5, c[i % 3])) + star(62, 40, 16, YELLOW) + star(838, 40, 16, YELLOW) + star(50, h - 32, 14, YELLOW) + star(850, h - 32, 14, YELLOW)
      break
    }
    case 'ramadan':
      art = crescent(62, 42, 17, '#f6d365') + star(96, 30, 6, '#f6d365') + lantern(838, 46, 1.1, '#f6c945') + each(side, (x, y, i) => (i % 3 === 0 ? star(x, y, 8, '#f6d365') : i % 3 === 1 ? lantern(x, y, 0.55, '#f6c945') : dot(x, y, 3, '#9db8ff'))) + lantern(50, h - 36, 1.1, '#f6c945') + crescent(850, h - 34, 15, '#f6d365')
      break
    case 'aid':
      art = each(side, (x, y, i) => (i % 2 ? star(x, y, 8, '#f6d365') : crescent(x, y, 7, '#f6d365'))) + crescent(62, 42, 17, '#f6d365') + star(838, 40, 15, '#f6d365') + dome(52, h - 38, 1.0, '#3ddc97') + dome(848, h - 38, 1.0, '#3ddc97')
      break
    case 'tabaski':
      art = each(side, (x, y, i) => (i % 2 ? star(x, y, 8, '#e0a458') : crescent(x, y, 7, '#e0a458'))) + crescent(62, 42, 17, '#e0a458') + star(838, 40, 15, '#e0a458') + dome(52, h - 38, 1.0, '#e0a458') + dome(848, h - 38, 1.0, '#e0a458')
      break
    default:
      return ''
  }
  return `<g id="theme-${theme}">${art}</g>`
}
