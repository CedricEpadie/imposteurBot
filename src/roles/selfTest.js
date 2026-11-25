// Diagnostic « /imposteur test » : envoie 3 variantes (sans effacement ni suppression)
// pour voir ce que WhatsApp accepte sur ce compte.
import { getSocket } from '../whatsapp/socket.js'
import { sleep } from '../core/utils.js'
import { renderCard } from '../render/card.js'

const testSpec = (label) => ({
  title: `TEST ${label}`,
  color: '#4da3ff',
  category: 'Catégorie : Test',
  big: 'Ça marche !',
  lines: ['Si tu lis ce texte,', 'ce mode fonctionne.'],
})

// Retourne une ligne de résultat par variante
export const runTest = async (me) => {
  const sock = getSocket()
  const targets = [...new Set([me.dm, me.jid])]
  const variants = [
    ['A · image à vue unique (ROLE_DELIVERY=image)', async () => ({ image: await renderCard(testSpec('A · VUE UNIQUE')), mimetype: 'image/jpeg', viewOnce: true })],
    ['B · photo normale (ROLE_DELIVERY=photo)', async () => ({ image: await renderCard(testSpec('B · PHOTO')), mimetype: 'image/jpeg' })],
    ['C · texte (ROLE_DELIVERY=text)', async () => ({ text: '🧪 TEST C · texte : si tu lis ceci, le mode texte fonctionne.' })],
  ]
  const out = []
  for (const [label, build] of variants) {
    let ok = false
    let err = 'erreur inconnue'
    try {
      const content = await build()
      for (const jid of targets) {
        try {
          await sock.sendMessage(jid, content)
          ok = true
          break
        } catch (e) {
          err = e?.message || String(e)
        }
      }
    } catch (e) {
      err = `génération impossible (${e.message})`
    }
    out.push(`${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${err}`}`)
    await sleep(2000)
  }
  return out
}
