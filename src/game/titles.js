// Titres à paliers d'un joueur, calculés à partir de ses statistiques (voir storage/scores.js, playerStats). Les surnoms sont dans style.js.
// Pour ajouter un titre : une entrée dans TITLES (paliers du plus facile au plus dur ; le dernier palier = or, l'avant-dernier = argent, les autres = bronze).

// Chaque titre : `of(s)` = la valeur suivie, `unit` = ce qu'on compte, `tiers` = paliers (du plus facile au plus dur)
export const TITLES = [
  { id: 'menteur', unit: 'victoires en imposteur', of: (s) => s.impWins, tiers: [['Menteur né', 5], ['Maître du bluff', 15], ['Mythomane suprême', 40]] },
  { id: 'detective', unit: 'imposteurs démasqués', of: (s) => s.rightVotes, tiers: [['Détective', 5], ['Inspecteur', 20], ['Commissaire', 50]] },
  { id: 'voleur', unit: 'mots devinés', of: (s) => s.stolen, tiers: [['Voleur de mots', 2], ['Devin', 6], ['Maître voleur', 15]] },
  { id: 'insaisissable', unit: 'parties d’imposteur sans être démasqué', of: (s) => Math.max(0, (s.t2 ? s.t2.asImposter : s.asImposter || 0) - (s.caught || 0)), tiers: [['Insaisissable', 3], ['Anguille', 10], ['Intouchable', 25]] },
  { id: 'serie', unit: 'victoires d’affilée (record)', of: (s) => s.bestStreak, tiers: [['Sur sa lancée', 3], ['Increvable', 5], ['Inarrêtable', 8]] },
  { id: 'civil', unit: 'victoires en civil', of: (s) => s.civWins, tiers: [['Civil exemplaire', 10], ['Pilier du village', 30], ['Conscience du village', 70]] },
  { id: 'assidu', unit: 'parties jouées', of: (s) => s.games, tiers: [['Habitué', 10], ['Vétéran', 30], ['Légende', 100]] },
  { id: 'points', unit: 'points', of: (s) => s.points, tiers: [['Marqueur', 50], ['Collectionneur', 200], ['Millionnaire', 1000]] },
  { id: 'indices', unit: 'indices donnés', of: (s) => s.clues, tiers: [['Ponctuel', 30], ['Plume d’or', 120], ['Dictionnaire vivant', 400]] },
  { id: 'eclair', unit: 'indices en moins de 10 s', of: (s) => s.fast, tiers: [['Rapide', 10], ['Éclair', 40], ['Foudroyant', 120]] },
  { id: 'causeur', unit: 'messages pendant les débats', of: (s) => s.talk, tiers: [['Causeur', 100], ['Moulin à paroles', 400], ['Orateur', 1500]] },
  { id: 'jours', unit: 'jours de suite (record)', of: (s) => s.bestDayStreak, tiers: [['Régulier', 3], ['Accro', 7], ['Rituel quotidien', 14]] },
  { id: 'semaines', unit: 'semaines de suite (record)', of: (s) => s.bestWeekStreak, tiers: [['Fidèle au poste', 3], ['Pilier du groupe', 8], ['Gardien du temple', 20]] },
  { id: 'defis', unit: 'défis de la semaine relevés', of: (s) => s.defisDone, tiers: [['Relève-défi', 1], ['Chasseur de défis', 5], ['Maître des défis', 20]] },
  { id: 'mvp', unit: 'semaines de MVP', of: (s) => s.champSeasons || 0, tiers: [['MVP de la semaine', 1], ['Double MVP', 3], ['Légende des semaines', 10]] },
]

// Titres obtenus : le plus haut palier de chaque famille. [{ id, name, tier (1..n), of: n }]
export const titlesOf = (s) =>
  TITLES.flatMap((t) => {
    const v = t.of(s) || 0
    const reached = t.tiers.filter(([, at]) => v >= at)
    return reached.length ? [{ id: t.id, name: reached.at(-1)[0], tier: reached.length, of: t.tiers.length }] : []
  })

// Prochain défi : le palier non atteint dont le joueur est le plus proche (en proportion). null si tout est atteint.
export const nextChallenge = (s) => {
  let best = null
  for (const t of TITLES) {
    const v = t.of(s) || 0
    const next = t.tiers.find(([, at]) => v < at)
    if (!next) continue
    const ratio = v / next[1]
    if (!best || ratio > best.ratio) best = { name: next[0], value: v, goal: next[1], unit: t.unit, ratio }
  }
  return best
}

export { MIN_GAMES, styleOf, nicknameOf } from './style.js'
