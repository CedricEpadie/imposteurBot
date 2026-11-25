import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boot, startGame, playClues, voteFor, PL, G, jid } from './helpers.mjs'

const b = await boot()
const { getGame } = await import('../src/game/store.js')

// Un vote complet : tout le monde (en vie) accuse `target`, qui ne vote pas pour lui-même
const roundVote = async (alive, target) => {
  await playClues(b)
  await voteFor(b, alive, target)
}

test('la question « 1 ou 2 » est posée, seul le lanceur répond', async () => {
  b.mark()
  await b.send(G, PL[0], '/imposteur')
  assert.match(b.last(/Format de la partie/), /1️⃣[\s\S]*2️⃣[\s\S]*Format choisi : \*1\*/)
  await b.send(G, PL[1], '2') // pas le lanceur : ignoré
  assert.equal(getGame(G).format, 'single')
  await b.send(G, PL[0], '2')
  assert.equal(getGame(G).format, 'rounds')
  assert.ok(b.has(/Format \*2\* : plusieurs manches/))
  await b.send(G, PL[0], '/stop')
})

test('format 2 à 5 joueurs : on élimine jusqu’à 3 joueurs, les imposteurs gagnent s’ils survivent', async () => {
  const { P, imposters, civils } = await startGame(b, { n: 5, format: 2 })
  assert.equal(imposters.length, 1, '1 seul imposteur sous 8 joueurs')
  const g = getGame(G)
  assert.equal(g.format, 'rounds')

  // manche 1 : le groupe accuse un civil → éliminé, on continue
  await roundVote(P, civils[0])
  assert.ok(await b.waitFor(/Manche 2/, 90000), 'manche 2')
  assert.match(b.last(/est éliminé/), /civil/)
  assert.match(b.last(/Points de la manche 1/) || 'Aucun point', /Points de la manche 1|Aucun point/)
  assert.equal(g.eliminated.size, 1)
  assert.equal(g.manche, 2)

  // le joueur éliminé ne peut ni donner d’indice ni voter
  const alive = P.filter((p) => p !== civils[0])
  await b.advance(5000)
  const n0 = b.texts().length
  await b.send(G, civils[0], 'bonjour')
  assert.equal(b.texts().length, n0)
  assert.doesNotMatch(b.last(/Manche 2/) || '', /undefined/)

  // manche 2 : on accuse encore un civil → il reste 3 joueurs → les imposteurs gagnent
  await roundVote(alive, civils[1])
  assert.ok(await b.waitFor(/FIN DE PARTIE/, 120000), 'fin de partie')
  const end = b.last(/FIN DE PARTIE/)
  assert.match(end, /L’imposteur gagne/)
  assert.match(end, /Il ne reste que \*3\* joueurs/)
  assert.match(end, /imposteur gagnant|Points de la partie/)
})

test('format 2 : démasquer le dernier imposteur donne la dernière chance de deviner le mot', async () => {
  const { P, imposters } = await startGame(b, { n: 5, format: 2 })
  await roundVote(P, imposters[0])
  assert.ok(await b.waitFor(/Dernière chance/, 90000))
  assert.match(b.last(/est éliminé/), /imposteur/)
  await b.send(G, imposters[0], 'zzzzz')
  assert.ok(await b.waitFor(/FIN DE PARTIE/, 30000))
  assert.match(b.last(/FIN DE PARTIE/), /Les civils gagnent/)
})

test('format 2 à 8 joueurs : 2 imposteurs ; en démasquer un fait continuer la partie', async () => {
  const { P, imposters, civils } = await startGame(b, { n: 8, format: 2 })
  assert.equal(imposters.length, 2, '2 imposteurs dès 8 joueurs')
  assert.ok(b.has(/2 imposteurs/), 'le groupe est prévenu')
  assert.ok(imposters.every((p) => /2 imposteurs/.test(b.dmOf(p))), 'chaque imposteur sait qu’il n’est pas seul')

  await roundVote(P, imposters[0])
  assert.ok(await b.waitFor(/Manche 2/, 120000), 'la partie continue')
  assert.match(b.last(/Il reste encore \*1\* imposteur/), /imposteur/)
  assert.equal(getGame(G).phase === 'guess', false, 'pas de dernière chance tant qu’un imposteur reste')
  assert.equal(getGame(G).eliminated.size, 1)
  await b.send(G, PL[0], '/stop')
  assert.ok(civils.length === 6)
})

test('format 2 sous 4 joueurs : repli sur un seul vote', async () => {
  const r = await startGame(b, { n: 3, format: 2 })
  assert.ok(b.has(/au moins 4 joueurs/))
  assert.equal(getGame(G).format, 'single')
  await b.send(G, PL[0], '/stop')
  assert.equal(r.P.length, 3)
})
