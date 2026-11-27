// Parties en cours, sauvegardées (et chiffrées) pour reprendre après un plantage ou un redémarrage.
import { getDb } from './db.js'
import { encryptText, decryptText } from './crypto.js'

export const saveGameState = (key, state) => {
  getDb()
    .prepare('INSERT INTO games (key, state, updated) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET state = excluded.state, updated = excluded.updated')
    .run(key, encryptText(JSON.stringify(state)), Date.now())
}

export const deleteGameState = (key) => {
  getDb().prepare('DELETE FROM games WHERE key = ?').run(key)
}

// [{ key, state, updated }] — une partie illisible (clé perdue, données abîmées) est ignorée, pas fatale
export const loadGameStates = () => {
  const out = []
  for (const r of getDb().prepare('SELECT key, state, updated FROM games').all()) {
    try {
      out.push({ key: r.key, state: JSON.parse(decryptText(r.state)), updated: r.updated })
    } catch (e) {
      console.warn(`[imposteur] partie sauvegardée illisible pour ${r.key} (clé STATE_KEY changée ?) : ${e.message}`)
    }
  }
  return out
}
