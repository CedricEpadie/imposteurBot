// Briques SVG de la charte : texte, blocs, pastilles, barres, logo, gabarit de carte.
// Toutes les images du bot sont construites avec ces fonctions, jamais avec du SVG « à la main ».
import { esc } from '../core/utils.js'
import { C, FONT, W, FOOTER_H } from './theme.js'
import { activeTheme, THEMES, decor } from './seasonal.js'

// Texte propre pour une image : retire le balisage WhatsApp et les emojis (absents de la police)
export const plain = (s) =>
  String(s ?? '')
    .replace(/[*_~`]/g, '')
    .replace(/[^\p{L}\p{N}\s.,;:!?'’"«»()/+\-–—·…%&#@→]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

// Largeur approximative d’un texte, en « em » : les caractères larges (CJK, emojis…) comptent double
const isWide = (cp) => (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe6f) || (cp >= 0xff00 && cp <= 0xff60) || cp >= 0x1f000
// Largeurs de DejaVu Sans (en em) : étroites (i l . , espace…), moyennes (f t r…), larges (m w), majuscules, chiffres. Le gras est ~10 % plus large.
const NARROW = new Set([...'ijl|!.,:;\'’ I'])
const MIDDLE = new Set([...'frt()[]-"/«»'])
const glyph = (ch) => {
  const cp = ch.codePointAt(0)
  if (isWide(cp)) return 1.1
  if (cp > 0x024f) return 0.62 // autres alphabets, symboles : police de secours (Unifont)
  if (NARROW.has(ch)) return 0.3
  if (MIDDLE.has(ch)) return 0.42
  if (ch === 'm' || ch === 'M') return 1.0
  if (ch === 'w' || ch === 'W') return 0.88
  if (/\d/.test(ch)) return 0.64
  if (ch !== ch.toLowerCase()) return 0.72 // majuscule
  return 0.6
}
export const emWidth = (text, bold = false) => Array.from(String(text)).reduce((n, ch) => n + glyph(ch), 0) * (bold ? 1.1 : 1)

// Coupe à n caractères (et non n unités UTF-16 : ne casse jamais un emoji ou une lettre rare en deux)
export const clip = (text, n) => {
  const chars = Array.from(String(text ?? ''))
  return chars.length > n ? chars.slice(0, n - 1).join('') + '…' : chars.join('')
}

// Taille de police qui fait tenir `text` dans `width` pixels
export const fit = (text, width, max, min, bold = false) => Math.max(min, Math.min(max, Math.floor(width / Math.max(emWidth(text, bold), 0.3))))

// Retour à la ligne par mots (maxChars caractères par ligne)
export const wrap = (text, maxChars) => {
  const lines = []
  let cur = ''
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (cur && (cur + ' ' + word).length > maxChars) {
      lines.push(cur)
      cur = word
    } else cur = cur ? cur + ' ' + word : word
  }
  if (cur) lines.push(cur)
  return lines
}

// Retour à la ligne selon la largeur RÉELLE du texte (en px, à la taille `size`) : aucune ligne ne dépasse `widthPx`
export const wrapPx = (text, widthPx, size, bold = false) => {
  const lines = []
  let cur = ''
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word
    if (cur && emWidth(next, bold) * size > widthPx) {
      lines.push(cur)
      cur = word
    } else cur = next
  }
  if (cur) lines.push(cur)
  return lines
}

// Retire ce qui ne peut pas se dessiner (contrôles, invisibles, XML invalide, empilements d’accents) sans changer le reste
const safe = (str) =>
  String(str ?? '')
    .replace(/[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\uFE0E\uFE0F]/gu, '')
    .replace(/(\p{M})\p{M}+/gu, '$1')

// Texte. Il ne déborde JAMAIS : sa largeur est mesurée (largeurs réelles de la police), puis la taille est réduite
// jusqu'à `minSize`, puis le texte est coupé avec « … ». Largeur disponible = `maxW` si donnée, sinon jusqu'au bord de l'image (marge 28 px).
const EDGE = 28
export const t = (x, y, str, { size = 24, weight = 'normal', fill = C.text, anchor = 'start', deco = '', opacity = 1, maxW = Infinity, minSize } = {}) => {
  const bold = weight === 'bold'
  const edge = anchor === 'middle' ? 2 * Math.min(x - EDGE, W - EDGE - x) : anchor === 'end' ? x - EDGE : W - EDGE - x
  const avail = Math.max(20, Math.min(maxW, edge))
  let s = safe(str)
  let sz = size
  if (emWidth(s, bold) * sz > avail) {
    sz = Math.max(Math.min(size, Math.floor(avail / emWidth(s, bold))), Math.min(size, minSize ?? Math.max(16, Math.round(size * 0.7))))
    while (Array.from(s).length > 1 && emWidth(s, bold) * sz > avail) s = clip(s, Array.from(s).length - 1)
  }
  return (
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${sz}" font-weight="${weight}" fill="${fill}"` +
    `${deco ? ` text-decoration="${deco}"` : ''}${opacity !== 1 ? ` opacity="${opacity}"` : ''}>${esc(s)}</text>`
  )
}

