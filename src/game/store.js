// Parties en cours (en mémoire, sauvegardées dans la base pour la reprise : voir persistence.js).
// Une partie par groupe.
const games = new Map() // clé = jid du groupe

export const getGame = (key) => games.get(key)
export const allGames = () => games.values()
export const removeGame = (key) => games.delete(key)
export const putGame = (g) => games.set(g.key, g)

// Vrai tant que `g` est la partie courante de son groupe (fausse si annulée ou remplacée entre-temps)
export const isActive = (g) => games.get(g.key) === g

export const createGame = ({ key, mode, starter }) => {
  const g = {
    key,
    gameId: `${key}#${Date.now()}`,
    phase: 'lobby',
    mode,
    format: 'single', // 'single' : un vote • 'rounds' : plusieurs manches d’élimination
    starter,
    players: [starter],
    imposters: [],
    eliminated: new Set(),
    manche: 1,
    clues: [], // { manche, round, p, text }
    ledger: [], // points gagnés : { p, pts, reason, manche }
    guesser: null, // imposteur démasqué qui tente de deviner le mot
    startedAt: Date.now(),
    timer: null,
    ticks: [],
    deadline: 0,
  }
  games.set(key, g)
  return g
}
