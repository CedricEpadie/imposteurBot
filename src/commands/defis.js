// /defis : les trois défis de la semaine du groupe (bronze, argent, or), ta progression et ceux qui les ont déjà relevés.
import { say } from '../whatsapp/messenger.js'
import { config } from '../config.js'
import { num, tag } from '../core/utils.js'
import { groupStats, weekKey, weekLabel, weekWindow } from '../storage/scores.js'
import { weekChallenges } from '../game/challenges.js'

export default {
  name: 'defis',
  aliases: ['défis', 'defi', 'défi'],
  shortcut: true,
  async run({ chat, me }) {
    const P = config.prefix
    const key = weekKey()
    const stats = groupStats(chat, weekWindow(key))
    const mine = stats.get(num(me.jid))
    const mentions = [me.jid]
    const list = weekChallenges(chat, key).map((c) => {
      const done = [...stats.values()].filter((s) => (c.of(s) || 0) >= c.goal)
      const value = Math.min(c.goal, mine ? c.of(mine) || 0 : 0)
      const who = done.map((s) => {
        mentions.push(s.jid)
        return tag(s.jid)
      })
      return `${c.tier.icon} *${c.tier.label}* — ${c.text}\n   ${tag(me.jid)} : ${value}/${c.goal}${value >= c.goal ? ' ✅' : ''}${who.length ? `\n   🎯 Relevé par : ${who.join(', ')}` : ''}`
    })
    await say(chat, `🎯 *Défis de la semaine* (${weekLabel(key)})\n\n${list.join('\n\n')}\n\nRelever un défi ne rapporte pas de points : c’est la gloire (et le titre *Chasseur de défis*) !\n${P}stats : ta carte • ${P}top : le classement`, [...new Set(mentions)])
  },
}
