// /imposteur test : t’envoie 3 messages de test pour choisir ROLE_DELIVERY
import { say } from '../whatsapp/messenger.js'
import { num } from '../core/utils.js'
import { onCooldown } from '../core/cooldown.js'
import { runTest } from '../roles/selfTest.js'

export default {
  name: 'test',
  shortcut: true,
  groupOnly: false, // utilisable aussi en privé avec le bot
  async run({ chat, me }) {
    if (onCooldown(`test:${num(me.jid)}`, 30)) return say(chat, '⏳ Un test toutes les 30 secondes, patience.')
    await say(chat, '🧪 J’envoie 3 messages de test en privé (A, B, C)… patiente une dizaine de secondes.')
    const results = await runTest(me)
    return say(
      chat,
      `🧪 *Résultat du test*\n${results.join('\n')}\n\n` +
        `✅ = accepté par WhatsApp côté bot. Regarde dans ta discussion privée avec le bot *lesquels sont réellement arrivés*, ` +
        `puis choisis le mode correspondant dans .env (ROLE_DELIVERY).`
    )
  },
}
