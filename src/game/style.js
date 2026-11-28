// Style de jeu d'un joueur : surnom, traits et explication, calculés à partir de ses statistiques (storage/scores.js, playerStats).
//
// Principe : chaque style repose sur UNE mesure (ex. messages par partie) et deux seuils :
//   • score absolu  : 0 en dessous du seuil de départ, 1 au seuil « plein » ;
//   • score relatif : où se situe le joueur parmi les autres joueurs du groupe (percentile), quand le groupe compte assez de joueurs.
// Un style n'existe que si le joueur a assez de matière (échantillon minimum) ET franchit le seuil absolu. Le score final mélange absolu et relatif,
// et un style « banal pour ce groupe » (tout le monde parle autant) est atténué : le surnom reste cohérent avec le groupe.
// Le surnom = le style au score le plus haut ; les traits = les trois meilleurs styles (compatibles par construction : un style « haut » et son contraire « bas » ne passent jamais ensemble).
export const MIN_GAMES = 5
const MIN_PEERS = 4 // en dessous, pas de comparaison avec le groupe

const n = (s, k) => s?.[k] || 0
// Dénominateur « mesuré » : t1 = parties suivies depuis la v1.10, t2 = depuis la v1.11 (sans ces champs, ex. dans les tests : valeurs globales)
const d1 = (s, k) => (s?.t1 ? s.t1[k] || 0 : n(s, k))
const d2 = (s, k) => (s?.t2 ? s.t2[k] || 0 : n(s, k))
const rate = (a, b) => (b > 0 ? a / b : null)
const pct = (v) => `${Math.round(v * 100)} %`
const dec = (v, d = 1) => v.toFixed(d).replace('.', ',')

// Mesures : of(s) = valeur (null si non mesurable), n(s) = taille de l'échantillon, min = échantillon minimum
export const METRICS = {
  talk: { of: (s) => rate(n(s, 'talk'), d1(s, 'games')), n: (s) => d1(s, 'games'), min: MIN_GAMES, label: 'messages par partie', fmt: (v) => dec(v) },
  acc: { of: (s) => rate(n(s, 'rightVotes'), n(s, 'rightVotes') + n(s, 'wrongVotes')), n: (s) => n(s, 'rightVotes') + n(s, 'wrongVotes'), min: 5, label: 'votes justes', fmt: pct },
  wrongShare: { of: (s) => rate(n(s, 'wrongVotes'), n(s, 'rightVotes') + n(s, 'wrongVotes')), n: (s) => n(s, 'rightVotes') + n(s, 'wrongVotes'), min: 5, label: 'accusations à tort', fmt: pct },
  received: { of: (s) => rate(n(s, 'received'), d1(s, 'games')), n: (s) => d1(s, 'games'), min: MIN_GAMES, label: 'votes reçus par partie', fmt: (v) => dec(v) },
  abstain: { of: (s) => rate(n(s, 'abstain'), n(s, 'votes') + n(s, 'abstain')), n: (s) => n(s, 'votes') + n(s, 'abstain'), min: 5, label: 'votes non rendus', fmt: pct },
  slow: { of: (s) => rate(n(s, 'missed'), n(s, 'clues') + n(s, 'missed')), n: (s) => n(s, 'clues') + n(s, 'missed'), min: 10, label: 'indices manqués', fmt: pct },
  fast: { of: (s) => rate(n(s, 'fast'), d2(s, 'clues')), n: (s) => d2(s, 'clues'), min: 10, label: 'indices en moins de 10 s', fmt: pct },
  clen: { of: (s) => rate(n(s, 'clen'), d2(s, 'clues')), n: (s) => d2(s, 'clues'), min: 10, label: 'lettres par indice', fmt: (v) => dec(v) },
  herd: { of: (s) => rate(n(s, 'herd'), d2(s, 'votes')), n: (s) => d2(s, 'votes'), min: 8, label: 'votes comme la majorité', fmt: pct },
  fell: { of: (s) => rate(n(s, 'fell'), d2(s, 'civGames')), n: (s) => d2(s, 'civGames'), min: 5, label: 'civil éliminé à tort', fmt: pct },
  impWin: { of: (s) => rate(n(s, 'impWins'), n(s, 'asImposter')), n: (s) => n(s, 'asImposter'), min: 3, label: 'victoires en imposteur', fmt: pct },
  caught: { of: (s) => rate(n(s, 'caught'), d2(s, 'asImposter')), n: (s) => d2(s, 'asImposter'), min: 4, label: 'démasqué en imposteur', fmt: pct },
  steal: { of: (s) => rate(n(s, 'stolen'), d1(s, 'asImposter')), n: (s) => d1(s, 'asImposter'), min: 3, label: 'mots devinés en imposteur', fmt: pct },
  win: { of: (s) => rate(n(s, 'wins'), n(s, 'games')), n: (s) => n(s, 'games'), min: 10, label: 'victoires', fmt: pct },
  civWin: { of: (s) => rate(n(s, 'civWins'), n(s, 'civGames')), n: (s) => n(s, 'civGames'), min: 3, label: 'victoires en civil', fmt: pct },
  night: { of: (s) => rate(n(s, 'night'), n(s, 'games')), n: (s) => n(s, 'games'), min: MIN_GAMES, label: 'parties entre 22 h et 5 h', fmt: pct },
  early: { of: (s) => rate(n(s, 'early'), n(s, 'games')), n: (s) => n(s, 'games'), min: MIN_GAMES, label: 'parties entre 5 h et 9 h', fmt: pct },
  ejected: { of: (s) => rate(n(s, 'ejected'), d2(s, 'games')), n: (s) => d2(s, 'games'), min: MIN_GAMES, label: 'parties quittées en silence', fmt: pct },
  games: { of: (s) => n(s, 'games'), n: (s) => n(s, 'games'), min: 0, label: 'parties jouées', fmt: (v) => String(Math.round(v)) },
}

