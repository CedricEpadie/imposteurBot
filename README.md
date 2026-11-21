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

## Commandes du jeu (dans un groupe)

| Commande | Effet |
|---|---|
| `/imposteur` | ouvre une partie (mode classique) |
| `/imposteur proche` | ouvre une partie en mode « mot proche » |
| `/imposteur mode classique\|proche` | change le mode avant le lancement (lanceur) |
| `/imposteur join` | rejoindre |
| `/imposteur go` | lancer (lanceur) |
| `/imposteur mot` | renvoyer son rôle (utilisable aussi en privé) |
| `/imposteur vote` | passer au vote (lanceur) |
| `/imposteur stop` | annuler (lanceur) |
| `/imposteur top` | classement |
| `/imposteur aide` | règles |

Raccourcis : `/join` `/go` `/mot` `/vote` `/stop` `/top` `/aide` `/mode`.

Les réglages du jeu (durées, nombre de joueurs, mots) sont en haut de `index.js`.
Le classement est en mémoire : il repart à zéro au redémarrage.