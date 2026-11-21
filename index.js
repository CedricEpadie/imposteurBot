// 🕵️ L’IMPOSTEUR — bot WhatsApp autonome (Baileys), préfixe « / » par défaut
//
// Deux modes de jeu :
//  • classique : tous les joueurs reçoivent EN PRIVÉ la catégorie et le mot secret… sauf l’imposteur,
//    qui ne connaît que la catégorie et doit bluffer.
//  • proche    : l’imposteur reçoit un mot VOISIN (ex. « koki » au lieu de « ndolé ») et ne sait pas
//    qu’il est l’imposteur ! Il doit s’en rendre compte grâce aux indices des autres.
//
// Commandes (dans un groupe) :
//  /imposteur                      → ouvre une partie (mode classique)
//  /imposteur proche               → ouvre une partie en mode « mot proche »
//  /imposteur mode <classique|proche> → change le mode avant le lancement (lanceur)
//  /imposteur join                 → rejoindre
//  /imposteur go                   → lancer (lanceur) — sinon lancement auto après le délai
//  /imposteur mot                  → renvoyer son rôle (aussi utilisable en PRIVÉ avec le bot)
//  /imposteur vote                 → passer au vote (lanceur)
//  /imposteur stop                 → annuler la partie (lanceur)
//  /imposteur top                  → classement des victoires
//  /imposteur aide                 → règles
// Raccourcis : /join /go /mot /vote /stop /top /aide /mode

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

// ───────── Configuration (variables d’environnement) ─────────
const P = process.env.PREFIX || '/'
const AUTH_DIR = process.env.AUTH_DIR || './auth' // dossier de session : à placer sur un volume persistant
const PAIRING_NUMBER = (process.env.PAIRING_NUMBER || '').replace(/\D/g, '') // ex. 237600000000 → connexion par code au lieu du QR

// ───────── Réglages du jeu (modifie à ta guise) ─────────
const MIN_PLAYERS = 3
const MAX_PLAYERS = 10
const LOBBY_SECONDS = 90 // temps pour rejoindre avant le lancement automatique
const CLUE_ROUNDS = 2 // nombre de tours d’indices
const CLUE_SECONDS = 40 // temps pour donner son indice
const DISCUSS_SECONDS = 60 // discussion libre avant le vote
const VOTE_SECONDS = 45
const GUESS_SECONDS = 30 // dernière chance de l’imposteur démasqué
const DM_DELAY_SECONDS = 5 // pause entre deux messages privés (limite les risques de blocage)

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
const SHORTCUTS = new Set(['join', 'go', 'mot', 'vote', 'stop', 'top', 'aide', 'mode'])

// ───────── État (en mémoire : remis à zéro au redémarrage du bot) ─────────
const games = new Map() // une partie par groupe (clé = jid du groupe)
const wins = new Map() // victoires : groupe → Map(num → { jid, n })
const usedPairs = new Map() // pour ne pas répéter les paires de mots
const sentTexts = [] // derniers textes envoyés par le bot (évite de les prendre pour des indices)

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

// ───────── Envoi ─────────
const say = async (chat, text, mentions = []) => {
  sentTexts.push(text)
  if (sentTexts.length > 40) sentTexts.shift()
  try {
    await sock.sendMessage(chat, { text, mentions })
  } catch (e) {
    console.error('[imposteur] envoi impossible :', e.message)
  }
}

const dm = async (jid, text) => {
  try {
    await sock.sendMessage(jid, { text })
    return true
  } catch (e) {
    console.error('[imposteur] message privé impossible :', e.message)
    return false
  }
}

const later = (g, seconds, fn) => {
  clearTimeout(g.timer)
  g.timer = setTimeout(() => {
    Promise.resolve().then(fn).catch((e) => console.error('[imposteur]', e))
  }, seconds * 1000)
}

// ───────── Mots et rôles ─────────
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

