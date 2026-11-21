// 🕵️ L’IMPOSTEUR — bot WhatsApp autonome (Baileys), préfixe « / » par défaut
//
// Deux modes de jeu :
//  • classique : tous les joueurs reçoivent EN PRIVÉ la catégorie et le mot secret… sauf l’imposteur,
//    qui ne connaît que la catégorie et doit bluffer.
//  • proche    : l’imposteur reçoit un mot VOISIN (ex. « koki » au lieu de « ndolé ») et ne sait pas
//    qu’il est l’imposteur ! Il doit s’en rendre compte grâce aux indices des autres.
//
// ÉQUITÉ : les rôles sont envoyés sous forme de carte image « à vue unique ». Celui qui héberge le bot
// ne peut pas la rouvrir depuis le téléphone du bot, et la conversation privée est ensuite effacée
// côté bot (voir ROLE_DELIVERY et WIPE_DM_CHAT).
//
// Commandes (dans un groupe) :
//  /imposteur                      → ouvre une partie (mode classique)
//  /imposteur proche               → ouvre une partie en mode « mot proche »
//  /imposteur mode <classique|proche> → change le mode avant le lancement (lanceur)
//  /imposteur join                 → rejoindre
//  /imposteur go                   → lancer (lanceur) — sinon lancement auto après le délai
//  /imposteur mot                  → renvoyer son rôle (aussi utilisable en PRIVÉ avec le bot)
//  /imposteur etat                 → phase en cours, temps restant, joueurs
//  /imposteur vote                 → passer au vote (lanceur)
//  /imposteur stop                 → annuler la partie (lanceur)
//  /imposteur top                  → classement des victoires
//  /imposteur test                 → t’envoie une carte de test (pour vérifier l’affichage)
//  /imposteur aide                 → règles
// Raccourcis : /join /go /mot /etat /vote /stop /top /test /aide /mode

import fs from 'node:fs'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  normalizeMessageContent,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'

try {
  process.loadEnvFile('.env') // Node ≥ 20.12 ; sans fichier .env, on utilise les variables d’environnement de l’hébergeur
} catch {}

let sharp = null
try {
  sharp = (await import('sharp')).default
} catch (e) {
  console.warn('[imposteur] sharp indisponible :', e.message)
}

// ───────── Configuration (variables d’environnement) ─────────
const P = process.env.PREFIX || '/'
const AUTH_DIR = process.env.AUTH_DIR || './auth' // dossier de session : à placer sur un volume persistant
const PAIRING_NUMBER = (process.env.PAIRING_NUMBER || '').replace(/\D/g, '') // ex. 237600000000 → connexion par code au lieu du QR
// image : carte à vue unique (équitable, recommandé) — text : message texte classique (visible par l’hébergeur du bot)
const ROLE_DELIVERY = (process.env.ROLE_DELIVERY || 'image').toLowerCase() === 'text' ? 'text' : 'image'
// Efface la conversation privée côté bot juste après l’envoi d’un rôle
const WIPE_DM_CHAT = (process.env.WIPE_DM_CHAT || 'true').toLowerCase() !== 'false'

// ───────── Réglages du jeu (modifie à ta guise) ─────────
const MIN_PLAYERS = 3
const MAX_PLAYERS = 10
const LOBBY_SECONDS = 90 // temps pour rejoindre avant le lancement automatique
const READ_SECONDS = 20 // temps pour lire son rôle avant les indices
const CLUE_ROUNDS = 2 // nombre de tours d’indices
const CLUE_SECONDS = 40 // temps pour donner son indice
const DISCUSS_SECONDS = 60 // discussion libre avant le vote
const VOTE_SECONDS = 45
const GUESS_SECONDS = 30 // dernière chance de l’imposteur démasqué
const DM_DELAY_SECONDS = 5 // pause entre deux envois privés (limite les risques de blocage)

// Chaque catégorie contient des paires de mots proches. Mode classique : on tire un des deux mots.
// Mode « proche » : les civils reçoivent un mot et l’imposteur l’autre.
const PAIRS = {
  '🍽️ Plats et aliments': [
    ['ndolé', 'koki'],
    ['poulet DG', 'poulet braisé'],
    ['plantain', 'banane douce'],
    ['manioc', 'igname'],
    ['mangue', 'papaye'],
    ['safou', 'goyave'],
    ['arachides', 'pistaches'],
    ['beignets', 'croissants'],
    ['achu', 'fufu'],
    ['jus de gingembre', 'jus de bissap'],
  ],
  '🐾 Animaux': [
    ['lion', 'tigre'],
    ['éléphant', 'hippopotame'],
    ['perroquet', 'perruche'],
    ['serpent', 'lézard'],
    ['crocodile', 'varan'],
    ['poule', 'pintade'],
    ['chèvre', 'mouton'],
    ['singe', 'gorille'],
    ['tortue', 'escargot'],
    ['chien', 'loup'],
  ],
  '📍 Lieux': [
    ['marché', 'supermarché'],
    ['gare routière', 'aéroport'],
    ['stade', 'gymnase'],
    ['hôpital', 'pharmacie'],
    ['université', 'lycée'],
    ['plage', 'piscine'],
    ['cybercafé', 'bibliothèque'],
    ['boulangerie', 'pâtisserie'],
    ['cinéma', 'théâtre'],
    ['hôtel', 'auberge'],
  ],
  '🏠 Objets du quotidien': [
    ['téléphone', 'tablette'],
    ['parapluie', 'imperméable'],
    ['ventilateur', 'climatiseur'],
    ['frigo', 'congélateur'],
    ['miroir', 'fenêtre'],
    ['lunettes', 'jumelles'],
    ['cuvette', 'seau'],
    ['clé', 'cadenas'],
    ['bougie', 'lampe torche'],
    ['casserole', 'marmite'],
  ],
  '👔 Métiers': [
    ['docteur', 'infirmier'],
    ['professeur', 'instituteur'],
    ['chauffeur de taxi', 'conducteur de moto-taxi'],
    ['boucher', 'poissonnier'],
    ['coiffeur', 'barbier'],
    ['pilote', 'hôtesse de l’air'],
    ['policier', 'gendarme'],
    ['journaliste', 'présentateur'],
    ['maçon', 'menuisier'],
    ['avocat', 'juge'],
  ],
  '🎉 Loisirs et sports': [
    ['football', 'handball'],
    ['basket', 'volley'],
    ['natation', 'plongée'],
    ['danse', 'gym'],
    ['ludo', 'dames'],
    ['belote', 'poker'],
    ['karaoké', 'concert'],
    ['pêche', 'chasse'],
    ['course à pied', 'vélo'],
    ['film', 'série'],
  ],
}

