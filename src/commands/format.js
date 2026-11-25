// /imposteur format <1|2> : alternative à la réponse « 1 » / « 2 » à la question du bot (lanceur, salle d’attente)
import { config } from '../config.js'
import { say } from '../whatsapp/messenger.js'
import { setFormat } from '../game/phases/index.js'

const P = config.prefix

export default {
  name: 'format',
  shortcut: true,
  async run({ chat, rest, game: g, isStarter }) {
    if (!g || g.phase !== 'lobby') return say(chat, 'Le format se choisit avant le lancement, dans la salle d’attente.')
    if (!isStarter) return say(chat, 'Seul le lanceur peut choisir le format 😉')
    if (['1', 'un', 'simple'].includes(rest[0])) return setFormat(g, 'single')
    if (['2', 'plusieurs', 'manches'].includes(rest[0])) return setFormat(g, 'rounds')
    return say(chat, `Formats : *${P}imposteur format 1* (un seul imposteur, un vote) ou *${P}imposteur format 2* (plusieurs manches).`)
  },
}
