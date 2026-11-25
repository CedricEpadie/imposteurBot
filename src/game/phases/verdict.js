// Phase 6 · Verdict : résultat du vote (élimination, manche suivante ou fin), dernière chance de
// l’imposteur démasqué, fin de partie avec points et classement.
//
// NB : verdict.js ↔ clues.js s’importent mutuellement (la manche suivante relance les indices) ;
// c’est sans danger car chaque fonction n’est appelée qu’à l’exécution, jamais à l’import.
import { config } from '../../config.js'
import { say, typing } from '../../whatsapp/messenger.js'
import { tag, norm, sleep } from '../../core/utils.js'
import { getGame, isActive } from '../store.js'
import { phaseTimer, stopTimers, endGame } from '../lifecycle.js'
import { alivePlayers, aliveImposters, hasId, isImposter, jidsOf } from '../players.js'
import { header } from '../phases-meta.js'
import { getMode } from '../modes/index.js'
import { gameRecap } from '../recap.js'
import { setupManche } from '../round.js'
import { finalizeScores, gameLines } from '../scoring.js'
import { recordGame, sessionRanking } from '../../storage/scores.js'
import { askTurn } from './clues.js'

const P = config.prefix
const { guessSeconds } = config.game
const { rounds } = config

const MEDALS = ['🥇', '🥈', '🥉']
const plural = (g) => g.imposters.length > 1

// Résultat d’un vote : `accused` = joueur désigné (null = égalité ou aucun vote)
export const resolveVote = async (key, g, { accused, tie, ranking }) => {
  const multi = g.format === 'rounds'
  const extra = ranking.map(([p]) => p.jid)

  if (!accused) {
    const why = tie
      ? '⚖️ Égalité des votes : personne n’est démasqué.'
      : plural(g)
        ? '🐔 Personne n’a osé voter : les imposteurs passent entre les mailles du filet.'
        : '🐔 Personne n’a osé voter : l’imposteur passe entre les mailles du filet.'
    return multi ? nextManche(key, g, why) : conclude(key, 'imposteur', why, extra)
  }

  const wasImposter = isImposter(g, accused)

  if (!multi) {
    if (!wasImposter) return conclude(key, 'imposteur', `❌ Le groupe a accusé ${tag(accused.jid)}… mais c’était un civil !`, extra)
    g.guesser = accused
    return startGuess(key, g, accused)
  }

  // Plusieurs manches : le joueur désigné est éliminé, son rôle est révélé
  g.eliminated.add(accused)
  await say(key, `🚪 ${tag(accused.jid)} est éliminé… c’était ${wasImposter ? 'un *imposteur* 🥷' : 'un *civil* 😬'} !`, [accused.jid])
  if (!isActive(g)) return

  const impsLeft = aliveImposters(g)
  if (wasImposter && impsLeft.length === 0) {
    g.guesser = accused // dernier imposteur démasqué : dernière chance de deviner le mot
    return startGuess(key, g, accused)
  }
  const left = alivePlayers(g).length
  if (left <= rounds.stopAt) {
    return conclude(key, 'imposteur', `🔻 Il ne reste que *${left}* joueurs et ${impsLeft.length > 1 ? 'les imposteurs sont toujours là' : 'l’imposteur est toujours là'} !`)
  }
  return nextManche(key, g, wasImposter ? `🥷 Il reste encore *${impsLeft.length}* imposteur(s) parmi vous !` : '❌ Un civil de moins…')
}

// Nouvelle manche : mêmes mots et mêmes rôles, joueurs encore en lice
const nextManche = async (key, g, why) => {
  g.manche++
  if (g.manche > rounds.maxManches) return conclude(key, 'imposteur', '⌛ Trop de manches sans verdict : les imposteurs l’emportent.')
  setupManche(g)
  g.phase = 'between' // aucun message de jeu accepté pendant l’annonce
  await say(key, `${why}\n\n➡️ *Manche ${g.manche}* : ${alivePlayers(g).length} joueurs encore en lice.`, jidsOf(g))
  await sleep(2500)
  if (!isActive(g)) return
  return askTurn(key)
}

