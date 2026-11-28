import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boot, jid } from './helpers.mjs'

const b = await boot() // horloge virtuelle : 14 novembre 2023
const scores = await import('../src/storage/scores.js')
const { announceSeasons } = await import('../src/game/seasons.js')
const { titlesOf } = await import('../src/game/titles.js')
const { activeTheme, decor } = await import('../src/render/seasonal.js')
const { profileSvg } = await import('../src/render/profile.js')
const { config } = await import('../src/config.js')

const GRP = '120363000000000077@g.us'
const row = (num, role, won, points) => ({ num, jid: jid(num), name: `Joueur ${num.slice(-2)}`, role, won, points })
const octobre = new Date(2023, 9, 15, 12).getTime()
const novembre = new Date(2023, 10, 10, 12).getTime()

test('saisons : clés, bornes et classement du mois', () => {
  assert.equal(scores.seasonKey(new Date(2023, 10, 14)), '2023-11')
  assert.equal(scores.previousSeasonKey(new Date(2024, 0, 3)), '2023-12')
  assert.equal(scores.seasonLabel('2023-10'), 'octobre 2023')
  scores.recordGame(GRP, 'g1', [row('237600000001', 'civil', true, 5), row('237600000002', 'imposteur', false, 0)], octobre)
  scores.recordGame(GRP, 'g2', [row('237600000002', 'civil', true, 9)], novembre)
  assert.deepEqual(scores.seasonRanking(GRP, '2023-10').map((r) => r.num), ['237600000001', '237600000002'])
  assert.deepEqual(scores.seasonRanking(GRP, '2023-11').map((r) => r.num), ['237600000002']) // le compteur repart de zéro
  assert.equal(scores.overallRanking(GRP, 5)[0].num, '237600000002') // le général cumule tout
})

test('annonce du podium de la saison écoulée : une seule fois, champion retenu', async () => {
  b.mark()
  assert.equal(await announceSeasons(), 1)
  assert.ok(b.has(/Fin de la saison de octobre 2023/))
  assert.match(b.image(/Fin de la saison/), /SAISON OCTOBRE 2023/)
  assert.equal(await announceSeasons(), 0)
  const s = scores.playerStats(GRP, '237600000001')
  assert.equal(s.champSeasons, 1)
  assert.ok(titlesOf(s).some((t) => t.name === 'Champion de saison'))
})

test('thèmes : Halloween et Noël par date, décor dans les images, rien le reste de l’année', () => {
  assert.equal(activeTheme(new Date(2026, 9, 31), 'auto'), 'halloween')
  assert.equal(activeTheme(new Date(2026, 11, 25), 'auto'), 'noel')
  assert.equal(activeTheme(new Date(2027, 0, 5), 'auto'), 'noel')
  assert.equal(activeTheme(new Date(2026, 5, 10), 'auto'), null)
  assert.equal(activeTheme(new Date(2026, 11, 25), 'none'), null)
  assert.match(decor('noel', 900, 800), /theme-noel/)
  assert.match(decor('halloween', 900, 800), /theme-halloween/)
  const s = { games: 3, wins: 1, points: 2, asImposter: 0, impWins: 0, civGames: 3, civWins: 1, streak: 0, bestStreak: 1, rightVotes: 0, wrongVotes: 0, votes: 0, received: 0, abstain: 0, talk: 0, clues: 0, missed: 0, stolen: 0, champSeasons: 0, form: [], rank: 1, players: 2 }
  assert.doesNotMatch(profileSvg(s, 'A'), /theme-/)
  config.theme = 'noel'
  assert.match(profileSvg(s, 'A'), /theme-noel/)
  config.theme = 'halloween'
  assert.match(profileSvg(s, 'A'), /theme-halloween/)
  config.theme = 'auto'
})
