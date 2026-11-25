// Registre des modes de jeu.
//
// Pour ajouter un mode : crée un fichier dans ce dossier (copie classique.js comme modèle), puis ajoute-le
// à la liste MODES ci-dessous. Il devient aussitôt disponible via « /imposteur <alias> » et « /imposteur mode <alias> ».
//
// Un mode fournit :
//   id, aliases[], label            identification et texte affiché
//   secretLabel, secretPlural       « rôle » / « mot secret » dans les messages de distribution
//   guessWordLabel                  « secret » / « des civils » dans « devine le mot … »
//   secretFor(g, p)                 mot connu du joueur p (ou null) — interdit de le dire en indice
//   card(g, isImposter)             carte image envoyée en privé
//   roleText(g, isImposter)         version texte du rôle
//   reveal(g)                       révélation des mots en fin de partie
//   helpLine (optionnel)            ligne ajoutée à l’aide
import classique from './classique.js'
import proche from './proche.js'

const MODES = [classique, proche]

export const DEFAULT_MODE = classique.id

const byId = new Map(MODES.map((m) => [m.id, m]))
const byAlias = new Map(MODES.flatMap((m) => m.aliases.map((a) => [a, m])))

export const getMode = (id) => byId.get(id)
export const listModes = () => MODES

// « proche » / « undercover » → mode correspondant (undefined si l’alias est inconnu)
export const resolveMode = (alias) => byAlias.get(alias)

// « *!imposteur mode classique* ou *!imposteur mode proche* »
export const modeUsage = (prefix) => MODES.map((m) => `*${prefix}imposteur mode ${m.id}*`).join(' ou ')
