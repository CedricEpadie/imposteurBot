// Phase 3 · Indices : chacun son tour, un seul mot, en plusieurs tours.
//
// Règles d’un indice : UN SEUL MOT (pas de phrase), différent du mot secret du joueur,
// et différent des indices déjà donnés par les autres joueurs.
import { config } from '../../config.js'
import { say } from '../../whatsapp/messenger.js'
import { sleep, tag, norm } from '../../core/utils.js'
import { getGame, isActive } from '../store.js'
import { phaseTimer, stopTimers } from '../lifecycle.js'
import { hasId, jidsOf } from '../players.js'
import { header } from '../phases-meta.js'
import { getMode } from '../modes/index.js'
import { clueLines } from '../recap.js'
import { startDiscuss } from './discussion.js'

const { clueRounds, clueSeconds } = config.game

export const askTurn = async (key) => {
  const g = getGame(key)
  if (!g) return
  const t = g.turns[g.turnIdx]
  if (!t) return startDiscuss(key)

  g.phase = 'clues'
  const n = g.order.length
  const round = Math.floor(g.turnIdx / n) + 1
  const pos = (g.turnIdx % n) + 1

  let head = ''
  if (g.turnIdx === 0) {
    head =
      header('clues', g) +
      `Chacun donne *un seul mot* (pas de phrase) en rapport avec son mot secret, sans le dire ni répéter l’indice d’un autre.\n` +
      `🔁 ${clueRounds} tour(s) • ⏱️ ${clueSeconds} s par joueur\n\n` +
      `📋 *Ordre de passage*\n${g.order.map((p, i) => `${i + 1}. ${tag(p.jid)}`).join('\n')}\n\n`
  } else if (pos === 1) {
    head = `🔁 *Tour ${round}/${clueRounds}* — on repart dans le même ordre !\n\n`
  }
  const next = g.turns[g.turnIdx + 1]
  const mentions = [t.jid, ...(next ? [next.jid] : []), ...(g.turnIdx === 0 ? jidsOf(g) : [])]

  phaseTimer(g, clueSeconds, () => takeClue(key, null), {
    marks: [20, 10, 5],
    tick: (m) => say(key, `⏳ ${tag(t.jid)} : plus que *${m} s* pour donner ton indice !`, [t.jid]),
  })
  return say(
    key,
    `${head}🗣️ *Tour ${round}/${clueRounds} • joueur ${pos}/${n}*\nC’est à ${tag(t.jid)} ! Donne ton indice en *un seul mot* (${clueSeconds} s).` +
      (next ? `\n➡️ Ensuite : ${tag(next.jid)}` : ''),
    mentions
  )
}

// Enregistre l’indice du joueur courant (text = null : temps écoulé) puis passe au suivant
export const takeClue = async (key, text) => {
  const g = getGame(key)
  if (!g || g.phase !== 'clues') return
  stopTimers(g)
  g.phase = 'between' // le temps d’annoncer l’indice, aucun autre indice n’est accepté

  const n = g.order.length
  const t = g.turns[g.turnIdx]
  const round = Math.floor(g.turnIdx / n) + 1
  const pos = (g.turnIdx % n) + 1
  g.clues.push({ manche: g.manche, round, p: t, text: text || null })
  g.turnIdx++

  await say(
    key,
    text
      ? `✅ ${tag(t.jid)} a donné son indice : *${text}* (${pos}/${n})`
      : `⏱️ ${tag(t.jid)} n’a rien dit à temps : indice passé… 🐢 (${pos}/${n})`,
    [t.jid]
  )
  if (!isActive(g)) return

  if (g.turnIdx % n === 0) {
    await sleep(1000)
    if (!isActive(g)) return
    await say(key, `📝 *Indices du tour ${round}*\n${clueLines(g, round).join('\n')}`, jidsOf(g))
    if (!isActive(g)) return
  }

  await sleep(1500)
  if (!isActive(g)) return
  return askTurn(key)
}

// Message du groupe pendant la phase d’indices : seul le joueur dont c’est le tour est écouté
export const onClueText = async (g, { chat, me, text }) => {
  const t = g.turns[g.turnIdx]
  if (!t || !hasId(t, me.ids)) return

  // 1. Un seul mot : une phrase est refusée (on ne garde plus le premier mot)
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length > 1) return say(chat, `⛔ ${tag(t.jid)} : L'indice en un mot pas de phrase !`, [t.jid])
  const clue = words[0].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').slice(0, 30)
  if (!clue) return

  // 2. Pas son propre mot secret
  const secret = getMode(g.mode).secretFor(g, t)
  if (secret && (norm(clue) === norm(secret) || (norm(clue).length >= 4 && norm(secret).includes(norm(clue)) && !norm(secret).includes(' ')))) {
    return say(chat, `⛔ ${tag(t.jid)} : tu ne peux pas dire ton mot secret ! Trouve un autre indice (le temps continue de tourner).`, [t.jid])
  }

  // 3. Pas l’indice déjà donné par un autre joueur
  const taken = g.clues.find((c) => c.p !== t && c.text && norm(c.text) === norm(clue))
  if (taken) {
    return say(chat, `⛔ ${tag(t.jid)} : « ${clue} » a déjà été donné par ${tag(taken.p.jid)} ! Trouve un autre indice (le temps continue de tourner).`, [t.jid, taken.p.jid])
  }

  return takeClue(chat, clue)
}
