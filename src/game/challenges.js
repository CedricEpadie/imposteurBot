// Défis de la semaine : trois défis (bronze, argent, or) tirés au sort pour chaque groupe et chaque semaine, les mêmes pour tous les joueurs.
// La progression se calcule sur les statistiques de la semaine (storage/scores.js). Relever un défi ne donne aucun point (le barème du jeu ne change pas) :
// le bot l'annonce, il compte pour le titre « Chasseur de défis » et il figure sur la carte de profil.
import crypto from 'node:crypto'
import { groupStats, weekWindow, weekKey, challengeDone, recordChallengeDone } from '../storage/scores.js'
import { tag } from '../core/utils.js'

export const TIERS = [
  { name: 'bronze', label: 'Bronze', icon: '🥉', color: '#d98b4c' },
  { name: 'argent', label: 'Argent', icon: '🥈', color: '#c4ccd8' },
  { name: 'or', label: 'Or', icon: '🥇', color: '#f0b429' },
]

// Catalogue : `goals` = objectif pour [bronze, argent, or] ; `of(s)` = valeur de la semaine ; `maxLevel` = palier le plus dur autorisé (0, 1 ou 2)
const plural = (n, one, many) => (n > 1 ? many : one)
export const CATALOG = [
  { id: 'wins', goals: [2, 4, 7], of: (s) => s.wins, text: (n) => `Gagner ${n} ${plural(n, 'partie', 'parties')}`, unit: 'victoires' },
  { id: 'pts', goals: [6, 12, 25], of: (s) => s.points, text: (n) => `Marquer ${n} points`, unit: 'points' },
  { id: 'games', goals: [3, 6, 12], of: (s) => s.games, text: (n) => `Jouer ${n} parties`, unit: 'parties' },
  { id: 'days', goals: [2, 4, 6], of: (s) => s.daysPlayed, text: (n) => `Jouer pendant ${n} jours différents`, unit: 'jours' },
  { id: 'bluff', goals: [1, 2, 4], of: (s) => s.impWins, text: (n) => `Gagner ${n} ${plural(n, 'partie', 'parties')} en imposteur`, unit: 'victoires' },
  { id: 'civil', goals: [1, 3, 5], of: (s) => s.civWins, text: (n) => `Gagner ${n} ${plural(n, 'partie', 'parties')} en civil`, unit: 'victoires' },
  { id: 'limier', goals: [2, 4, 8], of: (s) => s.rightVotes, text: (n) => `Démasquer ${n} ${plural(n, 'imposteur', 'imposteurs')} par tes votes`, unit: 'votes justes' },
  { id: 'serie', goals: [2, 3, 5], of: (s) => s.bestStreak, text: (n) => `Enchaîner ${n} victoires d’affilée`, unit: 'd’affilée' },
  { id: 'eclair', goals: [3, 8, 15], of: (s) => s.fast, text: (n) => `Donner ${n} indices en moins de 10 secondes`, unit: 'indices' },
  { id: 'causeur', goals: [15, 40, 90], of: (s) => s.talk, text: (n) => `Écrire ${n} messages pendant les débats`, unit: 'messages' },
  { id: 'anguille', goals: [1, 2, 3], of: (s) => Math.max(0, (s.t2 ? s.t2.asImposter : s.asImposter) - s.caught), text: (n) => `Échapper à la démasquade ${n} ${plural(n, 'fois', 'fois')} en imposteur`, unit: 'fois' },
  { id: 'voleur', goals: [1, 2, 3], of: (s) => s.stolen, maxLevel: 1, text: (n) => `Deviner le mot secret ${n} ${plural(n, 'fois', 'fois')}`, unit: 'mots' },
]

// Petit générateur pseudo-aléatoire déterministe (même graine = mêmes défis pour tout le groupe)
const seeded = (seed) => {
  let a = crypto.createHash('sha256').update(seed).digest().readUInt32LE(0)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Les trois défis d'un groupe pour une semaine : [{ id, level (0 bronze, 1 argent, 2 or), tier, goal, text, unit, of }]
export const weekChallenges = (groupJid, week = weekKey()) => {
  const rnd = seeded(`${groupJid}|${week}`)
  const pool = CATALOG.map((c) => ({ c, k: rnd() })).sort((a, b) => a.k - b.k).map((x) => x.c)
  const out = []
  for (const level of [2, 1, 0]) {
    const i = pool.findIndex((c) => (c.maxLevel ?? 2) >= level)
    const [c] = pool.splice(i, 1)
    out.unshift({ id: c.id, level, tier: TIERS[level], goal: c.goals[level], text: c.text(c.goals[level]), unit: c.unit, of: c.of })
  }
  return out
}

// Valeur actuelle d'un joueur pour un défi (s = stats de la semaine, ou null s'il n'a pas joué)
export const progressOf = (challenge, s) => (s ? Math.min(challenge.goal, challenge.of(s) || 0) : 0)

// Après une partie : détecte les défis tout juste relevés par les participants, les enregistre et retourne les lignes d'annonce.
export const completeChallenges = (groupJid, players, now = new Date(Date.now())) => {
  const week = weekKey(now)
  const stats = groupStats(groupJid, weekWindow(week))
  const list = weekChallenges(groupJid, week)
  const lines = []
  for (const p of players) {
    const s = stats.get(p.num)
    if (!s) continue
    for (const c of list) {
      if ((c.of(s) || 0) >= c.goal && !challengeDone(groupJid, week, c.id, p.num)) {
        recordChallengeDone(groupJid, week, c.id, p.num)
        lines.push(`🎯 ${tag(p.jid)} relève le défi ${c.tier.icon} *${c.tier.label}* de la semaine : ${c.text.toLowerCase()} !`)
      }
    }
  }
  return lines
}
