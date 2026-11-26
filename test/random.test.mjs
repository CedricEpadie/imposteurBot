import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boot } from './helpers.mjs'

await boot()
const { setRandomSource, rand, randInt, weightedSample } = await import('../src/core/random.js')
const { setupGame, setupManche } = await import('../src/game/round.js')
const { recordGame } = await import('../src/storage/scores.js')
const { pairsFor } = await import('../src/content/packs.js')
const { weightForGap } = await import('../src/game/fairness.js')

setRandomSource(null) // vrai aléa cryptographique pour ces tests statistiques

const mkPlayers = (n) => Array.from({ length: n }, (_, i) => ({ num: `2377${String(i).padStart(4, '0')}`, jid: `2377${String(i).padStart(4, '0')}@s.whatsapp.net`, name: `J${i}`, ids: new Set() }))

test('source d’aléa : bornes, uniformité et tirage pondéré sans remise', () => {
  const buckets = Array(10).fill(0)
  for (let i = 0; i < 20000; i++) {
    const r = rand()
    assert.ok(r >= 0 && r < 1)
    buckets[randInt(10)]++
  }
  for (const b of buckets) assert.ok(b > 1700 && b < 2300, `répartition uniforme (${b})`)
  const s = weightedSample(['a', 'b', 'c', 'd'], () => 1, 3)
  assert.equal(new Set(s).size, 3, 'sans doublon')
  let heavy = 0
  for (let i = 0; i < 4000; i++) if (weightedSample(['x', 'y'], (v) => (v === 'x' ? 9 : 1))[0] === 'x') heavy++
  assert.ok(heavy > 3500 && heavy < 3750, `poids respectés (${heavy}/4000 ≈ 3600)`)
  assert.ok(weightForGap(0) < weightForGap(2) && weightForGap(2) < weightForGap(6), 'plus le rôle est ancien, plus le poids monte')
})

test('imposteurs : répartition équitable sur 500 parties et peu de répétitions d’affilée', () => {
  const players = mkPlayers(8)
  const key = 'equite@g.us'
  const counts = new Map(players.map((p) => [p.num, 0]))
  let prev = null
  let repeats = 0
  const N = 500
  for (let i = 0; i < N; i++) {
    const g = { key, players, format: 'single', mode: 'classique' }
    setupGame(g)
    const imp = g.imposters[0]
    counts.set(imp.num, counts.get(imp.num) + 1)
    if (prev === imp.num) repeats++
    prev = imp.num
    recordGame(key, `g${i}`, players.map((p) => ({ num: p.num, jid: p.jid, name: p.name, role: p === imp ? 'imposteur' : 'civil', won: false, points: 0 })), 1000 + i)
  }
  const expected = N / players.length
  for (const [num, c] of counts) assert.ok(c > expected * 0.75 && c < expected * 1.25, `${num} imposteur ${c} fois (attendu ≈ ${expected})`)
  // sans correction, ~12,5 % de répétitions d’affilée
  assert.ok(repeats / N < 0.06, `répétitions d’affilée : ${((100 * repeats) / N).toFixed(1)} %`)
})

test('imposteur : un joueur qui ne l’a jamais été est favorisé, mais personne n’est exclu', () => {
  const players = mkPlayers(6)
  const key = 'jamais@g.us'
  // tout le monde sauf le dernier a déjà été imposteur à la partie précédente
  recordGame(key, 'h0', players.map((p, i) => ({ num: p.num, jid: p.jid, name: p.name, role: i < 5 ? 'imposteur' : 'civil', won: false, points: 0 })), 1)
  const counts = new Map(players.map((p) => [p.num, 0]))
  for (let i = 0; i < 3000; i++) {
    const g = { key, players, format: 'single' }
    setupGame(g)
    counts.set(g.imposters[0].num, counts.get(g.imposters[0].num) + 1)
  }
  assert.ok(counts.get(players[5].num) > counts.get(players[0].num) * 3, 'le jamais-imposteur sort bien plus souvent')
  for (const c of counts.values()) assert.ok(c > 0, 'tout le monde garde une chance')
})

test('mots : aucune paire rejouée avant épuisement, catégories variées, mots récents évités', async () => {
  const { pickPair } = await import('../src/game/words.js')
  const key = 'mots@g.us'
  const all = pairsFor([])
  const seen = new Set()
  const cats = []
  const words = []
  for (let i = 0; i < 60; i++) {
    const [cat, civil, close] = pickPair(key)
    const id = [civil, close].sort().join('|') + '|' + cat
    assert.ok(!seen.has(id), `paire rejouée trop tôt : ${id}`)
    seen.add(id)
    cats.push(cat)
    words.push(civil)
  }
  assert.ok(all.length > 60)
  let sameCat = 0
  for (let i = 1; i < cats.length; i++) if (cats[i] === cats[i - 1]) sameCat++
  assert.equal(sameCat, 0, 'jamais deux fois de suite la même catégorie')
  assert.ok(new Set(cats).size >= 8, `au moins 8 catégories différentes (${new Set(cats).size})`)
  // le mot des civils est tiré à pile ou face parmi la paire
  const key2 = 'pf@g.us'
  const firsts = new Map()
  for (let i = 0; i < 80; i++) {
    const [, a] = pickPair(key2)
    firsts.set(a, (firsts.get(a) || 0) + 1)
  }
  assert.ok(firsts.size > 20)
})

test('ordre de parole : jamais le même premier orateur deux parties de suite', () => {
  const players = mkPlayers(6)
  const key = 'ordre@g.us'
  let prev = null
  const firstCounts = new Map()
  for (let i = 0; i < 600; i++) {
    const g = { key, players, format: 'single', mode: 'classique', eliminated: new Set() }
    setupGame(g)
    const first = g.order[0].num
    assert.notEqual(first, prev, 'même premier orateur')
    prev = first
    firstCounts.set(first, (firstCounts.get(first) || 0) + 1)
  }
  for (const c of firstCounts.values()) assert.ok(c > 60 && c < 140, `premier orateur équilibré (${c}/600)`)
})
