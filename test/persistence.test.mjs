import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boot, startGame, playClues, voteFor, PL, G, jid } from './helpers.mjs'

const b = await boot()
const { getGame, removeGame } = await import('../src/game/store.js')
const { resumeGames } = await import('../src/game/resume.js')
const { loadGameStates } = await import('../src/storage/games.js')
const { getDb } = await import('../src/storage/db.js')

// Plantage : plus de minuteries ni de partie en mémoire, mais la base survit
const crashAndRestart = async () => {
  b.crash()
  removeGame(G)
  assert.equal(getGame(G), undefined)
  b.mark()
  return resumeGames()
}

test('reprise pendant le débat : rôles, indices et temps restant conservés', async () => {
  const { P, imposters } = await startGame(b, { n: 4 })
  await playClues(b)
  const before = getGame(G)
  const snapshot = { word: before.word, imposters: before.imposters.map((p) => p.num), clues: before.clues.length, manche: before.manche }
  await b.advance(20000) // 20 s de débat écoulées

  assert.equal(await crashAndRestart(), 1)
  assert.ok(b.has(/Le bot a redémarré/))
  const g = getGame(G)
  assert.equal(g.phase, 'discuss')
  assert.equal(g.word, snapshot.word)
  assert.deepEqual(g.imposters.map((p) => p.num), snapshot.imposters)
  assert.equal(g.clues.length, snapshot.clues)
  assert.ok(g.clues.every((c) => c.p && c.p.num), 'les références aux joueurs sont reconstruites')

  // le temps restant est repris (≈ 40 s), puis le vote démarre tout seul
  await b.advance(35000)
  assert.equal(getGame(G).phase, 'discuss')
  await b.advance(10000)
  assert.equal(getGame(G).phase, 'vote')
  assert.equal(P.length, 4)
  assert.equal(imposters.length, 1)
})

test('reprise pendant le vote : les votes déjà exprimés sont conservés, et la partie se termine normalement', async () => {
  // on repart de la partie précédente, en plein vote
  const g0 = getGame(G)
  assert.equal(g0.phase, 'vote')
  const [a, c, d] = g0.players.filter((p) => !g0.imposters.includes(p)).map((p) => p.num)
  const imp = g0.imposters[0].num
  await b.send(G, a, 'je vote', [jid(imp)])
  await b.send(G, c, 'je vote', [jid(imp)])
  assert.equal(getGame(G).votes.size, 2)

  await crashAndRestart()
  const g = getGame(G)
  assert.equal(g.phase, 'vote')
  assert.equal(g.votes.size, 2, 'votes conservés')
  assert.equal([...g.votes.values()][0].num, imp)

  await b.send(G, d, 'je vote', [jid(imp)]) // le 3e civil vote, l’imposteur ne vote pas : fin au délai
  assert.ok(await b.waitFor(/Dernière chance/, 90000))
  await b.send(G, imp, 'zzzzz')
  assert.ok(await b.waitFor(/FIN DE PARTIE/, 30000))
  assert.match(b.last(/FIN DE PARTIE/), /Les civils gagnent/)
  assert.deepEqual(loadGameStates(), [], 'la sauvegarde est effacée en fin de partie')
})

test('reprise dans la salle d’attente : les joueurs inscrits et le format sont conservés', async () => {
  b.mark()
  await b.send(G, PL[0], '/imposteur proche')
  await b.send(G, PL[0], '2')
  await b.send(G, PL[1], '/join')
  await b.send(G, PL[2], '/join')
  await crashAndRestart()
  const g = getGame(G)
  assert.equal(g.phase, 'lobby')
  assert.equal(g.players.length, 3)
  assert.equal(g.mode, 'proche')
  assert.equal(g.format, 'rounds')
  await b.send(G, PL[3], '/join') // on peut continuer à s’inscrire
  assert.equal(getGame(G).players.length, 4)
  await b.send(G, PL[0], '/stop')
  assert.deepEqual(loadGameStates(), [])
})

test('une partie interrompue depuis trop longtemps n’est pas reprise', async () => {
  b.mark()
  await b.send(G, PL[0], '/imposteur')
  await b.send(G, PL[1], '/join')
  assert.equal(loadGameStates().length, 1)
  getDb().prepare('UPDATE games SET updated = ?').run(Date.now() - 3 * 3600 * 1000)
  assert.equal(await crashAndRestart(), 0)
  assert.equal(getGame(G), undefined)
  assert.deepEqual(loadGameStates(), [], 'la sauvegarde périmée est supprimée')
})
