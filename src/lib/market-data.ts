// Acceso a los datos de mercado generados por scripts/fetch-market.ts (pueden no existir todavía).
import pullRates from '../data/pull-rates.json';
import {
  expectedValue, findPullRates, slugify, topHits,
  type ExpectedValue, type MarketCard, type MarketIndex, type MarketSet, type SealedItem, type SetPullRates,
} from './market';

const indexFiles = import.meta.glob<MarketIndex>('../data/market/index.json', { eager: true, import: 'default' });
const setFiles = import.meta.glob<MarketSet>('../data/market/sets/*.json', { eager: true, import: 'default' });

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

export function allSets(): SetSummary[] {
  const sets = Object.values(setFiles)
    .filter((s) => s.cards?.length)
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
  return sets.map((set) => {
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
}

export const RARITY_ES: Record<string, string> = {
  'common': 'Común', 'uncommon': 'Poco común', 'rare': 'Rara', 'double rare': 'Doble rara', 'ultra rare': 'Ultra rara',
  'illustration rare': 'Ilustración rara', 'special illustration rare': 'Ilustración especial rara',
  'hyper rare': 'Hiper rara', 'mega hyper rare': 'Mega hiper rara', 'ace spec rare': 'AS TÁCTICO rara',
  'shiny rare': 'Variocolor rara', 'shiny ultra rare': 'Variocolor ultra rara', 'black white rare': 'Rara blanca y negra',
};

export function rarityLabel(r: string | null, lang: 'es' | 'en') {
  if (!r) return '-';
  return lang === 'es' ? RARITY_ES[r.trim().toLowerCase()] ?? r : r;
}

const SHORT: Record<string, string> = {
  'common': 'C', 'uncommon': 'U', 'rare': 'R', 'double rare': 'DR', 'ultra rare': 'UR', 'illustration rare': 'IR',
  'special illustration rare': 'SIR', 'hyper rare': 'HR', 'mega hyper rare': 'MHR', 'ace spec rare': 'ACE',
  'shiny rare': 'SR', 'shiny ultra rare': 'SSR', 'black white rare': 'BWR',
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
  if (k.includes('hyper')) return 'hr';
  if (k.includes('illustration')) return 'ir';
  if (k.includes('ultra')) return 'ur';
  if (k.includes('double')) return 'dr';
  return 'base';
}
