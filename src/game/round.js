// Préparation d’une partie (mots, imposteurs) et de chaque manche (ordre de passage).
import { config } from '../config.js'
import { shuffle } from '../core/utils.js'
import { randInt, weightedSample } from '../core/random.js'
import { imposterWeights } from './fairness.js'
import { pickPair } from './words.js'
import { alivePlayers } from './players.js'

const { rounds } = config

// Nombre d’imposteurs : 1 ; en format « plusieurs manches » 2 dès `twoImpostersFrom` joueurs et 3 dès `threeImpostersFrom`
export const imposterCount = (g) => {
  if (g.format !== 'rounds') return 1
  const n = g.players.length
  return n >= rounds.threeImpostersFrom ? 3 : n >= rounds.twoImpostersFrom ? 2 : 1
}

const lastFirst = new Map() // groupe → numéro du dernier premier orateur

export const setupGame = (g) => {
  const [category, word, closeWord] = pickPair(g.key)
  g.category = category
  g.word = word // mot des civils
  g.closeWord = closeWord // mot proche de l’imposteur (utilisé par certains modes seulement)
  // tirage pondéré : qui l’a été récemment a moins de chances de l’être encore (voir fairness.js)
  const weights = imposterWeights(g.key, g.players)
  g.imposters = weightedSample(g.players, (p) => weights.get(p), imposterCount(g))
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
  // le premier à parler n’est jamais le même que la fois d’avant
  const last = lastFirst.get(g.key)
  if (g.order.length > 1 && g.order[0].num === last) {
    const j = 1 + randInt(g.order.length - 1)
    ;[g.order[0], g.order[j]] = [g.order[j], g.order[0]]
  }
  lastFirst.set(g.key, g.order[0]?.num)
  g.turns = []
  for (let r = 0; r < config.game.clueRounds; r++) g.order.forEach((p) => g.turns.push(p))
  g.turnIdx = 0
}
