// /imposteur top : classement de la session et classement général du groupe
import { say } from '../whatsapp/messenger.js'
import { count } from '../game/wording.js'
import { tag } from '../core/utils.js'
import { sessionRanking, overallRanking } from '../storage/scores.js'

const MEDALS = ['🥇', '🥈', '🥉']
const lines = (rows) =>
  rows.map((r, i) => `${MEDALS[i] || '▫️'} ${tag(r.jid)} — ${count(r.points, 'pt')} • ${count(r.wins, 'victoire')} / ${count(r.games, 'partie')}`)

export default {
  name: 'top',
  shortcut: true,
  async run({ chat }) {
    const session = sessionRanking(chat, 5)
    const overall = overallRanking(chat, 10)
    if (!overall.length) return say(chat, 'Aucun point pour l’instant. Lancez une partie ! 🕵️')
    return say(
      chat,
      `🏆 *Classement de l’imposteur*\n\n` +
        (session.length ? `📊 *Session en cours*\n${lines(session).join('\n')}\n\n` : '') +
        `🌍 *Général*\n${lines(overall).join('\n')}`,
      [...new Set([...session, ...overall].map((r) => r.jid))]
    )
  },
}
