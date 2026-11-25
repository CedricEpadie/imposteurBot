import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boot, startGame, currentTurn, PL, G } from './helpers.mjs'

const b = await boot()

test('règles d’indices : un mot, pas de phrase, pas de répétition, pas son mot secret', async () => {
  const { P } = await startGame(b, { n: 4 })
  const first = currentTurn(b)
  assert.ok(first, 'un premier joueur est désigné')

  // une phrase est refusée avec le message demandé, et le tour continue (on ne retient pas le 1er mot)
  await b.send(G, first, 'je pense que c’est bon')
  assert.ok(b.has(/L'indice en un mot pas de phrase !/), 'message de refus')
  assert.equal(b.count(/a donné son indice/), 0, 'aucun indice enregistré')
  assert.equal(currentTurn(b), first, 'c’est toujours son tour')

  // un seul mot : accepté
  await b.send(G, first, 'soleil')
  await b.advance(4000)
  assert.equal(b.count(/a donné son indice : \*soleil\*/), 1)

  // le joueur suivant ne peut pas répéter l’indice d’un autre (casse et accents ignorés)
  const second = currentTurn(b)
  assert.notEqual(second, first)
  await b.send(G, second, 'Soleil')
  assert.ok(b.has(/« Soleil » a déjà été donné par @/), 'répétition refusée')
  assert.equal(currentTurn(b), second)

  // son propre mot secret est refusé
  const secret = (b.dmOf(second).match(/Mot secret : \*(.+?)\*/) || [])[1]
  if (secret && !secret.includes(' ')) {  // un mot secret composé ne peut de toute façon pas être dit en un mot
    await b.send(G, second, secret)
    assert.ok(b.has(/tu ne peux pas dire ton mot secret/))
  }

  // un autre mot passe
  await b.send(G, second, 'lune')
  await b.advance(4000)
  assert.equal(b.count(/a donné son indice : \*lune\*/), 1)

  // un joueur qui n’est pas au tour est ignoré
  const other = P.find((p) => p !== currentTurn(b))
  const before = b.texts().length
  await b.send(G, other, 'mot')
  assert.equal(b.texts().length, before, 'message hors tour ignoré')
})
