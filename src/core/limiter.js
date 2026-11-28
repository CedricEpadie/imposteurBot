// File d'attente avec concurrence limitée : au plus `n` tâches en même temps, les autres patientent dans l'ordre.
// Sert à limiter les rendus d'images simultanés (chaque rendu consomme de la mémoire).
export const makeLimiter = (n) => {
  let active = 0
  const queue = []
  const idleWaiters = []
  const stats = { done: 0, maxWaiting: 0, maxActive: 0 }

  const settle = () => {
    if (active === 0 && queue.length === 0) while (idleWaiters.length) idleWaiters.shift()()
  }
  const pump = () => {
    while (active < n && queue.length) {
      const { fn, resolve, reject } = queue.shift()
      active++
      stats.maxActive = Math.max(stats.maxActive, active)
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          active--
          stats.done++
          pump()
          settle()
        })
    }
  }
  return {
    run: (fn) =>
      new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject })
        stats.maxWaiting = Math.max(stats.maxWaiting, queue.length)
        pump()
      }),
    idle: () => (active === 0 && queue.length === 0 ? Promise.resolve() : new Promise((r) => idleWaiters.push(r))),
    stats: () => ({ ...stats, active, waiting: queue.length }),
  }
}
