// /imposteur stop : annuler la partie (lanceur)
import { say } from '../whatsapp/messenger.js'
import { endGame } from '../game/lifecycle.js'

export default {
  name: 'stop',
  aliases: ['fin'],
  shortcut: true,
  async run({ chat, game: g, isStarter }) {
    if (!g) return say(chat, 'Aucune partie en cours.')
    if (!isStarter) return say(chat, 'Seul le lanceur peut annuler la partie 😉')
    endGame(g)
    return say(chat, '🛑 Partie annulée par le lanceur.')
  },
}
