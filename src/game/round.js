// Préparation d’une partie (mots, imposteurs) et de chaque manche (ordre de passage).
import { config } from '../config.js'
import { shuffle } from '../core/utils.js'
import { pickPair } from './words.js'
import { alivePlayers } from './players.js'

const { rounds } = config

// Nombre d’imposteurs : 1, ou 2 dès `twoImpostersFrom` joueurs dans le format « plusieurs manches »
export const imposterCount = (g) => (g.format === 'rounds' && g.players.length >= rounds.twoImpostersFrom ? 2 : 1)

export const setupGame = (g) => {
  const [category, word, closeWord] = pickPair(g.key)
  g.category = category
  g.word = word // mot des civils
  g.closeWord = closeWord // mot proche de l’imposteur (utilisé par certains modes seulement)
  g.imposters = shuffle(g.players).slice(0, imposterCount(g))
  g.eliminated = new Set()
  g.manche = 1
  g.clues = []
  g.ledger = []
  g.guesser = null
  setupManche(g)
}

// Ordre de passage et tours d’indices de la manche en cours (joueurs encore en lice)
export const setupManche = (g) => {
  g.order = shuffle(alivePlayers(g))
  g.turns = []
  for (let r = 0; r < config.game.clueRounds; r++) g.order.forEach((p) => g.turns.push(p))
  g.turnIdx = 0
}
