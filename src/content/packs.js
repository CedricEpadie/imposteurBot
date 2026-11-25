// Packs de mots : fichiers JSON modifiables, hors du code.
//
//  • packs/*.json            packs fournis avec le bot
//  • <DATA_DIR>/packs/*.json packs ajoutés ou complétés (même nom = fusionné avec le pack fourni)
//
// Format d’un pack :
//   { "name": "Foot ⚽", "description": "…", "categories": { "⚽ Joueurs": [["Messi", "Ronaldo"], …] } }
// Chaque paire = deux mots proches (mode classique : on tire l’un des deux ; mode « proche » : civils = l’un, imposteur = l’autre).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../config.js'
import { norm } from '../core/utils.js'

const BUNDLED_DIR = fileURLToPath(new URL('../../packs/', import.meta.url))
const userDir = () => path.join(config.data.dir, 'packs')

let packs = null // id → { id, name, description, categories }

const readPackFile = (file) => {
  try {
    const p = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!p || typeof p.categories !== 'object') throw new Error('champ « categories » manquant')
    const categories = {}
    for (const [cat, pairs] of Object.entries(p.categories)) {
      const valid = (Array.isArray(pairs) ? pairs : []).filter((x) => Array.isArray(x) && x.length === 2 && x.every((w) => typeof w === 'string' && w.trim()))
      if (valid.length) categories[cat] = valid.map(([a, b]) => [a.trim(), b.trim()])
    }
    return { name: String(p.name || path.basename(file, '.json')), description: String(p.description || ''), categories }
  } catch (e) {
    console.warn(`[imposteur] pack ignoré (${file}) : ${e.message}`)
    return null
  }
}

const listJson = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f)) : [])

const mergeInto = (target, extra) => {
  for (const [cat, pairs] of Object.entries(extra.categories)) {
    const list = (target.categories[cat] ||= [])
    for (const [a, b] of pairs) if (!list.some((q) => samePair(q, [a, b]))) list.push([a, b])
  }
}

export const loadPacks = () => {
  packs = new Map()
  for (const dir of [BUNDLED_DIR, userDir()]) {
    for (const file of listJson(dir)) {
      const data = readPackFile(file)
      if (!data) continue
      const id = path.basename(file, '.json').toLowerCase()
      const existing = packs.get(id)
      if (existing) mergeInto(existing, data)
      else packs.set(id, { id, ...data })
    }
  }
  return packs
}

export const getPacks = () => [...(packs || loadPacks()).values()]
export const getPack = (id) => (packs || loadPacks()).get(String(id).toLowerCase())
export const countPairs = (pack) => Object.values(pack.categories).reduce((n, l) => n + l.length, 0)

// Toutes les paires des packs demandés (tous si ids est vide) : [{ cat, a, b, id }]
export const pairsFor = (ids = []) => {
  const wanted = ids.length ? getPacks().filter((p) => ids.includes(p.id)) : getPacks()
  const pool = wanted.length ? wanted : getPacks()
  return pool.flatMap((p) => Object.entries(p.categories).flatMap(([cat, pairs]) => pairs.map(([a, b]) => ({ cat, a, b, id: `${p.id}|${cat}|${a}` }))))
}

// Deux paires sont identiques quel que soit l’ordre des mots (accents et casse ignorés)
const samePair = ([x, y], [a, b]) => (norm(x) === norm(a) && norm(y) === norm(b)) || (norm(x) === norm(b) && norm(y) === norm(a))

const slug = (s) => norm(s).replace(/ /g, '-').slice(0, 30)

// Ajoute une paire dans le pack `packId` (créé si besoin), catégorie `category`.
// Écrit dans <DATA_DIR>/packs/<pack>.json. Lève une Error avec un message lisible en cas de refus.
export const addPair = ({ packId, category, a, b }) => {
  const id = slug(packId)
  const cat = String(category || '').trim().slice(0, 40)
  a = String(a || '').trim()
  b = String(b || '').trim()
  if (!id) throw new Error('nom de pack invalide')
  if (!cat) throw new Error('catégorie manquante')
  if (!a || !b) throw new Error('il faut deux mots')
  if (a.length > 30 || b.length > 30) throw new Error('mots limités à 30 caractères')
  if (norm(a) === norm(b)) throw new Error('les deux mots doivent être différents')

  const file = path.join(userDir(), `${id}.json`)
  let data = fs.existsSync(file) ? readPackFile(file) : null
  data ||= { name: getPack(id)?.name || id, description: '', categories: {} }
  const existingCat = Object.keys(data.categories).find((c) => norm(c) === norm(cat)) || Object.keys(getPack(id)?.categories || {}).find((c) => norm(c) === norm(cat))
  const catName = existingCat || cat
  const list = (data.categories[catName] ||= [])
  if ((getPack(id)?.categories[catName] || []).concat(list).some((q) => samePair(q, [a, b]))) throw new Error('cette paire existe déjà')
  list.push([a, b])

  fs.mkdirSync(userDir(), { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n')
  fs.renameSync(tmp, file) // écriture atomique
  loadPacks()
  return { packId: id, category: catName }
}