const MODE_LABEL = {
  classique: '🥷 Classique : l’imposteur ne connaît pas le mot',
  proche: '🎭 Mot proche : l’imposteur reçoit un mot voisin… et ne sait pas qu’il est l’imposteur !',
}
const MODE_ALIASES = { classique: 'classique', classic: 'classique', proche: 'proche', undercover: 'proche' }
const SHORTCUTS = new Set(['join', 'go', 'mot', 'etat', 'vote', 'stop', 'top', 'test', 'aide', 'mode'])

const PHASES = {
  lobby: [1, 'SALLE D’ATTENTE'],
  dm: [2, 'DISTRIBUTION DES RÔLES'],
  clues: [3, 'INDICES'],
  discuss: [4, 'DÉBAT'],
  vote: [5, 'VOTE'],
  verdict: [6, 'VERDICT'],
}
const header = (k) => `━━━━━━━━━━━━━━\n*PHASE ${PHASES[k][0]}/6 · ${PHASES[k][1]}*\n━━━━━━━━━━━━━━\n\n`
const phaseName = (g) => {
  const map = {
    lobby: 'lobby',
    dm: 'dm',
    ready: 'dm',
    clues: 'clues',
    between: 'clues',
    discuss: 'discuss',
    vote: 'vote',
    counting: 'vote',
    guess: 'verdict',
    verdict: 'verdict',
  }
  const k = map[g.phase] || 'lobby'
  return `Phase ${PHASES[k][0]}/6 · ${PHASES[k][1].toLowerCase()}`
}

// ───────── État (en mémoire : remis à zéro au redémarrage du bot) ─────────
const games = new Map() // une partie par groupe (clé = jid du groupe)
const wins = new Map() // victoires : groupe → Map(num → { jid, n })
const usedPairs = new Map() // pour ne pas répéter les paires de mots
const sentTexts = [] // derniers textes envoyés par le bot (évite de les prendre pour des indices)
const cooldowns = new Map() // anti-spam des renvois de rôle / cartes de test

let sock = null

// ───────── Utilitaires ─────────
const num = (jid) => String(jid || '').split('@')[0].split(':')[0]
const clean = (jid) => {
  const [user, server] = String(jid || '').split('@')
  return `${user.split(':')[0]}@${server}`
}
const tag = (jid) => '@' + num(jid)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const progressBar = (done, total) => '▰'.repeat(done) + '▱'.repeat(total - done)
const onCooldown = (id, seconds) => {
  const now = Date.now()
  if ((cooldowns.get(id) || 0) > now) return true
  cooldowns.set(id, now + seconds * 1000)
  return false
}

// Identité de l’expéditeur : WhatsApp peut fournir un jid « numéro » et/ou un jid « LID ».
// On garde les deux pour reconnaître la même personne en groupe comme en privé.
const senderOf = (m) => {
  const k = m.key
  const group = k.remoteJid.endsWith('@g.us')
  let jid
  let alt
  if (k.fromMe) {
    jid = sock?.user?.id
    alt = sock?.user?.lid
  } else if (group) {
    jid = k.participant
    alt = k.participantAlt
  } else {
    jid = k.remoteJid
    alt = k.remoteJidAlt
  }
  if (!jid) return null
  jid = clean(jid)
  if (alt) alt = clean(alt)
  const ids = new Set([num(jid)])
  if (alt) ids.add(num(alt))
  const dm = [jid, alt].find((j) => j && j.endsWith('@s.whatsapp.net')) || jid
  return { jid, dm, ids }
}

const toPlayer = (s) => ({ num: num(s.jid), jid: s.jid, dm: s.dm, ids: s.ids })
const hasId = (p, ids) => !!p && [...ids].some((i) => p.ids.has(i))
const findPlayer = (g, ids) => g.players.find((p) => hasId(p, ids))
const jidsOf = (g) => g.players.map((p) => p.jid)
const listOf = (g) => g.players.map((p) => tag(p.jid)).join(', ')

// ───────── Minuteries (compte à rebours avec rappels) ─────────
const stopTimers = (g) => {
  clearTimeout(g.timer)
  for (const t of g.ticks || []) clearTimeout(t)
  g.ticks = []
  g.deadline = 0
}

// Lance la fin de phase dans `seconds` s ; `marks` = secondes restantes auxquelles `tick(m)` est appelé.
const phaseTimer = (g, seconds, onEnd, { marks = [], tick } = {}) => {
  stopTimers(g)
  const phase = g.phase
  g.deadline = Date.now() + seconds * 1000
  for (const m of marks) {
    if (m >= seconds || !tick) continue
    g.ticks.push(
      setTimeout(() => {
        if (games.get(g.key) !== g || g.phase !== phase) return
        Promise.resolve().then(() => tick(m)).catch((e) => console.error('[imposteur]', e))
      }, (seconds - m) * 1000)
    )
  }
  g.timer = setTimeout(() => {
    Promise.resolve().then(onEnd).catch((e) => console.error('[imposteur]', e))
  }, seconds * 1000)
}

// ───────── Envoi ─────────
const say = async (chat, text, mentions = []) => {
  sentTexts.push(text)
  if (sentTexts.length > 40) sentTexts.shift()
  try {
    return await sock.sendMessage(chat, { text, mentions })
  } catch (e) {
    console.error('[imposteur] envoi impossible :', e.message)
    return null
  }
}

const editMsg = async (chat, sent, text, mentions = []) => {
  if (!sent?.key) return
  try {
    await sock.sendMessage(chat, { text, edit: sent.key, mentions })
  } catch {
    /* l’édition est un plus : on ignore les erreurs */
  }
}

