// Cartes de saison : décor et couleur d'accent de Halloween (15 oct → 2 nov) et de Noël (1er déc → 6 janv).
// Le décor ne touche que les marges et le bandeau du bas : jamais le contenu. THEME=noel|halloween|none dans .env force un thème (essais).
import { config } from '../config.js'

export const THEMES = {
  halloween: { accent: '#ff9f1c' },
  noel: { accent: '#ff6b6b' },
}

// Thème actif à la date `d` (ou forcé par config.theme)
export const activeTheme = (d = new Date(Date.now()), forced = config.theme) => {
  if (forced === 'none') return null
  if (THEMES[forced]) return forced
  const m = d.getMonth() + 1
  const day = d.getDate()
  if ((m === 10 && day >= 15) || (m === 11 && day <= 2)) return 'halloween'
  if (m === 12 || (m === 1 && day <= 6)) return 'noel'
  return null
}

const snowflake = (x, y, r, o = 0.6) =>
  [0, 60, 120].map((a) => `<line x1="${x - r}" y1="${y}" x2="${x + r}" y2="${y}" stroke="#dff3ff" stroke-width="2.5" stroke-linecap="round" opacity="${o}" transform="rotate(${a} ${x} ${y})"/>`).join('')

const bat = (x, y, s) =>
  `<path d="M0,6 C-6,-6 -22,-8 -32,0 C-26,0 -22,4 -20,10 C-14,6 -8,8 0,14 C8,8 14,6 20,10 C22,4 26,0 32,0 C22,-8 6,-6 0,6 Z" fill="#2b2140" stroke="#ff9f1c" stroke-width="1.5" transform="translate(${x} ${y}) scale(${s})"/>`

const pumpkin = (x, y, s) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="22" ry="17" fill="#ff8a1f"/><ellipse cx="-11" cy="0" rx="10" ry="16" fill="#ff9f3d" opacity="0.7"/><ellipse cx="11" cy="0" rx="10" ry="16" fill="#ff9f3d" opacity="0.7"/>` +
  `<rect x="-3" y="-24" width="6" height="9" rx="2" fill="#4a7c2f"/><path d="M-11,-4 l6,-6 l4,8 z M3,-2 l4,-8 l6,6 z" fill="#2b1a05"/><path d="M-9,7 q9,8 18,0 q-9,3 -18,0 z" fill="#2b1a05"/></g>`

// Décor d'une image de hauteur h (SVG à insérer après le cadre)
export const decor = (theme, w, h) => {
  if (theme === 'noel') {
    const pts = [[30, 120, 9], [868, 150, 10], [28, 260, 7], [872, 300, 8], [32, 420, 10], [866, 450, 7], [30, 600, 8], [870, 620, 9], [60, 36, 8], [842, 34, 9], [100, h - 30, 8], [800, h - 28, 9], [40, h - 30, 10], [860, h - 30, 7]]
    return `<g id="theme-noel">${pts.filter(([, y]) => y < h - 10).map(([x, y, r]) => snowflake(x, y, r * 1.3, 0.8)).join('')}</g>`
  }
  if (theme === 'halloween') {
    return `<g id="theme-halloween">${bat(66, 42, 1.0)}${bat(834, 44, 0.9)}${pumpkin(60, h - 34, 1.0)}${pumpkin(w - 60, h - 34, 1.0)}</g>`
  }
  return ''
}
