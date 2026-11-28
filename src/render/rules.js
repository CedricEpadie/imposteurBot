// Carte des règles (/imposteur aide) : image construite sur la charte.
import { config } from '../config.js'
import { impostersRule } from '../game/wording.js'
import { listModes } from '../game/modes/index.js'
import { C, W } from './theme.js'
import { canvas, heading, section, t, rect, badge, pill, wrap } from './kit.js'

// Contenu des règles en données (texte brut), séparé du dessin pour être testé et modifié facilement
export const rulesData = () => {
  const { minPlayers, maxPlayers, clueRounds } = config.game
  const { stopAt } = config.rounds
  const P = config.prefix
  const steps = [
    ['Ouvrir la partie', `${P}imposteur pour ouvrir, ${P}imposteur join pour rejoindre (${minPlayers} à ${maxPlayers} joueurs).`],
    ['Recevoir son secret', 'Une carte privée donne la catégorie et le mot. L’imposteur n’a que la catégorie.'],
    ['Donner des indices', `${clueRounds} tours, un seul mot chacun : pas de phrase, ni le mot secret, ni l’indice d’un autre. Aucun indice donné = éjecté !`],
    ['Débattre puis voter', 'On discute devant le tableau des indices, puis chacun mentionne (@) son suspect.'],
    ['Démasquer', `Un imposteur démasqué peut gagner en devinant le mot. Format 2 : un suspect éliminé par manche, jusqu’à ${stopAt} joueurs.`],
  ]
  const s = config.scoring
  const points = [
    [`+${s.rightVote}`, 'vote juste'],
    [`+${s.civilsWin}`, 'civils gagnent'],
    [`+${s.imposterWin}`, 'imposteur gagne'],
    [`+${s.imposterGuess}`, 'mot deviné'],
  ]
  const variants = listModes().filter((m) => m.rule).map((m) => m.rule)
  return { steps, points, variants }
}

export const rulesSvg = () => {
  const { steps, points, variants } = rulesData()
  const { minPlayers, maxPlayers } = config.game
  let y = 160
  let body = heading('RÈGLES DU JEU', `${minPlayers} à ${maxPlayers} joueurs · ${impostersRule()}`, C.gold, { y: 80 })

  steps.forEach(([title, text], i) => {
    const lines = wrap(text, 50)
    const h = 62 + lines.length * 31
    body +=
      rect(36, y, W - 72, h, { r: 18, fill: C.panel }) +
      badge(80, y + h / 2, 26, String(i + 1), { size: 28 }) +
      t(130, y + 40, title, { size: 28, weight: 'bold' }) +
      lines.map((l, k) => t(130, y + 74 + k * 31, l, { size: 24, fill: C.muted })).join('')
    y += h + 14
  })

  y += 26
  body += section(y, 'POINTS', C.gold)
  y += 36
  const cw = (W - 72 - 3 * 12) / 4
  body += points
    .map(([pts, label], i) => {
      const x = 36 + i * (cw + 12)
      return rect(x, y, cw, 100, { r: 18, fill: C.panel }) + t(x + cw / 2, y + 48, pts, { size: 42, weight: 'bold', fill: C.gold, anchor: 'middle' }) + t(x + cw / 2, y + 82, label, { size: 21, fill: C.muted, anchor: 'middle' })
    })
    .join('')
  y += 126

  for (const v of variants) {
    const lines = wrap(v.text, 54)
    const h = 56 + lines.length * 29
    body +=
      rect(36, y, W - 72, h, { r: 18, fill: C.panel, stroke: C.blue, sw: 3 }) +
      t(62, y + 38, v.title, { size: 26, weight: 'bold', fill: C.blue }) +
      lines.map((l, k) => t(62, y + 72 + k * 29, l, { size: 23, fill: C.muted })).join('')
    y += h + 14
  }
  return canvas(y + 12, C.gold, body)
}

// Légende envoyée avec l’image : les commandes (le texte à copier)
export const rulesCaption = () => {
  const P = config.prefix
  return (
    `🕵️ *L’IMPOSTEUR* — les règles en image ☝️\n\n` +
    `📩 Rôle non reçu ? *${P}imposteur mot* en privé au bot.\n` +
    `📊 *${P}imposteur etat* : où en est la partie\n` +
    `🏆 *${P}imposteur top* : classement • *${P}imposteur stats* : tes statistiques\n` +
    `📦 *${P}imposteur packs* : packs de mots (foot, musique, Yaoundé, Douala…)\n` +
    `🔧 Admin : *${P}imposteur ajouter* (mots) • *${P}imposteur reset* (effacer les scores)`
  )
}
