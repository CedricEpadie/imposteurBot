# 🕵️ Bot WhatsApp — L'Imposteur

Bot autonome (Baileys), lancé en arrière-plan avec **pm2** via **yarn**. Préfixe par défaut : `/`.

## Installation

```bash
yarn install
cp .env.example .env     # puis ajuste si besoin
```

pm2 est installé avec le projet : pas besoin de l'installer globalement.

## Première connexion (QR code)

Lance le bot **au premier plan** pour scanner le QR :

```bash
yarn dev
```

Scanne le QR avec le téléphone du bot (WhatsApp → Appareils connectés → Connecter un appareil),
attends le message `✅ Bot connecté`, puis arrête avec `Ctrl+C`.

Variante sans QR : renseigne `PAIRING_NUMBER` dans `.env` (ex. `237600000000`), lance `yarn start`,
puis lis le code de jumelage avec `yarn logs`.

## Lancer en arrière-plan (pm2)

| Commande | Effet |
|---|---|
| `yarn start` | démarre le bot en arrière-plan |
| `yarn status` | état du processus |
| `yarn logs` | logs en direct (`Ctrl+C` pour quitter, le bot continue) |
| `yarn restart` | redémarre |
| `yarn stop` | arrête |
| `yarn delete` | retire le bot de pm2 |

### Redémarrage automatique au boot du serveur

```bash
yarn pm2 startup      # affiche une commande sudo à copier-coller
yarn start
yarn pm2 save
```

## Déploiement

- Node.js **≥ 22.13** (la base SQLite `node:sqlite` est intégrée à Node ; elle affiche un avertissement « experimental » au démarrage, sans conséquence).
- Garde le dossier `auth/` (ou `AUTH_DIR`) **et le dossier `data/` (ou `DATA_DIR`)** sur un **volume persistant** : sans `auth/` il faudra rescanner le QR, sans `data/` les scores, les parties en cours et les mots ajoutés seront perdus.
- **Une seule instance** par session WhatsApp (sinon déconnexions en boucle) : ne lance pas aussi `yarn dev` pendant que pm2 tourne.
- Si WhatsApp déconnecte la session (401), le bot supprime `auth/` et réaffiche un QR / code (visible avec `yarn logs`).

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

Le bot affiche les points de chaque manche (format 2), les points de la partie et le **classement de la session**
(parties du groupe séparées de moins de 6 h) à la fin. `/imposteur top` montre la session et le classement général,
`/imposteur stats [@joueur]` les statistiques d'un joueur (parties, victoires, points, rôle imposteur / civil).
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
| `/imposteur top` | classement de la session et classement général |
| `/imposteur stats [@joueur]` | statistiques d'un joueur |
| `/imposteur ajouter …` / `reset` | admin : ajouter des mots / effacer les scores |
| `/imposteur aide` | règles |

Raccourcis : `/join` `/go` `/mot` `/etat` `/vote` `/stop` `/top` `/stats` `/test` `/aide` `/mode` `/format` `/packs`.

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
yarn test     # ou : npm test
```

La suite (`test/`) fait tourner le vrai code du bot contre un **faux WhatsApp** et une **horloge virtuelle** : une partie entière de plusieurs minutes
s'exécute en quelques secondes, sans réseau. Elle couvre les règles d'indices, le scoring, le classement, les manches d'élimination,
les 2 imposteurs, la reprise après plantage, les packs, les commandes admin et le tableau en image.
Définis `TEST_VERBOSE=1` pour voir les logs du bot pendant les tests.