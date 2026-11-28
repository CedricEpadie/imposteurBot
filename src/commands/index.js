// Registre des commandes.
//
// Pour ajouter une commande : crée un fichier dans ce dossier (copie go.js ou top.js comme modèle),
// importe-le et ajoute-le à la liste COMMANDS ci-dessous.
//
// Une commande est un objet :
//   name         nom de la sous-commande : « /imposteur <name> »
//   aliases[]    autres noms acceptés après « /imposteur » (optionnel)
//   shortcut     true → aussi disponible en raccourci « /<name> » (optionnel)
//   groupOnly    false → utilisable aussi en privé avec le bot (défaut : true, groupe uniquement)
//   run(ctx)     ctx = { chat, isGroup, me, word, rest, raw, mentioned, game, isStarter }
//                  chat/me : où et qui • word : sous-commande tapée • rest : arguments (en minuscules) • raw : arguments tels que tapés
//                  mentioned : jids @mentionnés • me.fromMe / isAdmin(me) : voir core/admin.js
//                  game : partie du groupe (ou undefined) • isStarter : l’auteur a lancé la partie
import open from './open.js'
import join from './join.js'
import go from './go.js'
import vote from './vote.js'
import stop from './stop.js'
import mode from './mode.js'
import status from './status.js'
import top from './top.js'
import help from './help.js'
import role from './role.js'
import test from './test.js'
import stats from './stats.js'
import defis from './defis.js'
import format from './format.js'
import packs from './packs.js'
import addWords from './add-words.js'
import reset from './reset.js'
import backup from './backup.js'

// `open` n’est pas dans la liste : c’est la commande par défaut (voir router.js)
const COMMANDS = [role, test, help, status, top, stats, defis, mode, format, packs, addWords, reset, backup, join, go, vote, stop]

export const openCommand = open

// « /imposteur <word> » → commande (nom ou alias)
export const bySubcommand = new Map(COMMANDS.flatMap((c) => [c.name, ...(c.aliases || [])].map((w) => [w, c])))

// « /<word> » → commande (nom seulement, et seulement si elle déclare un raccourci)
export const byShortcut = new Map(COMMANDS.filter((c) => c.shortcut).map((c) => [c.name, c]))
