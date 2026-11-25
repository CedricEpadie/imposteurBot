// Réglages persistants par groupe (clé / valeur texte).
import { getDb } from './db.js'

export const getSetting = (group, key, fallback = null) => {
  const row = getDb().prepare('SELECT value FROM settings WHERE group_jid = ? AND key = ?').get(group, key)
  return row ? row.value : fallback
}

export const setSetting = (group, key, value) => {
  getDb()
    .prepare('INSERT INTO settings (group_jid, key, value) VALUES (?, ?, ?) ON CONFLICT (group_jid, key) DO UPDATE SET value = excluded.value')
    .run(group, key, String(value))
}
