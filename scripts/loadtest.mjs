// Test de montée en charge : N groupes jouent EN MÊME TEMPS (faux WhatsApp, horloge virtuelle, VRAI rendu d'images avec sharp).
//   npm run loadtest                       → 10 groupes de 15 joueurs, 1 partie chacun
//   LOAD_GROUPS=20 LOAD_PLAYERS=15 LOAD_GAMES=2 npm run loadtest   (RENDER_CONCURRENCY=1..n pour comparer)
// Mesure : durée réelle, mémoire maximale, rendus d'images (file d'attente), messages envoyés. Code de sortie 1 si une partie
// ne se termine pas ou si la mémoire dépasse la limite du conteneur (512 Mo).
// Lancé via : node --import ./test/register-real-render.mjs scripts/loadtest.mjs
import { boot, jid, PL } from '../test/helpers.mjs'

// boot() fait taire console.* (bruit du bot) : le rapport écrit directement sur la sortie standard
const out = (s) => process.stdout.write(s + '\n')
const GROUPS = Number(process.env.LOAD_GROUPS || 10)
const PLAYERS = Math.min(15, Number(process.env.LOAD_PLAYERS || 15))
const GAMES = Number(process.env.LOAD_GAMES || 1)
const MEM_LIMIT_MB = Number(process.env.MEM_LIMIT_MB || 480)

const b = await boot({ env: { ROLE_DELIVERY: 'image' } })
const { renderIdle, renderStats, canRender } = await import('../src/render/svg.js')
if (!canRender()) {
  out('❌ sharp indisponible : npm ci, puis relance.')
  process.exit(1)
}
globalThis.__renderIdle = renderIdle // la boucle attend les vrais rendus avant d'avancer l'horloge virtuelle

// Le faux WhatsApp garde en mémoire tout ce qu'il « envoie », images comprises : ce n'est pas la mémoire du bot. On libère les
// images déjà comptées pour ne mesurer que le bot.
let trimmed = 0
let imageCount = 0
const trimSent = () => {
  const sent = b.sock.sent
  for (; trimmed < sent.length; trimmed++) {
    const c = sent[trimmed].content
    if (c.image) {
      imageCount++
      c.image = true
    }
  }
}
const rssMb = () => Math.round(process.memoryUsage().rss / 1048576)
let peak = rssMb()

const groups = Array.from({ length: GROUPS }, (_, k) => ({
  id: `1203630000000010${String(k).padStart(2, '0')}@g.us`,
  players: PL.slice(0, PLAYERS),
  cursor: 0,
  alive: new Set(PL.slice(0, PLAYERS)),
  state: 'new',
  game: 0,
  finished: 0,
  clueN: 0,
  voted: false,
}))
const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)]

const startGroup = async (g) => {
  g.alive = new Set(g.players)
  g.voted = false
  g.state = 'lobby'
  await b.send(g.id, g.players[0], '/imposteur')
  await b.send(g.id, g.players[0], '2') // plusieurs manches : 3 imposteurs dès 12 joueurs, le scénario le plus lourd
  for (const p of g.players.slice(1)) await b.send(g.id, p, '/join')
  await b.send(g.id, g.players[0], '/go')
}

// Lit les nouveaux messages d'un groupe et réagit comme des joueurs
const react = async (g) => {
  const sent = b.sock.sent
  const fresh = sent.slice(g.cursor).filter((r) => r.jid === g.id)
  g.cursor = sent.length
  for (const r of fresh) {
    const text = r.content.text || r.content.caption || ''
    let m
    if (/FIN DE PARTIE/.test(text)) {
      g.finished++
      g.state = 'done'
      continue
    }
    if ((m = text.match(/C’est à @(\d+) !/))) await b.send(g.id, m[1], `mot${++g.clueN}x${Math.floor(Math.random() * 1e6)}`)
    else if ((m = text.match(/@(\d+) est éliminé/))) g.alive.delete(m[1])
    else if (/Pour voter, \*mentionne/.test(text)) {
      g.voted = true
      const alive = [...g.alive]
      for (const v of alive) {
        const t = rnd(alive.filter((x) => x !== v))
        if (t) await b.send(g.id, v, `je pense que c'est @${t}`, [jid(t)])
      }
    } else if ((m = text.match(/@(\d+) est bien/))) await b.send(g.id, m[1], 'zzzzz')
  }
}

