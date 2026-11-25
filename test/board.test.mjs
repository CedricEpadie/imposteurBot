import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boot, startGame, playClues, voteFor, PL, G } from './helpers.mjs'

const b = await boot()
const { getGame } = await import('../src/game/store.js')

const boards = () => b.sock.sent.filter((r) => r.content.image && /Tableau des indices/.test(r.content.caption || ''))

test('le tableau des indices est envoyé en image pendant le débat', async () => {
  const { P } = await startGame(b, { n: 4 })
  await playClues(b)
  const img = boards().at(-1)
  assert.ok(img, 'image envoyée')
  assert.equal(img.jid, G)
  assert.match(img.content.caption, /PHASE 4\/6 · DÉBAT/)
  const svg = String(img.content.image)
  assert.match(svg, /TABLEAU DES INDICES/)
  for (const w of ['indice1x', 'indice2x', 'indice8x']) assert.ok(svg.includes(w), `contient ${w}`)
  for (const p of P) assert.ok(svg.includes(`Joueur ${p.slice(-2)}`), `contient le nom de ${p}`)
  assert.match(svg, /Tour 1[\s\S]*Tour 2/)
  assert.doesNotMatch(svg, /line-through/, 'personne n’est éliminé')
  assert.equal(b.count(/Récapitulatif des indices/), 0, 'pas de doublon en texte')
  await b.send(G, PL[0], '/stop')
})

test('format manches : les éliminés sont barrés et la manche est indiquée', async () => {
  const { P, civils } = await startGame(b, { n: 5, format: 2 })
  await playClues(b)
  await voteFor(b, P, civils[0])
  assert.ok(await b.waitFor(/Manche 2/, 90000))
  await playClues(b)
  const svg = String(boards().at(-1).content.image)
  assert.match(svg, /Manche 2/)
  assert.match(svg, /line-through/, 'le joueur éliminé est barré')
  assert.ok(svg.includes(`Joueur ${civils[0].slice(-2)}`))
  assert.match(boards().at(-1).content.caption, /MANCHE 2/)
})
