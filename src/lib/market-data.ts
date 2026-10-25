// Acceso a los datos de mercado generados por scripts/fetch-market.ts (pueden no existir todavía).
import pullRates from '../data/pull-rates.json';
import pokemonNames from '../data/pokemon-names.json';
import {
  expectedValue, findPullRates, slugify, topHits,
  type ExpectedValue, type MarketCard, type MarketIndex, type MarketSet, type PriceHistory, type SealedItem, type SetPullRates,
} from './market';

const indexFiles = import.meta.glob<MarketIndex>('../data/market/index.json', { eager: true, import: 'default' });
const setFiles = import.meta.glob<MarketSet>('../data/market/sets/*.json', { eager: true, import: 'default' });
const historyFiles = import.meta.glob<PriceHistory>('../data/market/history/*.json', { eager: true, import: 'default' });

export function historyOf(setId: string): PriceHistory | null {
  return historyFiles[`../data/market/history/${setId}.json`] ?? null;
}

export const marketIndex: MarketIndex | null = Object.values(indexFiles)[0] ?? null;
export const RATES = pullRates.sets as SetPullRates[];

/** Sobres por producto, para el precio por sobre. Las ETB de las series SV y ME traen 9. */
export const PACKS: Record<SealedItem['kind'], number> = { pack: 1, box: 36, etb: 9, bundle: 6 };

export interface SetSummary {
  set: MarketSet;
  slug: string;
  pack: SealedItem | null;
  box: SealedItem | null;
  rates: SetPullRates | null;
  ev: ExpectedValue | null;
  hits: MarketCard[];
}

let setsCache: SetSummary[] | null = null;

/** Todas las expansiones con alguna carta con precio, de la más reciente a la más antigua. */
export function allSets(): SetSummary[] {
  if (setsCache) return setsCache;
  const sets = Object.values(setFiles)
    .filter((s) => s.cards?.some((c) => c.price.trend != null))
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || a.name.localeCompare(b.name));
  setsCache = sets.map((set) => {
    const rates = findPullRates(set.name, RATES);
    return {
      set,
      slug: slugify(set.name),
      pack: set.sealed.find((s) => s.kind === 'pack') ?? null,
      box: set.sealed.find((s) => s.kind === 'box') ?? null,
      rates,
      ev: rates ? expectedValue(set.cards, rates) : null,
      hits: topHits(set.cards, 12),
    };
  });
  return setsCache;
}

/** Nombre de cada serie en español (las de TCGdex vienen en inglés). */
const SERIES_ES: Record<string, string> = {
  'Mega Evolution': 'Megaevolución', 'Scarlet & Violet': 'Escarlata y Púrpura', 'Sword & Shield': 'Espada y Escudo',
  'Sun & Moon': 'Sol y Luna', 'Black & White': 'Negro y Blanco', 'Platinum': 'Platino', 'Diamond & Pearl': 'Diamante y Perla',
  "McDonald's Collection": "Colección McDonald's",
};

export function seriesName(serie: string, lang: 'es' | 'en') {
  return lang === 'es' ? SERIES_ES[serie] ?? serie : serie;
}

export interface SeriesGroup { name: string; slug: string; sets: SetSummary[] }

export const isJapanese = (s: SetSummary) => s.set.lang === 'ja';

/**
 * Expansiones agrupadas por serie, de la serie más nueva a la más antigua (las colecciones de McDonald's, al final).
 * Las japonesas van aparte: sus series llevan el prefijo "jp-" en el ancla.
 */
export function setsBySeries(region: 'intl' | 'ja' = 'intl'): SeriesGroup[] {
  const groups = new Map<string, SeriesGroup>();
  for (const s of allSets()) {
    if (isJapanese(s) !== (region === 'ja')) continue;
    const name = s.set.serie || 'Other';
    if (!groups.has(name)) groups.set(name, { name, slug: (region === 'ja' ? 'jp-' : '') + slugify(name), sets: [] });
    groups.get(name)!.sets.push(s);
  }
  const start = (g: SeriesGroup) => (g.name.startsWith('McDonald') ? '' : g.sets.at(-1)?.set.releaseDate ?? '');
  return [...groups.values()].sort((a, b) => start(b).localeCompare(start(a)));
}

