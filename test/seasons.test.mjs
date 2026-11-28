import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boot, jid } from './helpers.mjs'

const b = await boot() // horloge virtuelle : 14 novembre 2023 (mardi)
const scores = await import('../src/storage/scores.js')
const { announceSeasons } = await import('../src/game/seasons.js')
const { titlesOf, styleOf } = await import('../src/game/titles.js')
const { weekChallenges, completeChallenges } = await import('../src/game/challenges.js')
const { activeTheme, decor, easter, greeting } = await import('../src/render/seasonal.js')
const { profileSvg } = await import('../src/render/profile.js')
const { groupMentions, forgetMembers } = await import('../src/whatsapp/members.js')
const { config } = await import('../src/config.js')

const GRP = '120363000000000077@g.us'
const row = (num, role, won, points, extra = {}) => ({ num, jid: jid(num), name: `Joueur ${num.slice(-2)}`, role, won, points, ...extra })
const semainePassee = new Date(2023, 10, 7, 12).getTime() // mardi 7 novembre
const cetteSemaine = new Date(2023, 10, 13, 12).getTime() // lundi 13 novembre

test('semaines : clés (lundi), bornes, libellés', () => {
  assert.equal(scores.weekKey(new Date(2023, 10, 14)), '2023-11-13')
  assert.equal(scores.weekKey(new Date(2023, 10, 19)), '2023-11-13') // dimanche
  assert.equal(scores.weekKey(new Date(2023, 10, 20)), '2023-11-20')
  assert.equal(scores.previousWeekKey(new Date(2023, 10, 14)), '2023-11-06')
  assert.equal(scores.weekLabel('2023-11-13'), 'du 13 au 19 novembre')
  assert.equal(scores.weekLabel('2023-12-25'), 'du 25 au 31 décembre')
  assert.equal(scores.weekLabel('2023-10-30'), 'du 30 octobre au 5 novembre')
})

test('semaine : le classement repart de zéro, le global garde tout', () => {
  scores.recordGame(GRP, 'g1', [row('237600000001', 'civil', true, 5), row('237600000002', 'imposteur', false, 0)], semainePassee)
  scores.recordGame(GRP, 'g2', [row('237600000002', 'civil', true, 9)], cetteSemaine)
  assert.deepEqual(scores.weekRanking(GRP, '2023-11-06').map((r) => r.num), ['237600000001', '237600000002'])
  assert.deepEqual(scores.weekRanking(GRP, '2023-11-13').map((r) => r.num), ['237600000002'])
  assert.equal(scores.overallRanking(GRP, 5)[0].num, '237600000002')
  const week = scores.playerStats(GRP, '237600000002', { period: 'week' })
  const all = scores.playerStats(GRP, '237600000002')
  assert.equal(week.games, 1)
  assert.equal(all.games, 2)
  assert.equal(scores.playerStats(GRP, '237600000001', { period: 'week' }), null)
})

test('/top : semaine par défaut, « global » depuis le début ; tout le groupe est mentionné sans @ visible', async () => {
  globalThis.__sock.groupParticipants = ['237600000001', '237600000002', '237699999999'].map((n) => ({ id: `${n}@s.whatsapp.net` }))
  forgetMembers()
  b.mark()
  await b.send(GRP, '237600000002', '/top')
  const sent = globalThis.__sock.sent.filter((m) => m.jid === GRP && m.content.image).at(-1)
  assert.match(sent.content.caption, /Classement de la semaine\* \(du 13 au 19 novembre\)/)
  assert.doesNotMatch(sent.content.caption, /@\d/)
  assert.ok(sent.content.mentions.includes('237699999999@s.whatsapp.net'), 'un membre qui n’a jamais joué est quand même prévenu')
  assert.match(b.image(/Classement de la semaine/), /CLASSEMENT DE LA SEMAINE/)
  await b.send(GRP, '237600000001', '/top global')
  assert.match(b.image(/depuis le début/), /CLASSEMENT GÉNÉRAL/)
})

test('membres du groupe : cache et repli si WhatsApp ne répond pas', async () => {
  forgetMembers()
  const a = await groupMentions('x@g.us', ['f@s.whatsapp.net'], 1000)
  assert.equal(a.length, 3)
  globalThis.__sock.groupParticipants = []
  assert.equal((await groupMentions('x@g.us', [], 2000)).length, 3, 'cache de 10 min')
  forgetMembers()
  assert.deepEqual(await groupMentions('y@g.us', ['f@s.whatsapp.net'], 3000), ['f@s.whatsapp.net'], 'repli : joueurs du classement')
})

test('MVP : annonce de la semaine écoulée une seule fois, MVP retenu, récompenses', async () => {
  b.mark()
  assert.equal(await announceSeasons(), 1)
  assert.ok(b.has(/Fin de la semaine \(du 6 au 12 novembre\)/))
  assert.ok(b.has(/MVP de la semaine/))
  assert.match(b.image(/Fin de la semaine/), /MVP DE LA SEMAINE/)
  assert.equal(await announceSeasons(), 0)
  const s = scores.playerStats(GRP, '237600000001')
  assert.equal(s.champSeasons, 1)
  assert.ok(titlesOf(s).some((t) => t.name === 'MVP de la semaine'))
})

