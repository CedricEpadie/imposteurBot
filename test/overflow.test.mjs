// Aucun texte ne doit déborder de son image ni de sa case, même avec des pseudos extrêmes.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const NAMES = ['FRANCK YVAN BRAYAN DE LA TOUR EIFFEL ET PLUS', '𝔻𝔼ℕ𝔼𝕄 𝕊𝕋𝕐𝕃𝔼 𝕋𝕙𝕖 𝕄𝕒𝕤𝕥𝕖𝕣 𝕆𝕗 𝕋𝕙𝕖 𝕎𝕠𝕣𝕝𝕕', '小明小明小明小明小明小明小明小明', 'MMMMMMMMMMMMMMMMMMMMMMMMMMMM', 'مرحبا بكم في اللعبة اليوم يا أصدقاء']
globalThis.__pushName = (from) => NAMES[Number(from.slice(-2)) % NAMES.length]
const { boot, startGame, playClues, voteFor, G } = await import('./helpers.mjs')
const b = await boot()
const { emWidth } = await import('../src/render/kit.js')
const { W } = await import('../src/render/theme.js')
const { rankingSvg } = await import('../src/render/ranking.js')
const { profileSvg } = await import('../src/render/profile.js')

// Vérifie chaque <text> d'un SVG : sa largeur estimée tient entre les bords (marge 28 px)
const unwrap = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
const overflows = (svg) => {
  const bad = []
  for (const m of svg.matchAll(/<text x="([\d.]+)" y="[\d.]+" text-anchor="(\w+)"[^>]*font-size="([\d.]+)" font-weight="(\w+)"[^>]*>([^<]*)<\/text>/g)) {
    const [, x, anchor, size, weight, raw] = m
    const w = emWidth(unwrap(raw), weight === 'bold') * Number(size)
    const left = anchor === 'middle' ? Number(x) - w / 2 : anchor === 'end' ? Number(x) - w : Number(x)
    if (left < 27 || left + w > W - 27) bad.push(`« ${unwrap(raw)} » (${Math.round(left)}→${Math.round(left + w)})`)
  }
  return bad
}

test('classement : podium et liste sans débordement', () => {
  const rows = NAMES.concat(NAMES).map((name, i) => ({ num: `10${i}`, name, jid: `10${i}@s.whatsapp.net`, points: 99999 - i * 1000, wins: 12345, games: 123456 }))
  assert.deepEqual(overflows(rankingSvg(rows)), [])
})

test('profil : pseudo extrême sans débordement', () => {
  const s = { games: 400, wins: 250, points: 8000, asImposter: 120, impWins: 90, civGames: 280, civWins: 160, streak: 3, bestStreak: 12, rightVotes: 230, wrongVotes: 80, votes: 400, received: 300, abstain: 2, talk: 3000, clues: 700, missed: 3, stolen: 20, champSeasons: 3, form: [], rank: 12, players: 15 }
  for (const n of NAMES) assert.deepEqual(overflows(profileSvg(s, n)), [])
})

test('partie à 5 pseudos extrêmes : tableau, dépouillement et bilan sans débordement', async () => {
  const { P, imposters } = await startGame(b, { n: 5 })
  await playClues(b)
  assert.deepEqual(overflows(b.image(/Tableau des indices/)), [], 'tableau des indices')
  await voteFor(b, P, imposters[0])
  assert.ok(await b.waitFor(/Dernière chance/, 90000))
  assert.deepEqual(overflows(b.image(/Résultat du vote/)), [], 'dépouillement')
  await b.send(G, imposters[0], 'zzzzz')
  assert.ok(await b.waitFor(/FIN DE PARTIE/, 20000))
  assert.deepEqual(overflows(b.image(/FIN DE PARTIE/)), [], 'bilan de fin de partie')
})

test('le détecteur de débordement détecte bien un débordement', () => {
  assert.equal(overflows('<text x="880" y="9" text-anchor="start" font-family="x" font-size="30" font-weight="bold" fill="#fff">Un texte qui sort de l’image</text>').length, 1)
  assert.equal(overflows('<text x="450" y="9" text-anchor="middle" font-family="x" font-size="30" font-weight="normal" fill="#fff">Court</text>').length, 0)
})
