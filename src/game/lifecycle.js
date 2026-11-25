// Cycle de vie d’une partie : minuteries de phase (avec rappels) et fin de partie.
import { isActive, removeGame } from './store.js'
import { persistGame, forgetGame } from './persistence.js'

export const stopTimers = (g) => {
  clearTimeout(g.timer)
  for (const t of g.ticks || []) clearTimeout(t)
  g.ticks = []
  g.deadline = 0
}

// Lance la fin de phase dans `seconds` s ; `marks` = secondes restantes auxquelles `tick(m)` est appelé.
// Les rappels sont ignorés si la partie a été annulée ou a changé de phase entre-temps.
export const phaseTimer = (g, seconds, onEnd, { marks = [], tick } = {}) => {
  stopTimers(g)
  const phase = g.phase
  g.deadline = Date.now() + seconds * 1000
  persistGame(g) // point de sauvegarde : une partie interrompue reprend à cette phase
  for (const m of marks) {
    if (m >= seconds || !tick) continue
    g.ticks.push(
      setTimeout(() => {
        if (!isActive(g) || g.phase !== phase) return
        Promise.resolve().then(() => tick(m)).catch((e) => console.error('[imposteur]', e))
      }, (seconds - m) * 1000)
    )
  }
  g.timer = setTimeout(() => {
    Promise.resolve().then(onEnd).catch((e) => console.error('[imposteur]', e))
  }, seconds * 1000)
}

// Arrête les minuteries et retire la partie du registre
export const endGame = (g) => {
  stopTimers(g)
  removeGame(g.key)
  forgetGame(g.key)
}
