// Outils de test : horloge virtuelle, aléa fixé, faux socket WhatsApp, joueurs fictifs.
// À importer UNE fois par fichier de test (chaque fichier tourne dans son propre processus).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const G = '120363000000000001@g.us'
export const PL = Array.from({ length: 12 }, (_, i) => `2376000000${String(i + 1).padStart(2, '0')}`)
export const jid = (n) => `${n}@s.whatsapp.net`

export const boot = async ({ env = {}, seed = 1 } = {}) => {
  Object.assign(process.env, {
    DB_PATH: ':memory:',
    DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'imposteur-test-')),
    ROLE_DELIVERY: 'text',
    ROLE_SELF_DESTRUCT: '0',
    ...env,
  })

  // aléa déterministe
  let a = seed * 2654435761 >>> 0
  Math.random = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // horloge virtuelle
  let now = 1_700_000_000_000
  let seq = 0
  const timers = new Map()
  const realSetImmediate = globalThis.setImmediate
  globalThis.setTimeout = (fn, ms = 0, ...args) => {
    const id = ++seq
    timers.set(id, { at: now + Math.max(0, ms), id, fn: () => fn(...args) })
    return id
  }
  globalThis.clearTimeout = (id) => {
    timers.delete(id)
  }
  Date.now = () => now
  const flush = async () => {
    for (let i = 0; i < 30; i++) await new Promise((r) => realSetImmediate(r))
  }
  const advance = async (ms) => {
    const target = now + ms
    await flush()
    for (;;) {
      const next = [...timers.values()].filter((t) => t.at <= target).sort((x, y) => x.at - y.at || x.id - y.id)[0]
      if (!next) break
      timers.delete(next.id)
      now = Math.max(now, next.at)
      next.fn()
      await flush()
    }
    now = target
    await flush()
  }

  const silent = process.env.TEST_VERBOSE ? null : () => {}
  if (silent) for (const k of ['log', 'warn', 'error']) console[k] = silent

  await import(new URL('../index.js', import.meta.url).href)
  await flush()
  const sock = globalThis.__sock

  // message entrant (groupe si chat se termine par @g.us, sinon privé)
  const send = async (chat, from, text, mentions = []) => {
    const group = chat.endsWith('@g.us')
    const m = {
      key: group ? { remoteJid: chat, fromMe: false, participant: jid(from) } : { remoteJid: jid(from), fromMe: false },
      pushName: `Joueur ${from.slice(-2)}`,
      message: mentions.length ? { extendedTextMessage: { text, contextInfo: { mentionedJid: mentions } } } : { conversation: text },
    }
    sock.ev.emit('messages.upsert', { messages: [m], type: 'notify' }).catch(() => {})
    await flush()
  }

  let baseline = 0 // les recherches ne regardent que les messages envoyés après mark()
  const mark = () => {
    baseline = sock.sent.length
  }
  const texts = () => sock.sent.slice(baseline).map((r) => r.content.text || r.content.caption || '')
  const has = (re) => texts().some((t) => re.test(t))
  const count = (re) => texts().filter((t) => re.test(t)).length
  const last = (re) => [...texts()].reverse().find((t) => re.test(t))
  const dmOf = (n) => [...sock.sent.slice(baseline)].reverse().find((r) => r.jid === jid(n) && r.content.text)?.content.text || ''

  const waitFor = async (re, maxMs = 200000, step = 1000) => {
    for (let t = 0; t < maxMs; t += step) {
      if (has(re)) return true
      await advance(step)
    }
    return has(re)
  }

  // simule un plantage du processus : les minuteries disparaissent (la base, elle, survit)
  const crash = () => timers.clear()

  return { sock, send, advance, flush, texts, has, count, last, dmOf, waitFor, mark, crash }
}

// Ouvre une partie, fait rejoindre `n` joueurs, lance, et avance jusqu’au premier tour d’indices
export const startGame = async (b, { n = 4, open = '/imposteur', format = null, chat = G } = {}) => {
  const P = PL.slice(0, n)
  b.mark()
  await b.send(chat, P[0], open)
  if (format) await b.send(chat, P[0], String(format))
  for (const p of P.slice(1)) await b.send(chat, p, '/join')
  await b.send(chat, P[0], '/go')
  await b.advance(n * 5000 + 25000)
  const imposters = P.filter((p) => /IMPOSTEUR/.test(b.dmOf(p)))
  return { P, imposters, civils: P.filter((p) => !imposters.includes(p)) }
}

// Joueur dont c’est le tour d’indice
export const currentTurn = (b) => (b.last(/C’est à @(\d+) !/) || '').match(/C’est à @(\d+) !/)?.[1]

// Joue tous les tours d’indices (un mot différent à chaque fois) jusqu’au débat
export const playClues = async (b, chat = G) => {
  let k = 0
  const DEBATE = /Tableau des indices|Récapitulatif des indices/
  const debates = b.count(DEBATE) // débats déjà ouverts (manches précédentes)
  for (let i = 0; i < 60 && b.count(DEBATE) === debates; i++) {
    const who = currentTurn(b)
    const before = b.count(/a donné son indice/)
    await b.send(chat, who, `indice${++k}x`)
    await b.advance(4000)
    if (b.count(/a donné son indice/) === before) await b.advance(1000)
  }
}

// Passe au vote (le lanceur tape /vote), puis chacun des `voters` vote pour `target`
export const voteFor = async (b, voters, target, { chat = G, starter = PL[0] } = {}) => {
  await b.send(chat, starter, '/vote')
  for (const v of voters) if (v !== target) await b.send(chat, v, `c'est @${target}`, [jid(target)])
}
