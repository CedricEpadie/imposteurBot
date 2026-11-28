// /imposteur aide : règles et commandes
import { config } from '../config.js'
import { sayVisual } from '../render/svg.js'
import { rulesSvg, rulesCaption } from '../render/rules.js'
import { listModes } from '../game/modes/index.js'
import { impostersRule } from '../game/wording.js'

const P = config.prefix
const { minPlayers, maxPlayers, clueRounds } = config.game

export default {
  name: 'aide',
  aliases: ['help'],
  shortcut: true,
  async run({ chat }) {
    const variants = listModes()
      .filter((m) => m.helpLine)
      .map((m) => m.helpLine.replaceAll('{P}', P) + '\n')
      .join('')
    const text =
      `🕵️ *L’IMPOSTEUR*\n\n` +
        `1️⃣ *${P}imposteur* ouvre une partie, les autres tapent *${P}imposteur join* (${minPlayers} à ${maxPlayers} joueurs).\n` +
        `2️⃣ Chacun reçoit *en privé* une carte (à ouvrir une seule fois) avec la catégorie et le mot secret… sauf l’imposteur (ou les imposteurs), qui ne connaît que la catégorie.\n` +
        variants +
        `3️⃣ ${clueRounds} tours : chacun son tour donne un indice en *un seul mot* (pas de phrase), sans dire son mot ni répéter l’indice d’un autre. ⚠️ Aucun indice donné aux ${clueRounds} tours : *éjecté* (imposteur : les civils gagnent ; civil : la partie continue).\n` +
        `4️⃣ Débat libre (avec le tableau des indices), puis vote : mentionnez (@) votre suspect.\n` +
        `5️⃣ Un imposteur démasqué peut encore gagner en devinant le mot !\n` +
        `🔁 Le lanceur peut choisir le format *2* : plusieurs manches, un joueur éliminé à chaque vote jusqu’à ${config.rounds.stopAt} joueurs (${impostersRule()}).\n` +
        `⭐ Points : vote juste +${config.scoring.rightVote} • victoire des civils +${config.scoring.civilsWin} • imposteur gagnant +${config.scoring.imposterWin} • mot deviné +${config.scoring.imposterGuess}\n\n` +
        `📩 Rôle non reçu ? *${P}imposteur mot* en privé au bot.\n` +
        `📊 *${P}imposteur etat* : où en est la partie\n` +
        `🏆 *${P}top* : classement de la semaine (*${P}top global* : depuis le début) • *${P}stats* : tes statistiques de la semaine (*${P}stats global*) • *${P}defis* : défis de la semaine\n` +
        `📦 *${P}imposteur packs* : packs de mots (foot, musique, Yaoundé, Douala…)\n` +
        `🔧 Admin : *${P}imposteur ajouter* (mots) • *${P}imposteur reset* (effacer les scores)`
    // Carte en image + commandes en légende ; texte complet si l’image est impossible
    await sayVisual(chat, { svg: rulesSvg, caption: rulesCaption(), fallback: text })
  },
}