test('défis : trois par semaine, les mêmes pour tout le groupe, différents d’une semaine à l’autre', () => {
  const a = weekChallenges(GRP, '2023-11-13')
  assert.deepEqual(a.map((c) => c.level), [0, 1, 2])
  assert.equal(new Set(a.map((c) => c.id)).size, 3)
  assert.deepEqual(a.map((c) => c.text), weekChallenges(GRP, '2023-11-13').map((c) => c.text))
  assert.notDeepEqual(a.map((c) => c.text), weekChallenges(GRP, '2023-11-20').map((c) => c.text))
})

test('défis : annoncés une seule fois quand ils sont relevés', () => {
  const g = 'defis@g.us'
  const now = new Date(Date.now())
  const wk = scores.weekKey(now)
  const list = weekChallenges(g, wk)
  const p = { num: '237611111111', jid: jid('237611111111') }
  // un joueur qui explose tous les compteurs de la semaine
  scores.recordGame(g, 'd1', [row('237611111111', 'imposteur', true, 50, { clues: 20, fast: 20, talk: 500, right: 30, stolen: 9, votes: 40, caught: 0 })], Date.now())
  const lines = completeChallenges(g, [p], now)
  assert.ok(lines.length >= 1 && lines.every((l) => /relève le défi/.test(l)))
  assert.deepEqual(completeChallenges(g, [p], now), [], 'jamais deux fois')
  assert.ok(list.length === 3)
})

test('surnoms : relatifs au groupe, avec explication ; anciennes parties non mesurées ignorées', () => {
  const base = { games: 12, wins: 6, points: 10, asImposter: 3, impWins: 1, civGames: 9, civWins: 5, rightVotes: 3, wrongVotes: 3, votes: 12, received: 12, abstain: 0, talk: 60, clues: 24, clen: 144, herd: 6, missed: 0, stolen: 0 }
  const peer = (talk) => ({ ...base, talk })
  // Même nombre de messages : « bavard » dans un groupe calme, banal dans un groupe de bavards
  const calm = { ...base, talk: 96, peers: [peer(20), peer(24), peer(30), peer(36), { ...base, talk: 96 }] }
  const loud = { ...base, talk: 96, peers: [peer(90), peer(100), peer(110), peer(120), { ...base, talk: 96 }] }
  assert.equal(styleOf(calm).nickname, 'Le Bavard')
  assert.ok((styleOf(loud).traits.find((t) => t.id === 'bavard')?.score ?? 0) < styleOf(calm).traits.find((t) => t.id === 'bavard').score - 0.3, 'banal dans un groupe de bavards : style atténué')
  assert.match(styleOf(calm).why, /messages par partie : 8,0 \(groupe : /)
  // Pas de « Télégraphiste » à cause d'anciennes parties sans mesure des lettres
  const old = { ...base, clen: 0, t1: { games: 12, civGames: 9, asImposter: 3 }, t2: { games: 0, civGames: 0, asImposter: 0, clues: 0, votes: 0 } }
  assert.notEqual(styleOf(old).nickname, 'Le Télégraphiste')
  assert.ok(styleOf(calm).traits.length >= 1 && styleOf(calm).traits.length <= 3)
})

test('thèmes de fête : dates, fêtes mobiles (Pâques, Ramadan, Aïd, Tabaski), décor', () => {
  const T = (y, m, d) => activeTheme(new Date(y, m - 1, d), 'auto')
  assert.equal(T(2026, 10, 31), 'halloween')
  assert.equal(T(2026, 12, 25), 'noel')
  assert.equal(T(2026, 12, 31), 'nouvelan')
  assert.equal(T(2027, 1, 1), 'nouvelan')
  assert.equal(T(2027, 1, 5), 'noel')
  assert.equal(T(2026, 2, 14), 'valentin')
  assert.equal(T(2026, 5, 20), 'cameroun')
  assert.equal(T(2026, 3, 1), 'ramadan')
  assert.equal(T(2026, 3, 20), 'aid')
  assert.equal(T(2026, 5, 27), 'tabaski')
  assert.equal(easter(2026).getDate(), 5)
  assert.equal(T(2026, 4, 3), 'paques')
  assert.equal(T(2026, 4, 6), 'paques')
  assert.equal(T(2026, 4, 8), null)
  assert.equal(T(2026, 6, 10), null)
  assert.equal(activeTheme(new Date(2026, 11, 25), 'none'), null)
  for (const th of ['noel', 'halloween', 'nouvelan', 'valentin', 'paques', 'cameroun', 'ramadan', 'aid', 'tabaski']) {
    assert.match(decor(th, 900, 900), new RegExp(`theme-${th}`))
    assert.ok(greeting(th).length > 5)
    assert.doesNotMatch(greeting(th), /imposteur/i)
  }
  const s = { games: 3, wins: 1, points: 2, asImposter: 0, impWins: 0, civGames: 3, civWins: 1, streak: 0, bestStreak: 1, form: [], rank: 1, players: 2 }
  assert.doesNotMatch(profileSvg(s, 'A'), /theme-/)
  for (const th of ['ramadan', 'paques', 'tabaski']) {
    config.theme = th
    assert.match(profileSvg(s, 'A'), new RegExp(`theme-${th}`))
  }
  config.theme = 'auto'
})
