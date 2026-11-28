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
  `
  -- v1.10 : comportement de chaque joueur dans la partie (surnoms et titres)
  ALTER TABLE results ADD COLUMN votes    INTEGER NOT NULL DEFAULT 0;  -- votes émis
  ALTER TABLE results ADD COLUMN right    INTEGER NOT NULL DEFAULT 0;  -- votes justes (civil → imposteur)
  ALTER TABLE results ADD COLUMN wrong    INTEGER NOT NULL DEFAULT 0;  -- votes injustes (civil → civil)
  ALTER TABLE results ADD COLUMN received INTEGER NOT NULL DEFAULT 0;  -- votes reçus (accusations subies)
  ALTER TABLE results ADD COLUMN abstain  INTEGER NOT NULL DEFAULT 0;  -- votes manqués
  ALTER TABLE results ADD COLUMN talk     INTEGER NOT NULL DEFAULT 0;  -- messages pendant le débat et le vote
  ALTER TABLE results ADD COLUMN clues    INTEGER NOT NULL DEFAULT 0;  -- indices donnés
  ALTER TABLE results ADD COLUMN missed   INTEGER NOT NULL DEFAULT 0;  -- indices manqués (temps écoulé)
  ALTER TABLE results ADD COLUMN stolen   INTEGER NOT NULL DEFAULT 0;  -- victoires volées en devinant le mot
  `,
  `
  -- v1.11 : style de jeu plus fin (surnoms) — longueur et rapidité des indices, alignement sur le groupe, sorties de partie
  ALTER TABLE results ADD COLUMN clen    INTEGER NOT NULL DEFAULT 0;  -- total de lettres des indices donnés
  ALTER TABLE results ADD COLUMN fast    INTEGER NOT NULL DEFAULT 0;  -- indices donnés en moins de 10 s
  ALTER TABLE results ADD COLUMN herd    INTEGER NOT NULL DEFAULT 0;  -- votes pour le joueur finalement désigné par le groupe
  ALTER TABLE results ADD COLUMN fell    INTEGER NOT NULL DEFAULT 0;  -- éliminé par un vote alors qu'il était civil
  ALTER TABLE results ADD COLUMN caught  INTEGER NOT NULL DEFAULT 0;  -- démasqué (éliminé par un vote) alors qu'il était imposteur
  ALTER TABLE results ADD COLUMN ejected INTEGER NOT NULL DEFAULT 0;  -- éjecté pour silence
  -- Version du suivi : 0 = avant la v1.10 (rien de mesuré), 1 = v1.10, 2 = v1.11. Les surnoms ne comparent que ce qui a été mesuré.
  ALTER TABLE results ADD COLUMN tracking INTEGER NOT NULL DEFAULT 0;
  UPDATE results SET tracking = 1 WHERE clues + missed > 0;
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
