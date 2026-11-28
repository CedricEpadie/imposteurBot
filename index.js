// 🕵️ L’IMPOSTEUR — bot WhatsApp autonome (Baileys), préfixe « / » par défaut
//
// Point d’entrée : tout le code vit dans src/ (voir « Architecture du code » dans le README).

// La base SQLite intégrée à Node (node:sqlite) demande Node ≥ 22.13 : on vérifie avant de charger le reste
const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`❌ Node ${process.versions.node} détecté : ce bot demande Node 22.13 ou plus (base SQLite intégrée).`)
  process.exit(1)
}

const { config } = await import('./src/config.js') // en premier : charge le fichier .env
const { checkCardRendering } = await import('./src/render/card.js')
const { getDb } = await import('./src/storage/db.js')
const { loadPacks, getPacks } = await import('./src/content/packs.js')
const { startBackups } = await import('./src/storage/backup.js')
const { startHeartbeat } = await import('./src/core/heartbeat.js')
const { startSeasons } = await import('./src/game/seasons.js')
const { closeDb } = await import('./src/storage/db.js')
const { startConnection } = await import('./src/whatsapp/connection.js')

// Arrêt propre (docker stop, pm2 stop) : les parties sont déjà sauvegardées à chaque phase ; on ferme la base proprement
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`${sig} reçu : arrêt du bot`)
    try {
      closeDb()
    } catch {}
    process.exit(0)
  })
}

process.on('unhandledRejection', (e) => console.error('unhandledRejection :', e))
process.on('uncaughtException', (e) => console.error('uncaughtException :', e))

// Base de données (scores, parties en cours) et packs de mots
try {
  getDb()
} catch (e) {
  console.error(`❌ Impossible d’ouvrir la base de données (${config.data.dbPath}) : ${e.message}`)
  process.exit(1)
}
loadPacks()
startBackups()
startHeartbeat()
startSeasons()
console.log(`📦 ${getPacks().length} pack(s) de mots : ${getPacks().map((p) => p.id).join(', ')}`)

// Vérifie au démarrage que les cartes de rôle peuvent être générées
if (config.roles.delivery !== 'text') {
  try {
    await checkCardRendering()
  } catch (e) {
    console.error(
      `❌ Impossible de générer les cartes de rôle (${e.message}).\n` +
        `   Installe les dépendances (npm ci) et des polices (ex. : sudo apt install fonts-dejavu-core),\n` +
        `   ou mets ROLE_DELIVERY=text dans .env (les rôles seront alors visibles par l’hébergeur du bot).`
    )
    process.exit(1)
  }
}

startConnection().catch((e) => {
  console.error('Démarrage impossible :', e)
  process.exit(1)
})
