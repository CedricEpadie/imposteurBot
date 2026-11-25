// Phases affichées aux joueurs (6 étapes) et correspondance avec les états internes d’une partie.

export const PHASES = {
  lobby: [1, 'SALLE D’ATTENTE'],
  dm: [2, 'DISTRIBUTION DES RÔLES'],
  clues: [3, 'INDICES'],
  discuss: [4, 'DÉBAT'],
  vote: [5, 'VOTE'],
  verdict: [6, 'VERDICT'],
}

// Bandeau de début de phase
export const header = (k, g) =>
  `━━━━━━━━━━━━━━\n*PHASE ${PHASES[k][0]}/6 · ${PHASES[k][1]}${g && g.manche > 1 ? ` · MANCHE ${g.manche}` : ''}*\n━━━━━━━━━━━━━━\n\n`

// État interne (g.phase) → phase affichée
const DISPLAY_PHASE = {
  lobby: 'lobby',
  dm: 'dm',
  ready: 'dm',
  clues: 'clues',
  between: 'clues',
  discuss: 'discuss',
  vote: 'vote',
  counting: 'vote',
  guess: 'verdict',
  verdict: 'verdict',
}

export const phaseName = (g) => {
  const k = DISPLAY_PHASE[g.phase] || 'lobby'
  return `Phase ${PHASES[k][0]}/6 · ${PHASES[k][1].toLowerCase()}` + (g.manche > 1 ? ` (manche ${g.manche})` : '')
}
