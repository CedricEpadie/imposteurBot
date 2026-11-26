// Scores et statistiques des joueurs (une ligne `results` par joueur et par partie terminée).
// « Session » = suite de parties d’un groupe séparées de moins de `sessionGapHours` heures.
import { config } from '../config.js'
import { getDb } from './db.js'
import { getSetting, setSetting } from './settings.js'

const GAP_MS = () => config.data.sessionGapHours * 3600 * 1000

// Enregistre une partie terminée. rows = [{ num, jid, name, role, won, points }]
export const recordGame = (groupJid, gameId, rows, now = Date.now()) => {
  const db = getDb()
  const last = Number(getSetting(groupJid, 'last_game_ts', 0))
  if (!last || now - last > GAP_MS()) setSetting(groupJid, 'session_start', now) // nouvelle session
  setSetting(groupJid, 'last_game_ts', now)
  const insert = db.prepare(
    'INSERT INTO results (game_id, group_jid, num, jid, name, role, won, points, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  db.exec('BEGIN')
  try {
    for (const r of rows) insert.run(gameId, groupJid, r.num, r.jid, r.name || null, r.role, r.won ? 1 : 0, r.points, now)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

const RANKING = `
  SELECT num, MAX(jid) AS jid, SUM(points) AS points, COUNT(*) AS games, SUM(won) AS wins,
    (SELECT r2.name FROM results r2 WHERE r2.group_jid = results.group_jid AND r2.num = results.num AND r2.name IS NOT NULL ORDER BY r2.id DESC LIMIT 1) AS name
  FROM results WHERE group_jid = ? AND ts >= ?
  GROUP BY num ORDER BY points DESC, wins DESC, games ASC LIMIT ?`

// Classement de la session en cours ([] si la dernière partie date de plus de sessionGapHours)
export const sessionRanking = (groupJid, limit = 10, now = Date.now()) => {
  const last = Number(getSetting(groupJid, 'last_game_ts', 0))
  if (!last || now - last > GAP_MS()) return []
  const start = Number(getSetting(groupJid, 'session_start', 0))
  return getDb().prepare(RANKING).all(groupJid, start, limit)
}

// Classement général du groupe (depuis le dernier effacement)
export const overallRanking = (groupJid, limit = 10) => getDb().prepare(RANKING).all(groupJid, 0, limit)

// Séries de victoires à partir de l’historique (du plus ancien au plus récent)
const streaks = (wonList) => {
  let best = 0
  let run = 0
  for (const w of wonList) {
    run = w ? run + 1 : 0
    best = Math.max(best, run)
  }
  return { current: run, best }
}

// Statistiques d’un joueur dans un groupe, ou null s’il n’a pas fini de partie :
// { games, wins, points, asImposter, impWins, civGames, civWins, streak, bestStreak, form[{won, role}] (10 dernières, récente en dernier),
//   rank, players (joueurs classés dans le groupe), name (dernier pseudo connu) }
export const playerStats = (groupJid, num) => {
  const history = getDb().prepare('SELECT role, won, points, name FROM results WHERE group_jid = ? AND num = ? ORDER BY id').all(groupJid, num)
  if (!history.length) return null
  const wins = history.filter((r) => r.won).length
  const imp = history.filter((r) => r.role === 'imposteur')
  const { current, best } = streaks(history.map((r) => r.won))
  const ranking = overallRanking(groupJid, 10000)
  return {
    games: history.length,
    wins,
    points: history.reduce((n, r) => n + r.points, 0),
    asImposter: imp.length,
    impWins: imp.filter((r) => r.won).length,
    civGames: history.length - imp.length,
    civWins: wins - imp.filter((r) => r.won).length,
    streak: current,
    bestStreak: best,
    form: history.slice(-10).map((r) => ({ won: !!r.won, role: r.role })),
    rank: ranking.findIndex((r) => r.num === num) + 1,
    players: ranking.length,
    name: [...history].reverse().find((r) => r.name)?.name || null,
  }
}

// Efface les scores d’un groupe (ou de tous si groupJid = null). Retourne le nombre de lignes supprimées.
export const resetScores = (groupJid = null) => {
  const db = getDb()
  if (groupJid) {
    db.prepare("DELETE FROM settings WHERE group_jid = ? AND key IN ('session_start', 'last_game_ts')").run(groupJid)
    return Number(db.prepare('DELETE FROM results WHERE group_jid = ?').run(groupJid).changes)
  }
  db.exec("DELETE FROM settings WHERE key IN ('session_start', 'last_game_ts')")
  return Number(db.prepare('DELETE FROM results').run().changes)
}
