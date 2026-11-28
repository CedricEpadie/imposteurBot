// Petits utilitaires purs, sans dépendance au jeu ni à WhatsApp.
import { randInt, rand as randFloat } from './random.js'

// « 237600000000:12@s.whatsapp.net » → « 237600000000 »
export const num = (jid) => String(jid || '').split('@')[0].split(':')[0]

// Retire le suffixe d’appareil d’un jid : « 237…:12@s.whatsapp.net » → « 237…@s.whatsapp.net »
export const clean = (jid) => {
  const [user, server] = String(jid || '').split('@')
  return `${user.split(':')[0]}@${server}`
}

export const tag = (jid) => '@' + num(jid)
export const pick = (arr) => arr[randInt(arr.length)]
// Durée aléatoire (en ms) entre min et max secondes
export const jitterMs = (minS, maxS) => Math.round((minS + randFloat() * Math.max(0, maxS - minS)) * 1000)
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Normalise un texte pour comparer des mots (minuscules, sans accents ni ponctuation)
export const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Radical d'un mot pour comparer singulier et pluriel : « murs » = « mur », « chevaux » = « cheval », « eaux » = « eau »
const stemWord = (w) => {
  if (w.length > 4 && w.endsWith('aux') && !w.endsWith('eaux')) return w.slice(0, -3) + 'al'
  return w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w
}
export const stem = (s) => norm(s).split(' ').map(stemWord).join(' ')
// Deux mots ou expressions sont-ils les mêmes, au singulier/pluriel, aux accents et à la casse près ?
export const sameWord = (a, b) => stem(a) === stem(b)

// Échappement XML (pour le SVG des cartes)
export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const progressBar = (done, total) => '▰'.repeat(done) + '▱'.repeat(total - done)

// « 🍽️ Plats et aliments » → « Catégorie : Plats et aliments »
export const plainCategory = (cat) => 'Catégorie : ' + String(cat).replace(/[^\p{L}\p{N}\s'’-]/gu, '').trim()