// Compte à rebours de la dernière chance (aussi utilisé à la reprise après un redémarrage)
export const armGuess = (g, seconds) =>
  phaseTimer(g, seconds, () => conclude(g.key, 'civils', '⏱️ Le temps est écoulé : l’imposteur n’a pas trouvé le mot.'), {
    marks: [20, 10, 5],
    tick: (m) => say(g.key, `⏳ ${tag(g.guesser.jid)} : plus que *${m} s* pour deviner le mot !`, [g.guesser.jid]),
  })

// L’imposteur a été démasqué (`top`) : il a une dernière chance de deviner le mot
export const startGuess = (key, g, top) => {
  g.phase = 'guess'
  g.guesser = top
  armGuess(g, guessSeconds)
  return say(
    key,
    `🎯 *${tag(top.jid)} est bien l’imposteur !*\n\n` +
      `${header('verdict', g)}Dernière chance : devine le *mot ${getMode(g.mode).guessWordLabel}* ` +
      `(catégorie : ${g.category}) en *un seul message*.\n⏱️ Tu as *${guessSeconds} s*. S’il le trouve, il vole la victoire !`,
    [top.jid]
  )
}

// Message du groupe pendant la dernière chance : seul l’imposteur démasqué est écouté, un seul essai
export const onGuessText = async (g, { chat, me, text }) => {
  if (!hasId(g.guesser, me.ids)) return
  const guess = norm(text)
  const secret = norm(g.word)
  const ok = guess.length >= 3 && (guess === secret || guess.includes(secret) || secret.split(' ').includes(guess))
  stopTimers(g)
  g.phase = 'verdict' // un seul essai
  await say(chat, `🎯 ${tag(g.guesser.jid)} tente : *${text.slice(0, 40)}*\n🥁 …`, [g.guesser.jid])
  await typing(chat, 2500)
  if (!isActive(g)) return
  return conclude(
    chat,
    ok ? 'imposteur' : 'civils',
    ok ? `🎯 L’imposteur a deviné le mot : il vole la victoire !` : `❌ « ${text.slice(0, 40)} » n’était pas le bon mot.`,
    [],
    ok
  )
}

// Fin de partie : points, classement, révélation des mots, récap. winner = 'civils' | 'imposteur'
export const conclude = async (key, winner, reason, extraMentions = [], viaGuess = false) => {
  const g = getGame(key)
  if (!g) return
  const rows = finalizeScores(g, winner, viaGuess)
  endGame(g)
  try {
    recordGame(key, g.gameId, rows)
  } catch (e) {
    console.error('[imposteur] enregistrement des scores impossible :', e.message)
  }

  let session = []
  try {
    session = sessionRanking(key, 5)
  } catch {}

  const pts = gameLines(g)
  const imps = g.imposters.map((p) => tag(p.jid)).join(', ')
  await typing(key, 1500)
  return say(
    key,
    `🏁 *FIN DE PARTIE*\n\n` +
      (winner === 'civils' ? `🎉 *Les civils gagnent !*` : plural(g) ? `🥷 *Les imposteurs gagnent !*` : `🥷 *L’imposteur gagne !*`) +
      `\n${reason}\n\n${plural(g) ? '🥷 Imposteurs' : '🥷 Imposteur'} : ${imps}\n` +
      getMode(g.mode).reveal(g) +
      (pts.length ? `\n\n🏅 *Points de la partie*\n${pts.join('\n')}` : '') +
      (session.length ? `\n\n📊 *Classement de la session*\n${session.map((r, i) => `${MEDALS[i] || '▫️'} ${tag(r.jid)} — ${r.points} pt${r.points > 1 ? 's' : ''}`).join('\n')}` : '') +
      `\n\n📜 *Récap des indices*\n${gameRecap(g)}` +
      `\n\n🏆 *${P}imposteur top* : classement • *${P}imposteur stats* : tes stats • Rejouer : *${P}imposteur*`,
    [...g.imposters.map((p) => p.jid), ...jidsOf(g), ...extraMentions]
  )
}
