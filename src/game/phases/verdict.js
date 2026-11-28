// Phase 6 · Verdict : résultat du vote (élimination, manche suivante ou fin), dernière chance de
// l’imposteur démasqué, fin de partie avec points et classement.
//
// NB : verdict.js ↔ clues.js s’importent mutuellement (la manche suivante relance les indices) ;
// c’est sans danger car chaque fonction n’est appelée qu’à l’exécution, jamais à l’import.
import { config } from '../../config.js'
import { say, typing } from '../../whatsapp/messenger.js'
import { sayVisual } from '../../render/svg.js'
import { summarySvg } from '../../render/summary.js'
import { tag, stem, sleep } from '../../core/utils.js'
import { getGame, isActive } from '../store.js'
import { phaseTimer, stopTimers, endGame } from '../lifecycle.js'
import { alivePlayers, aliveImposters, hasId, isImposter, jidsOf, labelOf } from '../players.js'
import { header } from '../phases-meta.js'
import { getMode } from '../modes/index.js'
import { gameRecap } from '../recap.js'
import { setupManche } from '../round.js'
import { finalizeScores, gameLines } from '../scoring.js'
import { recordGame, groupStats, withPeers } from '../../storage/scores.js'
import { completeChallenges } from '../challenges.js'
import { titlesOf, nicknameOf, MIN_GAMES } from '../titles.js'
import { askTurn } from './clues.js'
import { count, ie, roleReveal, stillThere } from '../wording.js'
import { host, phrase } from '../voice.js'
import { persistGame } from '../persistence.js'
import { bump } from '../behavior.js'

const P = config.prefix
const { guessSeconds, clueRounds, minPlayers } = config.game
const { rounds } = config


// Un joueur qui n'a donné aucun de ses indices (temps écoulé à chaque tour) est éjecté de la partie :
//  • imposteur → la partie s'arrête, les civils gagnent (+points de victoire, pas de dernière chance) ;
//  • civil → il sort de la partie (ni vote ni accusation, pas de points de victoire) et le jeu continue, sauf s'il ne reste plus assez de joueurs.
// Retourne true si la partie est terminée.
export const ejectForSilence = async (key, g, p) => {
  g.ejected ??= new Set()
  g.ejected.add(p)
  bump(g, p, 'ejected')
  if (isImposter(g, p)) {
    await say(key, `🚪 ${tag(p.jid)} n’a donné aucun de ses ${clueRounds} indices : éjecté de la partie ! C’était ${roleReveal(true)}.\n${host('ejectedLiar')}`, [p.jid])
    await conclude(key, 'civils', `🚪 ${tag(p.jid)} éjecté pour silence : la partie s’arrête, tous les civils marquent ${count(config.scoring.civilsWin, 'point')}.`, [p.jid])
    return true
  }
  g.eliminated.add(p)
  persistGame(g)
  await say(key, `🚪 ${tag(p.jid)} n’a donné aucun de ses ${clueRounds} indices : éjecté de la partie ! C’était ${roleReveal(false)}.\n${host('ejectedCivil')}`, [p.jid])
  const left = alivePlayers(g).length
  const limit = g.format === 'rounds' ? rounds.stopAt : minPlayers - 1
  if (left <= limit) {
    await conclude(key, 'imposteur', `🔻 Il ne reste que *${left}* ${left > 1 ? 'joueurs' : 'joueur'} en jeu : trop peu pour continuer.`)
    return true
  }
  return false
}

