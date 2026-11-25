// /imposteur etat : phase en cours, temps restant, joueurs
import { config } from '../config.js'
import { say } from '../whatsapp/messenger.js'
import { sayVisual } from '../render/svg.js'
import { statusSvg } from '../render/statusCard.js'
import { tag } from '../core/utils.js'
import { alivePlayers, jidsOf, listOf } from '../game/players.js'
import { phaseName } from '../game/phases-meta.js'
import { getMode } from '../game/modes/index.js'
import { modeLabel } from '../game/wording.js'

const P = config.prefix
const { maxPlayers } = config.game

export default {
  name: 'etat',
  aliases: ['état', 'statut'],
  shortcut: true,
  async run({ chat, game: g }) {
    if (!g) return say(chat, `Aucune partie en cours. Lance-en une avec *${P}imposteur*.`)
    const left = g.deadline ? Math.max(0, Math.ceil((g.deadline - Date.now()) / 1000)) : null
    const text =
      `📊 *État de la partie*\n\n🧭 ${phaseName(g)}\n🎮 Mode : ${modeLabel(g, getMode(g.mode))}\n🎯 Format : ${g.format === 'rounds' ? 'plusieurs manches' : 'un seul vote'}\n` +
        `👥 Joueurs (${g.players.length}/${maxPlayers}) : ${listOf(g)}\n` +
        (g.eliminated.size ? `🚪 Éliminés : ${[...g.eliminated].map((p) => tag(p.jid)).join(', ')}\n` : '') +
        (left !== null ? `⏱️ Temps restant pour cette étape : *${left} s*\n` : '') +
        (g.phase === 'clues' && g.turns[g.turnIdx] ? `🗣️ À parler : ${tag(g.turns[g.turnIdx].jid)}\n` : '') +
        (g.phase === 'vote' ? `🗳️ Votes : ${g.votes.size}/${alivePlayers(g).length}\n` : '')
    // Carte d’état en image (sans mentionner tout le monde) ; texte complet si l’image est impossible
    await sayVisual(chat, { svg: () => statusSvg(g), caption: `📊 *État de la partie* — ${phaseName(g)}`, fallback: text, fallbackMentions: jidsOf(g) })
  },
}
