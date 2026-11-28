// Titres (défis à paliers) et surnoms (style de jeu) d'un joueur, calculés à partir de ses statistiques (voir storage/scores.js, playerStats).
// Pour ajouter un titre : une entrée dans TITLES (paliers + valeur à atteindre). Pour un surnom : une entrée dans NICKNAMES.

// Chaque titre : `of(s)` = la valeur suivie, `unit` = ce qu'on compte, `tiers` = paliers (du plus facile au plus dur)
export const TITLES = [
  { id: 'menteur', unit: 'victoires en imposteur', of: (s) => s.impWins, tiers: [['Menteur né', 5], ['Maître du bluff', 15], ['Mythomane suprême', 40]] },
  { id: 'detective', unit: 'imposteurs démasqués', of: (s) => s.rightVotes, tiers: [['Détective', 5], ['Inspecteur', 20], ['Commissaire', 50]] },
  { id: 'voleur', unit: 'mots devinés', of: (s) => s.stolen, tiers: [['Voleur de mots', 2], ['Devin', 6], ['Maître voleur', 15]] },
  { id: 'serie', unit: 'victoires d’affilée (record)', of: (s) => s.bestStreak, tiers: [['Sur sa lancée', 3], ['Increvable', 5], ['Inarrêtable', 8]] },
  { id: 'civil', unit: 'victoires en civil', of: (s) => s.civWins, tiers: [['Civil exemplaire', 10], ['Pilier du village', 30]] },
  { id: 'assidu', unit: 'parties jouées', of: (s) => s.games, tiers: [['Habitué', 10], ['Vétéran', 30], ['Légende', 100]] },
  { id: 'saison', unit: 'saisons remportées', of: (s) => s.champSeasons || 0, tiers: [['Champion de saison', 1], ['Roi des saisons', 3]] },
]

// Titres obtenus : le plus haut palier de chaque famille. [{ id, name, tier (1..n), of: n }]
export const titlesOf = (s) =>
  TITLES.flatMap((t) => {
    const v = t.of(s)
    const reached = t.tiers.filter(([, at]) => v >= at)
    return reached.length ? [{ id: t.id, name: reached.at(-1)[0], tier: reached.length, of: t.tiers.length }] : []
  })

// Prochain défi : le palier non atteint dont le joueur est le plus proche (en proportion). null si tout est atteint.
export const nextChallenge = (s) => {
  let best = null
  for (const t of TITLES) {
    const v = t.of(s)
    const next = t.tiers.find(([, at]) => v < at)
    if (!next) continue
    const ratio = v / next[1]
    if (!best || ratio > best.ratio) best = { name: next[0], value: v, goal: next[1], unit: t.unit, ratio }
  }
  return best
}

const per = (a, b) => (b > 0 ? a / b : 0)

// Surnoms : la première règle qui correspond l'emporte (de la plus distinctive à la plus courante). Il faut au moins `MIN_GAMES` parties.
export const MIN_GAMES = 5
const NICKNAMES = [
  ['Le Voleur de mots', (s) => s.stolen >= 2],
  ['Le Caméléon', (s) => s.asImposter >= 3 && per(s.impWins, s.asImposter) >= 0.6],
  ['Le Fin Limier', (s) => s.rightVotes + s.wrongVotes >= 5 && per(s.rightVotes, s.rightVotes + s.wrongVotes) >= 0.6],
  ['L’Accusateur', (s) => s.rightVotes + s.wrongVotes >= 5 && per(s.wrongVotes, s.rightVotes + s.wrongVotes) >= 0.6],
  ['Le Suspect n°1', (s) => per(s.received, s.games) >= 1.3],
  ['Le Bavard', (s) => per(s.talk, s.games) >= 7],
  ['Le Silencieux', (s) => per(s.talk, s.games) <= 2.2],
  ['Le Pacifiste', (s) => per(s.abstain, s.votes + s.abstain) >= 0.3],
  ['La Tortue', (s) => per(s.missed, s.clues + s.missed) >= 0.25],
]

export const nicknameOf = (s) => {
  if (!s || s.games < MIN_GAMES) return 'Le Novice'
  return NICKNAMES.find(([, rule]) => rule(s))?.[0] || 'Le Mystérieux'
}
