// Battement de cœur : le bot écrit toutes les 30 s l’état de sa connexion dans <DATA_DIR>/.heartbeat.
// Le healthcheck Docker (scripts/healthcheck.js) le lit pour savoir si le bot est vivant et connecté.
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'

const file = () => path.join(config.data.dir, '.heartbeat')
let connected = false
let since = Date.now() // depuis quand l’état « connecté / déconnecté » dure

const write = () => {
  try {
    fs.mkdirSync(config.data.dir, { recursive: true })
    fs.writeFileSync(file(), JSON.stringify({ ts: Date.now(), connected, since }))
  } catch {
    /* le battement est un plus : jamais bloquant */
  }
}

export const setConnected = (value) => {
  if (value !== connected) since = Date.now()
  connected = value
  write()
}

export const startHeartbeat = () => {
  write()
  const timer = setInterval(write, 30_000)
  timer.unref()
  return timer
}

// Le bot est-il « en bonne santé » ? hb = contenu du fichier. Fonction pure (testée).
//  • fichier absent ou plus vieux que 2 min → le processus est bloqué ou arrêté ;
//  • déconnecté depuis plus de `maxDownMin` minutes → WhatsApp injoignable ou session à relier (la reconnexion automatique peut
//    attendre jusqu’à 10 min : on tolère donc 12 min par défaut).
export const healthStatus = (hb, now = Date.now(), { maxAgeSec = 120, maxDownMin = 12 } = {}) => {
  if (!hb || typeof hb.ts !== 'number') return { ok: false, reason: 'aucun battement de cœur (bot non démarré ?)' }
  if (now - hb.ts > maxAgeSec * 1000) return { ok: false, reason: `plus de battement depuis ${Math.round((now - hb.ts) / 1000)} s (bot bloqué ?)` }
  if (!hb.connected && now - hb.since > maxDownMin * 60_000) return { ok: false, reason: `déconnecté de WhatsApp depuis ${Math.round((now - hb.since) / 60_000)} min` }
  return { ok: true, reason: hb.connected ? 'connecté' : 'déconnecté (reconnexion en cours)' }
}