const roleText = (g, isImposter) => {
  if (g.mode === 'proche') {
    // Même message pour tout le monde : personne ne sait s’il a le mot des civils ou le mot proche
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

// ───────── Déroulement de la partie ─────────
const beginGame = async (key) => {
  const g = games.get(key)
  if (!g || g.phase !== 'lobby') return
  clearTimeout(g.timer)

  if (g.players.length < MIN_PLAYERS) {
    games.delete(key)
    return say(key, `😕 Pas assez de joueurs (${g.players.length}/${MIN_PLAYERS} minimum). Partie annulée.`)
  }

  g.phase = 'dm'
  const [category, word, closeWord] = pickPair(key)
  g.category = category
  g.word = word // mot des civils
  g.closeWord = closeWord // mot proche de l’imposteur (mode « proche » uniquement)
  const secretLabel = g.mode === 'proche' ? 'mot secret' : 'rôle'
  g.imposter = pick(g.players)
  g.order = shuffle(g.players)
  g.turns = []
  for (let r = 0; r < CLUE_ROUNDS; r++) g.order.forEach((p) => g.turns.push(p))
  g.turnIdx = 0
  g.clues = []

  await say(
    key,
    `🕵️ *LA PARTIE COMMENCE !*\n\n👥 ${g.players.length} joueurs : ${listOf(g)}\n🏷️ Catégorie : ${g.category}\n🎮 Mode : ${MODE_LABEL[g.mode]}\n\n` +
      `📩 Je vous envoie votre ${secretLabel} en privé (environ ${DM_DELAY_SECONDS} s par joueur, patience).\n` +
      `💡 Rien reçu ? Écris *${P}imposteur mot* en privé au bot.`,
    jidsOf(g)
  )

  const failed = []
  for (const p of g.players) {
    if (games.get(key) !== g) return // partie annulée entre-temps
    const ok = await dm(p.dm, roleText(g, p === g.imposter))
    if (!ok) failed.push(p.jid)
    await sleep(DM_DELAY_SECONDS * 1000)
  }
  if (games.get(key) !== g) return

  if (failed.length) {
    await say(
      key,
      `⚠️ Je n’ai pas pu écrire en privé à ${failed.map(tag).join(', ')}. Écrivez-moi *${P}imposteur mot* en privé pour recevoir votre ${secretLabel}.`,
      failed
    )
  }
  return askTurn(key)
}

const askTurn = async (key) => {
  const g = games.get(key)
  if (!g) return
  const t = g.turns[g.turnIdx]
  if (!t) return startDiscuss(key)

  g.phase = 'clues'
  const n = g.order.length
  const head = g.turnIdx % n === 0 ? `🔁 *Tour ${Math.floor(g.turnIdx / n) + 1}/${CLUE_ROUNDS}*\n\n` : ''
  later(g, CLUE_SECONDS, () => takeClue(key, null))
  return say(key, `${head}🗣️ C’est à ${tag(t.jid)} ! Donne ton indice en *un seul mot* (${CLUE_SECONDS} s).`, [t.jid])
}

const takeClue = async (key, text) => {
  const g = games.get(key)
  if (!g || g.phase !== 'clues') return
  clearTimeout(g.timer)

  const n = g.order.length
  const t = g.turns[g.turnIdx]
  g.clues.push({ round: Math.floor(g.turnIdx / n) + 1, jid: t.jid, text: text || '…' })
  g.turnIdx++

  if (g.turnIdx % n === 0) {
    const round = g.turnIdx / n
    const lines = g.clues.filter((c) => c.round === round).map((c) => `• ${tag(c.jid)} : ${c.text}`)
    await say(key, `📝 *Indices du tour ${round}*\n${lines.join('\n')}`, jidsOf(g))
  }
  return askTurn(key)
}

const startDiscuss = async (key) => {
  const g = games.get(key)
  if (!g) return
  g.phase = 'discuss'
  later(g, DISCUSS_SECONDS, () => startVote(key))
  return say(
    key,
    `💬 *DISCUSSION LIBRE* (${DISCUSS_SECONDS} s)\n\nQui a donné un indice louche ? Défendez-vous, accusez-vous !\n` +
      `Le lanceur peut taper *${P}imposteur vote* pour passer au vote.`
  )
}

const startVote = async (key) => {
  const g = games.get(key)
  if (!g) return
  g.phase = 'vote'
  g.votes = new Map() // votant (joueur) → suspect (joueur)
  later(g, VOTE_SECONDS / 2, async () => {
    const gg = games.get(key)
    if (!gg || gg.phase !== 'vote') return
    later(gg, VOTE_SECONDS / 2, () => endVote(key))
    await say(key, `⏳ Plus que *${Math.round(VOTE_SECONDS / 2)} s* ! ${gg.votes.size}/${gg.players.length} vote(s).`)
  })
  return say(
    key,
    `🗳️ *VOTE !* Qui est l’imposteur ?\n\n${listOf(g)}\n\n` +
      `Mentionne (@) ton suspect ou réponds à son message (${VOTE_SECONDS} s). Seuls les joueurs votent, et pas pour eux-mêmes. Le dernier vote compte.`,
    jidsOf(g)
  )
}

const endVote = async (key) => {
  const g = games.get(key)
  if (!g || g.phase !== 'vote') return
  clearTimeout(g.timer)

  const counts = new Map()
  for (const target of g.votes.values()) counts.set(target, (counts.get(target) || 0) + 1)
  const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1])

  if (!ranking.length) {
    return conclude(key, 'imposteur', '🐔 Personne n’a osé voter : l’imposteur passe entre les mailles du filet.')
  }

  const lines = ranking.map(([p, c]) => `• ${tag(p.jid)} — ${c} vote(s)`).join('\n')
  const [top, topCount] = ranking[0]
  const tie = ranking.length > 1 && ranking[1][1] === topCount

  if (tie || top !== g.imposter) {
    const why = tie
      ? `⚖️ Égalité des votes, personne n’est démasqué.`
      : `❌ Le groupe a accusé ${tag(top.jid)}… mais c’était un civil !`
    return conclude(key, 'imposteur', `📊 *Votes*\n${lines}\n\n${why}`, ranking.map(([p]) => p.jid))
  }

  g.phase = 'guess'
  later(g, GUESS_SECONDS, () => conclude(key, 'civils', '⏱️ Le temps est écoulé : l’imposteur n’a pas trouvé le mot.'))
  return say(
    key,
    `📊 *Votes*\n${lines}\n\n🎯 ${tag(top.jid)} est bien l’imposteur !\n` +
      `Dernière chance : devine le *mot ${g.mode === 'proche' ? 'des civils' : 'secret'}* (catégorie : ${g.category}) en un seul message. Tu as ${GUESS_SECONDS} s.`,
    [top.jid]
  )
}

