// Rendu SVG → JPEG (sharp), et envoi d’une image avec repli texte.
// Les SVG eux-mêmes sont construits avec la charte (theme.js + kit.js).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { say, sayImage } from '../whatsapp/messenger.js'
import { config } from '../config.js'
import { makeLimiter } from '../core/limiter.js'

// Polices embarquées (dossier fonts/) : DejaVu Sans + GNU Unifont en secours, pour que n’importe quel pseudo
// (alphabets rares, symboles, emojis…) s’affiche, quelles que soient les polices installées sur le serveur.
// On crée une configuration fontconfig privée qui ajoute ce dossier aux polices du système.
const FONT_DIR = fileURLToPath(new URL('../../fonts/', import.meta.url))
const setupFonts = () => {
  if (process.env.FONTCONFIG_FILE || !fs.existsSync(FONT_DIR)) return
  try {
    const conf = path.join(os.tmpdir(), 'imposteur-fonts.conf')
    fs.writeFileSync(
      conf,
      `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n` +
        `  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>\n` +
        `  <dir>${FONT_DIR}</dir>\n` +
        `  <cachedir>${path.join(os.tmpdir(), 'imposteur-fontcache')}</cachedir>\n</fontconfig>\n`
    )
    process.env.FONTCONFIG_FILE = conf
  } catch (e) {
    console.warn('[imposteur] polices embarquées non activées :', e.message)
  }
}
setupFonts() // avant le chargement de sharp

let sharp = null
try {
  sharp = (await import('sharp')).default
} catch (e) {
  console.warn('[imposteur] sharp indisponible :', e.message)
}

export const canRender = () => !!sharp

// Au plus `render.concurrency` rendus en même temps : plusieurs groupes qui jouent ensemble ne font pas exploser la mémoire
const renders = makeLimiter(config.render.concurrency)
export const renderStats = renders.stats
export const renderIdle = renders.idle
if (sharp && typeof sharp.cache === 'function') sharp.cache({ memory: 32, files: 0, items: 20 })

export const svgToJpeg = (svg) => {
  if (!sharp) throw new Error('le module « sharp » n’est pas installé')
  return renders.run(() => sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer())
}

// Envoie une image avec légende. Si l’image est impossible (sharp absent, erreur de rendu, envoi refusé),
// envoie `fallback` (le contenu complet en texte) à la place. Retourne { image } : true si l’image est partie. `svg` est un SVG ou une fonction qui le construit.
export const sayVisual = async (chat, { svg, caption, fallback, mentions = [], fallbackMentions = mentions }) => {
  if (canRender()) {
    try {
      const image = await svgToJpeg(typeof svg === 'function' ? svg() : svg)
      const sent = await sayImage(chat, image, caption, mentions)
      if (sent) return { image: true }
    } catch (e) {
      console.warn('[imposteur] image impossible, repli en texte :', e.message)
    }
  }
  await say(chat, fallback ?? caption, fallbackMentions)
  return { image: false }
}
