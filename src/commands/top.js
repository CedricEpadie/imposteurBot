// /top : classement de la SEMAINE en cours (le lundi, tout repart de zéro) ; « /top global » : classement depuis le début.
// L'image est envoyée avec les mentions de tout le groupe (invisibles : la légende ne contient aucun @).
import { say } from '../whatsapp/messenger.js'
import { groupMentions } from '../whatsapp/members.js'
import { sayVisual } from '../render/svg.js'
import { rankingSvg } from '../render/ranking.js'
import { activeTheme, greeting } from '../render/seasonal.js'
import { config } from '../config.js'
import { count } from '../game/wording.js'
import { tag } from '../core/utils.js'
import { overallRanking, weekRanking, weekKey, weekLabel } from '../storage/scores.js'

const MEDALS = ['🥇', '🥈', '🥉']
export const GLOBAL_WORDS = ['global', 'general', 'général', 'tout', 'all', 'total', 'depuis']
const lines = (rows) => rows.map((r, i) => `${MEDALS[i] || '▫️'} ${tag(r.jid)} — ${count(r.points, 'pt')} • ${count(r.wins, 'victoire')} / ${count(r.games, 'partie')}`)

export default {
  name: 'top',
  shortcut: true,
  async run({ chat, rest }) {
    const P = config.prefix
    const global = rest.some((w) => GLOBAL_WORDS.includes(w))
    const key = weekKey()
    const label = weekLabel(key)
    const rows = global ? overallRanking(chat, 10) : weekRanking(chat, key, 10)

    if (!rows.length) {
      if (!global && overallRanking(chat, 1).length) {
        return say(chat, `🆕 *Semaine ${label}* : personne n’a encore marqué cette semaine. Lancez une partie ! 🕵️\n(classement depuis le début : *${P}top global*)`)
      }
      return say(chat, 'Aucun point pour l’instant. Lancez une partie ! 🕵️')
    }
    const head = global ? '🌍 *Classement depuis le début*' : `🏆 *Classement de la semaine* (${label})`
    const theme = activeTheme()
    // Légende SANS @ visible, mais avec les mentions de tout le groupe : chacun reçoit la notification
    const everyone = await groupMentions(chat, rows.map((r) => r.jid))
    await sayVisual(chat, {
      svg: () => rankingSvg(rows, global ? { title: 'CLASSEMENT GÉNÉRAL', subtitle: 'Depuis le début' } : { title: 'CLASSEMENT DE LA SEMAINE', subtitle: label }),
      caption: `${theme ? `${greeting(theme)}\n` : ''}${head}\n${global ? `${P}top : la semaine en cours` : `${P}top global : depuis le début`} • ${P}stats : ton profil • ${P}imposteur : rejouer`,
      mentions: everyone,
      fallback: `${head}\n\n${lines(rows).join('\n')}`,
      fallbackMentions: rows.map((r) => r.jid),
    })
  },
}
