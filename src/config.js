// Configuration centrale : variables d’environnement (.env) + réglages du jeu.
// Ce module doit être importé en premier : il charge le fichier .env avant toute lecture de process.env.

try {
  process.loadEnvFile('.env') // Node ≥ 20.12 ; sans fichier .env, on utilise les variables d’environnement de l’hébergeur
} catch {}

const env = process.env

// photo (défaut) = image normale qui s’efface seule • image = carte à vue unique (non livrée sur certains comptes)
// • text = texte qui s’efface seul
export const DELIVERY_MODES = ['image', 'photo', 'text']
const requested = (env.ROLE_DELIVERY || 'photo').toLowerCase()
const delivery = DELIVERY_MODES.includes(requested) ? requested : 'photo'

export const config = {
  // Préfixe des commandes
  prefix: env.PREFIX || '/',
  // Dossier de session WhatsApp : à placer sur un volume persistant
  authDir: env.AUTH_DIR || './auth',
  // ex. 237600000000 → connexion par code de jumelage au lieu du QR
  pairingNumber: (env.PAIRING_NUMBER || '').replace(/\D/g, ''),

  // Envoi des rôles en privé
  roles: {
    delivery,
    // Secondes avant suppression automatique du message de rôle (pour tout le monde). 0 = jamais.
    // Par défaut : désactivé en mode « image » (vue unique), 90 s en modes « photo » et « text ».
    selfDestruct: Number(env.ROLE_SELF_DESTRUCT ?? (delivery === 'image' ? 0 : 90)) || 0,
    // Efface la conversation privée côté bot juste après l’envoi d’un rôle
    wipeDmChat: (env.WIPE_DM_CHAT || 'true').toLowerCase() !== 'false',
  },

  // Données persistantes : base SQLite (scores, parties en cours) et packs de mots ajoutés
  // → à placer sur un volume persistant en hébergement
  data: {
    dir: env.DATA_DIR || './data',
    dbPath: env.DB_PATH || `${env.DATA_DIR || './data'}/imposteur.db`, // « :memory: » pour les tests
    sessionGapHours: 6, // une « session » = parties du groupe séparées de moins de 6 h
    resumeMaxAgeMinutes: 120, // une partie interrompue depuis plus longtemps n’est pas reprise
    // Sauvegarde automatique de la base dans <DATA_DIR>/backups : au plus une toutes les `everyHours` heures, `keep` copies conservées (0 = désactivé)
    backups: { keep: Number(env.BACKUP_KEEP ?? 7), everyHours: 24 },
  },

  // Numéros autorisés à utiliser les commandes admin (ajouter des mots, effacer les scores).
  // Le compte du bot lui-même est toujours admin.
  admins: (env.ADMIN_NUMBERS || '').split(',').map((s) => s.replace(/\D/g, '')).filter(Boolean),

  // Format « plusieurs manches » (choix 2 du lanceur) : le groupe élimine un suspect par manche
  rounds: {
    minPlayers: 4, // en dessous, la partie reste à un seul vote
    stopAt: 3, // la partie s’arrête (victoire des imposteurs) quand il reste ce nombre de joueurs
    twoImpostersFrom: 8, // 2 imposteurs à partir de ce nombre de joueurs (format « plusieurs manches »)
    threeImpostersFrom: 12, // 3 imposteurs à partir de ce nombre de joueurs
    maxManches: 8, // garde-fou (égalités en boucle)
  },

  // Points (affichés à chaque manche et à la fin de la partie)
  scoring: {
    rightVote: 1, // un civil vote pour un imposteur
    civilsWin: 2, // chaque civil quand les civils gagnent
    imposterWin: 3, // chaque imposteur encore en jeu quand les imposteurs gagnent
    imposterGuess: 2, // bonus : l’imposteur démasqué qui devine le mot
  },

  // Réglages du jeu (modifie à ta guise)
  game: {
    minPlayers: 3,
    maxPlayers: 15,
    lobbySeconds: 90, // temps pour rejoindre avant le lancement automatique
    readSeconds: 20, // temps pour lire son rôle avant les indices
    clueRounds: 2, // nombre de tours d’indices
    clueSeconds: 40, // temps pour donner son indice
    discussSeconds: 60, // discussion libre avant le vote
    voteSeconds: 45,
    guessSeconds: 30, // dernière chance de l’imposteur démasqué
    // Pause entre deux envois privés : durée tirée au hasard entre ces deux bornes (un rythme irrégulier ressemble plus à un humain
    // et limite les risques de blocage ; 15 joueurs = environ 45 s au lieu de 75 s)
    dmDelayMinSeconds: 2,
    dmDelayMaxSeconds: 4,
    dmRetries: 2, // nouvelles tentatives d’envoi d’un rôle en cas d’échec (en plus du premier essai)
  },
}