const typing = async (chat, ms) => {
  try {
    await sock.sendPresenceUpdate('composing', chat)
    await sleep(ms)
    await sock.sendPresenceUpdate('paused', chat)
  } catch {}
}

// ───────── Cartes de rôle (image à vue unique) ─────────
const renderCard = async ({ title, color, category, big, lines }) => {
  if (!sharp) throw new Error('le module « sharp » n’est pas installé')
  const size = Math.max(34, Math.min(84, Math.floor(820 / (Math.max(big.length, 1) * 0.6))))
  const font = 'DejaVu Sans, Arial, Helvetica, sans-serif'
  const footer = lines
    .map(
      (l, i) =>
        `<text x="450" y="${470 + i * 44}" text-anchor="middle" font-family="${font}" font-size="28" fill="#c7cdd6">${esc(l)}</text>`
    )
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <rect width="900" height="600" rx="36" fill="#14181f"/>
  <rect x="24" y="24" width="852" height="552" rx="26" fill="none" stroke="${color}" stroke-width="4"/>
  <text x="450" y="130" text-anchor="middle" font-family="${font}" font-size="46" font-weight="bold" fill="${color}">${esc(title)}</text>
  <text x="450" y="205" text-anchor="middle" font-family="${font}" font-size="30" fill="#9aa4b2">${esc(category)}</text>
  <text x="450" y="355" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="bold" fill="#ffffff">${esc(big)}</text>
  ${footer}
</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

const plainCategory = (cat) => 'Catégorie : ' + String(cat).replace(/[^\p{L}\p{N}\s'’-]/gu, '').trim()

const cardSpec = (g, isImposter) => {
  const category = plainCategory(g.category)
  if (g.mode === 'proche') {
    return {
      title: 'TON MOT SECRET',
      color: '#f0b429',
      category,
      big: isImposter ? g.closeWord : g.word,
      lines: ['Donne un indice en un seul mot.', 'Un joueur a un mot différent : reste discret.'],
    }
  }
  return isImposter
    ? {
        title: 'TU ES L’IMPOSTEUR',
        color: '#ff5d5d',
        category,
        big: 'Mot inconnu',
        lines: ['Bluffe : donne des indices crédibles.', 'Démasqué ? Devine le mot pour gagner !'],
      }
    : {
        title: 'TU ES CIVIL',
        color: '#3ddc84',
        category,
        big: g.word,
        lines: ['Donne un indice en un seul mot,', 'sans dire le mot secret.'],
      }
}

// Version texte (ROLE_DELIVERY=text)
const roleText = (g, isImposter) => {
  if (g.mode === 'proche') {
    return (
      `🎭 *Mode MOT PROCHE*\n\nCatégorie : ${g.category}\nTon mot secret : *${isImposter ? g.closeWord : g.word}*\n\n` +
      `Donne des indices en *un seul mot*, sans dire ton mot.\n` +
      `⚠️ Un joueur a reçu un mot *proche mais différent* et ne le sait pas ! Écoute bien les indices des autres : ` +
      `si tu penses être l’intrus, fais-toi discret… et essaie de deviner le mot des autres.`
    )
  }
  return isImposter
    ? `🥷 *Tu es l’IMPOSTEUR !*\n\nCatégorie : ${g.category}\n` +
        `Tu ne connais *pas* le mot secret. Bluffe : donne des indices crédibles pour passer pour un civil.\n` +
        `Si on te démasque, tu auras une dernière chance de deviner le mot !`
    : `🕵️ *Tu es CIVIL.*\n\nCatégorie : ${g.category}\nMot secret : *${g.word}*\n` +
        `Donne des indices en *un seul mot* (sans dire le mot !) pour te faire reconnaître des civils… ` +
        `sans trop aider l’imposteur qui se cache parmi vous.`
}

// Efface la conversation privée côté bot (le téléphone du bot n’en garde pas de trace)
const wipeChat = async (jid, sent) => {
  if (!WIPE_DM_CHAT || !sent?.key) return
  try {
    await sock.chatModify(
      { delete: true, lastMessages: [{ key: sent.key, messageTimestamp: Number(sent.messageTimestamp) }] },
      jid
    )
  } catch (e) {
    console.warn('[imposteur] effacement de la conversation impossible :', e.message)
  }
}

// Envoie une carte (ou un texte) à `jid`. Ne journalise jamais le contenu du rôle.
const sendCard = async (jid, spec, fallbackText) => {
  try {
    let sent
    if (ROLE_DELIVERY === 'image') {
      sent = await sock.sendMessage(jid, { image: await renderCard(spec), viewOnce: true })
    } else {
      sent = await sock.sendMessage(jid, { text: fallbackText })
    }
    await wipeChat(jid, sent)
    return true
  } catch (e) {
    console.error('[imposteur] envoi privé impossible :', e.message)
    return false
  }
}

const deliverRole = (g, p) => {
  const isImp = p === g.imposter
  return sendCard(p.dm, cardSpec(g, isImp), roleText(g, isImp))
}

// ───────── Mots ─────────
// Retourne [catégorie, mot des civils, mot proche pour l’imposteur (mode « proche »)]
const pickPair = (key) => {
  const all = Object.entries(PAIRS).flatMap(([cat, pairs]) => pairs.map(([a, b]) => ({ cat, a, b, id: `${cat}|${a}` })))
  let used = usedPairs.get(key) || new Set()
  if (used.size >= all.length) used = new Set()
  const chosen = pick(all.filter((x) => !used.has(x.id)))
  used.add(chosen.id)
  usedPairs.set(key, used)
  return Math.random() < 0.5 ? [chosen.cat, chosen.a, chosen.b] : [chosen.cat, chosen.b, chosen.a]
}

// Mot que ce joueur connaît (pour lui interdire de le dire en indice)
const ownSecret = (g, p) => {
  if (p === g.imposter) return g.mode === 'proche' ? g.closeWord : null
  return g.word
}

// ───────── Récapitulatifs ─────────
const clueLines = (g, round) =>
  g.clues.filter((c) => c.round === round).map((c) => `• ${tag(c.p.jid)} : ${c.text || '…'}`)

const fullRecap = (g) =>
  g.order
    .map((p) => {
      const mine = g.clues.filter((c) => c.p === p).map((c) => c.text || '…')
      return `• ${tag(p.jid)} : ${mine.length ? mine.join(' → ') : '—'}`
    })
    .join('\n')

// ───────── Déroulement de la partie ─────────
const beginGame = async (key, manual = false) => {
  const g = games.get(key)
  if (!g || g.phase !== 'lobby') return

  if (g.players.length < MIN_PLAYERS) {
    if (manual) {
      return say(key, `⛔ Il manque encore *${MIN_PLAYERS - g.players.length}* joueur(s) (${g.players.length}/${MIN_PLAYERS} minimum).`)
    }
    stopTimers(g)
    games.delete(key)
    return say(key, `😕 Pas assez de joueurs (${g.players.length}/${MIN_PLAYERS} minimum). Partie annulée.`)
  }

  stopTimers(g)
  g.phase = 'dm'
  const [category, word, closeWord] = pickPair(key)
  g.category = category
  g.word = word // mot des civils
  g.closeWord = closeWord // mot proche de l’imposteur (mode « proche » uniquement)
  const secretLabel = g.mode === 'proche' ? 'mot secret' : 'rôle'
  const secretPlural = g.mode === 'proche' ? 'mots secrets' : 'rôles'
  g.imposter = pick(g.players)
  g.order = shuffle(g.players)
  g.turns = []
  for (let r = 0; r < CLUE_ROUNDS; r++) g.order.forEach((p) => g.turns.push(p))
  g.turnIdx = 0
  g.clues = []

  const total = g.players.length
  const progress = (done, last) =>
    `${header('dm')}👥 ${total} joueurs : ${listOf(g)}\n🏷️ Catégorie : ${g.category}\n🎮 Mode : ${MODE_LABEL[g.mode]}\n\n` +
    `📩 Envoi des ${secretPlural} en privé${ROLE_DELIVERY === 'image' ? ' (carte à vue unique 👁️)' : ''}…\n` +
    `${progressBar(done, total)} ${done}/${total}` +
    (last ? `\n${last}` : '')

  const first = await say(key, progress(0), jidsOf(g))

  const failed = []
  let done = 0
  for (const p of g.players) {
    if (games.get(key) !== g) return // partie annulée entre-temps
    const ok = await deliverRole(g, p)
    done++
    if (!ok) failed.push(p.jid)
    await editMsg(
      key,
      first,
      progress(done, ok ? `✅ ${tag(p.jid)} a reçu son ${secretLabel}` : `⚠️ ${tag(p.jid)} : envoi impossible`),
      jidsOf(g)
    )
    if (done < total) await sleep(DM_DELAY_SECONDS * 1000)
  }
  if (games.get(key) !== g) return

  if (failed.length) {
    await say(
      key,
      `⚠️ Je n’ai pas pu écrire en privé à ${failed.map(tag).join(', ')}. Écrivez-moi d’abord en privé (un simple « salut »), puis tapez *${P}imposteur mot* pour recevoir votre ${secretLabel}.`,
      failed
    )
  }

  g.phase = 'ready'
  await say(
    key,
    `📖 *Lisez bien votre ${secretLabel} !*\n` +
      (ROLE_DELIVERY === 'image' ? `La carte ne s’ouvre qu’*UNE fois* : ouvrez-la sur votre téléphone.\n` : '') +
      `Rien reçu ? *${P}imposteur mot* en privé au bot.\n\n🎬 Les indices commencent dans *${READ_SECONDS} s*…`
  )
  phaseTimer(g, READ_SECONDS, () => askTurn(key), {
    marks: [10, 5],
    tick: (m) => say(key, `⏳ Début des indices dans *${m} s*…`),
  })
}

const askTurn = async (key) => {
  const g = games.get(key)
  if (!g) return
  const t = g.turns[g.turnIdx]
  if (!t) return startDiscuss(key)

  g.phase = 'clues'
  const n = g.order.length
  const round = Math.floor(g.turnIdx / n) + 1
  const pos = (g.turnIdx % n) + 1

  let head = ''
  if (g.turnIdx === 0) {
    head =
      header('clues') +
      `Chacun donne *un seul mot* en rapport avec son mot secret, sans le dire.\n` +
      `🔁 ${CLUE_ROUNDS} tour(s) • ⏱️ ${CLUE_SECONDS} s par joueur\n\n` +
      `📋 *Ordre de passage*\n${g.order.map((p, i) => `${i + 1}. ${tag(p.jid)}`).join('\n')}\n\n`
  } else if (pos === 1) {
    head = `🔁 *Tour ${round}/${CLUE_ROUNDS}* — on repart dans le même ordre !\n\n`
  }
  const next = g.turns[g.turnIdx + 1]
  const mentions = [t.jid, ...(g.turnIdx === 0 ? jidsOf(g) : [])]

  phaseTimer(g, CLUE_SECONDS, () => takeClue(key, null), {
    marks: [20, 10, 5],
    tick: (m) => say(key, `⏳ ${tag(t.jid)} : plus que *${m} s* pour donner ton indice !`, [t.jid]),
  })
  return say(
    key,
    `${head}🗣️ *Tour ${round}/${CLUE_ROUNDS} • joueur ${pos}/${n}*\nC’est à ${tag(t.jid)} ! Donne ton indice en *un seul mot* (${CLUE_SECONDS} s).` +
      (next ? `\n➡️ Ensuite : ${tag(next.jid)}` : ''),
    mentions
  )
}

const takeClue = async (key, text, multiWord = false) => {
  const g = games.get(key)
  if (!g || g.phase !== 'clues') return
  stopTimers(g)
  g.phase = 'between' // le temps d’annoncer l’indice, aucun autre indice n’est accepté

  const n = g.order.length
  const t = g.turns[g.turnIdx]
  const round = Math.floor(g.turnIdx / n) + 1
  const pos = (g.turnIdx % n) + 1
  g.clues.push({ round, p: t, text: text || null })
  g.turnIdx++

  await say(
    key,
    text
      ? `✅ ${tag(t.jid)} a donné son indice : *${text}* (${pos}/${n})` + (multiWord ? `\n(seul le 1er mot est retenu)` : '')
      : `⏱️ ${tag(t.jid)} n’a rien dit à temps : indice passé… 🐢 (${pos}/${n})`,
    [t.jid]
  )
  if (games.get(key) !== g) return

  if (g.turnIdx % n === 0) {
    await sleep(1000)
    if (games.get(key) !== g) return
    await say(key, `📝 *Indices du tour ${round}*\n${clueLines(g, round).join('\n')}`, jidsOf(g))
    if (games.get(key) !== g) return
  }

  await sleep(1500)
  if (games.get(key) !== g) return
  return askTurn(key)
}

const startDiscuss = async (key) => {
  const g = games.get(key)
  if (!g) return
  g.phase = 'discuss'
  phaseTimer(g, DISCUSS_SECONDS, () => startVote(key), {
    marks: [30, 10, 5],
    tick: (m) =>
      say(key, m > 10 ? `⏳ Il reste *${m} s* de débat… Qui est suspect ?` : `🚨 Le vote commence dans *${m} s* !`),
  })
  return say(
    key,
    `${header('discuss')}📋 *Récapitulatif des indices*\n${fullRecap(g)}\n\n` +
      `💬 Qui a donné un indice louche ? Défendez-vous, accusez-vous !\n` +
      `⏱️ *${DISCUSS_SECONDS} s* de débat. Le lanceur peut taper *${P}imposteur vote* pour voter tout de suite.`,
    jidsOf(g)
  )
}

const pendingVoters = (g) => g.players.filter((p) => !g.votes.has(p))

const startVote = async (key) => {
  const g = games.get(key)
  if (!g || g.phase !== 'discuss') return
  stopTimers(g)
  g.phase = 'vote'
  g.votes = new Map() // votant (joueur) → suspect (joueur)
  phaseTimer(g, VOTE_SECONDS, () => endVote(key), {
    marks: [30, 15, 5],
    tick: (m) => {
      const waiting = pendingVoters(g)
      return say(
        key,
        `⏳ *${m} s* — ${g.votes.size}/${g.players.length} vote(s).\n🕐 En attente : ${waiting.map((p) => tag(p.jid)).join(', ')}`,
        waiting.map((p) => p.jid)
      )
    },
  })
  return say(
    key,
    `${header('vote')}🗳️ *Qui est l’imposteur ?*\n\n${listOf(g)}\n\n` +
      `👉 *Mentionne (@)* ton suspect ou *réponds à son message*.\n` +
      `Pas de vote pour soi-même • le dernier vote compte • les votes restent secrets jusqu’au dépouillement.\n` +
      `⏱️ *${VOTE_SECONDS} s* (le vote s’arrête dès que tout le monde a voté).`,
    jidsOf(g)
  )
}

const endVote = async (key) => {
  const g = games.get(key)
  if (!g || g.phase !== 'vote') return
  stopTimers(g)
  g.phase = 'counting'

  await say(key, `🔔 *Le vote est clos !*\n🥁 Dépouillement en cours…`)
  await typing(key, 2500)
  if (games.get(key) !== g) return

  const counts = new Map()
  for (const target of g.votes.values()) counts.set(target, (counts.get(target) || 0) + 1)
  const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1])

  if (!ranking.length) {
    return conclude(key, 'imposteur', '🐔 Personne n’a osé voter : l’imposteur passe entre les mailles du filet.')
  }

  const detail = [...g.votes.entries()].map(([voter, target]) => `• ${tag(voter.jid)} ➜ ${tag(target.jid)}`).join('\n')
  const lines = ranking.map(([p, c]) => `${'🟥'.repeat(c)} ${tag(p.jid)} — ${c} vote(s)`).join('\n')
  const abstainers = pendingVoters(g)
  const [top, topCount] = ranking[0]
  const tie = ranking.length > 1 && ranking[1][1] === topCount

  await say(
    key,
    `📊 *Résultat du vote*\n\n${lines}\n\n🔍 *Détail*\n${detail}` +
      (abstainers.length ? `\n\n🙈 N’ont pas voté : ${abstainers.map((p) => tag(p.jid)).join(', ')}` : ''),
    jidsOf(g)
  )
  await sleep(2500)
  if (games.get(key) !== g) return

  if (tie || top !== g.imposter) {
    const why = tie
      ? `⚖️ Égalité des votes : personne n’est démasqué.`
      : `❌ Le groupe a accusé ${tag(top.jid)}… mais c’était un civil !`
    return conclude(key, 'imposteur', why, ranking.map(([p]) => p.jid))
  }

  g.phase = 'guess'
  phaseTimer(g, GUESS_SECONDS, () => conclude(key, 'civils', '⏱️ Le temps est écoulé : l’imposteur n’a pas trouvé le mot.'), {
    marks: [20, 10, 5],
    tick: (m) => say(key, `⏳ ${tag(g.imposter.jid)} : plus que *${m} s* pour deviner le mot !`, [g.imposter.jid]),
  })
  return say(
    key,
    `🎯 *${tag(top.jid)} est bien l’imposteur !*\n\n` +
      `${header('verdict')}Dernière chance : devine le *mot ${g.mode === 'proche' ? 'des civils' : 'secret'}* ` +
      `(catégorie : ${g.category}) en *un seul message*.\n⏱️ Tu as *${GUESS_SECONDS} s*. S’il le trouve, il vole la victoire !`,
    [top.jid]
  )
}

const conclude = async (key, winner, reason, extraMentions = []) => {
  const g = games.get(key)
  if (!g) return
  stopTimers(g)
  games.delete(key)

  const board = wins.get(key) || new Map()
  g.players
    .filter((p) => (winner === 'imposteur') === (p === g.imposter))
    .forEach((p) => {
      const e = board.get(p.num) || { jid: p.jid, n: 0 }
      e.n++
      board.set(p.num, e)
    })
  wins.set(key, board)

  const imp = g.imposter
  await typing(key, 1500)
  return say(
    key,
    `🏁 *FIN DE PARTIE*\n\n` +
      (winner === 'civils' ? `🎉 *Les civils gagnent !*` : `🥷 *L’imposteur gagne !*`) +
      `\n${reason}\n\n🥷 Imposteur : ${tag(imp.jid)}\n` +
      (g.mode === 'proche'
        ? `🔑 Mot des civils : *${g.word}* (${g.category})\n🎭 Mot de l’imposteur : *${g.closeWord}*`
        : `🔑 Mot secret : *${g.word}* (${g.category})`) +
      `\n\n📜 *Récap des indices*\n${fullRecap(g)}` +
      `\n\n🏆 *${P}imposteur top* : classement • Rejouer : *${P}imposteur*`,
    [imp.jid, ...jidsOf(g), ...extraMentions]
  )
}

// Renvoie son rôle : en privé (ou depuis le groupe, avec envoi en privé)
const resendRole = async (chat, isGroup, me) => {
  let game = null
  for (const g of games.values()) {
    if (g.phase !== 'lobby' && g.phase !== 'dm' && findPlayer(g, me.ids)) game = g
  }
  if (!game) return say(chat, 'Je ne te trouve dans aucune partie en cours (ou les rôles ne sont pas encore distribués).')
  if (onCooldown(`role:${num(me.jid)}`, 10)) return say(chat, '⏳ Patiente quelques secondes avant de redemander ton rôle.')
  const p = findPlayer(game, me.ids)
  const ok = await deliverRole(game, p)
  if (!isGroup) return ok ? undefined : say(chat, 'Impossible de t’envoyer ton rôle pour le moment.')
  return say(
    chat,
    ok
      ? `📩 ${tag(me.jid)} : rôle renvoyé en privé.`
      : `Impossible de t’écrire en privé : envoie-moi d’abord un message en privé, puis *${P}imposteur mot*.`,
    [me.jid]
  )
}

// ───────── Commandes ─────────
const handleCommand = async (chat, isGroup, me, text) => {
  const [cmdRaw, ...args] = text.slice(P.length).trim().split(/\s+/)
  const cmd = (cmdRaw || '').toLowerCase()

  let word
  let rest
  if (cmd === 'imposteur') {
    word = (args[0] || '').toLowerCase()
    rest = args.slice(1).map((a) => a.toLowerCase())
  } else if (SHORTCUTS.has(cmd)) {
    word = cmd
    rest = args.map((a) => a.toLowerCase())
  } else {
    return // commande inconnue : ignorée
  }

  if (word === 'mot' || word === 'role' || word === 'rôle') return resendRole(chat, isGroup, me)

  if (word === 'test') {
    if (onCooldown(`test:${num(me.jid)}`, 30)) return say(chat, '⏳ Un test toutes les 30 secondes, patience.')
    const ok = await sendCard(
      me.dm,
      { title: 'CARTE DE TEST', color: '#4da3ff', category: 'Catégorie : Test', big: 'Ça marche !', lines: ['Si tu lis ce texte,', 'les cartes s’affichent bien.'] },
      '🧪 Carte de test (mode texte).'
    )
    return say(chat, ok ? '🧪 Carte de test envoyée en privé.' : 'Impossible de t’écrire en privé : envoie-moi d’abord un message en privé.')
  }

  if (!isGroup) {
    return say(chat, `🕵️ Ce jeu se joue dans un groupe. Ici, tape *${P}imposteur mot* pour retrouver ton rôle.`)
  }

  const key = chat
  const g = games.get(key)
  const isStarter = !!g && hasId(g.starter, me.ids)

  if (word === 'aide' || word === 'help') {
    return say(
      chat,
      `🕵️ *L’IMPOSTEUR*\n\n` +
        `1️⃣ *${P}imposteur* ouvre une partie, les autres tapent *${P}imposteur join* (${MIN_PLAYERS} à ${MAX_PLAYERS} joueurs).\n` +
        `2️⃣ Chacun reçoit *en privé* une carte (à ouvrir une seule fois) avec la catégorie et le mot secret… sauf l’imposteur, qui ne connaît que la catégorie.\n` +
        `🎭 *Variante* : *${P}imposteur proche* → l’imposteur reçoit un mot *voisin* (ex. koki au lieu de ndolé) et ne sait pas qu’il est l’imposteur !\n` +
        `3️⃣ ${CLUE_ROUNDS} tours : chacun son tour donne un indice en *un seul mot*, sans dire le mot.\n` +
        `4️⃣ Débat libre, puis vote : mentionnez (@) votre suspect.\n` +
        `5️⃣ Si l’imposteur est démasqué, il peut encore gagner en devinant le mot !\n\n` +
        `📩 Rôle non reçu ? *${P}imposteur mot* en privé au bot.\n` +
        `📊 *${P}imposteur etat* : où en est la partie\n` +
        `🏆 *${P}imposteur top* : classement des victoires`
    )
  }

  if (word === 'etat' || word === 'état' || word === 'statut') {
    if (!g) return say(chat, `Aucune partie en cours. Lance-en une avec *${P}imposteur*.`)
    const left = g.deadline ? Math.max(0, Math.ceil((g.deadline - Date.now()) / 1000)) : null
    return say(
      chat,
      `📊 *État de la partie*\n\n🧭 ${phaseName(g)}\n🎮 Mode : ${MODE_LABEL[g.mode]}\n` +
        `👥 Joueurs (${g.players.length}/${MAX_PLAYERS}) : ${listOf(g)}\n` +
        (left !== null ? `⏱️ Temps restant pour cette étape : *${left} s*\n` : '') +
        (g.phase === 'clues' && g.turns[g.turnIdx] ? `🗣️ À parler : ${tag(g.turns[g.turnIdx].jid)}\n` : '') +
        (g.phase === 'vote' ? `🗳️ Votes : ${g.votes.size}/${g.players.length}\n` : ''),
      jidsOf(g)
    )
  }

  if (word === 'top') {
    const board = wins.get(key)
    if (!board || !board.size) return say(chat, 'Aucune victoire pour l’instant. Lancez une partie ! 🕵️')
    const sorted = [...board.values()].sort((a, b) => b.n - a.n).slice(0, 10)
    const medals = ['🥇', '🥈', '🥉']
    const lines = sorted.map((e, i) => `${medals[i] || '▫️'} ${tag(e.jid)} — ${e.n} victoire(s)`)
    return say(chat, `🏆 *Classement de l’imposteur*\n\n${lines.join('\n')}`, sorted.map((e) => e.jid))
  }

  if (word === 'mode') {
    if (!g || g.phase !== 'lobby') return say(chat, 'Le mode se choisit avant le lancement, dans la salle d’attente.')
    if (!isStarter) return say(chat, 'Seul le lanceur peut changer le mode 😉')
    const mode = MODE_ALIASES[rest[0]]
    if (!mode) return say(chat, `Modes disponibles : *${P}imposteur mode classique* ou *${P}imposteur mode proche*`)
    g.mode = mode
    return say(chat, `✅ Mode : ${MODE_LABEL[mode]}`)
  }

  if (word === 'join' || word === 'rejoindre' || word === '+') {
    if (!g) return say(chat, `Aucune partie ouverte. Lance-en une avec *${P}imposteur*.`)
    if (g.phase !== 'lobby') return say(chat, 'La partie a déjà commencé, rendez-vous à la prochaine ! 😉')
    if (findPlayer(g, me.ids)) return say(chat, 'Tu es déjà dans la partie 😉')
    if (g.players.length >= MAX_PLAYERS) return say(chat, `La partie est complète (${MAX_PLAYERS} joueurs max).`)
    g.players.push(toPlayer(me))
    const missing = MIN_PLAYERS - g.players.length
    await say(
      chat,
      `✅ ${tag(me.jid)} rejoint la partie ! (${g.players.length}/${MAX_PLAYERS})\n👥 ${listOf(g)}\n` +
        (missing > 0 ? `⏳ Il manque encore *${missing}* joueur(s) pour démarrer.` : `✅ Assez de joueurs ! Le lanceur peut taper *${P}imposteur go*.`),
      jidsOf(g)
    )
    if (g.players.length >= MAX_PLAYERS) {
      await say(chat, `🚪 Salle complète : on démarre tout de suite !`)
      beginGame(key).catch((e) => console.error('[imposteur]', e))
    }
    return
  }

  if (word === 'go' || word === 'start' || word === 'lancer') {
    if (!g || g.phase !== 'lobby') return say(chat, 'Aucune partie en attente de lancement.')
    if (!isStarter) return say(chat, 'Seul le lanceur peut démarrer la partie 😉')
    beginGame(key, true).catch((e) => console.error('[imposteur]', e)) // sans attendre : l’envoi des rôles prend du temps
    return
  }

  if (word === 'vote') {
    if (!g || g.phase !== 'discuss') return say(chat, 'Le vote n’est possible que pendant le débat.')
    if (!isStarter) return say(chat, 'Seul le lanceur peut lancer le vote 😉')
    return startVote(key)
  }

  if (word === 'stop' || word === 'fin') {
    if (!g) return say(chat, 'Aucune partie en cours.')
    if (!isStarter) return say(chat, 'Seul le lanceur peut annuler la partie 😉')
    stopTimers(g)
    games.delete(key)
    return say(chat, '🛑 Partie annulée par le lanceur.')
  }

  // Ouverture d’une partie
  if (word && !MODE_ALIASES[word]) {
    return say(chat, `Commande inconnue. Tape *${P}imposteur aide* pour les règles et les commandes.`)
  }
  if (g) {
    return say(
      chat,
      g.phase === 'lobby'
        ? `⏳ Une partie attend des joueurs (${g.players.length}/${MAX_PLAYERS}). Rejoins-la avec *${P}imposteur join* !`
        : '⚠️ Une partie est déjà en cours dans ce groupe.'
    )
  }

  const mode = MODE_ALIASES[word] || 'classique'
  const starter = toPlayer(me)
  const created = { key, phase: 'lobby', mode, starter, players: [starter], timer: null, ticks: [], deadline: 0 }
  games.set(key, created)
  phaseTimer(created, LOBBY_SECONDS, () => beginGame(key), {
    marks: [60, 30, 10],
    tick: (m) =>
      say(
        key,
        `⏳ Départ dans *${m} s* — ${created.players.length}/${MAX_PLAYERS} joueurs (minimum ${MIN_PLAYERS}).\n👥 ${listOf(created)}\n➡️ Rejoindre : *${P}imposteur join*`,
        jidsOf(created)
      ),
  })
  return say(
    chat,
    `${header('lobby')}🕵️ *L’IMPOSTEUR*\nUn mot secret est donné à tous les joueurs… sauf à l’imposteur !\n\n` +
      `🎮 Mode : ${MODE_LABEL[mode]}\n(changer : *${P}imposteur mode proche* ou *classique*)\n\n` +
      `👥 Joueurs (1/${MAX_PLAYERS}) : ${tag(me.jid)}\n` +
      `➡️ Rejoindre : *${P}imposteur join*\n` +
      `▶️ Lancer : *${P}imposteur go* (lanceur), sinon départ automatique dans *${LOBBY_SECONDS} s* (${MIN_PLAYERS} joueurs minimum)\n` +
      `📖 Règles : *${P}imposteur aide*`,
    [me.jid]
  )
}

// ───────── Messages du groupe : indices, votes, dernière chance ─────────
const handleGameText = async (chat, me, text, mentioned, quoted) => {
  const g = games.get(chat)
  if (!g) return

  if (g.phase === 'clues') {
    const t = g.turns[g.turnIdx]
    if (!t || !hasId(t, me.ids)) return
    const words = text.split(/\s+/)
    const clue = words[0].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').slice(0, 30)
    if (!clue) return
    const secret = ownSecret(g, t)
    if (secret && (norm(clue) === norm(secret) || (norm(clue).length >= 4 && norm(secret).includes(norm(clue)) && !norm(secret).includes(' ')))) {
      return say(chat, `⛔ ${tag(t.jid)} : tu ne peux pas dire ton mot secret ! Trouve un autre indice (le temps continue de tourner).`, [t.jid])
    }
    return takeClue(chat, clue, words.length > 1)
  }

  if (g.phase === 'vote') {
    const voter = findPlayer(g, me.ids)
    if (!voter) return
    const target = mentioned[0] || quoted
    if (!target) return
    const suspect = g.players.find((p) => p.ids.has(num(target)))
    if (!suspect) return say(chat, `⛔ ${tag(voter.jid)} : ${tag(target)} ne participe pas à la partie.`, [voter.jid, target])
    if (suspect === voter) return say(chat, `⛔ ${tag(voter.jid)} : tu ne peux pas voter pour toi-même !`, [voter.jid])
    const changed = g.votes.has(voter)
    g.votes.set(voter, suspect) // un vote par personne : le dernier compte
    const waiting = pendingVoters(g)
    if (!waiting.length) {
      await say(chat, `${changed ? '🔄' : '🗳️'} ${tag(voter.jid)} a ${changed ? 'changé son vote' : 'voté'} ! (${g.votes.size}/${g.players.length})\n✅ *Tous les joueurs ont voté !*`, [voter.jid])
      return endVote(chat)
    }
    return say(
      chat,
      `${changed ? '🔄' : '🗳️'} ${tag(voter.jid)} a ${changed ? 'changé son vote' : 'voté'} ! (${g.votes.size}/${g.players.length})\n🕐 En attente : ${waiting.map((p) => tag(p.jid)).join(', ')}`,
      [voter.jid, ...waiting.map((p) => p.jid)]
    )
  }

  if (g.phase === 'guess') {
    if (!hasId(g.imposter, me.ids)) return
    const guess = norm(text)
    const secret = norm(g.word)
    const ok = guess.length >= 3 && (guess === secret || guess.includes(secret) || secret.split(' ').includes(guess))
    stopTimers(g)
    g.phase = 'verdict' // un seul essai
    await say(chat, `🎯 ${tag(g.imposter.jid)} tente : *${text.slice(0, 40)}*\n🥁 …`, [g.imposter.jid])
    await typing(chat, 2500)
    if (games.get(chat) !== g) return
    return conclude(
      chat,
      ok ? 'imposteur' : 'civils',
      ok ? `🎯 L’imposteur a deviné le mot : il vole la victoire !` : `❌ « ${text.slice(0, 40)} » n’était pas le bon mot.`
    )
  }
}

// ───────── Réception des messages ─────────
const onMessage = async (m) => {
  if (!m.message || !m.key?.remoteJid) return
  const chat = m.key.remoteJid
  if (chat === 'status@broadcast' || chat.endsWith('@broadcast') || chat.endsWith('@newsletter')) return

  const c = normalizeMessageContent(m.message)
  const text = String(
    c?.conversation || c?.extendedTextMessage?.text || c?.imageMessage?.caption || c?.videoMessage?.caption || ''
  ).trim()
  if (!text) return
  if (m.key.fromMe && sentTexts.includes(text)) return // textes envoyés par le bot lui-même

  const me = senderOf(m)
  if (!me) return
  const isGroup = chat.endsWith('@g.us')
  const info = c?.extendedTextMessage?.contextInfo
  const mentioned = info?.mentionedJid || []
  const quoted = info?.participant

  if (text.startsWith(P)) return handleCommand(chat, isGroup, me, text)
  if (isGroup) return handleGameText(chat, me, text, mentioned, quoted)
}

// ───────── Connexion WhatsApp ─────────
let pairingRequested = false

const start = async () => {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  let version
  try {
    ;({ version } = await fetchLatestBaileysVersion())
  } catch (e) {
    console.warn('Version WhatsApp Web introuvable, version par défaut utilisée :', e.message)
  }

  const current = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  })
  sock = current

  current.ev.on('creds.update', saveCreds)

  current.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      if (PAIRING_NUMBER && !state.creds.registered) {
        if (!pairingRequested) {
          pairingRequested = true
          try {
            const code = await current.requestPairingCode(PAIRING_NUMBER)
            console.log(`\n🔗 Code de jumelage : ${code}\nWhatsApp → Appareils connectés → Connecter un appareil → Lier avec le numéro de téléphone.\n`)
          } catch (e) {
            pairingRequested = false
            console.error('Impossible d’obtenir le code de jumelage :', e.message)
          }
        }
      } else {
        console.log('\n📱 Scanne ce QR code avec WhatsApp → Appareils connectés :\n')
        qrcode.generate(qr, { small: true })
      }
    }

    if (connection === 'open') {
      pairingRequested = false
      console.log(`✅ Bot connecté (${num(current.user?.id)}). Préfixe : ${P} • Rôles : ${ROLE_DELIVERY}`)
    }

    if (connection === 'close') {
      pairingRequested = false
      const code = lastDisconnect?.error?.output?.statusCode
      if (code === DisconnectReason.loggedOut) {
        console.error('🔒 Session déconnectée par WhatsApp (401). Session supprimée : une nouvelle liaison est nécessaire.')
        fs.rmSync(AUTH_DIR, { recursive: true, force: true })
        setTimeout(() => start().catch(console.error), 2000)
      } else {
        console.warn(`⚠️ Connexion fermée (code ${code ?? '?'}), reconnexion…`)
        setTimeout(() => start().catch(console.error), 3000)
      }
    }
  })

  current.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const m of messages) {
      try {
        await onMessage(m)
      } catch (e) {
        console.error('[imposteur] erreur :', e)
      }
    }
  })
}

process.on('unhandledRejection', (e) => console.error('unhandledRejection :', e))
process.on('uncaughtException', (e) => console.error('uncaughtException :', e))

// Vérifie au démarrage que les cartes de rôle peuvent être générées
if (ROLE_DELIVERY === 'image') {
  try {
    await renderCard({ title: 'TEST', color: '#ffffff', category: 'Catégorie : Test', big: 'Test', lines: ['ok'] })
  } catch (e) {
    console.error(
      `❌ Impossible de générer les cartes de rôle (${e.message}).\n` +
        `   Installe les dépendances (yarn install) et des polices (ex. : sudo apt install fonts-dejavu-core),\n` +
        `   ou mets ROLE_DELIVERY=text dans .env (les rôles seront alors visibles par l’hébergeur du bot).`
    )
    process.exit(1)
  }
}

start().catch((e) => {
  console.error('Démarrage impossible :', e)
  process.exit(1)
})