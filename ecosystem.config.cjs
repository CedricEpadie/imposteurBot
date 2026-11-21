// Configuration pm2 (fichier .cjs car le projet utilise les modules ES)
module.exports = {
  apps: [
    {
      name: 'imposteur',
      script: 'index.js',
      cwd: __dirname, // pour que le fichier .env et le dossier auth/ soient trouvés
      instances: 1, // UNE SEULE instance par session WhatsApp
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      max_memory_restart: '400M',
      time: true, // horodatage dans les logs
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}