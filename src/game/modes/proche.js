// Mode « proche » : l’imposteur reçoit un mot VOISIN (ex. « koki » au lieu de « ndolé »)
// et ne sait pas qu’il est l’imposteur ! Il doit s’en rendre compte grâce aux indices des autres.
import { plainCategory } from '../../core/utils.js'

export default {
  id: 'proche',
  aliases: ['proche', 'undercover'],
  label: '🎭 Mot proche : l’imposteur reçoit un mot voisin… et ne sait pas qu’il est l’imposteur !',
  // Ligne ajoutée à l’aide (/imposteur aide) ; {P} est remplacé par le préfixe
  helpLine: '🎭 *Variante* : *{P}imposteur proche* → l’imposteur reçoit un mot *voisin* (ex. koki au lieu de ndolé) et ne sait pas qu’il est l’imposteur !',

  secretLabel: 'mot secret',
  secretPlural: 'mots secrets',
  guessWordLabel: 'des civils', // « devine le mot des civils »

  secretFor: (g, p) => (g.imposters.includes(p) ? g.closeWord : g.word),

  card(g, isImposter) {
    return {
      title: 'TON MOT SECRET',
      color: '#f0b429',
      category: plainCategory(g.category),
      big: isImposter ? g.closeWord : g.word,
      lines: ['Donne un indice en un seul mot.', 'Un joueur a un mot différent : reste discret.'],
    }
  },

  roleText(g, isImposter) {
    return (
      `🎭 *Mode MOT PROCHE*\n\nCatégorie : ${g.category}\nTon mot secret : *${isImposter ? g.closeWord : g.word}*\n\n` +
      `Donne des indices en *un seul mot*, sans dire ton mot.\n` +
      `⚠️ Un joueur a reçu un mot *proche mais différent* et ne le sait pas ! Écoute bien les indices des autres : ` +
      `si tu penses être l’intrus, fais-toi discret… et essaie de deviner le mot des autres.`
    )
  },

  reveal: (g) => `🔑 Mot des civils : *${g.word}* (${g.category})\n🎭 Mot de l’imposteur : *${g.closeWord}*`,
}
