// Semaines : le classement repart de zéro chaque lundi (heure locale du serveur). Au changement de semaine, le bot annonce le MVP
// et le podium de la semaine écoulée dans chaque groupe qui a joué, avec quelques récompenses, et retient le MVP (titre « MVP de la semaine »).
import { config } from '../config.js'
import { tag } from '../core/utils.js'
import { isConnected } from '../core/heartbeat.js'
import { getSetting, setSetting } from '../storage/settings.js'
import { groupsWithGames, weekRanking, previousWeekKey, weekLabel, weekWindow, groupStats, recordChampion } from '../storage/scores.js'
import { sayVisual } from '../render/svg.js'
import { rankingSvg } from '../render/ranking.js'
import { activeTheme, greeting } from '../render/seasonal.js'
import { weekChallenges } from './challenges.js'
import { count } from './wording.js'

const MEDALS = ['🥇', '🥈', '🥉']

// Récompenses de la semaine : le meilleur de chaque domaine (un joueur par récompense, au moins `min` pour la mériter)
const AWARDS = [
  { icon: '🥷', name: 'Roi du bluff', of: (s) => s.impWins, min: 1, unit: (n) => count(n, 'victoire') + ' en imposteur' },
  { icon: '🔍', name: 'Fin limier', of: (s) => s.rightVotes, min: 2, unit: (n) => count(n, 'imposteur') + ' démasqué' + (n > 1 ? 's' : '') },
  { icon: '🔥', name: 'Meilleure série', of: (s) => s.bestStreak, min: 2, unit: (n) => `${n} victoires d’affilée` },
  { icon: '🎯', name: 'Voleur de mots', of: (s) => s.stolen, min: 1, unit: (n) => count(n, 'mot') + ' deviné' + (n > 1 ? 's' : '') },
  { icon: '🎮', name: 'Le plus assidu', of: (s) => s.games, min: 3, unit: (n) => count(n, 'partie') },
]
export const weekAwards = (stats) => {
  const out = []
  for (const a of AWARDS) {
    const ranked = [...stats.values()].filter((s) => a.of(s) >= a.min).sort((x, y) => a.of(y) - a.of(x) || y.points - x.points)
    const best = ranked[0]
    if (best && !(ranked[1] && a.of(ranked[1]) === a.of(best) && ranked[1].points === best.points)) out.push({ ...a, player: best, value: a.of(best) })
  }
  return out
}

// Annonce le MVP et le podium de la semaine précédente dans les groupes concernés (une seule fois par groupe et par semaine)
export const announceSeasons = async (now = new Date(Date.now())) => {
  const key = previousWeekKey(now)
  let sent = 0
  for (const group of groupsWithGames(key)) {
    if (getSetting(group, 'season_announced') === key) continue
    const rows = weekRanking(group, key, 10)
    if (!rows.length) continue
    const label = weekLabel(key)
    const mvp = rows[0]
    recordChampion(group, key, mvp.num)
    const stats = groupStats(group, weekWindow(key))
    const jidOf = new Map(rows.map((r) => [r.num, r.jid]))
    const podium = rows.slice(0, 3).map((r, i) => `${MEDALS[i]} ${tag(r.jid)} — ${count(r.points, 'pt')} • ${count(r.wins, 'victoire')}`)
    const won = weekAwards(stats).filter((a) => jidOf.has(a.player.num))
    const awards = won.map((a) => `${a.icon} ${a.name} : ${tag(jidOf.get(a.player.num))} (${a.unit(a.value)})`)
    awards.winners = won.map((a) => jidOf.get(a.player.num))
    const defis = [...stats.values()].reduce((n, s) => n + weekChallenges(group, key).filter((c) => (c.of(s) || 0) >= c.goal).length, 0)
    const theme = activeTheme(now)
    const hello = theme ? `${greeting(theme)}\n\n` : ''
    await sayVisual(group, {
      svg: () => rankingSvg(rows, { title: 'MVP DE LA SEMAINE', subtitle: `Semaine ${label}`, mvp: true }),
      caption:
        `${hello}🏆 *Fin de la semaine (${label}) !*\n\n👑 *MVP de la semaine* : ${tag(mvp.jid)} — ${count(mvp.points, 'point')}, ${count(mvp.wins, 'victoire')} !\n\n${podium.join('\n')}` +
        (awards.length ? `\n\n${awards.join('\n')}` : '') +
        (defis ? `\n\n🎯 ${count(defis, 'défi relevé', 'défis relevés')} cette semaine.` : '') +
        `\n\n🆕 Nouvelle semaine : les compteurs repartent à zéro (tes statistiques et tes titres restent). ${config.prefix}top : classement de la semaine • ${config.prefix}top global : depuis le début`,
      mentions: [...new Set([...rows.slice(0, 3).map((r) => r.jid), ...awards.winners])],
    })
    setSetting(group, 'season_announced', key)
    sent++
  }
  return sent
}

// Vérifie régulièrement (le bot doit être connecté pour écrire dans les groupes)
export const startSeasons = () => {
  const run = () => {
    if (isConnected()) announceSeasons().catch((e) => console.error('[imposteur] annonce de la semaine :', e.message))
  }
  const first = setTimeout(run, 60_000)
  const timer = setInterval(run, 30 * 60_000)
  first.unref?.()
  timer.unref()
  return timer
}
