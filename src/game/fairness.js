// Équité du tirage : le hasard reste total (personne ne sait qui sera imposteur), mais un joueur qui l’a été
// récemment a moins de chances de l’être de nouveau, et celui qui ne l’a jamais été ou pas depuis longtemps en a plus.
// L’historique vient de la base (table results) : il survit aux redémarrages.
import { getDb } from '../storage/db.js'

const NEVER = 6 // « parties depuis le dernier rôle d’imposteur » pour qui ne l’a jamais été
// poids selon le nombre de parties écoulées depuis son dernier rôle d’imposteur (0 = à la partie précédente)
const WEIGHTS = [0.2, 0.4, 0.9, 1.5, 2, 2.5, 2.9]

export const weightForGap = (gap) => WEIGHTS[Math.min(gap, WEIGHTS.length - 1)]

// Nombre de parties écoulées depuis le dernier rôle d’imposteur de chaque numéro : Map(num → gap)
export const impostorGaps = (groupJid, limit = 600) => {
  const gaps = new Map()
  try {
    const rows = getDb().prepare('SELECT game_id, num, role FROM results WHERE group_jid = ? ORDER BY id DESC LIMIT ?').all(groupJid, limit)
    let game = -1
    let lastId = null
    for (const r of rows) {
      if (r.game_id !== lastId) {
        game++
        lastId = r.game_id
      }
      if (r.role === 'imposteur' && !gaps.has(r.num)) gaps.set(r.num, game)
    }
  } catch {
    /* base indisponible : tirage à poids égaux */
  }
  return gaps
}

// Poids de tirage « imposteur » de chaque joueur : Map(joueur → poids)
export const imposterWeights = (groupJid, players) => {
  const gaps = impostorGaps(groupJid)
  return new Map(players.map((p) => [p, weightForGap(gaps.has(p.num) ? gaps.get(p.num) : NEVER)]))
}