const conclude = async (key, winner, reason, extraMentions = []) => {
  const g = games.get(key)
  if (!g) return
  clearTimeout(g.timer)
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
  return say(
    key,
    `🏁 *FIN DE PARTIE*\n\n` +
      (winner === 'civils' ? `🎉 *Les civils gagnent !*` : `🥷 *L’imposteur gagne !*`) +
      `\n${reason}\n\n🥷 Imposteur : ${tag(imp.jid)}\n` +
      (g.mode === 'proche'
        ? `🔑 Mot des civils : *${g.word}* (${g.category})\n🎭 Mot de l’imposteur : *${g.closeWord}*`
        : `🔑 Mot secret : *${g.word}* (${g.category})`) +
      `\n\nRejouer : *${P}imposteur*`,
    [imp.jid, ...extraMentions]
  )
}

// Renvoie son rôle : en privé (ou depuis le groupe, avec envoi en privé)
const resendRole = async (chat, isGroup, me) => {
  let game = null
  for (const g of games.values()) {
    if (g.phase !== 'lobby' && g.phase !== 'dm' && findPlayer(g, me.ids)) game = g
  }
  if (!game) return say(chat, 'Je ne te trouve dans aucune partie en cours.')
  const p = findPlayer(game, me.ids)
  const text = roleText(game, p === game.imposter)
  if (!isGroup) return say(chat, text)
  const ok = await dm(p.dm, text)
  return say(chat, ok ? '📩 Rôle renvoyé en privé.' : `Impossible de t’écrire en privé : envoie-moi *${P}imposteur mot* en privé.`)
}

