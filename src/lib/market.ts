// Lógica de mercado: precios de Cardmarket por carta, producto sellado por expansión y valor esperado.
// Sin dependencias ni acceso a red: lo usan el script de descarga y las páginas.

/** Fila de price_guide_6.json de Cardmarket (campos que usamos). */
export interface CmGuide {
  idProduct: number;
  avg?: number | null;
  low?: number | null;
  trend?: number | null;
  avg1?: number | null;
  avg7?: number | null;
  avg30?: number | null;
  'low-holo'?: number | null;
  'avg1-holo'?: number | null;
  'avg7-holo'?: number | null;
  'trend-holo'?: number | null;
  'avg30-holo'?: number | null;
}

/** Fila de products_singles_6.json / products_nonsingles_6.json. */
export interface CmProduct {
  idProduct: number;
  name: string;
  idCategory?: number;
  categoryName?: string;
  idExpansion?: number;
  dateAdded?: string;
}

export interface Price {
  /** Tendencia de Cardmarket (EUR). */
  trend: number | null;
  /** Precio más bajo publicado (EUR). */
  low: number | null;
  /** Media de 30 días (EUR). */
  avg30: number | null;
  /** Media de 7 días (EUR). */
  avg7?: number | null;
  /** Media del último día (EUR). */
  avg1?: number | null;
}

export interface MarketCard {
  id: string;
  num: string;
  name: string;
  rarity: string | null;
  /** URL base de la imagen en TCGdex (sin extensión). */
  image: string | null;
  cmId: number | null;
  price: Price;
}

export type SealedKind = 'pack' | 'box' | 'etb' | 'bundle';

export interface SealedItem {
  kind: SealedKind;
  idProduct: number;
  name: string;
  price: Price;
}

export interface MarketSet {
  id: string;
  name: string;
  serie: string;
  releaseDate: string | null;
  logo: string | null;
  symbol: string | null;
  officialCount: number | null;
  totalCount: number;
  cmExpansion: number | null;
  sealed: SealedItem[];
  cards: MarketCard[];
}

export interface MarketIndex {
  /** Fecha de la guía de precios de Cardmarket usada (ISO). */
  pricesDate: string | null;
  generatedAt: string;
  sets: Omit<MarketSet, 'cards'>[];
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null);

/**
 * Precio de una carta a partir de la fila de Cardmarket. Cardmarket mezcla en el mismo producto la versión normal
 * y la "holo" (reverse); si la normal no tiene precio, se usa la holo.
 */
export function priceFromGuide(g: Partial<CmGuide> | null | undefined): Price {
  if (!g) return { trend: null, low: null, avg30: null, avg7: null, avg1: null };
  // Si la versión normal no tiene precio, todas las cifras salen de la holo para no mezclar productos.
  const holo = num(g.trend) == null && num(g['trend-holo']) != null;
  const pick = (normal: unknown, holoValue: unknown) => (holo ? num(holoValue) : num(normal));
  return {
    trend: pick(g.trend, g['trend-holo']),
    low: pick(g.low, g['low-holo']),
    avg30: pick(g.avg30, g['avg30-holo']),
    avg7: pick(g.avg7, g['avg7-holo']),
    avg1: pick(g.avg1, g['avg1-holo']),
  };
}

/** Variación de la media de 7 días frente a la de 30 (en %), o null si falta alguna. */
export function weekChange(p: Price): number | null {
  if (!p.avg7 || !p.avg30) return null;
  return Math.round(((p.avg7 - p.avg30) / p.avg30) * 1000) / 10;
}

