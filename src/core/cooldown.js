// Délai minimal entre deux utilisations d'une commande par un même joueur (anti-spam des commandes qui génèrent une image).
const hits = new Map() // clé → { until, warned }

// Retourne { ok: true } et démarre le délai, ou { ok: false, wait (secondes), warn } ; warn n'est vrai qu'à la 1re réponse refusée
// de la période (on prévient une fois, puis on ignore en silence : répondre à chaque essai serait lui-même du spam).
export const checkCooldown = (key, seconds, now = Date.now()) => {
  const e = hits.get(key)
  if (e && now < e.until) {
    const warn = !e.warned
    e.warned = true
    return { ok: false, wait: Math.ceil((e.until - now) / 1000), warn }
  }
  hits.set(key, { until: now + seconds * 1000, warned: false })
  if (hits.size > 2000) for (const [k, v] of hits) if (now >= v.until) hits.delete(k)
  return { ok: true }
}
export const _resetCooldowns = () => hits.clear()

// Anti-spam simple : renvoie true si `id` est encore en attente, sinon démarre un délai de `seconds` secondes (/test, /role).
const simple = new Map()
export const onCooldown = (id, seconds) => {
  const now = Date.now()
  if ((simple.get(id) || 0) > now) return true
  simple.set(id, now + seconds * 1000)
  return false
}
