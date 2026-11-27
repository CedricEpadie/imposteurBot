// Sauvegarde automatique de la base SQLite : un instantané cohérent (VACUUM INTO) par jour, les `keep` plus récents conservés.
// Les sauvegardes sont dans <DATA_DIR>/backups/. Pour restaurer : `npm run restore` (bot arrêté).
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'
import { getDb } from './db.js'
import { alertNow } from '../core/alerts.js'

const dir = () => path.join(config.data.dir, 'backups')
const stamp = (d = new Date()) => d.toISOString().slice(0, 16).replace(/[:T]/g, '-') // 2026-11-27-05-49

export const listBackups = () => {
  try {
    return fs
      .readdirSync(dir())
      .filter((f) => /^imposteur-.*\.db$/.test(f))
      .sort()
      .map((f) => ({ file: f, path: path.join(dir(), f), size: fs.statSync(path.join(dir(), f)).size }))
  } catch {
    return []
  }
}

// Fait une sauvegarde maintenant. Retourne { path, size, removed } ou null (base en mémoire).
export const backupNow = (now = new Date()) => {
  if (config.data.dbPath === ':memory:') return null
  fs.mkdirSync(dir(), { recursive: true })
  const target = path.join(dir(), `imposteur-${stamp(now)}.db`)
  if (fs.existsSync(target)) fs.rmSync(target)
  getDb().exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`)
  const all = listBackups()
  const old = all.slice(0, Math.max(0, all.length - config.data.backups.keep))
  for (const b of old) fs.rmSync(b.path, { force: true })
  return { path: target, size: fs.statSync(target).size, removed: old.length }
}

// Sauvegarde au démarrage si la dernière date de plus de `everyHours`, puis vérification régulière
export const startBackups = () => {
  if (config.data.dbPath === ':memory:' || config.data.backups.keep <= 0) return null
  const due = () => {
    const last = listBackups().at(-1)
    return !last || Date.now() - fs.statSync(last.path).mtimeMs > config.data.backups.everyHours * 3600_000
  }
  const run = () => {
    try {
      if (due()) {
        const r = backupNow()
        if (r) console.log(`💾 Sauvegarde de la base : ${r.path} (${Math.round(r.size / 1024)} Ko)`)
      }
    } catch (e) {
      console.error('[imposteur] sauvegarde de la base impossible :', e.message)
      alertNow('backup', `⚠️ La sauvegarde quotidienne de la base a échoué : ${e.message}`, { cooldownMin: 12 * 60 }).catch(() => {})
    }
  }
  run()
  const timer = setInterval(run, 60 * 60_000) // vérifie toutes les heures
  timer.unref()
  return timer
}
