// Parties en cours, sauvegardées pour reprendre après un plantage ou un redémarrage.
import { getDb } from './db.js'

export const saveGameState = (key, state) => {
  getDb()
    .prepare('INSERT INTO games (key, state, updated) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET state = excluded.state, updated = excluded.updated')
    .run(key, JSON.stringify(state), Date.now())
}

export const deleteGameState = (key) => {
  getDb().prepare('DELETE FROM games WHERE key = ?').run(key)
}

// [{ key, state, updated }]
export const loadGameStates = () =>
  getDb()
    .prepare('SELECT key, state, updated FROM games')
    .all()
    .map((r) => ({ key: r.key, state: JSON.parse(r.state), updated: r.updated }))
