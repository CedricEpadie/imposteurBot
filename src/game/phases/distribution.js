// Phase 2 · Distribution des rôles en privé, avec barre de progression modifiée en direct.
import { config } from '../../config.js'
import { say, editMsg } from '../../whatsapp/messenger.js'
import { sleep, tag, progressBar } from '../../core/utils.js'
import { deliverRole, resolveDms } from '../../roles/delivery.js'
import { isActive } from '../store.js'
import { phaseTimer } from '../lifecycle.js'
import { jidsOf, listOf } from '../players.js'
import { header } from '../phases-meta.js'
import { getMode } from '../modes/index.js'
import { askTurn } from './clues.js'

const P = config.prefix
const { readSeconds, dmDelaySeconds } = config.game
const { delivery, selfDestruct } = config.roles

export const distributeRoles = async (key, g) => {
  const mode = getMode(g.mode)
  const { secretLabel, secretPlural } = mode
  const total = g.players.length

  const progress = (done, last) =>
    `${header('dm', g)}👥 ${total} joueurs : ${listOf(g)}\n🏷️ Catégorie : ${g.category}\n🎮 Mode : ${mode.label}\n` +
    (g.imposters.length > 1 ? `🥷 *${g.imposters.length} imposteurs* se cachent parmi vous !\n` : '') +
    (g.format === 'rounds' ? `🔁 Plusieurs manches : un joueur éliminé par manche, jusqu’à ${config.rounds.stopAt} joueurs.\n` : '') +
    `\n` +
    `📩 Envoi des ${secretPlural} en privé${delivery === 'image' ? ' (carte à vue unique 👁️)' : ''}${delivery !== 'image' && selfDestruct > 0 ? ` (message effacé après ${selfDestruct} s)` : ''}…\n` +
    `${progressBar(done, total)} ${done}/${total}` +
    (last ? `\n${last}` : '')

  await resolveDms(key, g)
  const first = await say(key, progress(0), jidsOf(g))

  const failed = []
  let firstError = ''
  let done = 0
  for (const p of g.players) {
    if (!isActive(g)) return // partie annulée entre-temps
    const r = await deliverRole(g, p)
    const ok = r.ok
    done++
    if (!ok) {
      failed.push(p.jid)
      if (!firstError) firstError = r.error
    }
    await editMsg(
      key,
      first,
      progress(done, ok ? `✅ ${tag(p.jid)} a reçu son ${secretLabel}` : `⚠️ ${tag(p.jid)} : envoi impossible`),
      jidsOf(g)
    )
    if (done < total) await sleep(dmDelaySeconds * 1000)
  }
  if (!isActive(g)) return

  if (failed.length) {
    await say(
      key,
      `⚠️ Je n’ai pas pu écrire en privé à ${failed.map(tag).join(', ')}. Écrivez-moi d’abord en privé (un simple « salut »), puis tapez *${P}imposteur mot* pour recevoir votre ${secretLabel}.\n🔧 Détail technique : ${firstError}`,
      failed
    )
  }

  g.phase = 'ready'
  await say(
    key,
    `📖 *Lisez bien votre ${secretLabel} !*\n` +
      (delivery === 'image' ? `La carte ne s’ouvre qu’*UNE fois* : ouvrez-la sur votre téléphone.\n` : '') +
      (delivery !== 'image' && selfDestruct > 0 ? `Votre message s’efface tout seul après *${selfDestruct} s* : lisez-le vite !\n` : '') +
      `Rien reçu ? *${P}imposteur mot* en privé au bot.\n\n🎬 Les indices commencent dans *${readSeconds} s*…`
  )
  armReady(g, readSeconds)
}

// Compte à rebours avant les indices (aussi utilisé à la reprise après un redémarrage)
export const armReady = (g, seconds) =>
  phaseTimer(g, seconds, () => askTurn(g.key), {
    marks: [10, 5],
    tick: (m) => say(g.key, `⏳ Début des indices dans *${m} s*…`),
  })
