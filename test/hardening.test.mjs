import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { boot, startGame, jid, PL, G } from './helpers.mjs'

const b = await boot()
const { reconnectPlan, backupAuthDir, CODE } = await import('../src/whatsapp/session.js')
const { isDuplicate, _resetSeen } = await import('../src/whatsapp/messageHandler.js')

test('reconnexion : délai croissant plafonné, avec cas particuliers', () => {
  const d = (attempt) => reconnectPlan(500, attempt, 0.5).delayMs
  assert.equal(d(0), 3000)
  assert.equal(d(1), 6000)
  assert.equal(d(2), 12000)
  assert.ok(d(3) > d(2) && d(20) <= 120_000 * 1.2, 'plafonné à 2 minutes (± hasard)')
  const lo = reconnectPlan(500, 0, 0).delayMs
  const hi = reconnectPlan(500, 0, 1).delayMs
  assert.ok(lo < 3000 && hi > 3000, 'un peu de hasard autour du délai')
  assert.equal(reconnectPlan(CODE.loggedOut, 5).relink, true)
  assert.ok(reconnectPlan(CODE.connectionReplaced, 0).delayMs >= 5 * 60_000, 'conflit de session : longue attente, pas de boucle')
  assert.ok(reconnectPlan(CODE.forbidden, 0).delayMs >= 10 * 60_000)
  assert.ok(reconnectPlan(CODE.restartRequired, 9).delayMs < 1000, 'redémarrage demandé : immédiat')
})

test('session : copie de sauvegarde avant effacement, 3 copies conservées', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'imp-auth-'))
  const dir = path.join(root, 'auth')
  fs.mkdirSync(dir)
  fs.writeFileSync(path.join(dir, 'creds.json'), '{"a":1}')
  for (let i = 0; i < 5; i++) assert.ok(backupAuthDir(dir, 3, 1_700_000_000_000 + i * 1000))
  const copies = fs.readdirSync(root).filter((f) => f.startsWith('auth.sauvegarde-'))
  assert.equal(copies.length, 3)
  assert.equal(fs.readFileSync(path.join(root, copies.at(-1), 'creds.json'), 'utf8'), '{"a":1}')
  assert.equal(backupAuthDir(path.join(root, 'absent')), null)
})

test('messages : un message renvoyé par WhatsApp n’est traité qu’une fois', () => {
  _resetSeen()
  const m = (id, chat = 'g@g.us') => ({ key: { id, remoteJid: chat } })
  assert.equal(isDuplicate(m('A1')), false)
  assert.equal(isDuplicate(m('A1')), true, 'même id, même chat')
  assert.equal(isDuplicate(m('A1', 'autre@g.us')), false, 'même id dans un autre chat')
  assert.equal(isDuplicate({ key: { remoteJid: 'g@g.us' } }), false, 'sans id : on traite')
})

test('rôles : un échec ponctuel d’envoi est rattrapé par une nouvelle tentative', async () => {
  const real = b.sock.sendMessage.bind(b.sock)
  let failed = 0
  b.sock.sendMessage = async (to, content) => {
    if (to === jid(PL[1]) && failed < 1) {
      failed++
      throw new Error('timed out')
    }
    return real(to, content)
  }
  const { P } = await startGame(b, { n: 4 })
  b.sock.sendMessage = real
  assert.equal(failed, 1, 'un premier envoi a bien échoué')
  assert.ok(b.dmOf(PL[1]), 'le joueur a quand même reçu son rôle')
  assert.ok(!b.has(/Je n’ai pas pu écrire en privé/), 'aucune alerte inutile dans le groupe')
  await b.send(G, P[0], '/stop')
})

test('rôles : envoi définitivement impossible → message au groupe sans détail technique', async () => {
  b.sock.failFor.add(jid(PL[2]))
  await startGame(b, { n: 4 })
  b.sock.failFor.clear()
  const warn = b.last(/Je n’ai pas pu écrire en privé/)
  assert.ok(warn)
  assert.doesNotMatch(warn, /Détail technique|not-acceptable/, 'l’erreur technique ne s’affiche pas devant tout le groupe')
  await b.send(G, PL[0], '/stop')
})

