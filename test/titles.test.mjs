import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boot, startGame, playClues, voteFor, PL, G, jid } from './helpers.mjs'

const b = await boot()
const { titlesOf, nextChallenge, nicknameOf } = await import('../src/game/titles.js')
const { makeLimiter } = await import('../src/core/limiter.js')
const { checkCooldown, _resetCooldowns } = await import('../src/core/cooldown.js')
const { profileSvg } = await import('../src/render/profile.js')

const base = { games: 0, wins: 0, points: 0, asImposter: 0, impWins: 0, civGames: 0, civWins: 0, streak: 0, bestStreak: 0, rightVotes: 0, wrongVotes: 0, votes: 0, received: 0, abstain: 0, talk: 0, clues: 0, missed: 0, stolen: 0, champSeasons: 0, form: [], rank: 1, players: 3 }
const S = (o) => ({ ...base, ...o })

test('titres : paliers, plus haut palier retenu', () => {
  assert.deepEqual(titlesOf(S({ impWins: 4, rightVotes: 4 })), [])
  const t = titlesOf(S({ impWins: 5, rightVotes: 21, games: 12 }))
  assert.deepEqual(t.map((x) => x.name).sort(), ['Habitué', 'Inspecteur', 'Menteur né'])
  assert.equal(titlesOf(S({ impWins: 15 })).find((x) => x.id === 'menteur').name, 'Maître du bluff')
})

test('défis : le prochain est celui dont on est le plus proche', () => {
  const n = nextChallenge(S({ impWins: 4, rightVotes: 1, games: 2 }))
  assert.equal(n.name, 'Menteur né')
  assert.equal(n.value, 4)
  assert.equal(n.goal, 5)
})

test('surnoms : style de jeu, Novice avant 5 parties', () => {
  assert.equal(nicknameOf(S({ games: 4 })), 'Le Novice')
  assert.equal(nicknameOf(S({ games: 8, talk: 4 })), 'Le Silencieux')
  assert.equal(nicknameOf(S({ games: 8, talk: 80 })), 'Le Bavard')
  assert.equal(nicknameOf(S({ games: 8, talk: 30, rightVotes: 7, wrongVotes: 2 })), 'Le Fin Limier')
  assert.equal(nicknameOf(S({ games: 8, talk: 30, rightVotes: 2, wrongVotes: 7 })), 'L’Accusateur')
  assert.equal(nicknameOf(S({ games: 8, talk: 30, stolen: 2 })), 'Le Voleur de mots')
  assert.equal(nicknameOf(S({ games: 8, talk: 30 })), 'Le Mystérieux')
})

test('carte de profil : surnom, titres et prochain défi', () => {
  const svg = profileSvg(S({ games: 8, wins: 5, impWins: 5, asImposter: 6, talk: 80, form: [{ won: true, role: 'imposteur' }] }), 'Alice')
  assert.match(svg, /Le Caméléon/)
  assert.match(svg, /Menteur né/)
  assert.match(svg, /Prochain défi/)
  const rookie = profileSvg(S({ games: 1, form: [] }), 'Bob')
  assert.match(rookie, /Aucun titre/)
  assert.match(rookie, /Le Novice/)
})

test('file de rendus : jamais plus de 2 en même temps, tout est exécuté dans l’ordre', async () => {
  const l = makeLimiter(2)
  let active = 0
  let peak = 0
  const order = []
  await Promise.all(
    [0, 1, 2, 3, 4, 5].map((i) =>
      l.run(async () => {
        active++
        peak = Math.max(peak, active)
        await new Promise((r) => setImmediate(r))
        order.push(i)
        active--
      })
    )
  )
  assert.equal(peak, 2)
  assert.deepEqual(order, [0, 1, 2, 3, 4, 5])
  assert.equal(l.stats().done, 6)
  await l.idle()
})

test('délai anti-spam : une alerte, puis silence, puis de nouveau permis', () => {
  _resetCooldowns()
  assert.equal(checkCooldown('k', 10, 0).ok, true)
  const a = checkCooldown('k', 10, 3000)
  assert.deepEqual([a.ok, a.warn, a.wait], [false, true, 7])
  assert.equal(checkCooldown('k', 10, 4000).warn, false) // silence
  assert.equal(checkCooldown('k', 10, 11000).ok, true)
})

test('/top et /stats : 2e appel immédiat refusé (1 avertissement), admin dispensé', async () => {
  const P = PL.slice(0, 4)
  await startGame(b, { n: 4 })
  b.mark()
  await b.send(G, P[1], '/top')
  await b.send(G, P[1], '/top')
  await b.send(G, P[1], '/top')
  assert.equal(b.count(/doucement/), 1)
  await b.advance(21000)
  b.mark()
  await b.send(G, P[1], '/top')
  assert.equal(b.count(/doucement/), 0)
  await b.send(G, PL[0], '/imposteur stop') // libère le groupe pour le test suivant
  await b.advance(1000)
})

test('comportement enregistré en base : votes, indices, accusations', async () => {
  const { getDb } = await import('../src/storage/db.js')
  const { P, imposters } = await startGame(b, { n: 4 })
  await playClues(b)
  await b.send(G, P[1], 'je dis des mots pendant le débat')
  await voteFor(b, P, imposters[0])
  assert.ok(await b.waitFor(/Dernière chance|FIN DE PARTIE/, 90000))
  if (b.has(/Dernière chance/)) await b.send(G, imposters[0], 'zzzzz')
  assert.ok(await b.waitFor(/FIN DE PARTIE/, 20000))
  const rows = getDb().prepare('SELECT * FROM results WHERE game_id = (SELECT game_id FROM results ORDER BY id DESC LIMIT 1)').all()
  assert.equal(rows.length, 4)
  assert.ok(rows.every((r) => r.clues >= 1), 'chacun a donné au moins un indice')
  const imp = rows.find((r) => r.num === imposters[0])
  assert.equal(imp.received, 3, 'l’imposteur a reçu 3 votes')
  assert.equal(rows.filter((r) => r.right > 0).length, 3, 'les 3 civils ont voté juste')
  assert.ok(rows.find((r) => r.num === P[1]).talk >= 1)
})

// ── Pluriel : « mur » et « murs » sont le même mot ───────────────────────────────────────────────
const { sameWord, stem } = await import('../src/core/utils.js')
test('singulier et pluriel équivalents (accents et casse aussi)', () => {
  for (const [a, b] of [['Mur', 'Murs'], ['murs', 'MUR'], ['Cheval', 'Chevaux'], ['Eau', 'Eaux'], ['Prix', 'prix'], ['Gâteau', 'gateaux'], ['Pont Neuf', 'ponts neufs'], ['Café', 'cafés']]) {
    assert.ok(sameWord(a, b), `${a} = ${b} (${stem(a)} / ${stem(b)})`)
  }
  for (const [a, b] of [['Mur', 'Muret'], ['Mer', 'Mère'], ['Pont', 'Port'], ['Chat', 'Chats ou chien']]) assert.ok(!sameWord(a, b), `${a} ≠ ${b}`)
})
