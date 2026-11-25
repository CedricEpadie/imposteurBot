// Rendu SVG → JPEG (sharp), et envoi d’une image avec repli texte.
// Les SVG eux-mêmes sont construits avec la charte (theme.js + kit.js).
import { say, sayImage } from '../whatsapp/messenger.js'

let sharp = null
try {
  sharp = (await import('sharp')).default
} catch (e) {
  console.warn('[imposteur] sharp indisponible :', e.message)
}

export const canRender = () => !!sharp

export const svgToJpeg = (svg) => {
  if (!sharp) throw new Error('le module « sharp » n’est pas installé')
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer()
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