// Styles. dir 'hi' : plus la mesure est haute, plus le style est marqué ; 'lo' : l'inverse. from = seuil de départ, to = seuil plein.
// weight : un style rare ou très parlant l'emporte sur un style courant à score égal.
export const STYLES = [
  { id: 'voleur', nick: 'Le Voleur de mots', trait: 'voleur de mots', metric: 'steal', dir: 'hi', from: 0.1, to: 0.45, weight: 1.3, extra: (s) => n(s, 'stolen') >= 2 },
  { id: 'cameleon', nick: 'Le Caméléon', trait: 'caméléon', metric: 'impWin', dir: 'hi', from: 0.4, to: 0.75, weight: 1.15 },
  { id: 'anguille', nick: 'L’Anguille', trait: 'insaisissable', metric: 'caught', dir: 'lo', from: 0.5, to: 0.1, weight: 0.95 },
  { id: 'maladroit', nick: 'L’Imposteur de poche', trait: 'imposteur maladroit', metric: 'impWin', dir: 'lo', from: 0.25, to: 0, weight: 1.0 },
  { id: 'limier', nick: 'Le Fin Limier', trait: 'perspicace', metric: 'acc', dir: 'hi', from: 0.5, to: 0.85, weight: 1.1 },
  { id: 'accusateur', nick: 'L’Accusateur', trait: 'accusateur', metric: 'wrongShare', dir: 'hi', from: 0.5, to: 0.9, weight: 1.0 },
  { id: 'suspect', nick: 'Le Suspect n°1', trait: 'toujours suspecté', metric: 'received', dir: 'hi', from: 1.0, to: 2.2, weight: 1.05 },
  { id: 'insoupconnable', nick: 'L’Insoupçonnable', trait: 'insoupçonnable', metric: 'received', dir: 'lo', from: 0.5, to: 0.1, weight: 0.9, minGames: 8 },
  { id: 'martyr', nick: 'Le Martyr', trait: 'victime des soupçons', metric: 'fell', dir: 'hi', from: 0.2, to: 0.5, weight: 1.0 },
  { id: 'bavard', nick: 'Le Bavard', trait: 'bavard', metric: 'talk', dir: 'hi', from: 5, to: 12, weight: 1.0 },
  { id: 'silencieux', nick: 'Le Silencieux', trait: 'silencieux', metric: 'talk', dir: 'lo', from: 3, to: 0.5, weight: 1.0 },
  { id: 'pacifiste', nick: 'Le Pacifiste', trait: 'pacifiste', metric: 'abstain', dir: 'hi', from: 0.15, to: 0.5, weight: 1.0 },
  { id: 'tortue', nick: 'La Tortue', trait: 'lent à répondre', metric: 'slow', dir: 'hi', from: 0.12, to: 0.4, weight: 1.0 },
  { id: 'eclair', nick: 'L’Éclair', trait: 'rapide', metric: 'fast', dir: 'hi', from: 0.4, to: 0.85, weight: 1.0 },
  { id: 'poete', nick: 'Le Poète', trait: 'mots recherchés', metric: 'clen', dir: 'hi', from: 7.5, to: 10, weight: 1.0 },
  { id: 'telegraphiste', nick: 'Le Télégraphiste', trait: 'mots courts', metric: 'clen', dir: 'lo', from: 5, to: 3.5, weight: 1.0 },
  { id: 'mouton', nick: 'Le Mouton', trait: 'suit la foule', metric: 'herd', dir: 'hi', from: 0.65, to: 0.92, weight: 0.95 },
  { id: 'franc', nick: 'Le Franc-tireur', trait: 'esprit libre', metric: 'herd', dir: 'lo', from: 0.3, to: 0.1, weight: 1.0 },
  { id: 'noctambule', nick: 'Le Noctambule', trait: 'noctambule', metric: 'night', dir: 'hi', from: 0.5, to: 0.9, weight: 1.0 },
  { id: 'leve-tot', nick: 'Le Lève-tôt', trait: 'matinal', metric: 'early', dir: 'hi', from: 0.4, to: 0.8, weight: 1.0 },
  { id: 'stratege', nick: 'Le Stratège', trait: 'stratège', metric: 'win', dir: 'hi', from: 0.5, to: 0.7, weight: 1.1 },
  { id: 'deserteur', nick: 'Le Déserteur', trait: 'souvent absent du jeu', metric: 'ejected', dir: 'hi', from: 0.05, to: 0.25, weight: 1.2 },
  { id: 'pilier', nick: 'Le Pilier', trait: 'pilier du groupe', metric: 'games', dir: 'hi', from: 30, to: 100, weight: 0.8 },
  // Style composé : à l'aise dans les deux rôles
  {
    id: 'equilibriste',
    nick: 'L’Équilibriste',
    trait: 'polyvalent',
    metric: 'impWin',
    custom: (s) => {
      const a = METRICS.impWin.of(s)
      const b = METRICS.civWin.of(s)
      if (a === null || b === null || METRICS.impWin.n(s) < 3 || METRICS.civWin.n(s) < 3 || a < 0.4 || b < 0.5) return 0
      return Math.min(1, Math.min((a - 0.4) / 0.3, (b - 0.5) / 0.3) + 0.2)
    },
    weight: 1.1,
    why: (s) => `${pct(METRICS.impWin.of(s))} de victoires en imposteur et ${pct(METRICS.civWin.of(s))} en civil`,
  },
]

