// Scores et statistiques des joueurs (une ligne `results` par joueur et par partie terminée).
//
// Deux périodes :
//   • la SEMAINE (du lundi 00:00 au dimanche 24:00, heure locale du serveur, variable TZ) : le classement repart de zéro chaque lundi ;
//   • « global » : depuis le début (les données sont conservées).
// « Session » = suite de parties d’un groupe séparées de moins de `sessionGapHours` heures.
import { config } from '../config.js'
import { getDb } from './db.js'
import { getSetting, setSetting } from './settings.js'

const FOREVER = 8.64e15
const DAY = 86_400_000
const GAP_MS = () => config.data.sessionGapHours * 3600 * 1000
const TRACKING = 2 // version du suivi des comportements écrite avec chaque partie (voir la migration 3)
const FIELDS = ['votes', 'right', 'wrong', 'received', 'abstain', 'talk', 'clues', 'missed', 'stolen', 'clen', 'fast', 'herd', 'fell', 'caught', 'ejected']

// Enregistre une partie terminée. rows = [{ num, jid, name, role, won, points, ...comportement }]
export const recordGame = (groupJid, gameId, rows, now = Date.now()) => {
  const db = getDb()
  const last = Number(getSetting(groupJid, 'last_game_ts', 0))
  if (!last || now - last > GAP_MS()) setSetting(groupJid, 'session_start', now) // nouvelle session
  setSetting(groupJid, 'last_game_ts', now)
  const insert = db.prepare(
    `INSERT INTO results (game_id, group_jid, num, jid, name, role, won, points, ts, ${FIELDS.join(', ')}, tracking) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${FIELDS.map(() => '?').join(', ')}, ${TRACKING})`
  )
  db.exec('BEGIN')
  try {
    for (const r of rows) insert.run(gameId, groupJid, r.num, r.jid, r.name || null, r.role, r.won ? 1 : 0, r.points, now, ...FIELDS.map((f) => r[f] || 0))
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

// ── Semaines (lundi → dimanche) ───────────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
// Clé d’une semaine = date de son lundi, « AAAA-MM-JJ »
export const weekKey = (d = new Date(Date.now())) => {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`
}
const parseKey = (key) => key.split('-').map(Number)
export const weekBounds = (key) => {
  const [y, m, d] = parseKey(key)
  return [new Date(y, m - 1, d).getTime(), new Date(y, m - 1, d + 7).getTime()]
}
export const previousWeekKey = (d = new Date(Date.now())) => weekKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
// « du 24 au 30 novembre » / « du 28 décembre au 3 janvier »
export const weekLabel = (key) => {
  const [y, m, d] = parseKey(key)
  const a = new Date(y, m - 1, d)
  const b = new Date(y, m - 1, d + 6)
  return a.getMonth() === b.getMonth() ? `du ${a.getDate()} au ${b.getDate()} ${MONTHS[b.getMonth()]}` : `du ${a.getDate()} ${MONTHS[a.getMonth()]} au ${b.getDate()} ${MONTHS[b.getMonth()]}`
}
export const weekWindow = (key = weekKey()) => {
  const [since, until] = weekBounds(key)
  return { since, until }
}

// Groupes qui ont joué pendant la semaine `key`
export const groupsWithGames = (key) => {
  const [a, b] = weekBounds(key)
  return getDb().prepare('SELECT DISTINCT group_jid AS g FROM results WHERE ts >= ? AND ts < ?').all(a, b).map((r) => r.g)
}

// MVP de la semaine (réglage « season_champ:<semaine> » = numéro du joueur ; conserve aussi les anciens champions mensuels)
export const recordChampion = (groupJid, key, num) => setSetting(groupJid, `season_champ:${key}`, num)

// ── Défis réussis (réglage « defi:<semaine>:<défi>:<numéro> ») ───────────────────────────────────────
export const recordChallengeDone = (groupJid, week, id, num) => setSetting(groupJid, `defi:${week}:${id}:${num}`, 1)
export const challengeDone = (groupJid, week, id, num) => getSetting(groupJid, `defi:${week}:${id}:${num}`) != null

// ── Calcul des statistiques ──────────────────────────────────────────────────────────────────────────
const dayNumber = (ts) => {
  const d = new Date(ts)
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY)
}
const streaks = (wonList) => {
  let best = 0
  let run = 0
  for (const w of wonList) {
    run = w ? run + 1 : 0
    best = Math.max(best, run)
  }
  return { current: run, best }
}
// Plus longue suite de valeurs consécutives (jours ou semaines) ; `current` seulement si elle touche `today` ou la veille
const runs = (sorted, today) => {
  let best = 0
  let run = 0
  let prev = null
  for (const v of sorted) {
    run = prev !== null && v === prev + 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = v
  }
  return { current: prev !== null && today - prev <= 1 ? run : 0, best }
}

// Agrège l’historique d’un joueur (lignes `results`, du plus ancien au plus récent)
const aggregate = (history, now) => {
  const wins = history.filter((r) => r.won).length
  const imp = history.filter((r) => r.role === 'imposteur')
  const { current, best } = streaks(history.map((r) => r.won))
  const sum = (k) => history.reduce((n, r) => n + (r[k] || 0), 0)
  const days = [...new Set(history.map((r) => dayNumber(r.ts)))].sort((a, b) => a - b)
  const weekNums = [...new Set(history.map((r) => Math.floor((dayNumber(r.ts) + 3) / 7)))].sort((a, b) => a - b) // 1970-01-01 = jeudi
  const dayRun = runs(days, dayNumber(now))
  const weekRun = runs(weekNums, Math.floor((dayNumber(now) + 3) / 7))
  const hour = (r) => new Date(r.ts).getHours()
  // Dénominateurs « mesurés » : seules les parties suivies par la version qui a introduit la mesure comptent (t1 : depuis la v1.10, t2 : depuis la v1.11)
  const tier = (min) => {
    const h = history.filter((r) => r.tracking >= min)
    return { games: h.length, civGames: h.filter((r) => r.role !== 'imposteur').length, asImposter: h.filter((r) => r.role === 'imposteur').length, clues: h.reduce((n, r) => n + r.clues, 0), votes: h.reduce((n, r) => n + r.votes, 0) }
  }
  const s = {
    t1: tier(1),
    t2: tier(2),
    games: history.length,
    wins,
    points: sum('points'),
    asImposter: imp.length,
    impWins: imp.filter((r) => r.won).length,
    civGames: history.length - imp.length,
    civWins: wins - imp.filter((r) => r.won).length,
    streak: current,
    bestStreak: best,
    daysPlayed: days.length,
    dayStreak: dayRun.current,
    bestDayStreak: dayRun.best,
    weekStreak: weekRun.current,
    bestWeekStreak: weekRun.best,
    night: history.filter((r) => hour(r) >= 22 || hour(r) < 5).length, // parties jouées entre 22 h et 5 h
    early: history.filter((r) => hour(r) >= 5 && hour(r) < 9).length, // entre 5 h et 9 h
    form: history.slice(-10).map((r) => ({ won: !!r.won, role: r.role })),
    name: [...history].reverse().find((r) => r.name)?.name || null,
    jid: history.at(-1).jid,
  }
  // comportement cumulé (surnoms, titres, défis)
  s.rightVotes = sum('right')
  s.wrongVotes = sum('wrong')
  for (const f of FIELDS) if (f !== 'right' && f !== 'wrong') s[f] = sum(f)
  return s
}

const byRank = (a, b) => b.points - a.points || b.wins - a.wins || a.games - b.games

// Statistiques de TOUS les joueurs d’un groupe sur une période : Map numéro → stats (avec rang, `players` = nombre de classés).
// `since` / `until` : fenêtre en millisecondes (défaut : depuis le début).
export const groupStats = (groupJid, { since = 0, until = FOREVER } = {}, now = Date.now()) => {
  const rows = getDb()
    .prepare(`SELECT num, jid, role, won, points, name, ts, tracking, ${FIELDS.join(', ')} FROM results WHERE group_jid = ? AND ts >= ? AND ts < ? ORDER BY id`)
    .all(groupJid, since, until)
  const by = new Map()
  for (const r of rows) {
    if (!by.has(r.num)) by.set(r.num, [])
    by.get(r.num).push(r)
  }
  const champs = new Map()
  for (const r of getDb().prepare("SELECT value FROM settings WHERE group_jid = ? AND key LIKE 'season_champ:%'").all(groupJid)) champs.set(r.value, (champs.get(r.value) || 0) + 1)
  const defis = new Map()
  for (const r of getDb().prepare("SELECT key FROM settings WHERE group_jid = ? AND key LIKE 'defi:%'").all(groupJid)) {
    const n = r.key.split(':').at(-1)
    defis.set(n, (defis.get(n) || 0) + 1)
  }
  const all = new Map([...by].map(([num, h]) => [num, { num, ...aggregate(h, now), champSeasons: champs.get(num) || 0, defisDone: defis.get(num) || 0 }]))
  const ranked = [...all.values()].sort(byRank)
  ranked.forEach((s, i) => {
    s.rank = i + 1
    s.players = ranked.length
  })
  return all
}

// Classement du groupe sur une période (lignes { num, jid, name, points, wins, games }), limité à `limit`
const rankingOf = (groupJid, win, limit) => {
  const rows = getDb()
    .prepare(
      `SELECT num, MAX(jid) AS jid, SUM(points) AS points, COUNT(*) AS games, SUM(won) AS wins,
        (SELECT r2.name FROM results r2 WHERE r2.group_jid = results.group_jid AND r2.num = results.num AND r2.name IS NOT NULL ORDER BY r2.id DESC LIMIT 1) AS name
       FROM results WHERE group_jid = ? AND ts >= ? AND ts < ? GROUP BY num ORDER BY points DESC, wins DESC, games ASC LIMIT ?`
    )
    .all(groupJid, win.since ?? 0, win.until ?? FOREVER, limit)
  return rows
}
export const overallRanking = (groupJid, limit = 10) => rankingOf(groupJid, {}, limit)
export const weekRanking = (groupJid, key = weekKey(), limit = 10) => rankingOf(groupJid, weekWindow(key), limit)

// Classement de la session en cours ([] si la dernière partie date de plus de sessionGapHours)
export const sessionRanking = (groupJid, limit = 10, now = Date.now()) => {
  const last = Number(getSetting(groupJid, 'last_game_ts', 0))
  if (!last || now - last > GAP_MS()) return []
  return rankingOf(groupJid, { since: Number(getSetting(groupJid, 'session_start', 0)) }, limit)
}

// Statistiques d’un joueur ou null s’il n’a pas fini de partie sur la période.
// period : 'global' (défaut) ou 'week' (semaine en cours, ou `week` = clé d’une autre semaine).
// Le résultat contient aussi `peers` (stats des autres joueurs du groupe sur la même période : surnoms relatifs au groupe).
export const withPeers = (all, num) => (all.has(num) ? { ...all.get(num), peers: [...all.values()] } : null)
export const playerStats = (groupJid, num, { period = 'global', week = weekKey() } = {}) => withPeers(groupStats(groupJid, period === 'week' ? weekWindow(week) : {}), num)

// Efface les scores d’un groupe (ou de tous si groupJid = null). Retourne le nombre de lignes supprimées.
export const resetScores = (groupJid = null) => {
  const db = getDb()
  if (groupJid) {
    db.prepare("DELETE FROM settings WHERE group_jid = ? AND (key IN ('session_start', 'last_game_ts', 'season_announced') OR key LIKE 'season_champ:%' OR key LIKE 'defi:%')").run(groupJid)
    return Number(db.prepare('DELETE FROM results WHERE group_jid = ?').run(groupJid).changes)
  }
  db.exec("DELETE FROM settings WHERE key IN ('session_start', 'last_game_ts', 'season_announced') OR key LIKE 'season_champ:%' OR key LIKE 'defi:%'")
  return Number(db.prepare('DELETE FROM results').run().changes)
}
