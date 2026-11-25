// /imposteur go : lancer la partie (lanceur)
import { say } from '../whatsapp/messenger.js'
import { beginGame } from '../game/phases/index.js'

export default {
  name: 'go',
  aliases: ['start', 'lancer'],
  shortcut: true,
  async run({ chat, game: g, isStarter }) {
    if (!g || g.phase !== 'lobby') return say(chat, 'Aucune partie en attente de lancement.')
    if (!isStarter) return say(chat, 'Seul le lanceur peut démarrer la partie 😉')
    beginGame(chat, true).catch((e) => console.error('[imposteur]', e)) // sans attendre : l’envoi des rôles prend du temps
  },
}
