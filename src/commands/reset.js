// /imposteur reset [tout] [confirmer] : efface les scores enregistrés (admin). Jamais les mots.
import { config } from '../config.js'
import { count } from '../game/wording.js'
import { say } from '../whatsapp/messenger.js'
import { num } from '../core/utils.js'
import { isAdmin } from '../core/admin.js'
import { resetScores } from '../storage/scores.js'

const P = config.prefix
const CONFIRM_MS = 60_000
const pending = new Map() // admin + portée → heure de la demande

export default {
  name: 'reset',
  aliases: ['effacer'],
  async run({ chat, me, rest }) {
    if (!isAdmin(me)) return say(chat, '🔒 Commande réservée aux admins du bot (variable ADMIN_NUMBERS du fichier .env).')
    const all = rest.includes('tout')
    const id = `${num(me.jid)}:${all ? 'all' : chat}`
    const scope = all ? 'les scores de *TOUS les groupes*' : 'les scores de *ce groupe*'

    if (!rest.includes('confirmer') || Date.now() - (pending.get(id) || 0) > CONFIRM_MS) {
      pending.set(id, Date.now())
      return say(chat, `⚠️ Tu vas effacer ${scope} (classements et stats). Les mots ne sont pas touchés.\nPour confirmer dans la minute : *${P}imposteur reset ${all ? 'tout ' : ''}confirmer*`)
    }
    pending.delete(id)
    const n = resetScores(all ? null : chat)
    return say(chat, `🗑️ Scores effacés (${count(n, 'résultat supprimé', 'résultats supprimés')}).`)
  },
}
