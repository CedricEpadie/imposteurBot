// Base SQLite (module intégré à Node : node:sqlite, Node ≥ 22.13).
// Ouverte au premier usage ; le schéma est créé / mis à jour automatiquement.
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config } from '../config.js'

// Chaque entrée = une migration (numéro de version = position + 1)
const MIGRATIONS = [
  `
  CREATE TABLE games (            -- parties en cours (reprise après plantage)
    key     TEXT PRIMARY KEY,     -- jid du groupe
    state   TEXT NOT NULL,        -- JSON
    updated INTEGER NOT NULL
  );
  CREATE TABLE results (          -- une ligne par joueur et par partie terminée
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id   TEXT NOT NULL,
    group_jid TEXT NOT NULL,
    num       TEXT NOT NULL,
    jid       TEXT NOT NULL,
    name      TEXT,
    role      TEXT NOT NULL,      -- 'civil' | 'imposteur'
    won       INTEGER NOT NULL,   -- 1 si son camp a gagné
    points    INTEGER NOT NULL,
    ts        INTEGER NOT NULL
  );
  CREATE INDEX idx_results_group ON results (group_jid, ts);
  CREATE INDEX idx_results_num ON results (num);
  CREATE TABLE settings (         -- réglages par groupe (packs actifs, début de session…)
    group_jid TEXT NOT NULL,
    key       TEXT NOT NULL,
    value     TEXT NOT NULL,
    PRIMARY KEY (group_jid, key)
  );
  `,
]

let db = null

export const getDb = () => {
  if (db) return db
  const file = config.data.dbPath
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true })
  db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  const current = db.prepare('PRAGMA user_version').get().user_version
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[v])
      db.exec(`PRAGMA user_version = ${v + 1}`)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }
  return db
}

export const closeDb = () => {
  db?.close()
  db = null
}
