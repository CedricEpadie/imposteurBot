// La voix du bot : un présentateur de jeu télé. Chaque moment de la partie a une liste de phrases ; une est tirée au hasard
// (jamais la même deux fois de suite), avec un ton qui change selon le moment : suspense avant le dépouillement, ironie quand
// l'imposteur est démasqué, fausse compassion quand un civil est accusé à tort…
//
// Pour ajouter ou changer une phrase, modifie simplement les listes ci-dessous. Une entrée peut être un texte ou une fonction
// (arguments selon le moment, voir les appels). `host(moment, ...args)` renvoie la ligne prête à insérer, préfixée de 🎙️.
import crypto from 'node:crypto'

// Tirage PROPRE à la voix (cryptographique) : le choix d'une phrase ne touche jamais à l'aléa du jeu (rôles, mots, ordre de passage)
const randInt = (n) => crypto.randomInt(n)
const rand = () => crypto.randomInt(1_000_000) / 1_000_000

const lastIdx = new Map()

export const VOICE = {
  // Ouverture de la salle d'attente
  open: [
    'Mesdames et messieurs, bienvenue dans l’émission où personne ne dit la vérité !',
    'Les caméras tournent, les micros sont ouverts, il manque juste des joueurs !',
    'Ce soir, ça va mentir. Ça tombe bien, c’est le but du jeu.',
    'Installez-vous, le jeu le plus menteur de WhatsApp commence !',
    'Qui sera le bluffeur de la soirée ? Réponse dans quelques minutes !',
    'Dans le doute, méfiez-vous de tout le monde. Surtout de votre meilleur ami.',
  ],
  // Début des indices
  cluesStart: [
    'Premier tour de piste : un mot, un seul, et ne vous trahissez pas !',
    'Les indices, c’est maintenant ! Soyez subtils… ou faites semblant de l’être.',
    'Un conseil : ni trop vague, ni trop précis. Voilà, bonne chance !',
    'Chacun son tour ! Les civils protègent le mot, les menteurs improvisent.',
    'On respire, on réfléchit, on ment (ou pas). C’est parti !',
  ],
  // Un indice vient d'être donné (affiché une fois sur quatre)
  clueReact: [
    'Hmm, intéressant…',
    'Voilà qui fait réfléchir !',
    'Les sourcils se lèvent dans la salle…',
    'Joli ! Ou très suspect. Peut-être les deux.',
    'Je note, je note…',
    'Ça sent le civil. Ou le bluffeur très doué.',
  ],
  // Temps écoulé : le joueur n'a rien dit
  clueTimeout: [
    'Le silence est d’or, mais ici il est surtout suspect !',
    'On entend les grillons…',
    'Un joueur qui ne dit rien cache peut-être quelque chose !',
    'Trop tard ! Le chronomètre n’attend personne.',
  ],
  // Ouverture du débat
  discuss: [
    'Le débat est ouvert ! Accusez, défendez-vous, mentez avec élégance.',
    'À vos arguments ! Quelqu’un parmi vous a quelque chose à cacher…',
    'Le tableau est affiché, tous les regards se tournent vers… vous !',
    'Place au grand déballage : qui trouve un indice louche ?',
  ],
  // Ouverture du vote
  voteStart: [
    'L’heure du choix a sonné. Pas de pression, mais la réputation de vos amis est en jeu !',
    'Le moment de vérité : désignez votre suspect !',
    'Votez avec le cœur… ou plutôt avec la tête, c’est mieux !',
    'À vous de jouer : un @ et le sort est scellé !',
  ],
  // Vote clos, avant le dépouillement : suspense
  counting: [
    '🥁 Les bulletins sont dans l’urne… Dépouillement en cours, retenez votre souffle !',
    '🥁 Je vais ouvrir l’enveloppe… Dépouillement en cours, le suspense est à son comble !',
    '🥁 Ne bougez plus, personne ne respire : dépouillement en cours…',
    '🥁 Le moment que vous attendiez tous : dépouillement en cours, les cœurs s’accélèrent !',
    '🥁 Est-ce que le groupe a flairé le menteur ? Dépouillement en cours, réponse dans un instant…',
  ],
  // L'imposteur est démasqué (arg : nom du joueur)
  unmasked: [
    (n) => `Eh bien ${n}, on dirait que votre petit numéro s’arrête ici !`,
    (n) => `Applaudissons ${n} pour sa performance… d’acteur raté !`,
    (n) => `${n}, vous aviez l’air si sincère pourtant…`,
    (n) => `Démasqué ! ${n} peut ranger son déguisement.`,
    (n) => `Le rideau tombe pour ${n}. Vous nous laissez un dernier mot ?`,
  ],
  // Un civil a été accusé à tort (arg : nom)
  wrongAccuse: [
    (n) => `Toutes mes condoléances à ${n} : innocent, mais condamné !`,
    (n) => `${n} n’avait rien fait. Le groupe, lui, devrait avoir des remords !`,
    (n) => `Erreur judiciaire ! ${n} réclame un avocat.`,
    (n) => `Pauvre ${n}… Le vrai coupable doit bien rire en ce moment.`,
  ],
  // Égalité des votes
  tie: [
    'Égalité parfaite ! Le groupe n’arrive pas à se décider, et un sourire discret se dessine quelque part…',
    'Match nul au tribunal : personne n’est condamné, un sourire discret se dessine quelque part…',
    'Coupés en deux, comme d’habitude ! Résultat : rien.',
  ],
  // Personne n'a voté
  noVote: [
    'Plus personne n’ose rien ? Soit vous êtes très sages, soit très peureux.',
    'Le courage, ça ne s’achète pas ! Personne n’a voté.',
  ],
  // Dernière chance de l'imposteur : il tente un mot
  guessTry: [
    'Le public retient son souffle…',
    'Ça passe ou ça casse !',
    'Tout se joue sur un mot…',
  ],
  guessHit: [
    'INCROYABLE ! Il a trouvé ! Les civils sont sous le choc !',
    'Quel talent ! Le mot est trouvé, la salle n’en revient pas !',
  ],
  guessMiss: [
    'Raté ! Les civils peuvent respirer.',
    'Et c’est… non ! Quelle déception pour le tricheur !',
    'Pas du tout ! Retour à la case perdant.',
  ],
  // Victoire des civils
  civilsWin: [
    'Bravo les détectives, le bluff n’avait aucune chance face à votre flair !',
    'Justice est faite ! Les civils repartent la tête haute.',
    'Les civils gagnent, et ça se fête !',
    'Le bluff n’aura pas suffi : bien joué à tous les civils !',
  ],
  // Victoire des imposteurs
  imposterWin: [
    'Chapeau les artistes ! Vous avez tous été bernés, sans que personne ne sourcille.',
    'Le mensonge paie, ce soir en tout cas !',
    'Vous n’avez rien vu venir : quelle prestation !',
    'Les civils se regardent, perplexes… Les menteurs, eux, savourent !',
  ],
  // Joueur éjecté pour n'avoir donné aucun de ses indices
  ejectedCivil: ['Qui ne dit mot ne reste pas : le micro lui est coupé !', 'Les règles sont les règles : direction la sortie !', 'On ne peut pas jouer en silence, désolé !'],
  ejectedLiar: ['Il croyait se cacher dans le silence… ça ne marche pas ici !', 'Le silence l’a trahi : quel dommage pour le tricheur !', 'Pas un mot, pas de bluff, pas de chance !'],

  // Un joueur est éliminé (manches multiples), civil ou imposteur
  eliminatedCivil: ['Oups… mauvaise pioche !', 'Ça fait mal, une erreur de ce genre.', 'Le vrai menteur a dû sourire en coin…'],
  eliminatedImposter: ['Un menteur de moins !', 'Joli coup de filet !', 'Bien joué, le groupe flaire la bonne piste !'],
}

// Choisit une phrase du moment `moment` (jamais la même deux fois de suite)
export const phrase = (moment, ...args) => {
  const pool = VOICE[moment]
  if (!pool?.length) return ''
  let i = randInt(pool.length)
  if (pool.length > 1 && i === lastIdx.get(moment)) i = (i + 1 + randInt(pool.length - 1)) % pool.length
  lastIdx.set(moment, i)
  const p = pool[i]
  return typeof p === 'function' ? p(...args) : p
}

// Ligne de présentateur prête à insérer dans un message (🎙️ + phrase)
export const host = (moment, ...args) => `🎙️ _${phrase(moment, ...args)}_`

// Parfois seulement (probabilité p) : '' sinon
export const sometimes = (p, moment, ...args) => (rand() < p ? `\n${host(moment, ...args)}` : '')
