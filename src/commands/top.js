// /imposteur top : classement de la SAISON (le mois en cours) et de la session ; « top general » : classement de tous les temps
import { say } from '../whatsapp/messenger.js'
import { sayVisual } from '../render/svg.js'
import { rankingSvg } from '../render/ranking.js'
import { config } from '../config.js'
import { count } from '../game/wording.js'
import { tag } from '../core/utils.js'
import { overallRanking, seasonRanking, seasonKey, seasonLabel } from '../storage/scores.js'

const MEDALS = ['🥇', '🥈', '🥉']
const lines = (rows) =>
  rows.map((r, i) => `${MEDALS[i] || '▫️'} ${tag(r.jid)} — ${count(r.points, 'pt')} • ${count(r.wins, 'victoire')} / ${count(r.games, 'partie')}`)

export default {
  name: 'top',
  shortcut: true,
  async run({ chat, rest }) {
    const P = config.prefix
    const general = ['general', 'général', 'tout', 'all'].includes(rest[0])
    const key = seasonKey()
    const label = seasonLabel(key)
    const rows = general ? overallRanking(chat, 10) : seasonRanking(chat, key, 10)

    if (!rows.length) {
      if (!general && overallRanking(chat, 1).length) {
        return say(chat, `🆕 *Saison de ${label}* : personne n’a encore marqué ce mois-ci. Lancez une partie ! 🕵️\n(classement de tous les temps : *${P}imposteur top general*)`)
      }
      return say(chat, 'Aucun point pour l’instant. Lancez une partie ! 🕵️')
    }
    const head = general ? '🌍 *Classement de tous les temps*' : `🏆 *Saison de ${label}*`
    const text = `${head}\n\n${lines(rows).join('\n')}`
    // Podium en image (saison ou général) ; texte complet avec @mentions si l’image est impossible
    await sayVisual(chat, {
      svg: () =>
        rankingSvg(rows, general ? { title: 'CLASSEMENT GÉNÉRAL', subtitle: 'Tous les temps' } : { title: 'CLASSEMENT', subtitle: `Saison de ${label}` }),
      caption: `🏆 *Classement du groupe* — ${general ? 'tous les temps' : `saison de ${label}`}\n${P}imposteur top ${general ? '' : 'general : tous les temps • '}stats : ton profil • ${P}imposteur : rejouer`.replace('  ', ' '),
      fallback: text,
      fallbackMentions: rows.map((r) => r.jid),
    })
  },
}
