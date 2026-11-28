import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boot, startGame, playClues, voteFor, G } from './helpers.mjs'

const b = await boot()

// L'imposteur démasqué tente `guess` ; on renvoie true s'il vole la victoire
const tryGuess = async (transform) => {
  const { P, imposters } = await startGame(b, { n: 4 })
  const { getGame } = await import('../src/game/store.js')
  const word = getGame(G).word
  await playClues(b)
  await voteFor(b, P, imposters[0])
  assert.ok(await b.waitFor(/Dernière chance/, 90000))
  await b.send(G, imposters[0], transform(word))
  assert.ok(await b.waitFor(/FIN DE PARTIE/, 20000))
  return { won: /L’imposteur gagne/.test(b.last(/FIN DE PARTIE/)), word }
}

const plural = (w) => w.split(' ').map((x) => (/[sx]$/.test(x) ? x : x + 's')).join(' ')
const singular = (w) => w.split(' ').map((x) => (x.length > 3 && /s$/.test(x) ? x.slice(0, -1) : x)).join(' ')

test('devinette : le mot exact gagne', async () => assert.equal((await tryGuess((w) => w)).won, true))
test('devinette : le pluriel du mot gagne aussi', async () => assert.equal((await tryGuess(plural)).won, true))
test('devinette : le singulier d’un mot au pluriel gagne aussi', async () => assert.equal((await tryGuess(singular)).won, true))
test('devinette : majuscules et accents ignorés', async () => assert.equal((await tryGuess((w) => w.toUpperCase())).won, true))
test('devinette : un autre mot perd', async () => assert.equal((await tryGuess(() => 'zzzzz')).won, false))
