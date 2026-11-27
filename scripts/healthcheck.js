// Sonde de santé pour Docker : code de sortie 0 = bot sain, 1 = problème (raison affichée).
import fs from 'node:fs'
import path from 'node:path'
const { config } = await import('../src/config.js')
const { healthStatus } = await import('../src/core/heartbeat.js')
let hb = null
try {
  hb = JSON.parse(fs.readFileSync(path.join(config.data.dir, '.heartbeat'), 'utf8'))
} catch {}
const r = healthStatus(hb)
console.log(r.reason)
process.exit(r.ok ? 0 : 1)
