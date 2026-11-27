# Image du bot L'Imposteur : Node 22 (SQLite intégrée), sharp (images), polices embarquées dans fonts/.
# Construire : docker build -t imposteur-bot .      Lancer : voir docker-compose.yml et docs/DEPLOIEMENT.md
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts : aucun script d'installation de dépendance n'est exécuté (sharp fournit ses binaires précompilés)
RUN npm ci --omit=dev --ignore-scripts && npm rebuild sharp 2>/dev/null || true

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    AUTH_DIR=/data/auth \
    DATA_DIR=/data/db \
    TZ=Africa/Douala
# fontconfig : nécessaire au rendu du texte des images (les polices du bot sont dans fonts/, on n'installe rien d'autre)
RUN apt-get update && apt-get install -y --no-install-recommends fontconfig tini \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data/auth /data/db && chown -R node:node /data
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .
USER node
VOLUME ["/data"]
# Le bot écrit un battement de cœur toutes les 30 s ; la sonde vérifie qu'il est vivant et connecté
HEALTHCHECK --interval=60s --timeout=10s --start-period=90s --retries=3 CMD ["node", "scripts/healthcheck.js"]
# tini : transmet correctement les signaux d'arrêt (docker stop) et évite les processus zombies
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "index.js"]
