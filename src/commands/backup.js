// /imposteur sauvegarde : sauvegarde la base maintenant et liste les dernières copies (admin).
import { config } from '../config.js'
import { say } from '../whatsapp/messenger.js'
import { isAdmin } from '../core/admin.js'
import { backupNow, listBackups } from '../storage/backup.js'

export default {
  name: 'sauvegarde',
  aliases: ['backup'],
  async run({ chat, me }) {
    if (!isAdmin(me)) return say(chat, '🔒 Commande réservée aux admins du bot (variable ADMIN_NUMBERS du fichier .env).')
    let made
    try {
      made = backupNow()
    } catch (e) {
      return say(chat, `❌ Sauvegarde impossible : ${e.message}`)
    }
    if (!made) return say(chat, 'ℹ️ Base en mémoire : rien à sauvegarder.')
    const list = listBackups().slice(-5).reverse()
    return say(
      chat,
      `💾 Sauvegarde faite (${Math.round(made.size / 1024)} Ko).\n\n📚 Copies conservées (${config.data.backups.keep} max) :\n${list.map((b) => `• ${b.file} — ${Math.round(b.size / 1024)} Ko`).join('\n')}\n\nPour restaurer : arrêter le bot puis *npm run restore* sur le serveur.`
    )
  },
}
