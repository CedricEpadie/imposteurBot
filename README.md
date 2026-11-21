# 🕵️ Bot WhatsApp — L'Imposteur

Bot autonome (Baileys). Préfixe par défaut : `/`.

## Installation

```bash
npm install
cp .env.example .env     # puis ajuste si besoin
npm start
```

Au premier lancement, un **QR code** s'affiche dans la console : scanne-le avec le téléphone du bot
(WhatsApp → Appareils connectés → Connecter un appareil).
Variante : renseigne `PAIRING_NUMBER` (ex. `237600000000`) pour recevoir un **code de jumelage** à la place du QR.

## Déploiement

- Node.js **≥ 20.12**.
- Garde le dossier `AUTH_DIR` (par défaut `./auth`) sur un **volume persistant**, sinon il faudra rescanner à chaque redémarrage.
- **Une seule instance** par session WhatsApp (sinon déconnexions en boucle).
- Si WhatsApp déconnecte la session (401), le bot supprime `auth/` et réaffiche un QR / code.
- Avec pm2 : `pm2 start index.js --name imposteur`

## Commandes (dans un groupe)

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
