// Tirage des paires de mots (sans répétition tant que toutes n’ont pas été utilisées dans le groupe).
import { pairsFor } from '../content/packs.js'
import { getSetting } from '../storage/settings.js'
import { pick } from '../core/utils.js'

const usedPairs = new Map() // groupe → Set des paires déjà tirées

// Packs activés pour ce groupe (liste vide = tous)
export const activePackIds = (key) => {
  try {
    return String(getSetting(key, 'packs', '')).split(',').filter(Boolean)
  } catch {
    return []
  }
}

// Retourne [catégorie, mot des civils, mot proche pour l’imposteur (mode « proche »)]
export const pickPair = (key) => {
  const all = pairsFor(activePackIds(key))
  let used = usedPairs.get(key) || new Set()
  if (all.every((x) => used.has(x.id))) used = new Set()
  const chosen = pick(all.filter((x) => !used.has(x.id)))
  used.add(chosen.id)
  usedPairs.set(key, used)
  return Math.random() < 0.5 ? [chosen.cat, chosen.a, chosen.b] : [chosen.cat, chosen.b, chosen.a]
}
