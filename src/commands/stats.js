// /stats [@joueur] : carte de profil de la SEMAINE en cours ; « /stats global [@joueur] » : depuis le début (image + texte de secours).
import { count } from '../game/wording.js'
import { num, tag } from '../core/utils.js'
import { playerStats, weekKey, weekLabel } from '../storage/scores.js'
import { say } from '../whatsapp/messenger.js'
import { sayVisual } from '../render/svg.js'
import { profileSvg, ordinal } from '../render/profile.js'
import { titlesOf, styleOf, nextChallenge } from '../game/titles.js'
import { weekChallenges, progressOf } from '../game/challenges.js'
import { config } from '../config.js'
import { GLOBAL_WORDS } from './top.js'

export default {
  name: 'stats',
  aliases: ['stat', 'profil'],
  shortcut: true,
  async run({ chat, me, mentioned, rest }) {
    const P = config.prefix
    const global = rest.some((w) => GLOBAL_WORDS.includes(w))
    const target = mentioned[0] ? { jid: mentioned[0] } : me
    const n = num(target.jid)
    const career = playerStats(chat, n)
    if (!career) return say(chat, `${tag(target.jid)} n’a pas encore terminé de partie ici.`, [target.jid])
    const key = weekKey()
    const label = weekLabel(key)
    const s = global ? career : playerStats(chat, n, { period: 'week', week: key })
    if (!s) return say(chat, `${tag(target.jid)} n’a pas encore joué cette semaine (${label}).\n📈 Stats depuis le début : *${P}stats global*`, [target.jid])

    const style = styleOf(career)
    const challenges = global ? [] : weekChallenges(chat, key).map((c) => ({ level: c.level, tier: c.tier, text: c.text, goal: c.goal, value: progressOf(c, s) }))
    const pct = Math.round((100 * s.wins) / s.games)
    const titles = titlesOf(career).map((x) => x.name)
    const next = nextChallenge(career)
    const text =
      `📈 *Stats de ${tag(target.jid)}* — ${global ? 'depuis le début' : `semaine ${label}`}\n« ${style.nickname} » (${style.why})\n\n🎮 Parties : ${s.games}\n🏆 Victoires : ${s.wins} (${pct} %)\n⭐ Points : ${s.points}` +
      (s.rank ? `\n🏅 Classement : ${ordinal(s.rank)} sur ${s.players}` : '') +
      `\n🥷 Comme imposteur : ${count(s.asImposter, 'partie')}, ${count(s.impWins, 'victoire')}\n🕵️ Comme civil : ${count(s.civGames, 'partie')}, ${count(s.civWins, 'victoire')}` +
      `\n🔥 Série en cours : ${count(s.streak, 'victoire')} • record : ${s.bestStreak}` +
      `\n📅 Jours de suite : ${career.dayStreak} (record ${career.bestDayStreak}) • semaines de suite : ${career.weekStreak} (record ${career.bestWeekStreak})` +
      (challenges.length ? `\n\n🎯 *Défis de la semaine*\n${challenges.map((c) => `${c.tier.icon} ${c.text} : ${c.value}/${c.goal}${c.value >= c.goal ? ' ✅' : ''}`).join('\n')}` : '') +
      `\n\n🏅 Titres : ${titles.length ? titles.join(', ') : 'aucun pour l’instant'}` +
      (next ? `\n🎯 Prochain titre : ${next.name} (${next.value}/${next.goal} ${next.unit})` : '') +
      `\n\n${global ? `${P}stats : la semaine en cours` : `${P}stats global : depuis le début`}`
    // Carte de profil en image ; la légende mentionne le joueur. Texte complet si l’image est impossible.
    await sayVisual(chat, {
      svg: () => profileSvg(s, s.name || career.name || `+${n}`, { career, period: global ? 'global' : 'week', label, challenges }),
      caption: `📈 *Profil de ${tag(target.jid)}* — ${global ? 'depuis le début' : 'cette semaine'}\n${global ? `${P}stats : la semaine en cours` : `${P}stats global : depuis le début`}`,
      fallback: text,
      mentions: [target.jid],
    })
  },
}