// ───────── Commandes ─────────
const handleCommand = async (chat, isGroup, me, text, mentioned) => {
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
        `2️⃣ Chacun reçoit *en privé* la catégorie et le mot secret… sauf l’imposteur, qui ne connaît que la catégorie.\n` +
        `🎭 *Variante* : *${P}imposteur proche* → l’imposteur reçoit un mot *voisin* (ex. koki au lieu de ndolé) et ne sait pas qu’il est l’imposteur !\n` +
        `3️⃣ ${CLUE_ROUNDS} tours : chacun son tour donne un indice en *un seul mot*, sans dire le mot.\n` +
        `4️⃣ Discussion libre, puis vote : mentionnez (@) votre suspect.\n` +
        `5️⃣ Si l’imposteur est démasqué, il peut encore gagner en devinant le mot !\n\n` +
        `📩 Rôle non reçu ? *${P}imposteur mot* en privé au bot.\n` +
        `🏆 *${P}imposteur top* : classement des victoires`
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
    return say(chat, `✅ ${tag(me.jid)} rejoint la partie ! (${g.players.length}/${MAX_PLAYERS})\n👥 ${listOf(g)}`, jidsOf(g))
  }

  if (word === 'go' || word === 'start' || word === 'lancer') {
    if (!g || g.phase !== 'lobby') return say(chat, 'Aucune partie en attente de lancement.')
    if (!isStarter) return say(chat, 'Seul le lanceur peut démarrer la partie 😉')
    beginGame(key).catch((e) => console.error('[imposteur]', e)) // sans attendre : l’envoi des rôles prend du temps
    return
  }

  if (word === 'vote') {
    if (!g || g.phase !== 'discuss') return say(chat, 'Le vote n’est possible que pendant la discussion.')
    if (!isStarter) return say(chat, 'Seul le lanceur peut lancer le vote 😉')
    return startVote(key)
  }

  if (word === 'stop' || word === 'fin') {
    if (!g) return say(chat, 'Aucune partie en cours.')
    if (!isStarter) return say(chat, 'Seul le lanceur peut annuler la partie 😉')
    clearTimeout(g.timer)
    games.delete(key)
    return say(chat, '🛑 Partie annulée.')
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
  const created = { phase: 'lobby', mode, starter, players: [starter], timer: null }
  games.set(key, created)
  later(created, LOBBY_SECONDS, () => beginGame(key))
  return say(
    chat,
    `🕵️ *L’IMPOSTEUR*\n\nUn mot secret est donné à tous les joueurs… sauf à l’imposteur !\n` +
      `🎮 Mode : ${MODE_LABEL[mode]}\n(changer : *${P}imposteur mode proche* ou *classique*)\n\n` +
      `👥 Joueurs (1/${MAX_PLAYERS}) : ${tag(me.jid)}\n` +
      `➡️ Rejoindre : *${P}imposteur join*\n` +
      `▶️ Lancer : *${P}imposteur go* (lanceur), sinon départ automatique dans ${LOBBY_SECONDS} s (${MIN_PLAYERS} joueurs minimum)\n` +
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
    const clue = text.split(/\s+/)[0].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').slice(0, 30)
    if (!clue) return
    return takeClue(chat, clue)
  }

  if (g.phase === 'vote') {
    const voter = findPlayer(g, me.ids)
    if (!voter) return
    const target = mentioned[0] || quoted
    if (!target) return
    const suspect = g.players.find((p) => p.ids.has(num(target)))
    if (!suspect || suspect === voter) return
    g.votes.set(voter, suspect) // un vote par personne : le dernier compte
    return
  }

  if (g.phase === 'guess') {
    if (!hasId(g.imposter, me.ids)) return
    const guess = norm(text)
    const secret = norm(g.word)
    const ok = guess.length >= 3 && (guess === secret || guess.includes(secret) || secret.split(' ').includes(guess))
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

  if (text.startsWith(P)) return handleCommand(chat, isGroup, me, text, mentioned)
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
      console.log(`✅ Bot connecté (${num(current.user?.id)}). Préfixe : ${P}`)
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

start().catch((e) => {
  console.error('Démarrage impossible :', e)
  process.exit(1)
})
