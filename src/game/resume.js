// Reprise des parties interrompues (plantage, redémarrage) au démarrage du bot.
//
// L’état est sauvegardé à chaque changement de phase (voir lifecycle.phaseTimer). On reprend donc
// à la phase sauvegardée, avec le temps restant : lobby, rôles lus, indices, débat, vote, dernière chance.
import { config } from '../config.js'
import { say } from '../whatsapp/messenger.js'
import { loadGameStates } from '../storage/games.js'
import { deleteGameState } from '../storage/games.js'
import { deserializeGame } from './persistence.js'
import { putGame } from './store.js'
import { jidsOf } from './players.js'
import { armLobby } from './phases/lobby.js'
import { armReady } from './phases/distribution.js'
import { askTurn } from './phases/clues.js'
import { armDiscuss } from './phases/discussion.js'
import { armVote } from './phases/vote.js'
import { armGuess } from './phases/verdict.js'

const remaining = (g, min = 8) => Math.max(min, Math.ceil(((g.deadline || 0) - Date.now()) / 1000))

const RESUME = {
  lobby: (g) => armLobby(g, remaining(g, 15)),
  ready: (g) => armReady(g, remaining(g, 10)),
  clues: (g) => askTurn(g.key),
  discuss: (g) => armDiscuss(g, remaining(g)),
  vote: (g) => armVote(g, remaining(g, 15)),
  guess: (g) => armGuess(g, remaining(g, 15)),
}

// Retourne le nombre de parties reprises
export const resumeGames = async () => {
  let resumed = 0
  let states = []
  try {
    states = loadGameStates()
  } catch (e) {
    console.error('[imposteur] lecture des parties sauvegardées impossible :', e.message)
  }
  const maxAge = config.data.resumeMaxAgeMinutes * 60 * 1000
  for (const { key, state, updated } of states) {
    const resume = RESUME[state.phase]
    if (!resume || Date.now() - updated > maxAge) {
      deleteGameState(key) // trop ancienne ou phase non reprenable
      continue
    }
    try {
      const g = deserializeGame(state)
      putGame(g)
      await say(key, `♻️ Le bot a redémarré : la partie reprend là où elle s’était arrêtée !`, jidsOf(g))
      resume(g)
      resumed++
    } catch (e) {
      console.error(`[imposteur] reprise impossible (${key}) :`, e.message)
      deleteGameState(key)
    }
  }
  return resumed
}
