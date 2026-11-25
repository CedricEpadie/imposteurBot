// /imposteur mode <classique|proche> : change le mode avant le lancement (lanceur)
import { config } from '../config.js'
import { say } from '../whatsapp/messenger.js'
import { resolveMode, modeUsage } from '../game/modes/index.js'
import { persistGame } from '../game/persistence.js'

const P = config.prefix

export default {
  name: 'mode',
  shortcut: true,
  async run({ chat, rest, game: g, isStarter }) {
    if (!g || g.phase !== 'lobby') return say(chat, 'Le mode se choisit avant le lancement, dans la salle d’attente.')
    if (!isStarter) return say(chat, 'Seul le lanceur peut changer le mode 😉')
    const mode = resolveMode(rest[0])
    if (!mode) return say(chat, `Modes disponibles : ${modeUsage(P)}`)
    g.mode = mode.id
    persistGame(g)
    return say(chat, `✅ Mode : ${mode.label}`)
  },
}