// Résultat d’un vote : `accused` = joueur désigné (null = égalité ou aucun vote)
export const resolveVote = async (key, g, { accused, tie, ranking }) => {
  const multi = g.format === 'rounds'
  const extra = ranking.map(([p]) => p.jid)

  if (!accused) {
    const why = tie
      ? `⚖️ Égalité des votes : personne n’est démasqué.\n${host('tie')}`
      : `🐔 Personne n’a osé voter : ${ie(g, 'l’imposteur passe', 'les imposteurs passent')} entre les mailles du filet.\n${host('noVote')}`
    return multi ? nextManche(key, g, why) : conclude(key, 'imposteur', why, extra)
  }

  const wasImposter = isImposter(g, accused)
  for (const [voter, target] of g.votes) if (target === accused && voter !== accused) bump(g, voter, 'herd') // a voté comme le groupe
  bump(g, accused, wasImposter ? 'caught' : 'fell')

  if (!multi) {
    if (!wasImposter) return conclude(key, 'imposteur', `❌ Le groupe a accusé ${tag(accused.jid)}… mais c’était un civil !\n${host('wrongAccuse', tag(accused.jid))}`, extra)
    g.guesser = accused
    return startGuess(key, g, accused)
  }

  // Plusieurs manches : le joueur désigné est éliminé, son rôle est révélé
  g.eliminated.add(accused)
  await say(key, `🚪 ${tag(accused.jid)} est éliminé… c’était ${roleReveal(wasImposter)} !\n${host(wasImposter ? 'eliminatedImposter' : 'eliminatedCivil')}`, [accused.jid])
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
  return nextManche(key, g, wasImposter ? `🥷 ${stillThere(impsLeft.length)}` : '❌ Un civil de moins…')
}

// Nouvelle manche : mêmes mots et mêmes rôles, joueurs encore en lice
const nextManche = async (key, g, why) => {
  g.manche++
  if (g.manche > rounds.maxManches) return conclude(key, 'imposteur', `⌛ Trop de manches sans verdict : ${ie(g, 'l’imposteur l’emporte', 'les imposteurs l’emportent')}.`)
  setupManche(g)
  g.phase = 'between' // aucun message de jeu accepté pendant l’annonce
  await say(key, `${why}\n\n➡️ *Manche ${g.manche}* : ${alivePlayers(g).length} joueurs encore en lice.`, jidsOf(g))
  await sleep(2500)
  if (!isActive(g)) return
  return askTurn(key)
}

// Compte à rebours de la dernière chance (aussi utilisé à la reprise après un redémarrage)
export const armGuess = (g, seconds) =>
  phaseTimer(g, seconds, () => conclude(g.key, 'civils', `⏱️ Le temps est écoulé : ${ie(g, 'l’imposteur n’a pas trouvé', 'le dernier imposteur n’a pas trouvé')} le mot.`), {
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
    `🎯 *${tag(top.jid)} est bien ${ie(g, 'l’imposteur', 'un imposteur')} !*\n${host('unmasked', tag(top.jid))}\n\n` +
      `${header('verdict', g)}Dernière chance : devine le *mot ${getMode(g.mode).guessWordLabel}* ` +
      `(catégorie : ${g.category}) en *un seul message*.\n⏱️ Tu as *${guessSeconds} s*. Si tu le trouves, ${ie(g, 'tu voles la victoire', 'les imposteurs volent la victoire')} !`,
    [top.jid]
  )
}

// Message du groupe pendant la dernière chance : seul l’imposteur démasqué est écouté, un seul essai
export const onGuessText = async (g, { chat, me, text }) => {
  if (!hasId(g.guesser, me.ids)) return
  // Singulier et pluriel sont équivalents (« mur » = « murs »), comme les accents et la casse
  const guess = stem(text)
  const secret = stem(g.word)
  const ok = guess.length >= 3 && (guess === secret || guess.includes(secret) || secret.split(' ').includes(guess))
  stopTimers(g)
  g.phase = 'verdict' // un seul essai
  await say(chat, `🎯 ${tag(g.guesser.jid)} tente : *${text.slice(0, 40)}*\n🥁 …\n${host('guessTry')}`, [g.guesser.jid])
  await typing(chat, 2500)
  if (!isActive(g)) return
  return conclude(
    chat,
    ok ? 'imposteur' : 'civils',
    ok
      ? `🎯 ${ie(g, 'L’imposteur a deviné le mot : il vole', 'Le dernier imposteur a deviné le mot : les imposteurs volent')} la victoire !\n${host('guessHit')}`
      : `❌ « ${text.slice(0, 40)} » n’était pas le bon mot.\n${host('guessMiss')}`,
    [],
    ok
  )
}

