# 🕵️ Bot WhatsApp — L'Imposteur

![deploy](https://github.com/TON-COMPTE/imposteurBot/actions/workflows/deploy.yml/badge.svg)

Bot autonome (Baileys), prévu pour tourner dans **Docker** (recommandé) ou directement avec Node + pm2. Préfixe par défaut : `/`.
Mise en production complète (Docker, migration, CI/CD GitHub, alertes) : **[docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)**.

## Démarrage rapide avec Docker (recommandé)

```bash
cp .env.example .env && nano .env      # PREFIX, ADMIN_NUMBERS, STATE_KEY…
docker compose build
docker compose run --rm bot            # 1re connexion : scanne le QR code, attends « ✅ Bot connecté », puis Ctrl+C
docker compose up -d                   # lancement permanent (redémarrage automatique)
docker compose logs -f                 # journaux
```

Variante sans QR : renseigne `PAIRING_NUMBER` dans `.env` (ex. `237600000000`) et lis le code de jumelage dans `docker compose logs -f`.
Le QR se scanne avec le téléphone du bot (WhatsApp → Appareils connectés → Connecter un appareil).

| Commande | Effet |
|---|---|
| `docker compose up -d --build` | démarre ou met à jour le bot |
| `docker compose ps` | état (`healthy` = connecté à WhatsApp) |
| `docker compose logs -f` | journaux en direct (`Ctrl+C` pour quitter, le bot continue) |
| `docker compose restart` | redémarre |
| `docker compose down` | arrête (les données restent dans le volume) |

## Sans Docker (Node + pm2)

Node.js **≥ 22.13** requis.

```bash
npm ci
cp .env.example .env
npm run dev          # 1re connexion au premier plan (QR) ; Ctrl+C après « ✅ Bot connecté »
npm start            # lancement en arrière-plan avec pm2 (installé avec le projet)
npm run status       # état     |  npm run logs  # journaux  |  npm run restart / stop / delete
npx pm2 startup      # redémarrage automatique au boot : copie la commande sudo affichée, puis :  npm start && npx pm2 save
```

## Déploiement : ce qu'il faut savoir

- La base SQLite `node:sqlite` est intégrée à Node ; l'avertissement « experimental » au démarrage est sans conséquence.
- Garde `auth/` (`AUTH_DIR`) **et** `data/` (`DATA_DIR`) sur un **volume persistant** : sans `auth/`, il faut rescanner le QR ; sans `data/`, les scores, les parties en cours et les mots ajoutés sont perdus. Avec Docker, c'est le volume `imposteur-data`.
- **Une seule instance** par session WhatsApp (sinon déconnexions en boucle) : ne lance jamais Docker, pm2 et `npm run dev` en même temps.
- Si WhatsApp invalide la session (401), le bot en garde une copie, supprime `auth/` et réaffiche un QR / code (dans les journaux).
- **Alertes** : si `ADMIN_NUMBERS` est défini, les admins reçoivent un message privé au démarrage, au retour après une coupure d'au moins 10 min et si la sauvegarde quotidienne échoue. `HEALTHCHECK_URL` (Uptime Kuma, Healthchecks.io…) prévient aussi si le serveur entier tombe.

## Équité : l'hébergeur du bot peut-il voir les rôles ?

Trois modes d'envoi, au choix avec `ROLE_DELIVERY` dans `.env` :

| Mode | Ce que reçoit le joueur | Protection côté bot |
|---|---|---|
| `image` | carte à **vue unique** (une seule ouverture, sur téléphone) | le téléphone du bot ne peut pas la rouvrir |
| `photo` (défaut) | image normale | supprimée pour tout le monde après `ROLE_SELF_DESTRUCT` s (90 par défaut) |
| `text` | message texte | supprimé pour tout le monde après `ROLE_SELF_DESTRUCT` s (90 par défaut) |

Dans tous les modes, la conversation privée est **effacée côté bot** quelques secondes après l'envoi (`WIPE_DM_CHAT=true`)
et le bot n'écrit jamais les rôles dans ses logs. Un joueur qui a raté son message tape `/imposteur mot` en privé pour en recevoir un nouveau.

**Choisir le bon mode** : tape `/imposteur test` dans le groupe. Le bot envoie en privé 3 messages de test (A = vue unique,
B = photo, C = texte) et indique ce que WhatsApp a accepté. Regarde lesquels sont réellement arrivés, puis règle `ROLE_DELIVERY`.
La vue unique est la plus discrète, mais elle n'est pas livrée sur tous les comptes (c'est le cas si le test A n'arrive pas) : le mode par défaut est donc `photo`.
Pour renforcer `photo`, raccourcis `ROLE_SELF_DESTRUCT` (par exemple 45 s).

Limites honnêtes : celui qui contrôle le serveur et le code pourrait modifier le programme pour afficher les rôles.
La protection couvre ce que l'on voit sur le téléphone du bot, pas un hébergeur malveillant.
Conseils : utilise un **numéro dédié** au bot et joue avec ton compte habituel.

Les cartes utilisent des polices système : sur un serveur minimal, installe-en une (`sudo apt install fonts-dejavu-core`).

## Déroulement (6 phases avec décomptes)

1. **Salle d'attente** : rappels à 60 s, 30 s, 10 s ; démarrage immédiat si la salle est pleine.
2. **Distribution** : barre de progression modifiée en direct, joueur par joueur ; signalement des envois échoués.
3. **Indices** : ordre de passage annoncé, « C'est à @x » + « Ensuite : @y », décompte (20 / 10 / 5 s),
   chaque indice est annoncé aussitôt, les oublis sont signalés, récap à la fin de chaque tour.
   Règles : **un seul mot** (une phrase est refusée : « L'indice en un mot pas de phrase ! »), **pas son propre mot secret**,
   **pas l'indice déjà donné par un autre joueur**. Un indice refusé ne fait pas perdre de temps : le décompte continue.
4. **Débat** : **tableau des indices en image** (un joueur par ligne, un tour par colonne, éliminés barrés), rappels de temps.
5. **Vote** : on vote en **mentionnant (@)** le suspect, un seul @ par message (répondre à un message ne vote pas) ; chaque vote est notifié (sans révéler le suspect), qui reste à voter, fin anticipée quand tout le monde a voté, dépouillement détaillé.
6. **Verdict** : dernière chance de l'imposteur avec décompte, révélation des mots, **points de la partie**, **classement de la session** et récap des indices.

### Format de la partie (choix du lanceur)

À l'ouverture, le bot pose la question dans le groupe ; le **lanceur** répond par un chiffre (ou `/imposteur format 1|2`) :

1. **Un seul imposteur** : un seul vote, la partie est jouée.
2. **Plusieurs imposteurs / manches** : à chaque manche (indices → débat → vote) le joueur le plus accusé est **éliminé** et son rôle révélé,
   jusqu'à ce qu'il reste **3 joueurs**. Dès **8 joueurs**, il y a **2 imposteurs**. Les civils gagnent s'ils démasquent tous les imposteurs
   (le dernier démasqué a sa dernière chance de deviner le mot) ; les imposteurs gagnent s'il reste 3 joueurs avec au moins un imposteur.
   Il faut au moins 4 joueurs, sinon on joue en un seul vote. Une égalité n'élimine personne : on passe à la manche suivante.

### Points

| Événement | Points |
|---|---|
| Un civil vote pour un imposteur (à chaque vote) | +1 |
| Victoire des civils (chaque civil) | +2 |
| Imposteur gagnant (chaque imposteur encore en jeu) | +3 |
| Imposteur démasqué qui devine le mot | +2 en plus |

Le bot affiche les points de chaque manche (format 2) et, à la fin, les points de la partie et le total de chaque participant.
Les scores sont **hebdomadaires** (voir v1.11) : `/top` = la semaine, `/top global` = depuis le début ; `/stats [@joueur]` = la semaine, `/stats global` = depuis le début.
Les barèmes sont dans `src/config.js` (`scoring`).

### Identité visuelle (une seule charte)
Toutes les images (cartes de rôle, tableau des indices, règles de `/imposteur aide`, graphique du dépouillement, bilan de fin de partie, `/imposteur etat`) sont dessinées avec `src/render/theme.js` (palette, police, largeur) et `src/render/kit.js` (titres, lignes, pastilles, barres, signature). Pour changer l'apparence de tout le jeu, modifier `theme.js`. Chaque image a un repli texte si `sharp` est absent ou si le rendu échoue (`sayVisual`).

### Pseudos et polices embarquées
Le dossier `fonts/` contient DejaVu Sans (police de la charte) et GNU Unifont (secours pour presque tout Unicode) : les pseudos en alphabets rares, en lettres décoratives, en emojis ou en CJK s'affichent même sur un serveur sans ces polices. Au démarrage, `render/svg.js` crée une configuration fontconfig privée qui ajoute ce dossier. `cleanName` (game/players.js) normalise les lettres décoratives (𝐃𝐄𝐍𝐄𝐌 → DENEM) et retire invisibles et accents empilés ; un pseudo vide devient son numéro.

### Vocabulaire singulier / pluriel
Les messages qui parlent de l'imposteur passent par `src/game/wording.js` (`ie`, `pl`, `count`, `voteQuestion`…) : avec 2 imposteurs on lit « les imposteurs », « Il reste encore *1 imposteur* », etc.

### Persistance et reprise après plantage

Tout est enregistré dans une base **SQLite** (`data/imposteur.db`) : scores et statistiques, réglages par groupe, et **l'état de la partie en cours**
à chaque changement de phase. Si le bot plante ou redémarre, il **reprend la partie** là où elle s'était arrêtée (avec le temps restant)
et le prévient dans le groupe ; une partie interrompue depuis plus de 2 h est abandonnée.

### Packs de mots (hors du code)

Les mots sont dans des fichiers JSON : `packs/*.json` (fournis : `base`, `foot`, `musique`, `yaounde`, `douala`) et `data/packs/*.json` (tes ajouts).
Chaque pack contient des catégories de **paires de mots proches** :

```json
{ "name": "Foot ⚽", "description": "…", "categories": { "⚽ Joueurs": [["Messi", "Ronaldo"], ["Eto'o", "Drogba"]] } }
```

Dépose simplement un nouveau fichier `.json` dans `data/packs/` (ou `packs/`) et redémarre : le pack apparaît. Un fichier de `data/packs/` portant le même nom
qu'un pack fourni est **fusionné** avec lui. Un fichier invalide est ignoré (avec un avertissement dans les logs).
Le lanceur choisit les packs avec `/imposteur packs foot musique` (ou `tous`) ; le choix est mémorisé par groupe.

### Commandes admin

Réservées au compte du bot et aux numéros listés dans `ADMIN_NUMBERS` (`.env`).

| Commande | Effet |
|---|---|
| `/imposteur ajouter [pack :] catégorie : mot1 / mot2` | ajoute une paire de mots (pack `perso` par défaut), utilisable aussi en privé avec le bot |
| `/imposteur reset` puis `reset confirmer` | efface les **scores** du groupe (`reset tout confirmer` : tous les groupes) ; les mots ne sont jamais touchés |

`/imposteur etat` affiche à tout moment la phase, le temps restant et qui doit parler / voter.

## Commandes du jeu (dans un groupe)

| Commande | Effet |
|---|---|
| `/imposteur` | ouvre une partie (mode classique) |
| `/imposteur proche` | ouvre une partie en mode « mot proche » |
| `/imposteur mode classique\|proche` | change le mode avant le lancement (lanceur) |
| `/imposteur join` | rejoindre |
| `/imposteur go` | lancer (lanceur) |
| `/imposteur mot` | renvoyer son rôle (utilisable aussi en privé) |
| `/imposteur etat` | phase en cours, temps restant, joueurs |
| `/imposteur test` | t'envoie une carte de test |
| `/imposteur vote` | passer au vote (lanceur) |
| `/imposteur stop` | annuler (lanceur) |
| `/imposteur format 1\|2` | choisit le format (lanceur) : un seul vote, ou plusieurs manches |
| `/imposteur packs [id…\|tous]` | voir ou choisir les packs de mots |
| `/top` · `/top global` | classement de la semaine · depuis le début |
| `/stats [@joueur]` · `/stats global` | statistiques de la semaine · depuis le début |
| `/defis` | les trois défis de la semaine et ta progression |
| `/imposteur ajouter …` / `reset` | admin : ajouter des mots / effacer les scores |
| `/imposteur aide` | règles |

Raccourcis : `/defis` `/join` `/go` `/mot` `/etat` `/vote` `/stop` `/top` `/stats` `/test` `/aide` `/mode` `/format` `/packs`.

Les réglages du jeu (durées, nombre de joueurs, barème des points, règles des manches) sont dans `src/config.js`.

## Architecture du code

`index.js` ne fait que démarrer le bot ; tout le code vit dans `src/`.

```
index.js                 point d'entrée (vérifie Node, ouvre la base, charge les packs, lance la connexion)
packs/*.json             packs de mots fournis
src/
├── config.js            .env + réglages (durées, joueurs, manches, barème des points, admins)
├── core/                utilitaires purs, anti-spam, droits admin
├── content/packs.js     chargement des packs JSON, ajout de mots
├── storage/             base SQLite : db.js (schéma, migrations), scores.js, games.js, settings.js
├── whatsapp/            tout ce qui touche à Baileys
│   ├── connection.js      connexion, QR / code de jumelage, reconnexion, reprise des parties
│   ├── messageHandler.js  message reçu → commande ou message de jeu
│   ├── messenger.js       say / sayImage / editMsg / typing
│   ├── identity.js        qui écrit (jid numéro / LID, nom affiché)
│   └── socket.js          référence au socket courant
├── render/              images, toutes sur la même charte : theme.js (couleurs, police), kit.js (briques SVG), svg.js (SVG → JPEG + envoi avec repli texte),
│                        card.js (cartes de rôle), board.js (tableau), rules.js (règles), voteChart.js (dépouillement), summary.js (bilan), statusCard.js (/etat)
├── roles/               envoi des rôles en privé (delivery.js) et diagnostic (selfTest.js)
├── game/                le jeu lui-même, sans dépendance directe à Baileys
│   ├── modes/             un fichier par mode (classique, proche) + registre
│   ├── phases/            un fichier par phase (lobby → … → verdict)
│   ├── store.js           parties en cours
│   ├── lifecycle.js       minuteries de phase, fin de partie
│   ├── persistence.js     sauvegarde / chargement de l'état d'une partie
│   ├── resume.js          reprise des parties interrompues
│   ├── scoring.js         points (grand livre de la partie)
│   └── round.js, words.js, players.js, recap.js, phases-meta.js
└── commands/            une commande = un fichier + registre (index.js) + routeur
test/                    tests automatisés (faux WhatsApp, horloge virtuelle, base en mémoire)
```

Le déroulé d'une partie est : `lobby → distribution → clues → discussion → vote → verdict`.
Chaque phase démarre la suivante ; elle peut aussi écouter les messages du groupe (voir `game/phases/index.js`).

### Ajouter un mode de jeu
1. Copie `src/game/modes/classique.js` en `monmode.js` et adapte `id`, `aliases`, `label`, `secretFor`, `card`, `roleText`, `reveal`.
2. Ajoute-le à la liste `MODES` de `src/game/modes/index.js`.

Il est aussitôt disponible avec `/imposteur <alias>` et `/imposteur mode <alias>`, et apparaît dans l'aide s'il définit `helpLine`.

### Ajouter une commande
1. Copie un fichier de `src/commands/` (par ex. `top.js`) : `name`, `aliases`, `shortcut`, `groupOnly`, `run(ctx)`.
2. Ajoute-la à la liste `COMMANDS` de `src/commands/index.js`.

### Ajouter ou modifier une phase
Crée un fichier dans `src/game/phases/` (modèle : `discussion.js`), puis fais pointer la phase précédente vers lui.
Si la phase écoute les messages du groupe, déclare son gestionnaire dans `TEXT_HANDLERS` de `src/game/phases/index.js`.

### Autres points d'extension
- **Changer le barème, une durée ou une limite** : `src/config.js`.
- **Changer le schéma de la base** : ajoute une migration à la liste de `src/storage/db.js` (versionnée automatiquement).
- **Ajouter des mots** : un fichier JSON dans `packs/` ou `data/packs/`, ou la commande admin `ajouter`.

## Tests

```bash
npm test
```

La suite (`test/`) fait tourner le vrai code du bot contre un **faux WhatsApp** et une **horloge virtuelle** : une partie entière de plusieurs minutes
s'exécute en quelques secondes, sans réseau. Elle couvre les règles d'indices, le scoring, le classement, les manches d'élimination,
les 2 imposteurs, la reprise après plantage, les packs, les commandes admin et le tableau en image.
Définis `TEST_VERBOSE=1` pour voir les logs du bot pendant les tests.
### Lisibilité des images
Les images sont pensées pour un écran de téléphone (affichées ~2,4 fois plus petites que leur largeur de 900 px) : aucun texte sous 22 px, titres 48 px, valeurs clés 28–34 px, contrastes élevés, couleurs sémantiques (rouge = imposteur/danger, vert = civils, or = indices/points, bleu = information). Le bilan ne détaille que les joueurs qui ont marqué ; les autres tiennent sur une ligne.

### Carte de profil (`/imposteur stats [@joueur]`)
Image à la charte (`render/profile.js`) : rang dans le groupe, parties / victoires / points, bilan en imposteur et en civil, série de victoires en cours et meilleure série, forme des 10 dernières parties. Tout est calculé depuis la table `results` (`playerStats`), sans changement de base. Texte complet si l'image est impossible. Alias : `/imposteur profil`.

### Nombre d'imposteurs
Format 1 : toujours 1. Format 2 : 1 imposteur, 2 dès 8 joueurs, 3 dès 12 (`config.rounds.twoImpostersFrom` / `threeImpostersFrom`).

### Aléatoire (`core/random.js`, `game/fairness.js`, `game/words.js`)
- **Source** : aléa cryptographique (`crypto.randomInt`), plus de `Math.random`. Les tests injectent une source déterministe (`setRandomSource`).
- **Imposteurs** : tirage pondéré selon l'historique en base (donc persistant). Poids selon le nombre de parties *jouées par ce joueur* depuis son dernier rôle d'imposteur : 0,4 (à sa dernière partie), 0,7, 1, 1,25, 1,5, 1,7, 1,8. Un joueur sans historique (nouveau venu) reste neutre (poids 1). Poids bornés : rapport max 4,5, personne n'est exclu ni assuré. Barème dans `fairness.js` (`WEIGHTS`).
- **Mots** : mémoire persistante des paires jouées (pas de répétition avant épuisement, même après redémarrage) ; on tire d'abord une catégorie (hors les 3 dernières), puis une paire ; mots vus dans les dernières parties évités ; mot des civils / de l'imposteur tiré à pile ou face.
- **Ordre de parole** : mélange complet, avec un premier orateur toujours différent de la partie précédente. L'envoi des cartes privées se fait aussi dans un ordre aléatoire.

### Classement en image (`/imposteur top`)
Podium à la charte (`render/ranking.js`) : 1er au centre sur la marche la plus haute, 2e à gauche, 3e à droite, puis les rangs suivants en liste (10 au plus) et le bloc « Session en cours » (5 au plus). Fonctionne dès 1 joueur classé. Texte complet avec @mentions si l'image est impossible.

## Durcissement (v1.8)

- **Versions fixées** : `package.json` fixe Baileys (`7.0.0-rc14`, au moment de cette version « latest » pointait sur cette version candidate), sharp, pino, pm2, qrcode-terminal ; `package-lock.json` garantit des installations identiques (`npm ci`). Si ton installation actuelle tourne avec une autre version de Baileys, vérifie avec `npm ls @whiskeysockets/baileys` et reporte-la dans `package.json`. Mettre Baileys à jour est un choix volontaire, à tester avec `/imposteur test`.
- **Reconnexion** (`whatsapp/session.js`) : délai croissant 3 s, 6 s, 12 s… plafonné à 2 min (avec un peu de hasard). Cas particuliers : compte connecté ailleurs (440) → attente de 5 min au lieu d'une boucle de conflit ; accès refusé (403) → 10 min ; redémarrage demandé (515) → immédiat. Quand WhatsApp déconnecte la session (401), le dossier `auth/` est d'abord copié en `auth.sauvegarde-<date>` (3 copies gardées) avant d'être supprimé.
- **Doublons** : un message déjà traité (même identifiant, même conversation, dans les 10 minutes) est ignoré : un indice ne compte plus deux fois après une reconnexion.
- **Envoi des rôles** : pause aléatoire de 2 à 4 s entre deux envois (`dmDelayMinSeconds`, `dmDelayMaxSeconds`), 2 nouvelles tentatives par joueur (`dmRetries`), et le détail technique d'un échec va aux admins (`ADMIN_NUMBERS`) en message privé, plus au groupe.
- **État des parties chiffré** (AES-256-GCM, `storage/crypto.js`) : le mot secret et les imposteurs ne sont plus lisibles dans la base. Clé : `STATE_KEY` du `.env` (recommandé) ou `DATA_DIR/.state-key` créé automatiquement (droits 600). Ne range pas la clé avec les sauvegardes. Les anciennes parties non chiffrées restent lisibles ; une partie illisible (clé changée) est ignorée.
- **Sauvegarde de la base** (`storage/backup.js`) : un instantané cohérent par jour dans `DATA_DIR/backups` (`BACKUP_KEEP`, 7 par défaut, 0 = désactivé), fait aussi au démarrage si la dernière a plus de 24 h. `/imposteur sauvegarde` (admin) en fait une tout de suite. Restauration : arrêter le bot, `npm run restore` (liste), `npm run restore -- <fichier>` ; l'ancienne base est gardée en `.avant-restauration`.


## Surnoms, titres, saisons, voix du bot (v1.10)

- **Surnoms** (`src/game/titles.js`) : à partir de 5 parties, le bot donne à chaque joueur un surnom selon son style : *Le Silencieux*, *Le Bavard*,
  *L’Accusateur* (accuse souvent à tort), *Le Fin Limier* (démasque souvent), *Le Caméléon*, *Le Voleur de mots*, *Le Suspect n°1*, *Le Pacifiste*, *La Tortue*.
  Les compteurs (votes, accusations, messages, indices manqués…) sont enregistrés à chaque partie (migration 2 de la base : les anciennes parties comptent 0).
- **Titres et défis** : paliers par famille (*Menteur né* → *Maître du bluff*, *Détective* → *Inspecteur* → *Commissaire*, *Voleur de mots*, *Increvable*, *Vétéran*,
  *Champion de saison*…). La carte `/stats` affiche le surnom, les titres et le prochain défi avec sa progression ; la fin de partie annonce les nouveaux titres et surnoms.
  Pour ajouter un titre : une ligne dans `TITLES`.
- **Saisons** : `/imposteur top` montre le classement du **mois** (les compteurs repartent à zéro le 1er) ; `/imposteur top general` : tous les temps.
  Le 1er du mois, le bot annonce le podium de la saison écoulée dans chaque groupe qui a joué et retient le champion (titre *Champion de saison*).
  Les stats et les titres personnels ne sont jamais remis à zéro.
- **Cartes de saison** : décor Halloween (15 oct → 2 nov) et Noël (1er déc → 6 janv) dans les marges des images ; `THEME=noel|halloween|none` pour forcer.
- **Voix du bot** (`src/game/voice.js`) : ton de présentateur télé, phrases variées (jamais la même deux fois de suite) : ouverture, indices, débat, vote,
  suspense avant le dépouillement, ironie quand l’imposteur est démasqué, commentaires de victoire. Les phrases sont des listes faciles à modifier ;
  elles ne nomment jamais « l’imposteur » (accord singulier/pluriel) et utilisent un tirage séparé qui n’influence pas l’aléa du jeu.
- **Anti-spam** : `/etat` (10 s), `/stats` (15 s), `/top` (20 s) par joueur ; un seul avertissement, puis silence ; les admins en sont dispensés (`config.cooldowns`).
- **File de rendus** : au plus 2 images générées en même temps (`RENDER_CONCURRENCY`) : les pics de mémoire sont lissés quand plusieurs groupes jouent.
- **Test de charge** : `npm run loadtest` fait jouer 10 groupes de 15 joueurs en parallèle avec le vrai rendu d’images
  (`LOAD_GROUPS=30` pour plus). Résultat sur la machine de développement : 30 groupes terminent leur partie, mémoire maximale ≈ 300 Mo (limite du conteneur : 512 Mo).

## Éjection pour silence (v1.10.1)

Un joueur qui ne donne **aucun** de ses indices (temps écoulé à chacun de ses tours, 2 par défaut) est **éjecté** de la partie :
- **imposteur** : la partie s'arrête, pas de dernière chance, tous les civils marquent les points de victoire (`scoring.civilsWin`, 2 par défaut) ;
- **civil** : il sort du jeu (ni vote ni accusation, aucun point de victoire) et la partie continue, sauf s'il ne reste plus assez de joueurs (les imposteurs gagnent).

Le bot avertit après le premier indice manqué. Règle écrite dans `/aide`, dans l'image des règles et dans l'annonce du premier tour d'indices.


## Textes et cartes (v1.10.2)

- **Aucun texte ne déborde** : chaque texte d'image est mesuré avec les largeurs réelles de la police (`emWidth`), réduit jusqu'à une taille minimale, puis coupé par « … ».
  Les listes de mots (raisons, règles, votants) passent à la ligne selon la largeur en pixels (`wrapPx`). Un mot secret trop long se met sur 2 ou 3 lignes.
  Un test (`test/overflow.test.mjs`) vérifie le tableau, le dépouillement, le bilan, le classement et le profil avec des pseudos extrêmes.
- **Plus de score de session** nulle part : ni dans le bilan, ni dans `/top` (saison et général seulement).
- **Bilan de fin de partie** : pour chaque participant, les points de la partie (« PARTIE ») et son total de points (« TOTAL », tous les points du groupe).
- **Singulier / pluriel** : la devinette de l'imposteur accepte « mur » pour « murs » (et l'inverse), « cheval / chevaux », « eau / eaux », sans tenir compte des accents ni de la casse.
  Les indices suivent la même règle : donner le pluriel de son mot secret, ou répéter au pluriel l'indice d'un autre, est refusé.


## Semaines, défis, surnoms, fêtes (v1.11)

- **Scores hebdomadaires** (`storage/scores.js`) : la semaine va du **lundi 00:00 au dimanche 24:00** (heure du serveur, variable `TZ`). `/top` et `/stats` montrent la semaine en cours ;
  `/top global` et `/stats global` montrent tout depuis le début (rien n'est effacé : seule la vue change). Le lundi, le bot annonce dans chaque groupe qui a joué
  le **MVP de la semaine** (podium en image avec couronne, récompenses : Roi du bluff, Fin limier, Meilleure série, Voleur de mots, Le plus assidu, nombre de défis relevés)
  et retient le MVP (titres *MVP de la semaine* → *Double MVP* → *Légende des semaines*). Les anciens champions mensuels comptent toujours.
- **Défis de la semaine** (`game/challenges.js`, `/defis`) : 3 défis par groupe (bronze, argent, or), tirés au sort parmi 12 types, identiques pour tout le groupe et changeant chaque semaine
  (gagner N parties, jouer N jours différents, démasquer N imposteurs, donner N indices en moins de 10 s…). Barres de progression sur `/stats`, annonce à la fin de la partie qui en relève un.
  Aucun point en plus : c'est la gloire et le titre *Chasseur de défis*.
- **Séries** : victoires d'affilée, **jours de suite** et **semaines de suite** (avec records) sur la carte de profil.
- **Titres** : 15 familles à paliers bronze / argent / or (points, indices, rapidité, messages, régularité, défis, MVP, insaisissable…). Une ligne dans `TITLES` pour en ajouter.
- **Surnoms, analyse de style** (`game/style.js`) : 24 styles (Le Poète, Le Télégraphiste, L'Éclair, Le Mouton, Le Franc-tireur, Le Martyr, L'Anguille, Le Noctambule, Le Lève-tôt, Le Stratège, L'Équilibriste…).
  Chaque style repose sur une mesure avec échantillon minimum ; le score mélange le **seuil absolu** et la **position dans le groupe** (un « bavard » dans un groupe de bavards est atténué).
  La carte affiche le surnom, **la raison chiffrée** (« messages par partie : 8,0 (groupe : 4,1) »), jusqu'à 3 traits compatibles et la fiabilité (nombre de parties).
  Les nouvelles mesures (longueur et rapidité des indices, vote comme la majorité, éliminations, éjections) sont suivies depuis la v1.11 (migration 3 : version de suivi par partie) :
  les anciennes parties ne sont jamais comptées comme « zéro » dans ces mesures.
- **Thèmes de fête** (`render/seasonal.js`) : Halloween, Noël, Nouvel An, Saint-Valentin, Pâques (du vendredi saint au lundi), fête de l'Unité (Cameroun, 19-21 mai), **Ramadan**, **Aïd el-Fitr**, **Tabaski**
  (dates lunaires calculées avec le calendrier hégirien, ±1 jour). `THEME=ramadan|aid|tabaski|paques|…|none` dans `.env` pour forcer ou couper. Un vœu s'ajoute à l'annonce du MVP et au `/top`.
- **`/top` tague tout le groupe sans @ visible** (`whatsapp/members.js`) : la légende de l'image n'a aucun @, mais tous les membres sont mentionnés (liste du groupe mise en cache 10 min).
  Si WhatsApp ne donne pas la liste, repli sur les joueurs du classement.
- **CI/CD** : un seul workflow `.github/workflows/deploy.yml` (tests → image Docker → mise à jour du serveur sur `master`).
