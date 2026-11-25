// Branche les faux modules (Baileys, sharp…) pour les tests : aucun réseau, aucune dépendance native.
import { register } from 'node:module'
register('./hooks.mjs', import.meta.url)
