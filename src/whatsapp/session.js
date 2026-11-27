// Fiabilité de la session WhatsApp : délais de reconnexion, copie de sauvegarde du dossier de session.
import fs from 'node:fs'
import path from 'node:path'

// Codes de déconnexion Baileys (DisconnectReason)
export const CODE = { loggedOut: 401, forbidden: 403, connectionReplaced: 440, restartRequired: 515 }

const BASE_MS = 3000
const MAX_MS = 120_000

// Que faire après une fermeture de connexion ? { delayMs, relink?, note }
//  • 401 : session invalidée par WhatsApp → nouvelle liaison nécessaire ;
//  • 440 : le même compte s’est connecté ailleurs → on attend longtemps (sinon les deux instances se chassent en boucle) ;
//  • 403 : accès refusé par WhatsApp → attente longue, sans insister ;
//  • 515 : redémarrage demandé (normal après la liaison) → immédiat ;
//  • autre : délai croissant 3 s, 6 s, 12 s… plafonné à 2 min, avec un peu de hasard.
export const reconnectPlan = (code, attempt, jitter = Math.random()) => {
  if (code === CODE.loggedOut) return { delayMs: 2000, relink: true, note: 'session déconnectée par WhatsApp (401) : nouvelle liaison nécessaire' }
  if (code === CODE.connectionReplaced) return { delayMs: 5 * 60_000, note: 'compte connecté ailleurs (440) : une seule instance du bot doit utiliser cette session ; nouvel essai dans 5 min' }
  if (code === CODE.forbidden) return { delayMs: 10 * 60_000, note: 'accès refusé par WhatsApp (403) : nouvel essai dans 10 min' }
  if (code === CODE.restartRequired) return { delayMs: 500, note: 'redémarrage demandé par WhatsApp' }
  const delayMs = Math.min(MAX_MS, BASE_MS * 2 ** Math.min(attempt, 10)) * (0.8 + 0.4 * jitter)
  return { delayMs: Math.round(delayMs), note: `connexion fermée (code ${code ?? '?'})` }
}

// Copie le dossier de session avant de l’effacer ; ne garde que les `keep` copies les plus récentes. Retourne le chemin ou null.
export const backupAuthDir = (dir, keep = 3, now = Date.now()) => {
  try {
    if (!fs.existsSync(dir)) return null
    const target = `${dir.replace(/[\\/]+$/, '')}.sauvegarde-${new Date(now).toISOString().replace(/[:.]/g, '-')}`
    fs.cpSync(dir, target, { recursive: true })
    const parent = path.dirname(path.resolve(dir))
    const prefix = `${path.basename(dir.replace(/[\\/]+$/, ''))}.sauvegarde-`
    const old = fs.readdirSync(parent).filter((f) => f.startsWith(prefix)).sort().slice(0, -keep)
    for (const f of old) fs.rmSync(path.join(parent, f), { recursive: true, force: true })
    return target
  } catch (e) {
    console.warn('[imposteur] sauvegarde de la session impossible :', e.message)
    return null
  }
}
