// Phase 1 · Salle d’attente : ouverture, inscriptions, choix du format, lancement.
import { config } from '../../config.js'
import { say } from '../../whatsapp/messenger.js'
import { tag } from '../../core/utils.js'
import { createGame, getGame } from '../store.js'
import { phaseTimer, stopTimers, endGame } from '../lifecycle.js'
import { persistGame } from '../persistence.js'
import { findPlayer, hasId, toPlayer, jidsOf, listOf } from '../players.js'
import { header } from '../phases-meta.js'
import { getMode, modeUsage } from '../modes/index.js'
import { setupGame } from '../round.js'
import { activePackIds } from '../words.js'
import { distributeRoles } from './distribution.js'
import { count, pl, impostersRule } from '../wording.js'
import { host } from '../voice.js'

const P = config.prefix
const { minPlayers, maxPlayers, lobbySeconds } = config.game
const { rounds } = config

export const FORMATS = {
  single: '1️⃣ Un seul imposteur : un seul vote, et la partie est jouée',
  rounds: `2️⃣ Plusieurs manches : le groupe élimine un suspect par manche jusqu’à ${rounds.stopAt} joueurs restants (${impostersRule()})`,
}

export const formatQuestion = (g) =>
  `🎯 *Format de la partie* — le lanceur répond par un chiffre :\n${FORMATS.single}\n${FORMATS.rounds}\n\nFormat choisi : *${g.format === 'rounds' ? 2 : 1}*`

// Arme la minuterie de départ automatique (aussi utilisée à la reprise après un redémarrage)
export const armLobby = (g, seconds) =>
  phaseTimer(g, seconds, () => beginGame(g.key), {
    marks: [60, 30, 10],
    tick: (m) =>
      say(
        g.key,
        `⏳ Départ dans *${m} s* — ${g.players.length}/${maxPlayers} joueurs (minimum ${minPlayers}).\n👥 ${listOf(g)}\n➡️ Rejoindre : *${P}imposteur join*`,
        jidsOf(g)
      ),
  })

// Ouvre une partie dans le groupe `key`
export const openLobby = async (key, me, modeId) => {
  const mode = getMode(modeId)
  const g = createGame({ key, mode: mode.id, starter: toPlayer(me) })
  armLobby(g, lobbySeconds)
  const packs = activePackIds(key)
  await say(
    key,
    `${header('lobby')}🕵️ *L’IMPOSTEUR*\n${host('open')}\n\nUn mot secret est donné à tous les joueurs… sauf à l’imposteur (ou aux imposteurs : ${impostersRule()}, en format 2) !\n\n` +
      `🎮 Mode : ${mode.label}\n(changer : ${modeUsage(P)})\n` +
      `📦 Mots : ${packs.length ? packs.join(', ') : 'tous les packs'} (changer : *${P}imposteur packs*)\n\n` +
      `👥 Joueurs (1/${maxPlayers}) : ${tag(me.jid)}\n` +
      `➡️ Rejoindre : *${P}imposteur join*\n` +
      `▶️ Lancer : *${P}imposteur go* (lanceur), sinon départ automatique dans *${lobbySeconds} s* (${minPlayers} joueurs minimum)\n` +
      `📖 Règles : *${P}imposteur aide*`,
    [me.jid]
  )
  return say(key, formatQuestion(g), [me.jid])
}

// Le lanceur répond « 1 » ou « 2 » pendant la salle d’attente (ou tape la commande format)
export const setFormat = async (g, format) => {
  if (g.format === format) return say(g.key, `✅ Format déjà choisi : *${format === 'rounds' ? 2 : 1}*`)
  g.format = format
  persistGame(g)
  return say(
    g.key,
    format === 'rounds'
      ? `✅ Format *2* : plusieurs manches.\nLe groupe élimine un suspect par manche jusqu’à ${rounds.stopAt} joueurs restants (minimum ${rounds.minPlayers} joueurs ; ${impostersRule()}).`
      : `✅ Format *1* : un seul imposteur, un seul vote.`
  )
}

export const onLobbyText = async (g, { me, text }) => {
  if (!hasId(g.starter, me.ids)) return
  const t = text.trim()
  if (t === '1') return setFormat(g, 'single')
  if (t === '2') return setFormat(g, 'rounds')
}

// Un joueur rejoint la salle d’attente `g`
export const joinLobby = async (g, me) => {
  const key = g.key
  if (g.phase !== 'lobby') return say(key, 'La partie a déjà commencé, rendez-vous à la prochaine ! 😉')
  if (findPlayer(g, me.ids)) return say(key, 'Tu es déjà dans la partie 😉')
  if (g.players.length >= maxPlayers) return say(key, `La partie est complète (${maxPlayers} joueurs max).`)
  g.players.push(toPlayer(me))
  persistGame(g)
  const missing = minPlayers - g.players.length
  await say(
    key,
    `✅ ${tag(me.jid)} rejoint la partie ! (${g.players.length}/${maxPlayers})\n👥 ${listOf(g)}\n` +
      (missing > 0 ? `⏳ Il manque encore *${missing}* ${pl(missing, 'joueur')} pour démarrer.` : `✅ Assez de joueurs ! Le lanceur peut taper *${P}imposteur go*.`),
    jidsOf(g)
  )
  if (g.players.length >= maxPlayers) {
    await say(key, `🚪 Salle complète : on démarre tout de suite !`)
    beginGame(key).catch((e) => console.error('[imposteur]', e))
  }
}

// Sort de la salle d’attente : vérifie le nombre de joueurs, prépare la partie, distribue les rôles.
// `manual` = lancé par le lanceur (sinon : fin du délai ou salle pleine).
export const beginGame = async (key, manual = false) => {
  const g = getGame(key)
  if (!g || g.phase !== 'lobby') return

  if (g.players.length < minPlayers) {
    if (manual) {
      return say(key, `⛔ Il manque encore *${minPlayers - g.players.length}* ${pl(minPlayers - g.players.length, 'joueur')} (${g.players.length}/${minPlayers} minimum).`)
    }
    endGame(g)
    return say(key, `😕 Pas assez de joueurs (${g.players.length}/${minPlayers} minimum). Partie annulée.`)
  }

  stopTimers(g)
  if (g.format === 'rounds' && g.players.length < rounds.minPlayers) {
    g.format = 'single'
    await say(key, `ℹ️ Il faut au moins ${rounds.minPlayers} joueurs pour jouer en plusieurs manches : on joue en *un seul vote*.`)
  }
  g.phase = 'dm'
  setupGame(g)
  return distributeRoles(key, g)
}
