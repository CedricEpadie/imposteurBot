// Référence partagée vers le socket Baileys courant (remplacé à chaque reconnexion).
let sock = null

export const setSocket = (s) => {
  sock = s
}

export const getSocket = () => sock