/** "2026-10-07T02:49:47+0200" -> "2026-10-07T00:49:47.000Z" */
export function guideDate(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const d = new Date(String(createdAt).replace(/([+-]\d\d)(\d\d)$/, '$1:$2'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Expansión de Cardmarket de un set: la más repetida entre los productos de sus cartas. */
export function expansionOf(cmIds: (number | null)[], singlesById: Map<number, CmProduct>): number | null {
  const count = new Map<number, number>();
  for (const id of cmIds) {
    const exp = id == null ? undefined : singlesById.get(id)?.idExpansion;
    if (exp != null) count.set(exp, (count.get(exp) ?? 0) + 1);
  }
  let best: number | null = null;
  let max = 0;
  for (const [exp, n] of count) if (n > max) [best, max] = [exp, n];
  return best;
}

/**
 * Tipo de producto sellado según el nombre de Cardmarket ("Destined Rivals Booster Box"). Se descartan cajas de 18,
 * sobres con fundas, cajas cerradas (case), displays de bundles y las ETB de Pokémon Center.
 */
export function sealedKind(p: Pick<CmProduct, 'name' | 'categoryName'>): SealedKind | null {
  const name = p.name.trim().toLowerCase();
  if (/case|pok[eé]mon center|sleeved/.test(name)) return null;
  if (name.endsWith(' booster')) return 'pack';
  if (name.endsWith(' booster box')) return 'box';
  if (name.endsWith(' booster bundle')) return 'bundle';
  if (name.endsWith(' elite trainer box')) return 'etb';
  return null;
}

/**
 * Producto sellado de una expansión: un producto por tipo (el que tenga precio, y a igualdad el más antiguo, que suele
 * ser el genérico frente a ediciones especiales).
 */
export function pickSealed(
  products: CmProduct[],
  guideById: Map<number, Partial<CmGuide>>,
  idExpansion: number | null,
): SealedItem[] {
  if (idExpansion == null) return [];
  const best = new Map<SealedKind, SealedItem>();
  const candidates = products
    .filter((p) => p.idExpansion === idExpansion)
    .sort((a, b) => a.idProduct - b.idProduct);
  for (const p of candidates) {
    const kind = sealedKind(p);
    if (!kind) continue;
    const price = priceFromGuide(guideById.get(p.idProduct));
    const current = best.get(kind);
    if (!current || (current.price.trend == null && price.trend != null)) {
      best.set(kind, { kind, idProduct: p.idProduct, name: p.name, price });
    }
  }
  const order: SealedKind[] = ['pack', 'box', 'etb', 'bundle'];
  return order.flatMap((k) => (best.has(k) ? [best.get(k)!] : []));
}

/** Rarezas que no cuentan como "hit". */
const BASE_RARITIES = new Set(['common', 'uncommon', 'rare', 'none', 'promo']);
export const normRarity = (r: string | null | undefined) => (r ?? '').trim().toLowerCase();
export const isHit = (c: MarketCard) => !!c.rarity && !BASE_RARITIES.has(normRarity(c.rarity));

/** Cartas más caras del set según la tendencia de Cardmarket. */
export function topHits(cards: MarketCard[], n = 12): MarketCard[] {
  return cards
    .filter((c) => c.price.trend != null)
    .sort((a, b) => b.price.trend! - a.price.trend!)
    .slice(0, n);
}

export interface PullRate {
  /** Rareza tal como la escribe TCGdex (se compara sin mayúsculas). */
  rarity: string;
  /** Probabilidad de que un sobre traiga una carta de esta rareza (0-1). */
  perPack: number;
}

export interface SetPullRates {
  /** Nombre del set en inglés (clave de búsqueda). */
  set: string;
  packsPerBox: number | null;
  rates: PullRate[];
  source: { title: string; url: string; packs: number | null; kind: 'study' | 'community' | 'official' };
  reviewed: string;
}

export interface EvLine {
  rarity: string;
  perPack: number;
  cards: number;
  avgTrend: number | null;
  avgLow: number | null;
  evTrend: number;
  evLow: number;
}

export interface ExpectedValue {
  lines: EvLine[];
  /** Rarezas con tasa pero sin cartas con precio en el set. */
  missing: string[];
  perPack: { low: number; trend: number };
  perBox: { low: number; trend: number } | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Valor esperado de los hits de un sobre: para cada rareza con tasa conocida, probabilidad por sobre × precio medio de
 * las cartas de esa rareza (todas igual de probables dentro de su rareza). Rango: precio más bajo publicado y tendencia.
 */
export function expectedValue(cards: MarketCard[], rates: SetPullRates): ExpectedValue {
  const lines: EvLine[] = [];
  const missing: string[] = [];
  for (const rate of rates.rates) {
    const inRarity = cards.filter((c) => normRarity(c.rarity) === normRarity(rate.rarity));
    const trends = inRarity.map((c) => c.price.trend).filter((v): v is number => v != null);
    const lows = inRarity.map((c) => c.price.low ?? c.price.trend).filter((v): v is number => v != null);
    const avgTrend = mean(trends);
    const avgLow = mean(lows);
    if (avgTrend == null) {
      missing.push(rate.rarity);
      continue;
    }
    lines.push({
      rarity: rate.rarity, perPack: rate.perPack, cards: inRarity.length,
      avgTrend: r2(avgTrend), avgLow: avgLow == null ? null : r2(avgLow),
      evTrend: r2(rate.perPack * avgTrend), evLow: r2(rate.perPack * (avgLow ?? avgTrend)),
    });
  }
  const perPack = {
    low: r2(lines.reduce((s, l) => s + l.evLow, 0)),
    trend: r2(lines.reduce((s, l) => s + l.evTrend, 0)),
  };
  const box = rates.packsPerBox;
  return {
    lines, missing, perPack,
    perBox: box ? { low: r2(perPack.low * box), trend: r2(perPack.trend * box) } : null,
  };
}

export const normSetName = (s: string) => s.normalize('NFD').replace(/[^a-z0-9]/gi, '').toLowerCase();

export function findPullRates(setName: string, all: SetPullRates[]): SetPullRates | null {
  const key = normSetName(setName);
  return all.find((r) => normSetName(r.set) === key) ?? null;
}

export function cardmarketUrl(lang: 'es' | 'en', idProduct: number | null, searchName?: string) {
  if (idProduct) return `https://www.cardmarket.com/${lang}/Pokemon/Products?idProduct=${idProduct}`;
  return `https://www.cardmarket.com/${lang}/Pokemon/Products/Search?searchString=${encodeURIComponent(searchName ?? '')}`;
}

export function cardImage(base: string | null, quality: 'low' | 'high' = 'low') {
  return base ? `${base}/${quality}.webp` : null;
}

export function slugify(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
