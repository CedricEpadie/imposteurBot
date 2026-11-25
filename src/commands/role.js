// /imposteur mot : renvoie son rôle (en privé, ou depuis le groupe avec envoi en privé)
import { config } from '../config.js'
import { say } from '../whatsapp/messenger.js'
import { num, tag } from '../core/utils.js'
import { onCooldown } from '../core/cooldown.js'
import { allGames } from '../game/store.js'
import { findPlayer } from '../game/players.js'
import { deliverRole } from '../roles/delivery.js'

const P = config.prefix

export default {
  name: 'mot',
  aliases: ['role', 'rôle'],
  shortcut: true,
  groupOnly: false, // utilisable aussi en privé avec le bot
  async run({ chat, isGroup, me }) {
    let game = null
    for (const g of allGames()) {
      if (g.phase !== 'lobby' && g.phase !== 'dm' && findPlayer(g, me.ids)) game = g
    }
    if (!game) return say(chat, 'Je ne te trouve dans aucune partie en cours (ou les rôles ne sont pas encore distribués).')
    if (onCooldown(`role:${num(me.jid)}`, 10)) return say(chat, '⏳ Patiente quelques secondes avant de redemander ton rôle.')
    const p = findPlayer(game, me.ids)
    const r = await deliverRole(game, p)
    const ok = r.ok
    if (!isGroup) return ok ? undefined : say(chat, `Impossible de t’envoyer ton rôle pour le moment.\n🔧 ${r.error}`)
    return say(
      chat,
      ok
        ? `📩 ${tag(me.jid)} : rôle renvoyé en privé.`
        : `Impossible de t’écrire en privé : envoie-moi d’abord un message en privé, puis *${P}imposteur mot*.\n🔧 ${r.error}`,
      [me.jid]
    )
  },
}
