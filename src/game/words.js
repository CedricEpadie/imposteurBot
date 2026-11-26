// Tirage des paires de mots, le plus varié possible :
//  • jamais une paire déjà jouée dans le groupe tant que toutes n’ont pas servi (mémoire persistante, survit aux redémarrages) ;
//  • on tire d’abord une catégorie au hasard (et non une paire parmi toutes : les grosses catégories ne dominent pas),
//    en évitant les 3 dernières catégories jouées ;
//  • on évite les mots déjà vus dans les dernières parties (un même mot peut figurer dans plusieurs paires) ;
//  • quel mot va aux civils et lequel à l’imposteur (mode « proche ») est tiré à pile ou face.
import crypto from 'node:crypto'
import { pairsFor } from '../content/packs.js'
import { getSetting, setSetting } from '../storage/settings.js'
import { norm, pick } from '../core/utils.js'
import { randInt } from '../core/random.js'

const RECENT_CATEGORIES = 3
const RECENT_WORDS = 14
const USED_MAX = 5000

const memory = new Map() // repli si la base est indisponible : `${groupe}|${clé}` → tableau

const load = (key, name) => {
  try {
    const v = JSON.parse(getSetting(key, name, '[]'))
    return Array.isArray(v) ? v : []
  } catch {
    return memory.get(`${key}|${name}`) || []
  }
}
const save = (key, name, list) => {
  memory.set(`${key}|${name}`, list)
  try {
    setSetting(key, name, JSON.stringify(list))
  } catch {
    /* mémoire seulement */
  }
}

// Packs activés pour ce groupe (liste vide = tous)
export const activePackIds = (key) => {
  try {
    return String(getSetting(key, 'packs', '')).split(',').filter(Boolean)
  } catch {
    return []
  }
}

const hash = (id) => crypto.createHash('sha1').update(id).digest('base64url').slice(0, 8)
const groupOf = (x) => x.id.slice(0, x.id.length - x.a.length - 1) // « pack|catégorie »

// Retourne [catégorie, mot des civils, mot proche pour l’imposteur (mode « proche »)]
export const pickPair = (key) => {
  const all = pairsFor(activePackIds(key))
  let used = new Set(load(key, 'used_pairs'))
  let pool = all.filter((x) => !used.has(hash(x.id)))
  if (!pool.length) {
    used = new Set() // toutes les paires ont servi : on repart de zéro
    pool = all
  }

  // mots déjà vus récemment
  const recentWords = load(key, 'recent_words')
  const fresh = pool.filter((x) => !recentWords.includes(norm(x.a)) && !recentWords.includes(norm(x.b)))
  if (fresh.length) pool = fresh

  // catégorie d’abord (hors les dernières jouées), puis paire dans la catégorie
  const recentCats = load(key, 'recent_cats')
  const groups = [...new Set(pool.map(groupOf))]
  const window = Math.min(RECENT_CATEGORIES, groups.length - 1)
  const avoid = window > 0 ? recentCats.slice(-window) : []
  const candidates = groups.filter((g) => !avoid.includes(g))
  const group = pick(candidates.length ? candidates : groups)
  const chosen = pick(pool.filter((x) => groupOf(x) === group))

  used.add(hash(chosen.id))
  save(key, 'used_pairs', [...used].slice(-USED_MAX))
  save(key, 'recent_cats', [...recentCats, group].slice(-RECENT_CATEGORIES))
  save(key, 'recent_words', [...recentWords, norm(chosen.a), norm(chosen.b)].slice(-RECENT_WORDS))

  return randInt(2) === 0 ? [chosen.cat, chosen.a, chosen.b] : [chosen.cat, chosen.b, chosen.a]
}
