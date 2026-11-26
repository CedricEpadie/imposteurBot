import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boot, startGame, playClues, voteFor, PL, G, jid } from './helpers.mjs'

const b = await boot({ env: { ADMIN_NUMBERS: PL[0] } })
const { playerStats, overallRanking, sessionRanking } = await import('../src/storage/scores.js')

test('partie classique : les civils trouvent l’imposteur → points de vote juste + victoire', async () => {
  const { P, imposters, civils } = await startGame(b, { n: 4 })
  assert.equal(imposters.length, 1)
  await playClues(b)
  assert.ok(b.has(/Tableau des indices/), 'le tableau des indices est envoyé')
  await voteFor(b, P, imposters[0])
  assert.ok(await b.waitFor(/Dernière chance/, 90000))
  await b.send(G, imposters[0], 'zzzzz') // mauvais mot
  assert.ok(await b.waitFor(/FIN DE PARTIE/, 20000))
  const end = b.last(/FIN DE PARTIE/)
  assert.match(end, /Les civils gagnent/)
  const svg = b.image(/FIN DE PARTIE/)
  assert.match(svg, /POINTS DE LA PARTIE/)
  assert.match(svg, /CLASSEMENT DE LA SESSION/)
  assert.match(svg, /LES CIVILS GAGNENT/)
  assert.ok(b.has(/Récap des indices/), 'les indices suivent en texte')

  // chaque civil : 1 (vote juste) + 2 (victoire) = 3 ; l’imposteur : 0
  for (const c of civils) assert.equal(playerStats(G, c).points, 3, `civil ${c}`)
  assert.equal(playerStats(G, imposters[0]).points, 0)
  assert.equal(playerStats(G, imposters[0]).asImposter, 1)
})

test('l’imposteur qui survit marque des points ; le classement cumule', async () => {
  const { P, imposters, civils } = await startGame(b, { n: 4 })
  const before = playerStats(G, imposters[0])?.points ?? 0 // cumul des parties précédentes
  await playClues(b)
  // tout le monde accuse un civil (sauf lui-même) → l’imposteur gagne
  const victim = civils[0]
  await voteFor(b, P, victim)
  assert.ok(await b.waitFor(/L’imposteur gagne/, 90000), 'victoire de l’imposteur')
  assert.match(b.last(/FIN DE PARTIE/), /mais c’était un civil/)
  const imp = playerStats(G, imposters[0])
  assert.equal(imp.points - before, 3, 'imposteur gagnant : +3')

  const all = overallRanking(G, 10)
  assert.equal(all.length, 4)
  assert.ok(all[0].points >= all[all.length - 1].points, 'classement trié')
  assert.ok(sessionRanking(G, 5).length > 0, 'session en cours')

  await b.send(G, PL[1], '/top')
  const top = b.image(/Classement du groupe/)
  assert.match(top, /CLASSEMENT/)
  assert.match(top, /SESSION EN COURS/)
  await b.send(G, PL[1], '/stats')
  const card = b.image(/Profil de/)
  assert.match(card, /PROFIL DE JOUEUR/)
  assert.match(card, /EN IMPOSTEUR/)
  assert.match(card, /EN CIVIL/)
})

test('reset : réservé aux admins, avec confirmation, n’efface que les scores', async () => {
  await b.send(G, PL[1], '/imposteur reset confirmer') // pas admin
  assert.ok(b.has(/réservée aux admins/))
  assert.ok(overallRanking(G).length > 0)

  await b.send(G, PL[0], '/imposteur reset confirmer') // admin mais pas de demande préalable
  assert.ok(b.has(/Pour confirmer dans la minute/))
  assert.ok(overallRanking(G).length > 0, 'rien d’effacé sans demande préalable')

  await b.send(G, PL[0], '/imposteur reset confirmer')
  assert.ok(b.has(/Scores effacés/))
  assert.equal(overallRanking(G).length, 0)
  const { getPacks } = await import('../src/content/packs.js')
  assert.ok(getPacks().length >= 5, 'les mots ne sont pas touchés')
})
