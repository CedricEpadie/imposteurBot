# Déploiement : Docker, CI/CD GitHub, alertes

Sommaire : 1. Docker · 2. Migrer l'existant · 3. Mises à jour · 4. Sauvegardes · 5. CI · 6. CD · 7. Dependabot · 8. Alertes · 9. Test de charge · 10. Dépannage

## 0. Le message `npm ls … invalid: "latest"`
La version installée (rc14) est la bonne ; l'ancien `package.json` demandait `"latest"`. Avec le `package.json` actuel (version figée) :
```bash
rm -rf node_modules && npm ci && npm ls @whiskeysockets/baileys
```
(Avec Docker, les dépendances sont installées dans l'image : ce message ne te concerne plus.)

## 1. Docker sur le serveur (Ubuntu/Debian)
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER      # puis déconnecte-toi et reconnecte-toi
docker compose version
```
Première installation :
```bash
cd ~/imposteurBot
cp .env.example .env && nano .env   # PREFIX, ADMIN_NUMBERS, STATE_KEY (openssl rand -hex 32), PAIRING_NUMBER si besoin
docker compose build
docker compose run --rm bot         # 1re connexion : QR code (ou code de jumelage), puis Ctrl+C
docker compose up -d && docker compose logs -f
docker compose ps                   # « healthy » après ~1,5 min
```
**STATE_KEY** : garde-la ailleurs aussi ; sans elle, les parties chiffrées ne se relisent pas.

## 2. Migrer l'existant (pm2 → Docker) sans rien perdre
Le conteneur n'utilise **pas** ton dossier `data/` : il a son propre volume, vide au départ. Il faut y copier :
`auth/` (session WhatsApp, sinon nouveau QR) et `data/` (scores, historique, parties en cours, mots ajoutés).
```bash
cd ~/imposteurBot
cp -a auth auth.copie && cp -a data data.copie     # filet de sécurité
pm2 stop imposteur                                 # une seule session WhatsApp à la fois !

docker compose run --rm --no-deps --user root \
  -v "$PWD/auth:/old/auth:ro" -v "$PWD/data:/old/data:ro" bot \
  sh -c 'cp -a /old/auth/. /data/auth/ && cp -a /old/data/. /data/db/ && chown -R node:node /data'

docker compose up -d && docker compose logs -f
```
Vérifie avec `/top` et `/stats` que les anciens scores sont là. Garde `STATE_KEY` identique à l'ancien `.env`.
Quand tout va bien : `pm2 delete imposteur`.

## 3. Mises à jour
Manuelle : `git pull && docker compose up -d --build` (ou laisse le CD le faire, §6).
Les données (session, scores, sauvegardes) vivent dans le volume `imposteur-data` et survivent.

## 4. Sauvegardes
Sauvegarde automatique quotidienne de la base (7 conservées) dans `/data/db/backups`.
```bash
docker compose exec bot ls /data/db/backups
docker run --rm -v imposteur-data:/data -v "$PWD":/out debian tar czf /out/imposteur-data.tgz -C /data .   # copie complète du volume
docker compose stop && docker compose run --rm bot node scripts/restore.js                               # restauration
```
Copie régulièrement l'archive hors du serveur (autre machine, stockage externe) : si le disque meurt, les sauvegardes locales partent avec.

## 5. CI : les vérifications automatiques (workflow `deploy`, jobs `tests` et `docker`)
1. Crée un dépôt GitHub **privé** (New repository, sans README). `.env`, `auth/`, `data/` sont déjà ignorés (`.gitignore`) : ne les ajoute jamais.
2. Pousse le code :
   ```bash
   cd ~/imposteurBot
   git init && git add . && git status     # vérifie : ni .env, ni auth/, ni data/
   git commit -m "Bot L'Imposteur" && git branch -M master
   git remote add origin git@github.com:TON-COMPTE/imposteurBot.git && git push -u origin master
   ```
   (Clé SSH refusée : `ssh-keygen -t ed25519`, puis colle `~/.ssh/id_ed25519.pub` dans GitHub → Settings → SSH and GPG keys.)
3. Onglet **Actions** : le workflow « deploy » se lance seul → job *Tests (Node 22)* (tests, rendu réel des images, audit) puis job *Image Docker* (construction et test dans l'image). Sur une Pull Request, seuls ces deux jobs tournent.
4. Badge : remplace `TON-COMPTE` dans la 1re ligne du README.
5. Protéger `master` : Settings → Branches → Add rule → « Require status checks to pass » → `Tests (Node 22)` et `Image Docker`.
6. Publier une image (facultatif) : `git tag v1.9.1 && git push --tags` → image sur `ghcr.io/TON-COMPTE/imposteurbot`
   (Settings → Actions → General → Workflow permissions : « Read and write »).

## 6. CD : déploiement automatique
Quand les jobs *tests* et *docker* sont verts sur `master`, le 3e job du même fichier `.github/workflows/deploy.yml` (*Mise à jour du serveur*) se connecte en SSH au serveur, fait `git reset --hard origin/master`,
`docker compose up -d --build`, puis attend que le conteneur soit **healthy** (sinon le déploiement est marqué en échec et GitHub te prévient).

**a) Relier le dossier du serveur au dépôt** (une fois ; `.env` et le volume Docker ne sont pas touchés) :
```bash
cd ~/imposteurBot
ssh-keygen -t ed25519 -f ~/.ssh/deploy_github -N ""        # clé de lecture du dépôt
cat ~/.ssh/deploy_github.pub                               # → GitHub : dépôt → Settings → Deploy keys → Add (lecture seule)
printf 'Host github.com\n  IdentityFile ~/.ssh/deploy_github\n' >> ~/.ssh/config
git init && git remote add origin git@github.com:TON-COMPTE/imposteurBot.git
git fetch origin master && git reset --hard origin/master
```
**b) Clé SSH pour GitHub Actions** (sur ton PC) :
```bash
ssh-keygen -t ed25519 -f imposteur_deploy -N "" -C github-actions
ssh-copy-id -i imposteur_deploy.pub UTILISATEUR@IP_DU_SERVEUR
```
**c) Secrets** : GitHub → Settings → Secrets and variables → Actions → New repository secret :
`SSH_HOST` (IP ou domaine), `SSH_USER`, `SSH_KEY` (contenu complet de `imposteur_deploy`, clé **privée**), `SSH_PORT` (si ≠ 22).
Variable facultative (onglet Variables) : `DEPLOY_DIR` si le bot n'est pas dans `~/imposteurBot`.
Puis supprime `imposteur_deploy` de ton PC.

**d) Test** : un petit commit sur `master` → Actions : le workflow « deploy » enchaîne tests, image et mise à jour du serveur. Sur le serveur : `docker compose ps`.

Notes : un déploiement redémarre le bot (une partie en cours est reprise) → évite de pousser en pleine soirée de jeu.
Retour arrière : `git revert <commit>` puis push. Le bot t'envoie un message WhatsApp à chaque redémarrage (§8), tu vois donc le déploiement passer.

## 7. Dependabot : dépendances à jour
`.github/dependabot.yml` : chaque lundi, GitHub ouvre une Pull Request si une dépendance (npm, image Node, actions GitHub) a une nouvelle version.
Le job *tests* la teste ; si c'est vert, tu fusionnes (donc le CD déploie). **Baileys est exclu** : il reste figé en rc14 jusqu'à ce que tu décides de le monter
à la main (change la version dans `package.json`, `npm install`, teste avec `/imposteur test`). Pas de saut de version majeure de Node automatique.
Activation : Settings → Code security → « Dependabot alerts » et « Dependabot security updates » (alertes de vulnérabilités).

## 8. Alertes quand le bot tombe
**Par WhatsApp** (nécessite `ADMIN_NUMBERS` dans `.env`) — message privé aux admins :
- au démarrage (« ✅ L'Imposteur vX démarré ») : confirme aussi chaque déploiement ;
- au retour après une coupure d'au moins 10 min (« reconnecté après N min ») ;
- si la session WhatsApp a été invalidée puis reliée ;
- si la sauvegarde quotidienne échoue.
Un bot déconnecté ne peut pas écrire : ces alertes partent dès la reconnexion.

**Surveillance externe** (prévient même si le serveur est éteint) :
1. Crée un moniteur de type **Push** : dans Uptime Kuma (auto-hébergé, ou sur un autre serveur) *Add New Monitor → Push*, intervalle 120 s ;
   ou sur healthchecks.io (gratuit) un check « every 2 minutes, grace 5 minutes ».
2. Copie l'adresse de push et mets-la dans `.env` : `HEALTHCHECK_URL=https://…`
3. `docker compose up -d` pour recharger.
4. Configure la notification (e-mail, Telegram…) dans le service.
Le bot appelle cette adresse chaque minute **tant qu'il est connecté à WhatsApp** : plus d'appel = alerte (serveur éteint, bot planté ou déconnecté).

## 9. Test de charge
`npm ci && npm run loadtest` (hors Docker, avec les dépendances de développement) : 10 groupes × 15 joueurs jouent en même temps avec le vrai rendu d'images.
`LOAD_GROUPS=30 npm run loadtest` pour pousser plus loin. Le test échoue si une partie ne finit pas ou si la mémoire dépasse 480 Mo.
Si tu héberges beaucoup de groupes, ajuste `mem_limit` dans `docker-compose.yml` et `RENDER_CONCURRENCY` dans `.env`.

## 10. Dépannage
- `docker compose ps` → **unhealthy** : `docker compose logs --tail 50` ; la sonde échoue si le bot est bloqué ou déconnecté depuis plus de 12 min.
- Session invalidée (401) : une copie de `auth/` est gardée ; relie avec `docker compose run --rm bot` (QR).
- Test du rendu des images : `docker compose run --rm bot node scripts/smoke.js`.
- Le déploiement échoue sur « Permission denied (publickey) » : la clé du §6b n'est pas dans `~/.ssh/authorized_keys` du serveur, ou `SSH_KEY` est incomplet.
- `git fetch` échoue sur le serveur : la deploy key du §6a n'est pas ajoutée au dépôt.
