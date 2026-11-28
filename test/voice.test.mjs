import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boot, startGame, playClues, voteFor, G, PL } from './helpers.mjs'

const b = await boot()
const { VOICE, phrase, host } = await import('../src/game/voice.js')

test('voix : chaque moment a plusieurs phrases, aucune ne parle de « l’imposteur » (accord 1 ou plusieurs)', () => {
  for (const [moment, pool] of Object.entries(VOICE)) {
    assert.ok(pool.length >= 2, `${moment} : au moins 2 variantes`)
    for (const p of pool) {
      const text = typeof p === 'function' ? p('@237600000001') : p
      assert.ok(text.length > 10, `${moment} : phrase trop courte`)
      assert.doesNotMatch(text, /imposteur/i, `${moment} : « ${text} » nomme l’imposteur (pluriel/singulier)`)
    }
  }
})

test('voix : jamais la même phrase deux fois de suite, variété réelle', () => {
  const seen = new Set()
  let prev = null
  for (let i = 0; i < 60; i++) {
    const p = phrase('counting')
    assert.notEqual(p, prev)
    seen.add(p)
    prev = p
  }
  assert.ok(seen.size >= 4)
  assert.match(host('open'), /^🎙️ _.+_$/)
  assert.match(phrase('unmasked', '@237600000009'), /@237600000009/)
})

test('partie complète : le présentateur parle à chaque moment fort', async () => {
  const { P, imposters } = await startGame(b, { n: 4 })
  assert.ok(b.has(/🎙️/), 'ouverture et début des indices')
  await playClues(b)
  assert.ok(b.has(/Tableau des indices/))
  await voteFor(b, P, imposters[0])
  assert.ok(await b.waitFor(/Dernière chance/, 90000))
  assert.ok(b.has(/dépouillement en cours/i), 'suspense avant le dépouillement')
  assert.match(b.last(/est bien/), /🎙️/, 'ironie quand l’imposteur est démasqué')
  await b.send(G, imposters[0], 'zzzzz')
  assert.ok(await b.waitFor(/FIN DE PARTIE/, 20000))
  assert.match(b.last(/FIN DE PARTIE/), /🎙️/, 'commentaire de victoire')
})
