// /imposteur [classique|proche] : ouvre une partie. Commande par défaut (pas de sous-commande, ou un nom de mode).
import { config } from '../config.js'
import { say } from '../whatsapp/messenger.js'
import { openLobby } from '../game/phases/index.js'
import { DEFAULT_MODE, resolveMode } from '../game/modes/index.js'

const P = config.prefix
const { maxPlayers } = config.game

export default {
  name: 'open',
  async run({ chat, me, word, game: g }) {
    if (g) {
      return say(
        chat,
        g.phase === 'lobby'
          ? `⏳ Une partie attend des joueurs (${g.players.length}/${maxPlayers}). Rejoins-la avec *${P}imposteur join* !`
          : '⚠️ Une partie est déjà en cours dans ce groupe.'
      )
    }
    const mode = resolveMode(word)
    return openLobby(chat, me, mode ? mode.id : DEFAULT_MODE)
  },
}
