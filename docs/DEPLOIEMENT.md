# Déploiement Docker + intégration continue

## 0. Ton `npm ls` « invalid »
`@whiskeysockets/baileys@7.0.0-rc14 invalid: "latest"` : la version installée (rc14) est la bonne, mais l'ancien
`package.json` demandait `"latest"`. Avec le `package.json` actuel (version figée) et `npm ci`, le message disparaît :
```bash
cd ~/imposteurBot && rm -rf node_modules && npm ci && npm ls @whiskeysockets/baileys
```

## 1. Installer Docker sur le serveur (Ubuntu/Debian)
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER      # puis déconnecte-toi et reconnecte-toi
docker compose version             # doit afficher une version
```

## 2. Première installation
```bash
cd ~/imposteurBot
cp .env.example .env && nano .env   # PREFIX, ADMIN_NUMBERS, STATE_KEY (voir ci-dessous), PAIRING_NUMBER si code de jumelage
docker compose build
docker compose run --rm bot         # 1re connexion : scanne le QR code (ou saisis le code de jumelage), puis Ctrl+C
docker compose up -d                # lancement permanent
docker compose logs -f              # journaux
docker compose ps                   # « healthy » après ~1,5 min
```
- **STATE_KEY** : `openssl rand -hex 32` → à coller dans `.env` et à sauvegarder ailleurs (sans elle, les parties chiffrées ne se relisent pas).
- **Migrer l'ancienne session** (pm2 → Docker) pour éviter de rescanner le QR : `pm2 stop imposteur`, puis
  `docker compose run --rm --no-deps -v $PWD/auth:/old bot sh -c 'cp -r /old/. /data/auth/'` ; idem pour `data/` → `/data/db`.
  Ne lance jamais pm2 et Docker en même temps (deux sessions WhatsApp = déconnexions).

## 3. Mise à jour
```bash
git pull && docker compose up -d --build
```
Les données (session, scores, sauvegardes) vivent dans le volume `imposteur-data` : elles survivent aux mises à jour.

## 4. Sauvegarde / restauration
```bash
docker compose exec bot ls /data/db/backups                 # sauvegardes quotidiennes automatiques
docker run --rm -v imposteur-data:/data -v $PWD:/out debian tar czf /out/imposteur-data.tgz -C /data .
docker compose run --rm bot node scripts/restore.js         # restauration de la base
```

## 5. Intégration continue (GitHub Actions)
1. Crée un dépôt **privé** sur github.com (New repository). Ne commit jamais `.env`, `auth/`, `data/` (déjà dans `.gitignore`).
2. Dans le dossier du bot :
   ```bash
   git init && git add . && git commit -m "Bot L'Imposteur v1.9"
   git branch -M main
   git remote add origin git@github.com:TON-COMPTE/imposteurBot.git
   git push -u origin main
   ```
3. Onglet **Actions** du dépôt : le workflow « CI » se lance seul. Il fait : `npm ci` → tests → rendu réel des images →
   audit de sécurité (informatif) → construction de l'image Docker → test de rendu dans l'image.
4. Badge (optionnel) à mettre dans le README :
   `![CI](https://github.com/TON-COMPTE/imposteurBot/actions/workflows/ci.yml/badge.svg)`
5. Protéger `main` : Settings → Branches → Add rule → « Require status checks to pass » → coche `Tests (Node 22)` et `Image Docker`.
6. Publier une image : `git tag v1.9.0 && git push --tags` → l'image part sur `ghcr.io/TON-COMPTE/imposteurbot` (Settings → Actions → General
   → Workflow permissions : « Read and write »). Sur le serveur : `docker pull ghcr.io/TON-COMPTE/imposteurbot:v1.9.0`.

## 6. Dépannage
- `docker compose ps` affiche **unhealthy** : `docker compose logs --tail 50` ; la sonde échoue si le bot est bloqué ou déconnecté depuis plus de 12 min.
- Session invalidée (401) : le bot sauvegarde `auth/` puis redemande un QR → `docker compose run --rm bot`.
- Images sans texte exotique : `docker compose run --rm bot node scripts/smoke.js`.
