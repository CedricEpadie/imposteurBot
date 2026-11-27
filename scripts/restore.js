// Restaure une sauvegarde de la base : `npm run restore` (liste les copies) puis `npm run restore -- imposteur-2026-11-27-05-49.db`.
// ARRÊTE LE BOT AVANT (npm run stop). La base actuelle est conservée à côté (.avant-restauration).
import fs from 'node:fs'
import path from 'node:path'
process.env.DB_PATH ||= '' // la config se charge sans ouvrir la base
const { config } = await import('../src/config.js')
const dir = path.join(config.data.dir, 'backups')
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^imposteur-.*\.db$/.test(f)).sort() : []
const wanted = process.argv[2]

if (!wanted) {
  console.log(files.length ? `Sauvegardes disponibles dans ${dir} :\n${files.map((f) => `  ${f}`).join('\n')}\n\nRestaurer : npm run restore -- <fichier>   (bot arrêté !)` : `Aucune sauvegarde dans ${dir}`)
  process.exit(0)
}
const src = path.join(dir, path.basename(wanted))
if (!fs.existsSync(src)) {
  console.error(`❌ Sauvegarde introuvable : ${src}`)
  process.exit(1)
}
const db = config.data.dbPath
if (fs.existsSync(db)) fs.copyFileSync(db, `${db}.avant-restauration`)
for (const ext of ['-wal', '-shm']) fs.rmSync(db + ext, { force: true }) // sinon l’ancien journal serait rejoué sur la base restaurée
fs.copyFileSync(src, db)
console.log(`✅ Base restaurée depuis ${path.basename(src)}. L’ancienne est dans ${db}.avant-restauration. Relance le bot (npm start).`)
