// /imposteur stats [@joueur] : carte de profil d’un joueur dans ce groupe (image + texte)
import { count } from '../game/wording.js'
import { num, tag } from '../core/utils.js'
import { playerStats } from '../storage/scores.js'
import { say } from '../whatsapp/messenger.js'
import { sayVisual } from '../render/svg.js'
import { profileSvg, ordinal } from '../render/profile.js'
import { titlesOf, nicknameOf, nextChallenge } from '../game/titles.js'

export default {
  name: 'stats',
  aliases: ['stat', 'profil'],
  shortcut: true,
  async run({ chat, me, mentioned }) {
    const target = mentioned[0] ? { jid: mentioned[0] } : me
    const s = playerStats(chat, num(target.jid))
    if (!s) return say(chat, `${tag(target.jid)} n’a pas encore terminé de partie ici.`, [target.jid])
    const pct = Math.round((100 * s.wins) / s.games)
    const titles = titlesOf(s).map((x) => x.name)
    const next = nextChallenge(s)
    const text =
      `📈 *Stats de ${tag(target.jid)}* — « ${nicknameOf(s)} »\n\n🎮 Parties : ${s.games}\n🏆 Victoires : ${s.wins} (${pct} %)\n⭐ Points : ${s.points}` +
      (s.rank ? `\n🏅 Classement : ${ordinal(s.rank)} sur ${s.players}` : '') +
      `\n🥷 Comme imposteur : ${count(s.asImposter, 'partie')}, ${count(s.impWins, 'victoire')}\n🕵️ Comme civil : ${count(s.civGames, 'partie')}, ${count(s.civWins, 'victoire')}` +
      `\n🔥 Série en cours : ${count(s.streak, 'victoire')} • meilleure série : ${s.bestStreak}` +
      `\n🏅 Titres : ${titles.length ? titles.join(', ') : 'aucun pour l’instant'}` +
      (next ? `\n🎯 Prochain défi : ${next.name} (${next.value}/${next.goal} ${next.unit})` : '')
    // Carte de profil en image ; la légende mentionne le joueur. Texte complet si l’image est impossible.
    await sayVisual(chat, {
      svg: () => profileSvg(s, s.name || `+${num(target.jid)}`),
      caption: `📈 *Profil de ${tag(target.jid)}*`,
      fallback: text,
      mentions: [target.jid],
    })
  },
}
