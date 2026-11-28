// Phase 5 · Vote : on vote en mentionnant (@) le suspect ; dépouillement à la fin.
import { config } from '../../config.js'
import { say, typing } from '../../whatsapp/messenger.js'
import { sayVisual } from '../../render/svg.js'
import { voteChartSvg } from '../../render/voteChart.js'
import { sleep, tag, num } from '../../core/utils.js'
import { getGame, isActive } from '../store.js'
import { phaseTimer, stopTimers } from '../lifecycle.js'
import { persistGame } from '../persistence.js'
import { alivePlayers, findAlive, jidsOf, listOf } from '../players.js'
import { header } from '../phases-meta.js'
import { pl, count, voteQuestion } from '../wording.js'
import { scoreVotes, mancheLines } from '../scoring.js'
import { resolveVote } from './verdict.js'
import { host, phrase } from '../voice.js'

const { voteSeconds } = config.game

const pendingVoters = (g) => alivePlayers(g).filter((p) => !g.votes.has(p))

// Compte à rebours du vote (aussi utilisé à la reprise après un redémarrage)
export const armVote = (g, seconds) =>
  phaseTimer(g, seconds, () => endVote(g.key), {
    marks: [30, 15, 5],
    tick: (m) => {
      const waiting = pendingVoters(g)
      return say(
        g.key,
        `⏳ *${m} s* — ${g.votes.size}/${alivePlayers(g).length} ${pl(g.votes.size, 'vote')}.\n🕐 En attente : ${waiting.map((p) => tag(p.jid)).join(', ')}`,
        waiting.map((p) => p.jid)
      )
    },
  })

export const startVote = async (key) => {
  const g = getGame(key)
  if (!g || g.phase !== 'discuss') return
  stopTimers(g)
  g.phase = 'vote'
  g.votes = new Map() // votant (joueur) → suspect (joueur)
  armVote(g, voteSeconds)
  return say(
    key,
    `${header('vote', g)}🗳️ *${voteQuestion(g)}*\n${host('voteStart')}\n\n${listOf(g)}\n\n` +
      `👉 Pour voter, *mentionne (@)* ton suspect : un seul @ par message.\n` +
      `Répondre à un message ne compte pas • pas de vote pour soi-même • le dernier vote compte • les votes restent secrets jusqu’au dépouillement.\n` +
      `⏱️ *${voteSeconds} s* (le vote s’arrête dès que tout le monde a voté).`,
    jidsOf(g)
  )
}

export const endVote = async (key) => {
  const g = getGame(key)
  if (!g || g.phase !== 'vote') return
  stopTimers(g)
  g.phase = 'counting'

  await say(key, `🔔 *Le vote est clos !*\n${phrase('counting')}`)
  await typing(key, 2500)
  if (!isActive(g)) return

  const counts = new Map()
  for (const target of g.votes.values()) counts.set(target, (counts.get(target) || 0) + 1)
  const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1])

  scoreVotes(g) // points des votes justes

  if (!ranking.length) return resolveVote(key, g, { accused: null, tie: false, ranking })

  const detail = [...g.votes.entries()].map(([voter, target]) => `• ${tag(voter.jid)} ➜ ${tag(target.jid)}`).join('\n')
  const lines = ranking.map(([p, c]) => `${'🟥'.repeat(c)} ${tag(p.jid)} — ${count(c, 'vote')}`).join('\n')
  const abstainers = pendingVoters(g)
  const [top, topCount] = ranking[0]
  const tie = ranking.length > 1 && ranking[1][1] === topCount

  const missing = abstainers.length ? `\n\n🙈 N’ont pas voté : ${abstainers.map((p) => tag(p.jid)).join(', ')}` : ''
  // Graphique en image (barres + qui a voté pour qui) ; la légende garde les @mentions. Texte complet si l’image est impossible.
  await sayVisual(key, {
    svg: () => voteChartSvg(g, ranking, abstainers),
    caption: `📊 *Résultat du vote*\n\n🔍 *Détail*\n${detail}${missing}`,
    fallback: `📊 *Résultat du vote*\n\n${lines}\n\n🔍 *Détail*\n${detail}${missing}`,
    mentions: jidsOf(g),
  })
  if (g.format === 'rounds') {
    const pts = mancheLines(g)
    await say(key, pts.length ? `📈 *Points de la manche ${g.manche}*\n${pts.join('\n')}` : `📈 Aucun point marqué à la manche ${g.manche}.`, jidsOf(g))
  }
  await sleep(2500)
  if (!isActive(g)) return

  return resolveVote(key, g, { accused: tie ? null : top, tie, ranking })
}

// Message du groupe pendant le vote : seule une @mention (une seule) compte
export const onVoteText = async (g, { chat, me, mentioned }) => {
  const voter = findAlive(g, me.ids) // les joueurs éliminés ne votent plus
  if (!voter) return
  // Seule une @mention vote, et un seul @ par message (répondre à un message ne vote pas : on discute !)
  if (mentioned.length !== 1) return
  const suspect = alivePlayers(g).find((p) => p.ids.has(num(mentioned[0])))
  if (!suspect || suspect === voter) return // @ d’un non-joueur, d’un éliminé ou de soi-même : simple discussion, on ignore
  const changed = g.votes.has(voter)
  g.votes.set(voter, suspect) // un vote par personne : le dernier compte
  persistGame(g)
  const total = alivePlayers(g).length
  const waiting = pendingVoters(g)
  if (!waiting.length) {
    await say(chat, `${changed ? '🔄' : '🗳️'} ${tag(voter.jid)} a ${changed ? 'changé son vote' : 'voté'} ! (${g.votes.size}/${total})\n✅ *Tous les joueurs ont voté !*`, [voter.jid])
    return endVote(chat)
  }
  return say(
    chat,
    `${changed ? '🔄' : '🗳️'} ${tag(voter.jid)} a ${changed ? 'changé son vote' : 'voté'} ! (${g.votes.size}/${total})\n🕐 En attente : ${waiting.map((p) => tag(p.jid)).join(', ')}`,
    [voter.jid, ...waiting.map((p) => p.jid)]
  )
}
