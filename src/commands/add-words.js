// /imposteur ajouter [pack :] catégorie : mot1 / mot2   (admin) : ajoute une paire de mots à un pack
import { config } from '../config.js'
import { say } from '../whatsapp/messenger.js'
import { isAdmin } from '../core/admin.js'
import { addPair } from '../content/packs.js'

const P = config.prefix

export default {
  name: 'ajouter',
  aliases: ['add'],
  groupOnly: false, // un admin peut aussi ajouter des mots en privé avec le bot
  async run({ chat, me, raw }) {
    if (!isAdmin(me)) {
      return say(chat, '🔒 Commande réservée aux admins du bot (variable ADMIN_NUMBERS du fichier .env).')
    }
    const parts = raw.split(':').map((s) => s.trim())
    const pair = (parts.pop() || '').split(/\s*[/|]\s*/)
    const usage = `Usage : *${P}imposteur ajouter [pack :] catégorie : mot1 / mot2*\nex. *${P}imposteur ajouter foot : Joueurs : Messi / Ronaldo*\nSans pack, la paire va dans le pack « perso ».`
    if (pair.length !== 2 || parts.length < 1 || parts.length > 2) return say(chat, usage)
    const [packId, category] = parts.length === 2 ? parts : ['perso', parts[0]]
    try {
      const r = addPair({ packId, category, a: pair[0], b: pair[1] })
      return say(chat, `✅ Paire ajoutée : *${pair[0]}* / *${pair[1]}*\n📦 Pack : ${r.packId} • Catégorie : ${r.category}`)
    } catch (e) {
      return say(chat, `⛔ ${e.message}.\n\n${usage}`)
    }
  },
}
