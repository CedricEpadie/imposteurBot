// Source d’aléa du bot : cryptographique (non prévisible, sans biais), jamais Math.random.
// Les tests peuvent injecter une source déterministe avec setRandomSource().
import crypto from 'node:crypto'

let source = null
export const setRandomSource = (fn) => {
  source = fn
}

// Flottant uniforme dans [0, 1)
export const rand = () => (source ? source() : crypto.randomBytes(6).readUIntBE(0, 6) / 2 ** 48)

// Entier uniforme dans [0, n), sans biais de modulo
export const randInt = (n) => (source ? Math.floor(source() * n) : crypto.randomInt(n))

// Tire `k` éléments distincts, chacun avec une probabilité proportionnelle à son poids (tirage sans remise)
export const weightedSample = (items, weightOf, k = 1) => {
  const pool = items.map((item) => ({ item, w: Math.max(0, Number(weightOf(item)) || 0) }))
  const out = []
  while (out.length < k && pool.length) {
    const total = pool.reduce((n, x) => n + x.w, 0)
    let idx
    if (total <= 0) idx = randInt(pool.length) // tous les poids nuls : tirage égal
    else {
      let r = rand() * total
      idx = pool.findIndex((x) => (r -= x.w) < 0)
      if (idx < 0) idx = pool.length - 1
    }
    out.push(pool.splice(idx, 1)[0].item)
  }
  return out
}
