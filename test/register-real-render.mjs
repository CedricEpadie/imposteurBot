// Comme register.mjs, mais SANS faux « sharp » : le vrai rendu d'images est utilisé (test de charge).
import { register } from 'node:module'
register('./hooks-real.mjs', import.meta.url)
