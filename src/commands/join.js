// /imposteur join : rejoindre la salle d’attente
import { config } from '../config.js'
import { say } from '../whatsapp/messenger.js'
import { joinLobby } from '../game/phases/index.js'

const P = config.prefix

export default {
  name: 'join',
  aliases: ['rejoindre', '+'],
  shortcut: true,
  async run({ chat, me, game: g }) {
    if (!g) return say(chat, `Aucune partie ouverte. Lance-en une avec *${P}imposteur*.`)
    return joinLobby(g, me)
  },
}
