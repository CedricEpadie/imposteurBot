import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { boot, startGame, PL, G, jid } from './helpers.mjs'

const b = await boot({ env: { ADMIN_NUMBERS: PL[0] } })
const { getGame } = await import('../src/game/store.js')
const { getPacks, getPack, loadPacks, pairsFor } = await import('../src/content/packs.js')
const DATA = process.env.DATA_DIR

test('les packs fournis sont chargés depuis des fichiers JSON', () => {
  const ids = getPacks().map((p) => p.id).sort()
  assert.deepEqual(ids, ['base', 'douala', 'foot', 'musique', 'yaounde'])
  assert.ok(getPack('yaounde').categories['🏘️ Quartiers de Yaoundé'].length >= 5)
})

test('le lanceur choisit un pack dans la salle d’attente ; les mots viennent de ce pack', async () => {
  b.mark()
  await b.send(G, PL[0], '/imposteur')
  await b.send(G, PL[1], '/join')
  await b.send(G, PL[2], '/join')
  await b.send(G, PL[1], '/imposteur packs foot') // pas le lanceur
  assert.ok(b.has(/dans la salle d’attente \(lanceur\) ou par un admin/))
  await b.send(G, PL[0], '/imposteur packs inconnu')
  assert.ok(b.has(/Pack inconnu/))
  await b.send(G, PL[0], '/imposteur packs foot')
  assert.ok(b.has(/Packs activés : Foot/))
  await b.send(G, PL[0], '/go')
  await b.advance(60000)
  const cats = Object.keys(getPack('foot').categories)
  assert.ok(cats.includes(getGame(G).category), `catégorie « ${getGame(G).category} » issue du pack foot`)
  await b.send(G, PL[0], '/stop')

  await b.send(G, PL[2], '/packs') // liste
  assert.match(b.last(/Packs de mots/), /▫️ \*base\*[\s\S]*✅ \*foot\*/)
  await b.send(G, PL[0], '/imposteur packs tous') // admin : possible hors salle d’attente
  assert.ok(b.has(/Tous les packs sont activés/))
})

test('ajouter des mots : admin seulement, validation, écriture dans un fichier modifiable', async () => {
  b.mark()
  await b.send(G, PL[1], '/imposteur ajouter foot : Joueurs : Pelé / Maradona')
  assert.ok(b.has(/réservée aux admins/))

  await b.send(G, PL[0], '/imposteur ajouter foot : Joueurs : Pelé / Maradona')
  assert.ok(b.has(/Paire ajoutée : \*Pelé\* \/ \*Maradona\*/), 'casse et accents conservés')
  const file = path.join(DATA, 'packs', 'foot.json')
  assert.ok(fs.existsSync(file), 'fichier créé dans le dossier de données')
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).categories['⚽ Joueurs'], [['Pelé', 'Maradona']], 'catégorie existante retrouvée sans emoji')
  assert.ok(pairsFor(['foot']).some((x) => x.a === 'Pelé' && x.b === 'Maradona'), 'disponible tout de suite en jeu')
  assert.equal(getPack('foot').categories['⚽ Joueurs'].length, 10, 'fusionné avec le pack fourni (9 + 1)')

  await b.send(G, PL[0], '/imposteur ajouter foot : Joueurs : maradona / pelé')
  assert.ok(b.has(/cette paire existe déjà/))
  await b.send(G, PL[0], '/imposteur ajouter Joueurs : Messi')
  assert.ok(b.has(/Usage : \*\/imposteur ajouter/))
  await b.send(G, PL[0], '/imposteur ajouter Animaux : chat / chat')
  assert.ok(b.has(/doivent être différents/))

  // sans pack : pack « perso » ; un admin peut aussi ajouter en privé avec le bot
  await b.send(jid(PL[0]), PL[0], '/imposteur ajouter Tontons : Mimboman / Mvan')
  assert.ok(b.has(/Pack : perso/))
  assert.ok(getPack('perso'), 'nouveau pack créé')
})

test('un fichier de pack invalide est ignoré sans casser le bot', () => {
  fs.writeFileSync(path.join(DATA, 'packs', 'casse.json'), '{ pas du json')
  fs.writeFileSync(path.join(DATA, 'packs', 'vide.json'), JSON.stringify({ categories: { x: [['seul']] } }))
  assert.doesNotThrow(() => loadPacks())
  assert.ok(getPack('base') && getPack('foot'))
  assert.equal(getPack('casse'), undefined)
  assert.deepEqual(getPack('vide').categories, {}, 'paires invalides écartées')
})
