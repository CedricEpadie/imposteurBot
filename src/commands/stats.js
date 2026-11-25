// /imposteur stats [@joueur] : statistiques d’un joueur dans ce groupe
import { say } from '../whatsapp/messenger.js'
import { count } from '../game/wording.js'
import { num, tag } from '../core/utils.js'
import { playerStats } from '../storage/scores.js'

export default {
  name: 'stats',
  aliases: ['stat'],
  shortcut: true,
  async run({ chat, me, mentioned }) {
    const target = mentioned[0] ? { jid: mentioned[0] } : me
    const s = playerStats(chat, num(target.jid))
    if (!s) return say(chat, `${tag(target.jid)} n’a pas encore terminé de partie ici.`, [target.jid])
    const pct = Math.round((100 * s.wins) / s.games)
    return say(
      chat,
      `📈 *Stats de ${tag(target.jid)}*\n\n🎮 Parties : ${s.games}\n🏆 Victoires : ${s.wins} (${pct} %)\n⭐ Points : ${s.points}\n` +
        `🥷 Comme imposteur : ${count(s.asImposter, 'partie')}, ${count(s.impWins, 'victoire')}\n🕵️ Comme civil : ${count(s.games - s.asImposter, 'partie')}, ${count(s.wins - s.impWins, 'victoire')}`,
      [target.jid]
    )
  },
}