const clamp01 = (x) => Math.max(0, Math.min(1, x))
const ramp = (v, from, to) => clamp01((v - from) / (to - from)) // marche dans les deux sens (from > to : style « bas »)

// Valeurs d'une mesure chez les autres joueurs du groupe (ceux qui ont assez de parties et d'échantillon)
const peerValues = (s, metric) => {
  const m = METRICS[metric]
  return (s.peers || []).filter((p) => n(p, 'games') >= MIN_GAMES && m.n(p) >= m.min && m.of(p) !== null).map((p) => m.of(p))
}
const median = (a) => {
  const x = [...a].sort((p, q) => p - q)
  return x.length ? (x.length % 2 ? x[(x.length - 1) / 2] : (x[x.length / 2 - 1] + x[x.length / 2]) / 2) : null
}

// Évalue un style pour le joueur : { score (0..1, 0 = absent), value, median }
const evaluate = (style, s) => {
  if (style.custom) {
    const sc = style.custom(s)
    return { score: sc, value: null, median: null }
  }
  const m = METRICS[style.metric]
  if (n(s, 'games') < (style.minGames || MIN_GAMES) || m.n(s) < m.min) return { score: 0 }
  if (style.extra && !style.extra(s)) return { score: 0 }
  const v = m.of(s)
  if (v === null) return { score: 0 }
  const abs = ramp(v, style.from, style.to)
  if (abs <= 0) return { score: 0 }
  const peers = peerValues(s, style.metric)
  if (peers.length < MIN_PEERS) return { score: abs, value: v, median: null }
  const below = peers.filter((x) => (style.dir === 'hi' ? x < v : x > v)).length + 0.5 * peers.filter((x) => x === v).length
  const rel = below / peers.length // 1 = le plus marqué du groupe
  let score = 0.6 * abs + 0.4 * rel
  if (rel < 0.4) score *= 0.6 // banal pour ce groupe : le style est atténué
  return { score: clamp01(score), value: v, median: median(peers) }
}

const whyOf = (style, s, ev) => {
  if (style.why) return style.why(s)
  const m = METRICS[style.metric]
  const base = `${m.label} : ${m.fmt(ev.value)}`
  return ev.median !== null && ev.median !== undefined ? `${base} (groupe : ${m.fmt(ev.median)})` : base
}

// Style complet d'un joueur : { nickname, why, traits: [{ id, label, why, score }], confidence (0..1), novice }
export const styleOf = (s) => {
  if (!s || n(s, 'games') < MIN_GAMES) return { nickname: 'Le Novice', why: s ? `encore ${MIN_GAMES - n(s, 'games')} partie(s) pour dévoiler ton style` : '', traits: [], confidence: 0, novice: true }
  const found = STYLES.map((st) => ({ st, ev: evaluate(st, s) }))
    .filter((x) => x.ev.score > 0.12)
    .map((x) => ({ ...x, rank: x.ev.score * x.st.weight }))
    .sort((a, b) => b.rank - a.rank)
  const confidence = clamp01(n(s, 'games') / 25)
  if (!found.length) return { nickname: 'Le Mystérieux', why: 'aucun style ne se dégage encore', traits: [], confidence, novice: false }
  const traits = found.slice(0, 3).map((x) => ({ id: x.st.id, label: x.st.trait, why: whyOf(x.st, s, x.ev), score: Math.round(x.ev.score * 100) / 100 }))
  return { nickname: found[0].st.nick, why: traits[0].why, traits, confidence, novice: false }
}

export const nicknameOf = (s) => styleOf(s).nickname
