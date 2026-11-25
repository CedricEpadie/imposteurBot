// Carte des règles (/imposteur aide) : image construite sur la charte.
import { config } from '../config.js'
import { listModes } from '../game/modes/index.js'
import { C, W } from './theme.js'
import { canvas, heading, section, t, rect, badge, pill, wrap } from './kit.js'

// Contenu des règles en données (texte brut), séparé du dessin pour être testé et modifié facilement
export const rulesData = () => {
  const { minPlayers, maxPlayers, clueRounds } = config.game
  const { stopAt, twoImpostersFrom } = config.rounds
  const P = config.prefix
  const steps = [
    ['Ouvrir la partie', `${P}imposteur ouvre la partie, les autres tapent ${P}imposteur join (${minPlayers} à ${maxPlayers} joueurs).`],
    ['Recevoir son secret', 'Une carte privée donne la catégorie et le mot secret. L’imposteur ne connaît que la catégorie.'],
    ['Donner des indices', `${clueRounds} tours : un seul mot par joueur, jamais une phrase, ni le mot secret, ni l’indice d’un autre.`],
    ['Débattre puis voter', 'Débat libre devant le tableau des indices, puis chacun mentionne (@) son suspect.'],
    ['Démasquer', `Un imposteur démasqué peut encore gagner en devinant le mot. Format 2 : on élimine un suspect par manche jusqu’à ${stopAt} joueurs (2 imposteurs dès ${twoImpostersFrom} joueurs).`],
  ]
  const s = config.scoring
  const points = [
    [`+${s.rightVote}`, 'vote juste'],
    [`+${s.civilsWin}`, 'victoire des civils'],
    [`+${s.imposterWin}`, 'imposteur gagnant'],
    [`+${s.imposterGuess}`, 'mot deviné'],
  ]
  const variants = listModes().filter((m) => m.rule).map((m) => m.rule)
  return { steps, points, variants }
}

export const rulesSvg = () => {
  const { steps, points, variants } = rulesData()
  const { minPlayers, maxPlayers } = config.game
  let y = 150
  let body = heading('RÈGLES DU JEU', `${minPlayers} à ${maxPlayers} joueurs · 1 ou 2 imposteurs`, C.gold, { y: 76 })

  steps.forEach(([title, text], i) => {
    const lines = wrap(text, 64)
    const h = 54 + lines.length * 26
    body +=
      rect(36, y, W - 72, h, { r: 16, fill: C.panel }) +
      badge(76, y + h / 2, 22, String(i + 1)) +
      t(116, y + 34, title, { size: 24, weight: 'bold' }) +
      lines.map((l, k) => t(116, y + 62 + k * 26, l, { size: 19, fill: C.muted })).join('')
    y += h + 12
  })

  y += 28
  body += section(y, 'POINTS', C.gold)
  y += 32
  const cw = (W - 72 - 3 * 12) / 4
  body += points
    .map(([pts, label], i) => {
      const x = 36 + i * (cw + 12)
      return rect(x, y, cw, 86, { r: 16, fill: C.panel }) + t(x + cw / 2, y + 38, pts, { size: 32, weight: 'bold', fill: C.gold, anchor: 'middle' }) + t(x + cw / 2, y + 68, label, { size: 15, fill: C.muted, anchor: 'middle' })
    })
    .join('')
  y += 114

  for (const v of variants) {
    const lines = wrap(v.text, 66)
    const h = 44 + lines.length * 24
    body +=
      rect(36, y, W - 72, h, { r: 16, fill: C.panel, stroke: C.blue, sw: 2 }) +
      t(60, y + 30, v.title, { size: 20, weight: 'bold', fill: C.blue }) +
      lines.map((l, k) => t(60, y + 56 + k * 24, l, { size: 18, fill: C.muted })).join('')
    y += h + 12
  }
  return canvas(y + 10, C.gold, body)
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
