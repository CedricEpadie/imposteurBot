// /imposteur vote : passer au vote sans attendre la fin du débat (lanceur)
import { say } from '../whatsapp/messenger.js'
import { startVote } from '../game/phases/index.js'

export default {
  name: 'vote',
  shortcut: true,
  async run({ chat, game: g, isStarter }) {
    if (!g || g.phase !== 'discuss') return say(chat, 'Le vote n’est possible que pendant le débat.')
    if (!isStarter) return say(chat, 'Seul le lanceur peut lancer le vote 😉')
    return startVote(chat)
  },
}
