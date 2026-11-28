// Saisons : le classement repart de zéro chaque mois. Au changement de mois, le bot annonce le podium de la saison écoulée
// dans chaque groupe qui a joué, et retient le champion (titre « Champion de saison » sur le profil).
import { config } from '../config.js'
import { tag } from '../core/utils.js'
import { isConnected } from '../core/heartbeat.js'
import { getSetting, setSetting } from '../storage/settings.js'
import { groupsWithGames, seasonRanking, previousSeasonKey, seasonLabel, recordChampion } from '../storage/scores.js'
import { sayVisual } from '../render/svg.js'
import { rankingSvg } from '../render/ranking.js'
import { count } from './wording.js'

const MEDALS = ['🥇', '🥈', '🥉']

// Annonce le podium de la saison précédente dans les groupes concernés (une seule fois par groupe et par saison)
export const announceSeasons = async (now = new Date(Date.now())) => {
  const key = previousSeasonKey(now)
  let sent = 0
  for (const group of groupsWithGames(key)) {
    if (getSetting(group, 'season_announced') === key) continue
    const rows = seasonRanking(group, key, 10)
    if (!rows.length) continue
    const label = seasonLabel(key)
    recordChampion(group, key, rows[0].num)
    const podium = rows.slice(0, 3).map((r, i) => `${MEDALS[i]} ${tag(r.jid)} — ${count(r.points, 'pt')} • ${count(r.wins, 'victoire')}`)
    await sayVisual(group, {
      svg: () => rankingSvg(rows, { title: `SAISON ${label.toUpperCase()}`, subtitle: 'Le podium de la saison écoulée' }),
      caption: `🏆 *Fin de la saison de ${label} !*\n\n👑 Champion : ${tag(rows[0].jid)}\n\n${podium.join('\n')}\n\n🆕 Une nouvelle saison commence : les compteurs du classement repartent à zéro (tes stats et tes titres restent). ${config.prefix}imposteur top : classement de la saison`,
      mentions: rows.slice(0, 3).map((r) => r.jid),
    })
    setSetting(group, 'season_announced', key)
    sent++
  }
  return sent
}

// Vérifie régulièrement (le bot doit être connecté pour écrire dans les groupes)
export const startSeasons = () => {
  const run = () => {
    if (isConnected()) announceSeasons().catch((e) => console.error('[imposteur] annonce de saison :', e.message))
  }
  const first = setTimeout(run, 60_000)
  const timer = setInterval(run, 30 * 60_000)
  first.unref?.()
  timer.unref()
  return timer
}