// Rafale : 60 images demandées exactement en même temps (le cas des commandes /stats /top lancées par plusieurs groupes à la fois).
// Dans la partie ci-dessous l'horloge virtuelle attend chaque rendu, donc seule la rafale éprouve vraiment la file d'attente.
const { svgToJpeg } = await import('../src/render/svg.js')
const { profileSvg } = await import('../src/render/profile.js')
const sample = { games: 40, wins: 25, points: 80, asImposter: 12, impWins: 9, civGames: 28, civWins: 16, streak: 3, bestStreak: 6, rightVotes: 23, wrongVotes: 8, votes: 40, received: 30, abstain: 2, talk: 300, clues: 70, missed: 3, stolen: 2, champSeasons: 1, form: [], rank: 1, players: 12 }
const burstStart = performance.now()
let burstPeak = rssMb()
const sampler = setInterval(() => (burstPeak = Math.max(burstPeak, rssMb())), 20)
await Promise.all(Array.from({ length: Number(process.env.LOAD_BURST || 60) }, (_, i) => svgToJpeg(profileSvg(sample, `Joueur ${i}`))))
clearInterval(sampler)
peak = Math.max(peak, burstPeak)
out(`💥 Rafale de ${process.env.LOAD_BURST || 60} images simultanées : ${Math.round(performance.now() - burstStart)} ms • mémoire max ${burstPeak} Mo • file d'attente max ${renderStats().maxWaiting} • simultanés max ${renderStats().maxActive}`)

const t0 = Date.now ? performance.now() : 0
out(`🧪 Charge : ${GROUPS} groupes × ${PLAYERS} joueurs × ${GAMES} partie(s), vrai rendu d'images, concurrence de rendu = ${process.env.RENDER_CONCURRENCY || 2}`)
for (const g of groups) await startGroup(g)

let steps = 0
const MAX_STEPS = 6000 // ~100 min de jeu virtuel
for (; steps < MAX_STEPS; steps++) {
  await b.advance(1000)
  for (const g of groups) {
    if (g.state === 'done') {
      if (g.game + 1 < GAMES) {
        g.game++
        await startGroup(g)
      } else g.state = 'over'
    } else if (g.state !== 'over') await react(g)
  }
  trimSent()
  peak = Math.max(peak, rssMb())
  if (groups.every((g) => g.state === 'over')) break
}

const wall = ((performance.now() - t0) / 1000).toFixed(1)
const rs = renderStats()
trimSent()
const images = imageCount
const unfinished = groups.filter((g) => g.state !== 'over')
out(`\n📊 Résultat`)
out(`   parties terminées      : ${groups.reduce((n, g) => n + g.finished, 0)} / ${GROUPS * GAMES}`)
out(`   temps réel             : ${wall} s (jeu virtuel : ${Math.round(steps / 60)} min)`)
out(`   mémoire maximale (RSS) : ${peak} Mo (limite ${MEM_LIMIT_MB} Mo)`)
out(`   messages envoyés       : ${b.sock.sent.length} dont ${images} images`)
out(`   rendus d'images        : ${rs.done} • simultanés max ${rs.maxActive} • file d'attente max ${rs.maxWaiting}`)
let ok = true
if (unfinished.length) {
  ok = false
  out(`❌ ${unfinished.length} groupe(s) n'ont pas terminé leur partie`)
}
if (peak > MEM_LIMIT_MB) {
  ok = false
  out(`❌ mémoire au-dessus de ${MEM_LIMIT_MB} Mo`)
}
out(ok ? '✅ Charge supportée' : '❌ Charge non supportée')
process.exit(ok ? 0 : 1)
