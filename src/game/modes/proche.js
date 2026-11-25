// Mode « proche » : l’imposteur reçoit un mot VOISIN (ex. « koki » au lieu de « ndolé »)
// et ne sait pas qu’il est l’imposteur ! Il doit s’en rendre compte grâce aux indices des autres.
import { plainCategory } from '../../core/utils.js'
import { multi, ie } from '../wording.js'

export default {
  id: 'proche',
  aliases: ['proche', 'undercover'],
  label: '🎭 Mot proche : l’imposteur reçoit un mot voisin… et ne sait pas qu’il est l’imposteur !',
  labelPlural: '🎭 Mot proche : les imposteurs reçoivent un mot voisin… et ne savent pas qu’ils sont imposteurs !',
  // Règle en texte brut pour la carte des règles
  rule: { title: 'Variante « proche »', text: 'Avec /imposteur proche, l’imposteur reçoit un mot voisin (koki au lieu de ndolé) et ne sait pas qu’il l’est.' },
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
      lines: ['Donne un indice en un seul mot.', multi(g) ? 'Certains joueurs ont un mot différent : reste discret.' : 'Un joueur a un mot différent : reste discret.'],
    }
  },

  roleText(g, isImposter) {
    return (
      `🎭 *Mode MOT PROCHE*\n\nCatégorie : ${g.category}\nTon mot secret : *${isImposter ? g.closeWord : g.word}*\n\n` +
      `Donne des indices en *un seul mot*, sans dire ton mot.\n` +
      `⚠️ ${multi(g) ? `${g.imposters.length} joueurs ont reçu un mot *proche mais différent* et ne le savent pas` : 'Un joueur a reçu un mot *proche mais différent* et ne le sait pas'} ! Écoute bien les indices des autres : ` +
      `si tu penses être ${ie(g, 'l’intrus', 'un intrus')}, fais-toi discret… et essaie de deviner le mot des autres.`
    )
  },

  reveal: (g) => `🔑 Mot des civils : *${g.word}* (${g.category})\n🎭 Mot ${ie(g, 'de l’imposteur', 'des imposteurs')} : *${g.closeWord}*`,
  revealPlain: (g) => [['Mot des civils', g.word], [`Mot ${ie(g, 'de l’imposteur', 'des imposteurs')}`, g.closeWord]],
}
