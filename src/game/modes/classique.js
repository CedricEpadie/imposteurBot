// Mode classique : tous les joueurs reçoivent la catégorie et le mot secret… sauf l’imposteur,
// qui ne connaît que la catégorie et doit bluffer.
import { plainCategory } from '../../core/utils.js'
import { multi, ie, theImp } from '../wording.js'

export default {
  id: 'classique',
  aliases: ['classique', 'classic'],
  label: '🥷 Classique : l’imposteur ne connaît pas le mot',
  labelPlural: '🥷 Classique : les imposteurs ne connaissent pas le mot',
  // Règle en texte brut pour la carte des règles (/imposteur aide)
  rule: null,

  // Vocabulaire utilisé dans les messages de distribution et de dernière chance
  secretLabel: 'rôle',
  secretPlural: 'rôles',
  guessWordLabel: 'secret', // « devine le mot secret »

  // Le mot que ce joueur connaît (null = aucun) : sert aussi à lui interdire de le dire en indice
  secretFor: (g, p) => (g.imposters.includes(p) ? null : g.word),

  // Carte image envoyée en privé
  card(g, isImposter) {
    const category = plainCategory(g.category)
    return isImposter
      ? {
          title: 'TU ES L’IMPOSTEUR',
          color: '#ff5d5d',
          category,
          big: 'Mot inconnu',
          lines: multi(g)
            ? [`Vous êtes ${g.imposters.length} imposteurs : bluffez !`, 'Le dernier démasqué peut deviner le mot.']
            : ['Bluffe : donne des indices crédibles.', 'Démasqué ? Devine le mot pour gagner !'],
        }
      : {
          title: 'TU ES CIVIL',
          color: '#3ddc84',
          category,
          big: g.word,
          lines: ['Donne un indice en un seul mot,', 'sans dire le mot secret.'],
        }
  },

  // Version texte (ROLE_DELIVERY=text)
  roleText(g, isImposter) {
    return isImposter
      ? `🥷 *Tu es l’IMPOSTEUR !*\n\nCatégorie : ${g.category}\n` +
          `Tu ne connais *pas* le mot secret. Bluffe : donne des indices crédibles pour passer pour un civil.\n` +
          ie(g, 'Si on te démasque, tu auras une dernière chance de deviner le mot !', 'Si tu es le dernier imposteur démasqué, tu auras une dernière chance de deviner le mot !') +
          (multi(g) ? `\n👥 Il y a *${g.imposters.length} imposteurs* dans la partie : vous ne savez pas qui sont les autres.` : '')
      : `🕵️ *Tu es CIVIL.*\n\nCatégorie : ${g.category}\nMot secret : *${g.word}*\n` +
          `Donne des indices en *un seul mot* (sans dire le mot !) pour te faire reconnaître des civils… ` +
          `sans trop aider ${theImp(g)} qui ${ie(g, 'se cache', 'se cachent')} parmi vous.`
  },

  // Révélation des mots en fin de partie
  reveal: (g) => `🔑 Mot secret : *${g.word}* (${g.category})`,
  // Même chose en texte brut, sous forme [libellé, valeur] (pour les images)
  revealPlain: (g) => [['Mot secret', g.word]],
}