test('état des parties : chiffré en base, relu normalement, ancien format toujours lisible', async () => {
  const { saveGameState, loadGameStates } = await import('../src/storage/games.js')
  const { getDb } = await import('../src/storage/db.js')
  const { encryptText, decryptText } = await import('../src/storage/crypto.js')
  saveGameState('chiffre@g.us', { word: 'Real Madrid', imposters: ['237600000001'] })
  const raw = getDb().prepare('SELECT state FROM games WHERE key = ?').get('chiffre@g.us').state
  assert.match(raw, /^enc:v1:/)
  assert.doesNotMatch(raw, /Real Madrid|237600000001/, 'ni le mot ni les imposteurs en clair')
  assert.equal(loadGameStates().find((s) => s.key === 'chiffre@g.us').state.word, 'Real Madrid')
  // ancienne base : JSON en clair
  getDb().prepare('INSERT OR REPLACE INTO games (key, state, updated) VALUES (?, ?, ?)').run('ancien@g.us', JSON.stringify({ word: 'x' }), Date.now())
  assert.equal(loadGameStates().find((s) => s.key === 'ancien@g.us').state.word, 'x')
  // chiffrement authentifié : une donnée altérée est refusée
  const bad = raw.slice(0, -6) + 'AAAAA='
  assert.throws(() => decryptText(bad))
  // deux chiffrements du même texte diffèrent (IV aléatoire)
  assert.notEqual(encryptText('a'), encryptText('a'))
  getDb().prepare('DELETE FROM games').run()
})

test('état des parties : une partie illisible (mauvaise clé) est ignorée sans faire planter la reprise', async () => {
  const { saveGameState, loadGameStates } = await import('../src/storage/games.js')
  const { getDb } = await import('../src/storage/db.js')
  const { _resetKey } = await import('../src/storage/crypto.js')
  saveGameState('cle@g.us', { word: 'secret' })
  process.env.STATE_KEY = 'une-autre-cle'
  _resetKey()
  assert.deepEqual(loadGameStates(), [])
  delete process.env.STATE_KEY
  _resetKey()
  getDb().prepare('DELETE FROM games').run()
})

test('sauvegarde de la base : vrai instantané, rotation, et restauration', async () => {
  const { execFileSync } = await import('node:child_process')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imp-bak-'))
  const root = path.resolve(import.meta.dirname, '..')
  const script = `
    const { getDb } = await import('./src/storage/db.js')
    const { backupNow, listBackups } = await import('./src/storage/backup.js')
    const { DatabaseSync } = await import('node:sqlite')
    getDb().prepare("INSERT INTO settings VALUES ('g', 'k', 'valeur-42')").run()
    for (let i = 0; i < 5; i++) backupNow(new Date(Date.UTC(2026, 10, 20 + i, 5, 0)))
    const list = listBackups()
    const copy = new DatabaseSync(list.at(-1).path)
    console.log(JSON.stringify({ n: list.length, first: list[0].file, last: list.at(-1).file, value: copy.prepare('SELECT value FROM settings').get().value }))`
  const env = { ...process.env, DATA_DIR: dir, DB_PATH: path.join(dir, 'imposteur.db'), BACKUP_KEEP: '3' }
  const out = JSON.parse(execFileSync('node', ['--input-type=module', '-e', script], { cwd: root, env }).toString().trim().split('\n').at(-1))
  assert.equal(out.n, 3, '3 copies conservées sur 5')
  assert.equal(out.first, 'imposteur-2026-11-22-05-00.db', 'les plus anciennes sont supprimées')
  assert.equal(out.last, 'imposteur-2026-11-24-05-00.db')
  assert.equal(out.value, 'valeur-42', 'la copie contient bien les données')

  // restauration : la base abîmée est remplacée par la copie, l’ancienne est gardée
  fs.writeFileSync(path.join(dir, 'imposteur.db'), 'abîmée')
  fs.writeFileSync(path.join(dir, 'imposteur.db-wal'), 'journal périmé')
  const msg = execFileSync('node', ['scripts/restore.js', out.last], { cwd: root, env }).toString()
  assert.match(msg, /Base restaurée/)
  assert.equal(fs.existsSync(path.join(dir, 'imposteur.db-wal')), false, 'ancien journal supprimé')
  assert.equal(fs.readFileSync(path.join(dir, 'imposteur.db.avant-restauration'), 'utf8'), 'abîmée')
  const { DatabaseSync } = await import('node:sqlite')
  assert.equal(new DatabaseSync(path.join(dir, 'imposteur.db')).prepare('SELECT value FROM settings').get().value, 'valeur-42')
})

// ── Sonde de santé (Docker) ──────────────────────────────────────────────────
const { healthStatus } = await import('../src/core/heartbeat.js')
test('healthStatus : sain, bloqué, déconnecté trop longtemps', () => {
  const now = 1_000_000_000
  assert.equal(healthStatus(null, now).ok, false)
  assert.equal(healthStatus({ ts: now - 10_000, connected: true, since: now - 5000 }, now).ok, true)
  assert.equal(healthStatus({ ts: now - 300_000, connected: true, since: now - 400_000 }, now).ok, false) // plus de battement
  assert.equal(healthStatus({ ts: now - 5000, connected: false, since: now - 5 * 60_000 }, now).ok, true) // reconnexion en cours
  assert.equal(healthStatus({ ts: now - 5000, connected: false, since: now - 20 * 60_000 }, now).ok, false) // déconnecté trop longtemps
})
