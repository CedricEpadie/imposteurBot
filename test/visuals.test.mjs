import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boot, startGame, playClues, voteFor, PL, G } from './helpers.mjs'

const b = await boot()
const { getGame } = await import('../src/game/store.js')
const { C } = await import('../src/render/theme.js')

test('/aide : carte des règles en image, commandes en légende', async () => {
  b.mark()
  await b.send(G, PL[0], '/aide')
  const svg = b.image(/les règles en image/)
  assert.match(svg, /RÈGLES DU JEU/)
  assert.match(svg, /POINTS/)
  assert.match(svg, /Variante « proche »/, 'les variantes de mode figurent sur la carte')
  assert.ok(b.has(/imposteur etat/) && b.has(/imposteur top/), 'les commandes restent en texte')
})

test('charte : toutes les images utilisent la même palette et la même police', async () => {
  const { rulesSvg } = await import('../src/render/rules.js')
  const { FONT } = await import('../src/render/theme.js')
  const svg = rulesSvg()
  assert.ok(svg.includes(C.bg) && svg.includes(FONT))
  assert.ok(svg.includes('L’IMPOSTEUR'), 'signature de la charte')
})

test('/etat : carte d’état en image pendant la partie', async () => {
  const { P } = await startGame(b, { n: 4 })
  b.mark()
  await b.send(G, P[1], '/etat')
  const svg = b.image(/État de la partie/)
  assert.match(svg, /ÉTAT DE LA PARTIE/)
  assert.match(svg, /JOUEURS \(4\//)
  assert.match(svg, /À parler/)
  await b.send(G, P[0], '/stop')
})

test('dépouillement : graphique en image, sans révéler les rôles', async () => {
  const { P, imposters } = await startGame(b, { n: 4 })
  await playClues(b)
  await voteFor(b, P, imposters[0])
  assert.ok(await b.waitFor(/Dernière chance/, 90000))
  const svg = b.image(/Résultat du vote/)
  assert.match(svg, /DÉPOUILLEMENT/)
  assert.match(svg, /3 votes/)
  assert.doesNotMatch(svg, />(IMPOSTEUR|CIVIL)</, 'aucun rôle dans le graphique')
  await b.send(G, imposters[0], 'zzzzz')
  assert.ok(await b.waitFor(/FIN DE PARTIE/, 20000))
})

test('sans rendu d’image, le texte complet prend le relais', async () => {
  const { sayVisual } = await import('../src/render/svg.js')
  b.mark()
  const r = await sayVisual(G, { svg: () => { throw new Error('boum') }, caption: 'légende', fallback: 'texte complet' })
  assert.equal(r.image, false)
  assert.ok(b.has(/texte complet/) && !b.has(/légende/))
})

test('pluriel : à 2 imposteurs, plus aucun message ne parle de « l’imposteur » au singulier', async () => {
  const { P, imposters, civils } = await startGame(b, { n: 8, format: 2 })
  assert.equal(imposters.length, 2)
  const SING = /l’imposteur(?! restant)|un imposteur[^s]|L’imposteur (gagne|a deviné)|de l’imposteur/
  const from = b.texts().length
  // les cartes privées
  for (const p of civils) assert.match(b.dmOf(p), /les imposteurs/, 'carte civil au pluriel')
  for (const p of imposters) assert.doesNotMatch(b.dmOf(p), /Si on te démasque/, 'seul le dernier démasqué devine')

  await playClues(b)
  await voteFor(b, P, imposters[0])
  assert.ok(await b.waitFor(/Manche 2/, 120000))
  const g = getGame(G)
  assert.equal(g.eliminated.size, 1)
  assert.ok(b.has(/Il reste encore \*1 imposteur\*/))

  const spoken = b.texts().slice(from).join('\n')
  const bad = spoken.match(SING)
  assert.equal(bad, null, `singulier trouvé : ${bad?.[0]}`)
  assert.ok(b.has(/Qui sont les \*2 imposteurs\*/), 'question de vote au pluriel')
  await b.send(G, PL[0], '/stop')
})

test('un seul imposteur : le singulier est conservé', async () => {
  const { P } = await startGame(b, { n: 4 })
  await playClues(b)
  await b.advance(70000)
  assert.ok(await b.waitFor(/Qui est l’imposteur \?/, 20000))
  await b.send(G, P[0], '/stop')
})

test('15 joueurs : la salle accepte jusqu’à 15 et refuse le 16e', async () => {
  const { config } = await import('../src/config.js')
  assert.equal(config.game.maxPlayers, 15)
  const { P } = await startGame(b, { n: 15, format: 2 })
  const g = getGame(G)
  assert.equal(g.players.length, 15)
  assert.equal(g.imposters.length, 3)
  await playClues(b)
  const svg = b.image(/Tableau des indices/)
  assert.ok(svg.includes('Joueur ' + P[14].slice(-2)), 'les 15 joueurs figurent sur le tableau')
  await b.send(G, P[0], '/stop')
})

test('le 16e joueur est refusé', async () => {
  b.mark()
  await b.send(G, PL[0], '/imposteur')
  for (const p of PL.slice(1, 15)) await b.send(G, p, '/join')
  assert.equal(getGame(G)?.players.length, 15)
  await b.send(G, PL[15], '/join')
  assert.ok(b.has(/complète|15 joueurs max/) || getGame(G)?.phase !== 'lobby')
  await b.send(G, PL[0], '/stop')
})

test('pseudos : lettres décoratives normalisées, alphabets et emojis conservés, rien d’invisible', async () => {
  const { labelOf, cleanName } = await import('../src/game/players.js')
  const { clip, fit } = await import('../src/render/kit.js')
  assert.equal(labelOf({ name: '𝐃𝐄𝐍𝐄𝐌 ＳＴＹＬ', num: '1' }), 'DENEM STYL')
  assert.equal(labelOf({ name: '小明 🔥 مرحبا', num: '1' }), '小明 🔥 مرحبا')
  assert.equal(labelOf({ name: '​⠀ㅤ', num: '2376' }), '+2376', 'pseudo invisible → numéro')
  assert.equal((cleanName('Z\u0303\u0334\u0301\u0489algo').match(/\p{M}/gu) || []).length, 1, 'un seul signe combinant conservé')
  assert.equal(clip('😀😀😀😀', 3), '😀😀…', 'jamais un emoji coupé en deux')
  assert.ok(fit('小明小明小明小明', 200, 30, 12) < fit('abcdefgh', 200, 30, 12), 'les caractères larges réduisent la taille')
})

test('nombre d’imposteurs selon les joueurs : 1 (<8), 2 (8-11), 3 (12+)', async () => {
  for (const [n, expected] of [[7, 1], [8, 2], [11, 2], [12, 3], [15, 3]]) {
    const { P } = await startGame(b, { n, format: 2 })
    assert.equal(getGame(G).imposters.length, expected, `${n} joueurs → ${expected} imposteur(s)`)
    await b.send(G, P[0], '/stop')
  }
  const { P } = await startGame(b, { n: 12, format: 1 })
  assert.equal(getGame(G).imposters.length, 1, 'format 1 : toujours un seul imposteur')
  await b.send(G, P[0], '/stop')
})

test('3 imposteurs : partie complète, textes au pluriel, 2 éliminations puis le dernier devine', async () => {
  const { P, imposters } = await startGame(b, { n: 12, format: 2 })
  assert.equal(imposters.length, 3)
  const from = b.texts().length
  await playClues(b)
  await voteFor(b, P, imposters[0])
  assert.ok(await b.waitFor(/Manche 2/, 120000))
  assert.ok(b.has(/Il reste encore \*2 imposteurs\*/))
  const spoken = b.texts().slice(from).join('\n')
  assert.doesNotMatch(spoken, /l’imposteur(?! restant)|un imposteur[^s]/)
  await b.send(G, P[0], '/stop')
})

test('profil : séries de victoires, rang et forme calculés depuis l’historique', async () => {
  const { recordGame, playerStats } = await import('../src/storage/scores.js')
  const grp = 'profil@g.us'
  const row = (num, role, won, points) => ({ num, jid: `${num}@s.whatsapp.net`, name: num === '111' ? 'Aïcha 🔥' : null, role, won, points })
  // 111 : G G P G G G (série en cours 3, meilleure 3) ; 222 : P P G
  const games = [[true, true], [true, false], [false, true], [true, true], [true, false], [true, false]]
  games.forEach(([w1], i) => recordGame(grp, `p${i}`, [row('111', i % 2 ? 'imposteur' : 'civil', w1, w1 ? 3 : 0), row('222', 'civil', i === 5, i === 5 ? 2 : 0)], 1000 + i))
  const s = playerStats(grp, '111')
  assert.equal(s.games, 6)
  assert.equal(s.streak, 3)
  assert.equal(s.bestStreak, 3)
  assert.equal(s.rank, 1)
  assert.equal(s.players, 2)
  assert.equal(s.asImposter + s.civGames, 6)
  assert.equal(s.impWins + s.civWins, s.wins)
  assert.equal(s.form.length, 6)
  assert.equal(s.name, 'Aïcha 🔥')
  const { profileSvg } = await import('../src/render/profile.js')
  const svg = profileSvg(s, s.name)
  assert.match(svg, /1er sur 2/)
  assert.match(svg, /victoires d’affilée/)
  assert.equal(playerStats(grp, '999'), null)
})
