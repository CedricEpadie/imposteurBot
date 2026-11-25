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
  SELECT num, MAX(jid) AS jid, SUM(points) AS points, COUNT(*) AS games, SUM(won) AS wins
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

// Statistiques d’un joueur dans un groupe : { games, wins, points, asImposter, impWins } ou null
export const playerStats = (groupJid, num) => {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS games, SUM(won) AS wins, SUM(points) AS points,
              SUM(role = 'imposteur') AS asImposter, SUM(role = 'imposteur' AND won = 1) AS impWins
       FROM results WHERE group_jid = ? AND num = ?`
    )
    .get(groupJid, num)
  return row && row.games ? row : null
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
