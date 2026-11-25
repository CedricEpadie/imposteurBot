// Enchaînement d’une partie :
//   lobby → distribution → clues → discussion → vote → verdict
//   (format « plusieurs manches » : verdict → nouvelle manche → clues → … jusqu’à la fin)
//
// Chaque phase est un fichier de ce dossier : elle démarre la suivante en l’important directement.
// Pour réagir aux messages du groupe pendant une phase, déclare un gestionnaire ci-dessous :
// la clé est l’état interne `g.phase` ; le gestionnaire reçoit (g, { chat, me, text, mentioned }).
import { onLobbyText } from './lobby.js'
import { onClueText } from './clues.js'
import { onVoteText } from './vote.js'
import { onGuessText } from './verdict.js'

export { openLobby, joinLobby, beginGame, setFormat } from './lobby.js'
export { startVote } from './vote.js'

const TEXT_HANDLERS = {
  lobby: onLobbyText,
  clues: onClueText,
  vote: onVoteText,
  guess: onGuessText,
}

// Message de groupe (hors commande) → gestionnaire de la phase en cours, s’il y en a un
export const handleGameText = async (chat, me, text, mentioned, g) => {
  const handler = g && TEXT_HANDLERS[g.phase]
  if (handler) return handler(g, { chat, me, text, mentioned })
}
