import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boot, startGame, currentTurn, voteFor, PL, G } from './helpers.mjs'

const b = await boot()
const { playerStats } = await import('../src/storage/scores.js')
const { getGame } = await import('../src/game/store.js')
const { config } = await import('../src/config.js')
const CLUE_MS = config.game.clueSeconds * 1000

// Joue les indices ; `silent` = joueurs qui ne disent rien (temps écoulé à chacun de leurs tours), `once` = ne manquent que leur 1er tour
const playWith = async ({ silent = [], once = [] }, until = /Tableau des indices|FIN DE PARTIE/) => {
  const skipped = new Set()
  for (let i = 0, k = 0; i < 80 && !b.has(until); i++) {
    const who = currentTurn(b)
    const turnKey = `${who}:${b.count(/C’est à @/)}`
    if (silent.includes(who) || (once.includes(who) && !skipped.has(who))) {
      if (once.includes(who)) skipped.add(who)
      await b.advance(CLUE_MS + 1500)
    } else {
      await b.send(G, who, `mot${++k}x`)
      await b.advance(4000)
    }
    await b.advance(1500)
    void turnKey
  }
}

test('un seul indice manqué : avertissement, pas d’éjection', async () => {
  const { P, civils } = await startGame(b, { n: 5 })
  await playWith({ once: [civils[0]] })
  assert.ok(b.has(/un autre indice manqué et tu seras \*éjecté/), 'avertissement après le 1er indice manqué')
  assert.ok(!b.has(/éjecté de la partie ! C’était/), 'pas éjecté')
  assert.equal(getGame(G).eliminated.size, 0)
  await b.send(G, P[0], '/imposteur stop')
})

test('civil silencieux : éjecté, la partie continue, ni vote ni points de victoire', async () => {
  const { P, imposters, civils } = await startGame(b, { n: 5 })
  const mute = civils[0]
  await playWith({ silent: [mute] })
  assert.ok(b.has(new RegExp(`@${mute} n’a donné aucun de ses 2 indices : éjecté de la partie ! C’était un \\*civil\\*`)))
  const g = getGame(G)
  assert.ok([...g.eliminated].some((p) => p.num === mute))
  assert.ok(b.has(/Tableau des indices/), 'la partie continue jusqu’au débat')

  const voters = P.filter((p) => p !== mute)
  await voteFor(b, voters, imposters[0])
  assert.ok(await b.waitFor(/Dernière chance/, 90000))
  await b.send(G, imposters[0], 'zzzzz')
  assert.ok(await b.waitFor(/FIN DE PARTIE/, 20000))
  const s = playerStats(G, mute)
  assert.equal(s.wins, 0, 'l’éjecté ne gagne pas')
  assert.equal(s.points, 0, 'et ne marque rien')
  const other = civils.find((c) => c !== mute)
  assert.equal(playerStats(G, other).points, 3, 'les autres civils : vote juste + victoire')
})

const playerStatsBefore = new Map()
const winsBefore = new Map()
test('imposteur silencieux : la partie s’arrête, tous les civils marquent 2 points, pas de dernière chance', async () => {
  const { P, imposters, civils } = await startGame(b, { n: 5 })
  for (const p of P) {
    playerStatsBefore.set(p, playerStats(G, p)?.points ?? 0)
    winsBefore.set(p, playerStats(G, p)?.wins ?? 0)
  }
  await playWith({ silent: [imposters[0]] })
  assert.ok(await b.waitFor(/FIN DE PARTIE/, 20000))
  assert.ok(b.has(/éjecté de la partie ! C’était un \*imposteur\*/))
  assert.ok(!b.has(/Dernière chance/), 'pas de dernière chance')
  assert.match(b.last(/FIN DE PARTIE/), /Les civils gagnent/)
  assert.match(b.last(/FIN DE PARTIE/), /tous les civils marquent 2 points/)
  for (const c of civils) assert.equal(playerStats(G, c).points - (playerStatsBefore.get(c) || 0), 2, `civil ${c}`)
  assert.equal(playerStats(G, imposters[0]).wins - (winsBefore.get(imposters[0]) || 0), 0)
  assert.equal(getGame(G), undefined, 'partie terminée')
})

test('civil éjecté qui laisse trop peu de joueurs : les imposteurs l’emportent', async () => {
  const { civils } = await startGame(b, { n: 3 })
  await playWith({ silent: [civils[0]] })
  assert.ok(await b.waitFor(/FIN DE PARTIE/, 20000))
  assert.match(b.last(/FIN DE PARTIE/), /gagne/)
  assert.match(b.last(/FIN DE PARTIE/), /trop peu pour continuer/)
})

test('plusieurs manches : le civil éjecté ne vote plus, l’éjection survit à un redémarrage', async () => {
  const { serializeGame, deserializeGame } = await import('../src/game/persistence.js')
  const { P, civils } = await startGame(b, { n: 6, format: 2 })
  const mute = civils[0]
  await playWith({ silent: [mute] })
  assert.ok(b.has(/éjecté de la partie ! C’était un \*civil\*/))
  const g = getGame(G)
  const back = deserializeGame(JSON.parse(JSON.stringify(serializeGame(g))))
  assert.deepEqual([...back.ejected].map((p) => p.num), [mute])
  assert.ok([...back.eliminated].some((p) => p.num === mute))
  // il est hors vote : son @ ne compte pas et il n'est pas attendu
  await b.send(G, P[0], '/vote')
  assert.ok(!b.has(new RegExp(`En attente : .*@${mute}`)))
  await b.send(G, P[0], '/imposteur stop')
})
