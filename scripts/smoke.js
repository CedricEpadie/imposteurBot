// Test de fumée du rendu RÉEL (sharp + polices) : à lancer dans l’image Docker ou sur le serveur.
//   node scripts/smoke.js
// Génère une carte de rôle, un tableau et un profil avec des pseudos exotiques, et vérifie que ce sont de vrais JPEG.
// (Les tests unitaires utilisent un faux « sharp » : ce script est le seul qui vérifie le vrai rendu.)
const { config } = await import('../src/config.js')
const { canRender, svgToJpeg } = await import('../src/render/svg.js')
const { cardSvg } = await import('../src/render/card.js')
const { profileSvg } = await import('../src/render/profile.js')
const { rankingSvg } = await import('../src/render/ranking.js')

if (!canRender()) {
  console.error('❌ sharp indisponible : les images ne pourront pas être générées.')
  process.exit(1)
}
const names = ['𝔻𝔼ℕ𝔼𝕄 𝕊𝕋𝕐𝕃𝔼', '小明 ♥', 'مرحبا', 'ᏃᎾᎢ ༺ཌ', '🔥😎 Roi']
const stats = { games: 9, wins: 5, points: 17, asImposter: 3, impWins: 1, civGames: 6, civWins: 4, streak: 2, bestStreak: 3, rank: 1, players: 5, form: [{ won: true, role: 'civil' }, { won: false, role: 'imposteur' }], name: names[0] }
const rows = names.map((name, i) => ({ num: `1${i}`, name, points: 9 - i, wins: 3, games: 5 }))
const jobs = {
  carte: cardSvg({ title: 'TU ES CIVIL', color: '#3ddc97', category: 'Catégorie : Foot', big: 'Real Madrid', lines: ['Donne un indice en un mot.'] }),
  profil: profileSvg(stats, names[1]),
  classement: rankingSvg(rows),
}
let bad = 0
for (const [name, svg] of Object.entries(jobs)) {
  const jpeg = await svgToJpeg(svg)
  const ok = jpeg.length > 5000 && jpeg[0] === 0xff && jpeg[1] === 0xd8
  console.log(`${ok ? '✅' : '❌'} ${name} : ${Math.round(jpeg.length / 1024)} Ko`)
  if (!ok) bad++
}
console.log(`Polices : ${process.env.FONTCONFIG_FILE ? 'configuration privée active' : 'configuration du système'} • DATA_DIR=${config.data.dir}`)
process.exit(bad ? 1 : 0)
