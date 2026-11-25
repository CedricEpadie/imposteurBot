import { config } from '../config.js'

// Admin du bot : le compte du bot lui-même, ou un numéro listé dans ADMIN_NUMBERS (.env)
export const isAdmin = (me) => !!me.fromMe || config.admins.some((n) => me.ids.has(n))
