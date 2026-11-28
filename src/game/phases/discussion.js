// Phase 4 · Débat libre avant le vote, avec le tableau des indices en image.
import { config } from '../../config.js'
import { say, sayImage } from '../../whatsapp/messenger.js'
import { getGame } from '../store.js'
import { phaseTimer } from '../lifecycle.js'
import { jidsOf } from '../players.js'
import { header } from '../phases-meta.js'
import { fullRecap } from '../recap.js'
import { canRender } from '../../render/svg.js'
import { renderBoard } from '../../render/board.js'
import { startVote } from './vote.js'
import { host } from '../voice.js'

const P = config.prefix
const { discussSeconds } = config.game

// Compte à rebours du débat (aussi utilisé à la reprise après un redémarrage)
export const armDiscuss = (g, seconds) =>
  phaseTimer(g, seconds, () => startVote(g.key), {
    marks: [30, 10, 5],
    tick: (m) =>
      say(g.key, m > 10 ? `⏳ Il reste *${m} s* de débat… Qui est suspect ?` : `🚨 Le vote commence dans *${m} s* !`),
  })

export const startDiscuss = async (key) => {
  const g = getGame(key)
  if (!g) return
  g.phase = 'discuss'
  armDiscuss(g, discussSeconds)

  const outro =
    `${host('discuss')}\n💬 Qui a donné un indice louche ? Défendez-vous, accusez-vous !\n` +
    `⏱️ *${discussSeconds} s* de débat. Le lanceur peut taper *${P}imposteur vote* pour voter tout de suite.`

  // Tableau en image ; si l’image est impossible (sharp absent, envoi refusé), récapitulatif en texte
  if (canRender()) {
    try {
      const sent = await sayImage(key, await renderBoard(g), `${header('discuss', g)}📋 *Tableau des indices*\n\n${outro}`, jidsOf(g))
      if (sent) return
    } catch (e) {
      console.warn('[imposteur] tableau des indices impossible :', e.message)
    }
  }
  return say(key, `${header('discuss', g)}📋 *Récapitulatif des indices*\n${fullRecap(g)}\n\n${outro}`, jidsOf(g))
}
