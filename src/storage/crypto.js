// Chiffrement de l’état des parties en base (AES-256-GCM).
// Une partie en cours contient le mot secret et l’identité des imposteurs : sans chiffrement, une copie de la base
// (sauvegarde, fichier récupéré) suffirait à les lire.
//
// Clé : variable STATE_KEY du .env (recommandé en production : elle reste hors du dossier de données), sinon une clé aléatoire
// créée au premier lancement dans <DATA_DIR>/.state-key (droits 600). Ne range jamais cette clé avec les sauvegardes.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'

const PREFIX = 'enc:v1:'
let key = null

const loadKey = () => {
  if (key) return key
  const fromEnv = process.env.STATE_KEY
  if (fromEnv) {
    key = crypto.createHash('sha256').update(String(fromEnv)).digest()
    return key
  }
  const file = path.join(config.data.dir, '.state-key')
  try {
    key = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'hex')
    if (key.length === 32) return key
  } catch {
    /* pas encore de clé */
  }
  key = crypto.randomBytes(32)
  fs.mkdirSync(config.data.dir, { recursive: true })
  fs.writeFileSync(file, key.toString('hex') + '\n', { mode: 0o600 })
  return key
}

export const _resetKey = () => {
  key = null // pour les tests
}

export const encryptText = (plain) => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', loadKey(), iv)
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')
}

// Déchiffre ; un texte sans préfixe (ancienne base, avant le chiffrement) est rendu tel quel. Lève une erreur si la clé ne correspond pas.
export const decryptText = (stored) => {
  const s = String(stored)
  if (!s.startsWith(PREFIX)) return s
  const raw = Buffer.from(s.slice(PREFIX.length), 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', loadKey(), raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
}
