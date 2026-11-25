// Charte graphique de L’IMPOSTEUR : une seule palette, une seule police, un seul gabarit
// pour toutes les images du bot (cartes de rôle, tableau des indices, dépouillement, bilan, état, règles).
//
// Pour changer l’apparence de tout le jeu, modifie ce fichier.

// DejaVu Sans d’abord ; les caractères qu’elle n’a pas sont pris dans Unifont (embarquée, couvre presque tout Unicode)
export const FONT = 'DejaVu Sans, Unifont, Unifont Upper, Arial, sans-serif'

export const C = {
  bg: '#12161f', // fond des cartes
  panel: '#1b2230', // blocs et lignes
  panel2: '#222b3b', // lignes alternées
  line: '#323f55', // filets
  text: '#f4f6fa', // texte principal
  muted: '#9aa7b8', // texte secondaire
  dim: '#5f6b7d', // texte discret (éliminé, signature)

  gold: '#f0b429', // identité du jeu : titres, tableau, points
  red: '#ff5d6c', // imposteur, danger, élimination
  green: '#3ddc97', // civil, victoire des civils, validé
  blue: '#4da3ff', // information, état
}

export const W = 900 // largeur de toutes les images
export const FOOTER_H = 56 // bandeau de signature réservé en bas de chaque image
export const PAD = 40 // marge intérieure