export const RARITY_ES: Record<string, string> = {
  'triple rare': 'Triple rara', 'character rare': 'Rara de personaje', 'character super rare': 'Súper rara de personaje',
  'common': 'Común', 'uncommon': 'Poco común', 'rare': 'Rara', 'double rare': 'Doble rara', 'ultra rare': 'Ultra rara',
  'illustration rare': 'Ilustración rara', 'special illustration rare': 'Ilustración especial rara',
  'hyper rare': 'Hiper rara', 'mega hyper rare': 'Mega hiper rara', 'ace spec rare': 'AS TÁCTICO rara',
  'shiny rare': 'Variocolor rara', 'shiny ultra rare': 'Variocolor ultra rara', 'black white rare': 'Rara blanca y negra',
  'secret rare': 'Secreta rara', 'holo rare': 'Rara holo', 'rare holo': 'Rara holo', 'holo rare v': 'Rara holo V',
  'holo rare vmax': 'Rara holo VMAX', 'holo rare vstar': 'Rara holo ASTRO', 'rare holo lv.x': 'Rara holo NV.X',
  'rare prime': 'Rara PRIME', 'legend': 'LEYENDA', 'promo': 'Promo', 'amazing rare': 'Rara asombrosa',
  'radiant rare': 'Rara radiante', 'shiny rare v': 'Variocolor rara V', 'shiny rare vmax': 'Variocolor rara VMAX',
  'full art trainer': 'Entrenador arte completo', 'classic collection': 'Colección clásica', 'pikachu rare': 'Rara Pikachu',
  'futuristic rare': 'Rara futurista', 'none': '-',
};

export function rarityLabel(r: string | null, lang: 'es' | 'en') {
  if (!r) return '-';
  return lang === 'es' ? RARITY_ES[r.trim().toLowerCase()] ?? r : r;
}

const SHORT: Record<string, string> = {
  'triple rare': 'RRR', 'character rare': 'CHR', 'character super rare': 'CSR',
  'common': 'C', 'uncommon': 'U', 'rare': 'R', 'double rare': 'DR', 'ultra rare': 'UR', 'illustration rare': 'IR',
  'special illustration rare': 'SIR', 'hyper rare': 'HR', 'mega hyper rare': 'MHR', 'ace spec rare': 'ACE',
  'shiny rare': 'SR', 'shiny ultra rare': 'SSR', 'black white rare': 'BWR',
  'secret rare': 'SCR', 'holo rare': 'RH', 'rare holo': 'RH', 'holo rare v': 'V', 'holo rare vmax': 'VMAX',
  'holo rare vstar': 'VSTAR', 'rare holo lv.x': 'LV.X', 'rare prime': 'PRIME', 'legend': 'LEGEND', 'promo': 'PR',
  'amazing rare': 'AR', 'radiant rare': 'RR', 'shiny rare v': 'SV', 'shiny rare vmax': 'SV', 'full art trainer': 'FA',
  'classic collection': 'CC', 'pikachu rare': 'PR', 'futuristic rare': 'FR', 'none': '-',
};

/** Abreviatura de la rareza, como la usan los coleccionistas (SIR, IR, HR...). */
export function rarityShort(r: string | null) {
  return r ? SHORT[r.trim().toLowerCase()] ?? r : '-';
}

/** Clase de color por rareza para las etiquetas. */
export function rarityTone(r: string | null) {
  const k = (r ?? '').trim().toLowerCase();
  if (k.includes('mega hyper')) return 'mhr';
  if (k.includes('special illustration')) return 'sir';
  if (k.includes('hyper') || k === 'secret rare' || k === 'amazing rare') return 'hr';
  if (k.includes('illustration') || k.includes('character')) return 'ir';
  if (k.includes('ultra')) return 'ur';
  if (k.includes('double')) return 'dr';
  return 'base';
}


const NAMES = pokemonNames.names as Record<string, { en?: string; es?: string }>;

export interface PokemonEntry {
  dex: number;
  en: string;
  es: string;
  slug: string;
  /** Cartas de este Pokémon en todos los sets, de la más cara a la más barata. */
  cards: { card: MarketCard; summary: SetSummary }[];
  /** Suma de la tendencia de todas sus cartas: lo que costaría tener una de cada. */
  total: number;
}

let pokemonCache: PokemonEntry[] | null = null;

/** Pokémon con al menos una carta en los sets con precios, agrupados por número de Pokédex. */
export function allPokemon(): PokemonEntry[] {
  if (pokemonCache) return pokemonCache;
  const byDex = new Map<number, PokemonEntry>();
  for (const summary of allSets()) {
    for (const card of summary.set.cards) {
      for (const dex of card.dex ?? []) {
        const names = NAMES[String(dex)];
        if (!names?.en) continue;
        if (!byDex.has(dex)) byDex.set(dex, { dex, en: names.en, es: names.es ?? names.en, slug: slugify(names.en.replace('♀', ' f').replace('♂', ' m')), cards: [], total: 0 });
        byDex.get(dex)!.cards.push({ card, summary });
      }
    }
  }
  pokemonCache = [...byDex.values()].map((p) => {
    p.cards.sort((a, b) => (b.card.price.trend ?? -1) - (a.card.price.trend ?? -1));
    p.total = Math.round(p.cards.reduce((sum, x) => sum + (x.card.price.trend ?? 0), 0) * 100) / 100;
    return p;
  });
  pokemonCache.sort((a, b) => (b.cards[0]?.card.price.trend ?? 0) - (a.cards[0]?.card.price.trend ?? 0));
  return pokemonCache;
}

export const pokemonName = (p: PokemonEntry, lang: 'es' | 'en') => (lang === 'es' ? p.es : p.en);