export const rect = (x, y, w, h, { r = 14, fill = C.panel, stroke = '', sw = 2, opacity = 1 } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`

// Pastille arrondie avec libellé centré
export const pill = (x, y, w, h, label, { fill = C.panel2, color = C.text, size = 20 } = {}) =>
  rect(x, y, w, h, { r: h / 2, fill }) + t(x + w / 2, y + h / 2 + size * 0.35, label, { size, weight: 'bold', fill: color, anchor: 'middle', maxW: w - 20 })

// Cercle numéroté (étapes, classement)
export const badge = (cx, cy, r, label, { fill = C.gold, color = C.bg, size = 22 } = {}) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>` + t(cx, cy + size * 0.36, label, { size, weight: 'bold', fill: color, anchor: 'middle', maxW: r * 2 - 4 })

// Barre de progression / histogramme
export const bar = (x, y, w, h, fraction, { fill = C.gold, back = C.panel2 } = {}) =>
  rect(x, y, w, h, { r: h / 2, fill: back }) + (fraction > 0 ? rect(x, y, Math.max(h, w * Math.min(1, fraction)), h, { r: h / 2, fill }) : '')

// Logo : une loupe (le bot cherche l’imposteur)
export const logoMark = (x, y, s, color = C.gold) =>
  `<circle cx="${x + s * 0.4}" cy="${y + s * 0.4}" r="${s * 0.3}" fill="none" stroke="${color}" stroke-width="${s * 0.1}"/>` +
  `<line x1="${x + s * 0.62}" y1="${y + s * 0.62}" x2="${x + s * 0.92}" y2="${y + s * 0.92}" stroke="${color}" stroke-width="${s * 0.12}" stroke-linecap="round"/>` +
  t(x + s * 0.4, y + s * 0.52, '?', { size: s * 0.38, weight: 'bold', fill: color, anchor: 'middle' })

// Titre centré + sous-titre (haut de carte)
export const heading = (title, sub, accent = C.gold, { y = 84 } = {}) =>
  t(W / 2, y, title, { size: fit(title, W - 100, 48, 30), weight: 'bold', fill: accent, anchor: 'middle' }) +
  (sub ? t(W / 2, y + 42, sub, { size: fit(sub, W - 100, 26, 20), fill: C.muted, anchor: 'middle' }) : '')

// Titre de section (à gauche, avec filet)
export const section = (y, label, accent = C.gold) =>
  t(48, y, label, { size: 24, weight: 'bold', fill: accent }) + `<line x1="48" y1="${y + 14}" x2="${W - 48}" y2="${y + 14}" stroke="${C.line}" stroke-width="2"/>`

// Gabarit commun : fond, cadre à la couleur d’accent, contenu, signature. `contentH` = hauteur utile (hors signature).
export const canvas = (contentH, accent, body) => {
  const h = contentH + FOOTER_H
  const theme = activeTheme() // Halloween, Noël : couleur du cadre et décor dans les marges
  if (theme && accent === C.gold) accent = THEMES[theme].accent
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">
  ${rect(0, 0, W, h, { r: 30, fill: C.bg })}
  ${rect(14, 14, W - 28, h - 28, { r: 22, fill: 'none', stroke: accent, sw: 3 })}
  ${body}
  ${theme ? decor(theme, W, h) : ''}
  ${logoMark(W / 2 - 88, h - 52, 30, C.dim)}${t(W / 2 - 52, h - 30, 'L’IMPOSTEUR', { size: 18, weight: 'bold', fill: C.dim })}
</svg>`
}
