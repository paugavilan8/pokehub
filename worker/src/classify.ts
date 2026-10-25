// Clasifica productos de tiendas: ¿es producto sellado de Pokémon? ¿de qué tipo y en qué idioma?

export type ProductKind = 'pack' | 'box' | 'etb' | 'bundle' | 'blister' | 'tin' | 'collection';
export type ProductLang = 'es' | 'en' | 'ja' | 'ko' | 'zh' | null;

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Otros juegos. Se descartan salvo que la tienda etiquete el producto como Pokémon. */
const OTHER_GAMES = [
  'one piece', 'magic', 'lorcana', 'topps', 'panini', 'yu-gi-oh', 'yugioh', 'dragon ball', 'weiss', 'naruto',
  'harry potter', 'detective conan', 'haikyu', 'build divide', 'digimon', 'union arena', 'star wars', 'riftbound',
  'gundam', 'nfl', 'nba', 'wwe', 'futbol', 'my little pony', 'palworld', 'shadowverse', 'vanguard',
  'flesh and blood', 'altered', 'sorcery', 'grand archive', 'battle spirits', 'duel masters', 'hololive',
  'goddess story', 'kayou', 'ultraman', 'blue lock', 'jujutsu', 'demon slayer', 'kimetsu', 'final fantasy', 'mtg',
  'disney', 'marvel', 'dc comics', 'metazoo', 'wixoss', 'hunter x hunter', 'bleach', 'chainsaw', 'spy x family',
  'zenless', 'genshin', 'honkai', 'fusion world', 'cardfight', 'force of will',
];

/** Lo que nunca es producto sellado: accesorios, cartas sueltas, gradeadas, usados, lotes y cajas misteriosas. */
const NOT_SEALED = [
  'otros tcg', 'segunda mano', 'pedido', 'protector', 'funda', 'bolsa', 'bandolera', 'peluche', 'figura ', 'tapete',
  'carpeta', 'album', 'deck box', 'porta deck', 'psa ', 'psa 10', 'cgc', 'bgs', 'gradead', 'cartas raw', 'torneo',
  'sin plastico', 'combo', 'mystery', 'misteriosa', 'case ', 'lote',
];

/** Si las etiquetas o el tipo de producto dicen que es de Pokémon, se confía en ellas. */
const POKEMON = /pokemon/;

const KINDS: [ProductKind, RegExp][] = [
  ['etb', /\betb\b|elite trainer|entrenador de elite/],
  ['bundle', /\bbundle\b/],
  ['blister', /\bblister\b/],
  ['tin', /\blata\b|\btin\b/],
  ['box', /booster box|\bdisplay\b|caja de \d+ sobres|caja \d+ sobres|caja de sobres/],
  ['pack', /^sobres?\b|\bbooster pack\b|^sobre /],
  ['collection', /coleccion|collection|\bupc\b|\bspc\b|build (&|and) battle|premium|\bcaja\b|\bbox\b|\bkit\b/],
];

export function classify(title: string, extra: string[] = []): ProductKind | null {
  const all = norm([title, ...extra].join(' '));
  if (NOT_SEALED.some((w) => all.includes(w))) return null;
  const tagged = POKEMON.test(norm(extra.join(' ')));
  if (!tagged && OTHER_GAMES.some((w) => all.includes(w))) return null;
  // Cartas sueltas: "Charizard EX 100/106", "#234".
  if (/\b\d{1,3}\/\d{1,3}\b|#\d{2,3}\b/.test(norm(title))) return null;
  const t = norm(title);
  for (const [kind, re] of KINDS) if (re.test(t)) return kind;
  return null;
}

export function detectLang(title: string, extra: string[] = []): ProductLang {
  const all = norm([title, ...extra].join(' '));
  if (/espanol|castellano/.test(all)) return 'es';
  if (/ingles|english/.test(all)) return 'en';
  if (/japones|japanese/.test(all)) return 'ja';
  if (/coreano|korean/.test(all)) return 'ko';
  if (/chino|chinese/.test(all)) return 'zh';
  return null;
}
