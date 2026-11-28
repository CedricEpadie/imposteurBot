// Analyse un message commençant par le préfixe et l’aiguille vers la bonne commande.
import { config } from '../config.js'
import { say } from '../whatsapp/messenger.js'
import { checkCooldown } from '../core/cooldown.js'
import { isAdmin } from '../core/admin.js'
import { num, tag } from '../core/utils.js'
import { getGame } from '../game/store.js'
import { hasId } from '../game/players.js'
import { resolveMode } from '../game/modes/index.js'
import { openCommand, bySubcommand, byShortcut } from './index.js'

const P = config.prefix

export const handleCommand = async (chat, isGroup, me, text, mentioned = []) => {
  const body = text.slice(P.length).trim()
  const [cmdRaw, ...args] = body.split(/\s+/)
  const cmd = (cmdRaw || '').toLowerCase()

  // « /imposteur <word> ... » ou raccourci « /<word> ... »
  let word
  let rest
  let raw // arguments tels que tapés (casse conservée)
  let command
  if (cmd === 'imposteur') {
    word = (args[0] || '').toLowerCase()
    rest = args.slice(1).map((a) => a.toLowerCase())
    raw = body.replace(/^\S+\s*\S*\s*/, '')
    command = bySubcommand.get(word)
  } else if (byShortcut.has(cmd)) {
    word = cmd
    rest = args.map((a) => a.toLowerCase())
    raw = body.replace(/^\S+\s*/, '')
    command = byShortcut.get(cmd)
  } else {
    return // commande inconnue : ignorée
  }

  const key = chat
  const game = getGame(key)
  const ctx = { chat, isGroup, me, word, rest, raw, mentioned, game, isStarter: !!game && hasId(game.starter, me.ids) }

  // Anti-spam : un délai par joueur et par commande pour celles qui fabriquent une image (admins dispensés)
  const cooldown = command && config.cooldowns[command.name]
  if (cooldown && !isAdmin(me)) {
    const c = checkCooldown(`${chat}|${num(me.jid)}|${command.name}`, cooldown)
    if (!c.ok) return c.warn ? say(chat, `⏳ ${tag(me.jid)}, doucement : *${P}${command.name}* sera de nouveau disponible dans ${c.wait} s.`, [me.jid]) : undefined
  }

  if (command && command.groupOnly === false) return command.run(ctx) // utilisable aussi en privé

  if (!isGroup) {
    return say(chat, `🕵️ Ce jeu se joue dans un groupe. Ici, tape *${P}imposteur mot* pour retrouver ton rôle.`)
  }

  if (command) return command.run(ctx)

  // Pas de sous-commande, ou un nom de mode : ouverture d’une partie
  if (!word || resolveMode(word)) return openCommand.run(ctx)

  return say(chat, `Commande inconnue. Tape *${P}imposteur aide* pour les règles et les commandes.`)
}
