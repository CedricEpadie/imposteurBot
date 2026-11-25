// /imposteur packs [id… | tous] : voir ou choisir les packs de mots (lanceur dans la salle d’attente, ou admin)
import { config } from '../config.js'
import { say } from '../whatsapp/messenger.js'
import { isAdmin } from '../core/admin.js'
import { getPacks, getPack, countPairs } from '../content/packs.js'
import { getSetting, setSetting } from '../storage/settings.js'
import { persistGame } from '../game/persistence.js'

const P = config.prefix

export default {
  name: 'packs',
  aliases: ['pack'],
  shortcut: true,
  async run({ chat, rest, game: g, isStarter, me }) {
    const active = String(getSetting(chat, 'packs', '')).split(',').filter(Boolean)

    if (!rest.length) {
      const list = getPacks()
        .map((p) => `${!active.length || active.includes(p.id) ? '✅' : '▫️'} *${p.id}* — ${p.name} (${countPairs(p)} paires)${p.description ? `\n    ${p.description}` : ''}`)
        .join('\n')
      return say(
        chat,
        `📦 *Packs de mots*\n\n${list}\n\nChoisir : *${P}imposteur packs foot musique* • tout activer : *${P}imposteur packs tous*`
      )
    }

    const allowed = isAdmin(me) || (isStarter && g?.phase === 'lobby')
    if (!allowed) return say(chat, 'Les packs se choisissent dans la salle d’attente (lanceur) ou par un admin du bot 😉')

    if (rest[0] === 'tous' || rest[0] === 'all') {
      setSetting(chat, 'packs', '')
      return say(chat, '✅ Tous les packs sont activés.')
    }
    const unknown = rest.filter((id) => !getPack(id))
    if (unknown.length) return say(chat, `Pack inconnu : ${unknown.join(', ')}. Tape *${P}imposteur packs* pour la liste.`)
    setSetting(chat, 'packs', rest.join(','))
    if (g) persistGame(g)
    return say(chat, `✅ Packs activés : ${rest.map((id) => getPack(id).name).join(', ')}`)
  },
}
