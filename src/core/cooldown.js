// Anti-spam : renvoie true si `id` est encore en attente, sinon démarre un délai de `seconds` secondes.
const cooldowns = new Map()

export const onCooldown = (id, seconds) => {
  const now = Date.now()
  if ((cooldowns.get(id) || 0) > now) return true
  cooldowns.set(id, now + seconds * 1000)
  return false
}
