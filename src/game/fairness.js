// Équité du tirage : le hasard reste total (personne ne sait qui sera imposteur), mais un joueur qui l’a été
// récemment a un peu moins de chances de l’être de nouveau, et celui qui ne l’a pas été depuis longtemps un peu plus.
// L’historique vient de la base (table results) : il survit aux redémarrages.
//
// Règles de prudence (pour que la correction ne devienne jamais un piège ou une certitude) :
//  • on compte les parties que le joueur a réellement jouées : un nouveau venu n’a pas d’historique et reste NEUTRE (poids 1) ;
//  • les poids sont bornés (de 0,4 à 1,8 : au plus un rapport de 4,5 entre deux joueurs), personne n’est jamais exclu ni assuré.
import { getDb } from '../storage/db.js'

// poids selon le nombre de parties jouées depuis le dernier rôle d’imposteur (0 = à sa dernière partie)
// — ou depuis ses débuts s’il ne l’a jamais été
export const WEIGHTS = [0.4, 0.7, 1, 1.25, 1.5, 1.7, 1.8]
export const NEUTRAL = 1

export const weightForGap = (gap) => WEIGHTS[Math.min(gap, WEIGHTS.length - 1)]

// Parties jouées depuis le dernier rôle d’imposteur de chaque numéro : Map(num → nombre de parties). Absent = jamais joué ici.
export const impostorGaps = (groupJid, limit = 1000) => {
  const state = new Map()
  try {
    const rows = getDb().prepare('SELECT num, role FROM results WHERE group_jid = ? ORDER BY id DESC LIMIT ?').all(groupJid, limit)
    for (const r of rows) {
      const st = state.get(r.num) || { played: 0, found: false }
      state.set(r.num, st)
      if (st.found) continue
      if (r.role === 'imposteur') st.found = true
      else st.played++
    }
  } catch {
    /* base indisponible : tirage à poids égaux */
  }
  return new Map([...state].map(([num, st]) => [num, st.played]))
}

// Poids de tirage « imposteur » de chaque joueur : Map(joueur → poids)
export const imposterWeights = (groupJid, players) => {
  const gaps = impostorGaps(groupJid)
  return new Map(players.map((p) => [p, gaps.has(p.num) ? weightForGap(gaps.get(p.num)) : NEUTRAL]))
}