// Nouveaux titres et surnoms gagnés pendant la partie (comparaison avant / après l'enregistrement)
const progress = (g, before, after) => {
  const out = []
  for (const p of g.players) {
    const prev = withPeers(before, p.num)
    const now = withPeers(after, p.num)
    if (!now) continue
    const had = new Map(titlesOf(prev || {}).map((x) => [x.id, x.tier]))
    for (const ti of titlesOf(now)) if ((had.get(ti.id) || 0) < ti.tier) out.push(`🏅 ${tag(p.jid)} débloque le titre *${ti.name}* !`)
    const old = prev ? nicknameOf(prev) : null
    const nick = nicknameOf(now)
    if (now.games >= MIN_GAMES && old !== nick) out.push(`🏷️ ${tag(p.jid)} est désormais *${nick}*.`)
  }
  return out
}

// Texte de repli : total de points des participants après la partie
const totalsText = (g, totals) => {
  const list = g.players.filter((p) => totals.has(p.num)).sort((a, b) => totals.get(b.num) - totals.get(a.num))
  return list.length ? `\n\n📊 *Total des points*\n${list.map((p) => `▫️ ${tag(p.jid)} — ${count(totals.get(p.num), 'pt')}`).join('\n')}` : ''
}

// Fin de partie : points, classement, révélation des mots, récap. winner = 'civils' | 'imposteur'
export const conclude = async (key, winner, reason, extraMentions = [], viaGuess = false) => {
  const g = getGame(key)
  if (!g) return
  const rows = finalizeScores(g, winner, viaGuess)
  endGame(g)
  let news = []
  const totals = new Map() // numéro → total de points après la partie
  try {
    const before = groupStats(key)
    recordGame(key, g.gameId, rows)
    const challenges = completeChallenges(key, g.players) // défis de la semaine relevés (avant le calcul des titres : « Chasseur de défis »)
    const after = groupStats(key)
    for (const r of rows) if (after.has(r.num)) totals.set(r.num, after.get(r.num).points)
    news = [...progress(g, before, after), ...challenges]
  } catch (e) {
    console.error('[imposteur] enregistrement des scores impossible :', e.message)
  }

  const pts = gameLines(g)
  const imps = g.imposters.map((p) => tag(p.jid)).join(', ')
  const mentions = [...g.imposters.map((p) => p.jid), ...jidsOf(g), ...extraMentions]
  const winLine = winner === 'civils' ? `🎉 *Les civils gagnent !*` : `🥷 *${ie(g, 'L’imposteur gagne', 'Les imposteurs gagnent')} !*`
  const bilan = `${winLine}\n${host(winner === 'civils' ? 'civilsWin' : 'imposterWin')}\n${reason}\n\n${ie(g, '🥷 Imposteur', '🥷 Imposteurs')} : ${imps}\n${getMode(g.mode).reveal(g)}`
  const recap = `📜 *Récap des indices*\n${gameRecap(g)}`
  const newsText = news.length ? `\n\n${news.join('\n')}` : ''
  const commands = `${newsText}\n\n🏆 *${P}imposteur top* : classement • *${P}imposteur stats* : tes stats • Rejouer : *${P}imposteur*`

  await typing(key, 1500)
  // Bilan en image (vainqueur, imposteurs, mots, points, classement), puis les indices et les commandes en texte.
  // Sans image : tout le bilan tient en un seul message texte, comme avant.
  const { image } = await sayVisual(key, {
    svg: () => summarySvg(g, winner, reason, totals),
    caption: `🏁 *FIN DE PARTIE*\n\n${bilan}`,
    fallback: `🏁 *FIN DE PARTIE*\n\n${bilan}` + (pts.length ? `\n\n🏅 *Points de la partie*\n${pts.join('\n')}` : '') + totalsText(g, totals) + `\n\n${recap}${commands}`,
    mentions,
  })
  if (image) return say(key, `${recap}${commands}`, jidsOf(g))
}
