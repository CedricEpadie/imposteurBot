// Alertes aux admins (ADMIN_NUMBERS) par message privé WhatsApp : démarrage, retour après une longue coupure, sauvegarde en échec…
// Une alerte émise alors que le bot est déconnecté reste en attente et part dès la reconnexion (flushAlerts).
// Une même alerte (même clé) n'est pas répétée avant `cooldownMin` minutes.
import fs from 'node:fs'
import { isConnected } from './heartbeat.js'

const queue = []
const lastAt = new Map()

export const appVersion = () => {
  try {
    return JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version
  } catch {
    return '?'
  }
}

// Met une alerte en file (sauf si la même est trop récente). Retourne true si elle a été retenue.
export const queueAlert = (key, text, { cooldownMin = 30, now = Date.now() } = {}) => {
  if (now - (lastAt.get(key) ?? -Infinity) < cooldownMin * 60_000) return false
  lastAt.set(key, now)
  queue.push(text)
  return true
}

// Envoie les alertes en attente (un seul message regroupé). `send` est injecté pour les tests.
export const flushAlerts = async (send) => {
  if (!queue.length) return 0
  const n = queue.length
  const text = queue.splice(0).join('\n\n')
  if (!send) ({ notifyAdmins: send } = await import('../whatsapp/messenger.js'))
  await send(text)
  return n
}

// Alerte immédiate si le bot est connecté, sinon en attente de la reconnexion.
export const alertNow = async (key, text, opts) => {
  if (!queueAlert(key, text, opts)) return false
  if (isConnected()) await flushAlerts().catch(() => {})
  return true
}

export const _reset = () => {
  queue.length = 0
  lastAt.clear()
}
