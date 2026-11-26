// Vocabulaire : accords singulier / pluriel des messages (1 imposteur ou plusieurs).
// Tous les textes qui parlent « du » ou « des » imposteurs passent par ici, jamais en dur.
import { config } from '../config.js'
import { aliveImposters } from './players.js'

// « 1 vote », « 2 votes » (le pluriel s’applique dès 2)
export const pl = (n, one, many = one + 's') => (n > 1 ? many : one)
export const count = (n, one, many) => `${n} ${pl(n, one, many)}`

// Plusieurs imposteurs dans la partie (nombre de départ, connu de tous) ?
export const multi = (g) => (g.imposters?.length || 0) > 1

// Choisit la forme selon le nombre d’imposteurs de la partie
export const ie = (g, one, many) => (multi(g) ? many : one)

export const theImp = (g) => ie(g, 'l’imposteur', 'les imposteurs')
export const TheImp = (g) => ie(g, 'L’imposteur', 'Les imposteurs')
export const anImp = (g) => ie(g, 'un imposteur', 'des imposteurs')

// Libellé du mode adapté au nombre d’imposteurs
export const modeLabel = (g, mode) => (multi(g) && mode.labelPlural ? mode.labelPlural : mode.label)

// Question posée au moment du vote, selon les imposteurs encore en jeu
export const voteQuestion = (g) => {
  const k = aliveImposters(g).length
  if (k > 1) return `Qui sont les *${k} imposteurs* ? Accuse-en un !`
  return multi(g) ? 'Il reste *1 imposteur* : qui est-ce ?' : 'Qui est l’imposteur ?'
}

// Règle du nombre d’imposteurs, pour les textes d’aide : « 1 imposteur, 2 dès 8 joueurs, 3 dès 12 »
export const impostersRule = () => `1 imposteur, 2 dès ${config.rounds.twoImpostersFrom} joueurs, 3 dès ${config.rounds.threeImpostersFrom}`

// Annonce d’une élimination, selon le rôle révélé
export const roleReveal = (wasImposter) => (wasImposter ? 'un *imposteur* 🥷' : 'un *civil* 😬')

// Imposteurs encore là après une élimination
export const stillThere = (k) => (k > 1 ? `Il reste encore *${k} imposteurs* parmi vous !` : 'Il reste encore *1 imposteur* parmi vous !')
