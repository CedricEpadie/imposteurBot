// /imposteur top : classement de la session et classement général du groupe
import { say } from '../whatsapp/messenger.js'
import { sayVisual } from '../render/svg.js'
import { rankingSvg } from '../render/ranking.js'
import { config } from '../config.js'
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
    const text =
      `🏆 *Classement de l’imposteur*\n\n` +
      (session.length ? `📊 *Session en cours*\n${lines(session).join('\n')}\n\n` : '') +
      `🌍 *Général*\n${lines(overall).join('\n')}`
    // Podium en image (général + session) ; texte complet avec @mentions si l’image est impossible
    await sayVisual(chat, {
      svg: () => rankingSvg(overall, session),
      caption: `🏆 *Classement du groupe* • ${config.prefix}imposteur stats : ton profil • ${config.prefix}imposteur : rejouer`,
      fallback: text,
      fallbackMentions: [...new Set([...session, ...overall].map((r) => r.jid))],
    })
  },
}
