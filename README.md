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

- Node.js **≥ 20.12**.
- Garde le dossier `auth/` (ou `AUTH_DIR`) sur un **volume persistant**, sinon il faudra rescanner à chaque redémarrage.
- **Une seule instance** par session WhatsApp (sinon déconnexions en boucle) : ne lance pas aussi `yarn dev` pendant que pm2 tourne.
- Si WhatsApp déconnecte la session (401), le bot supprime `auth/` et réaffiche un QR / code (visible avec `yarn logs`).

## Équité : l'hébergeur du bot peut-il voir les rôles ?

Trois modes d'envoi, au choix avec `ROLE_DELIVERY` dans `.env` :

| Mode | Ce que reçoit le joueur | Protection côté bot |
|---|---|---|
| `image` (défaut) | carte à **vue unique** (une seule ouverture, sur téléphone) | le téléphone du bot ne peut pas la rouvrir |
| `photo` | image normale | supprimée pour tout le monde après `ROLE_SELF_DESTRUCT` s (90 par défaut) |
| `text` | message texte | supprimé pour tout le monde après `ROLE_SELF_DESTRUCT` s (90 par défaut) |

Dans tous les modes, la conversation privée est **effacée côté bot** quelques secondes après l'envoi (`WIPE_DM_CHAT=true`)
et le bot n'écrit jamais les rôles dans ses logs. Un joueur qui a raté son message tape `/imposteur mot` en privé pour en recevoir un nouveau.

**Choisir le bon mode** : tape `/imposteur test` dans le groupe. Le bot envoie en privé 3 messages de test (A = vue unique,
B = photo, C = texte) et indique ce que WhatsApp a accepté. Regarde lesquels sont réellement arrivés, puis règle `ROLE_DELIVERY`.
La vue unique est la plus équitable, mais certaines versions de WhatsApp ou de Baileys ne la livrent pas : dans ce cas, utilise `photo`.

Limites honnêtes : celui qui contrôle le serveur et le code pourrait modifier le programme pour afficher les rôles.
La protection couvre ce que l'on voit sur le téléphone du bot, pas un hébergeur malveillant.
Conseils : utilise un **numéro dédié** au bot et joue avec ton compte habituel.

Les cartes utilisent des polices système : sur un serveur minimal, installe-en une (`sudo apt install fonts-dejavu-core`).

## Déroulement (6 phases avec décomptes)

1. **Salle d'attente** : rappels à 60 s, 30 s, 10 s ; démarrage immédiat si la salle est pleine.
2. **Distribution** : barre de progression modifiée en direct, joueur par joueur ; signalement des envois échoués.
3. **Indices** : ordre de passage annoncé, « C'est à @x » + « Ensuite : @y », décompte (20 / 10 / 5 s),
   chaque indice est annoncé aussitôt, les oublis sont signalés, récap à la fin de chaque tour ; dire son propre mot secret est refusé.
4. **Débat** : récap de tous les indices, rappels de temps.
5. **Vote** : chaque vote est notifié (sans révéler le suspect), qui reste à voter, fin anticipée quand tout le monde a voté, dépouillement détaillé.
6. **Verdict** : dernière chance de l'imposteur avec décompte, révélation des mots et récap des indices.

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
| `/imposteur top` | classement |
| `/imposteur aide` | règles |

Raccourcis : `/join` `/go` `/mot` `/etat` `/vote` `/stop` `/top` `/test` `/aide` `/mode`.

Les réglages du jeu (durées, nombre de joueurs, mots) sont en haut de `index.js`.
Le classement est en mémoire : il repart à zéro au redémarrage.