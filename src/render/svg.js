// Rendu SVG → JPEG (sharp). Partagé par les cartes de rôle et le tableau des indices.
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

export const FONT = 'DejaVu Sans, Arial, Helvetica, sans-serif'
