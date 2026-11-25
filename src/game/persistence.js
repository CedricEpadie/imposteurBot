// Sauvegarde de l’état d’une partie dans la base (pour reprendre après un plantage).
// Les joueurs et les références entre objets sont enregistrés par numéro, puis reconstruits au chargement.
import { saveGameState, deleteGameState } from '../storage/games.js'

const SCHEMA_VERSION = 1

export const serializeGame = (g) => {
  const n = (p) => p.num
  return {
    v: SCHEMA_VERSION,
    key: g.key,
    gameId: g.gameId,
    phase: g.phase,
    mode: g.mode,
    format: g.format,
    startedAt: g.startedAt,
    deadline: g.deadline,
    phaseTotal: g.phaseTotal || 0,
    starter: n(g.starter),
    players: g.players.map((p) => ({ num: p.num, jid: p.jid, dm: p.dm, ids: [...p.ids], name: p.name })),
    category: g.category,
    word: g.word,
    closeWord: g.closeWord,
    imposters: g.imposters.map(n),
    eliminated: [...g.eliminated].map(n),
    manche: g.manche,
    order: (g.order || []).map(n),
    turns: (g.turns || []).map(n),
    turnIdx: g.turnIdx || 0,
    clues: g.clues.map((c) => ({ manche: c.manche, round: c.round, num: n(c.p), text: c.text })),
    ledger: g.ledger.map((e) => ({ num: n(e.p), pts: e.pts, reason: e.reason, manche: e.manche })),
    guesser: g.guesser ? n(g.guesser) : null,
    votes: g.votes ? [...g.votes].map(([v, t]) => [n(v), n(t)]) : null,
  }
}

export const deserializeGame = (s) => {
  const players = s.players.map((p) => ({ ...p, ids: new Set(p.ids) }))
  const by = new Map(players.map((p) => [p.num, p]))
  const ref = (num) => by.get(num)
  const g = {
    key: s.key,
    gameId: s.gameId,
    phase: s.phase,
    mode: s.mode,
    format: s.format,
    startedAt: s.startedAt,
    deadline: s.deadline,
    phaseTotal: s.phaseTotal || 0,
    starter: ref(s.starter),
    players,
    category: s.category,
    word: s.word,
    closeWord: s.closeWord,
    imposters: s.imposters.map(ref),
    eliminated: new Set(s.eliminated.map(ref)),
    manche: s.manche,
    order: s.order.map(ref),
    turns: s.turns.map(ref),
    turnIdx: s.turnIdx,
    clues: s.clues.map((c) => ({ manche: c.manche, round: c.round, p: ref(c.num), text: c.text })),
    ledger: s.ledger.map((e) => ({ p: ref(e.num), pts: e.pts, reason: e.reason, manche: e.manche })),
    guesser: s.guesser ? ref(s.guesser) : null,
    timer: null,
    ticks: [],
  }
  if (s.votes) g.votes = new Map(s.votes.map(([v, t]) => [ref(v), ref(t)]))
  return g
}

// Appelée à chaque changement de phase et après chaque vote. Ne doit jamais faire planter le jeu.
export const persistGame = (g) => {
  try {
    saveGameState(g.key, serializeGame(g))
  } catch (e) {
    console.error('[imposteur] sauvegarde de la partie impossible :', e.message)
  }
}

export const forgetGame = (key) => {
  try {
    deleteGameState(key)
  } catch (e) {
    console.error('[imposteur] suppression de la sauvegarde impossible :', e.message)
  }
}
