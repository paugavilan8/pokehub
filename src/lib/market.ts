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
  /** Misma carta (nombre y ataques) en distintas expansiones e idiomas. */
  idMetacard?: number;
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
  /** Números de Pokédex del Pokémon (o Pokémon) de la carta; vacío en entrenadores y energías. */
  dex?: number[] | null;
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
  /** Solo en los sets japoneses: 'ja' y el nombre original. */
  lang?: 'ja';
  nameLocal?: string;
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
 * Rareza de las cartas que TCGdex trae sin ella (pasa mucho en los sets japoneses): si su número pasa del oficial del
 * set (188/187), es una secreta. Si no, se deja como está.
 */
export function inferRarity(card: Pick<MarketCard, 'num' | 'rarity'>, officialCount: number | null): string | null {
  const missing = !card.rarity || card.rarity.toLowerCase() === 'none';
  if (missing && officialCount && /^\d+$/.test(card.num) && Number(card.num) > officialCount) return 'Secret Rare';
  return card.rarity;
}

/** Nombre de una carta en Cardmarket sin los ataques: "Budew [Itchy Pollen]" -> "Budew". */
export const cmCardName = (name: string) => name.replace(/\s*\[.*$/, '').trim();

/**
 * Nombre en inglés de un set japonés: el de su sobre en Cardmarket ("Terastal Festival ex Booster"), o el de la serie
 * si es de promos. null si no hay forma de saberlo (barajas y sets de inicio sin sobres propios).
 */
export function japaneseSetName(id: string, seriesEn: string, sealed: SealedItem[]): string | null {
  if (/-P$/i.test(id)) return `${seriesEn} Promos`;
  const pack = sealed.find((s) => s.kind === 'pack');
  return pack ? pack.name.replace(/\s+booster$/i, '').replace(/\s+JP$/, '').trim() : null;
}

/**
 * Cartas de una expansión sacadas solo del catálogo de Cardmarket, para los sets que TCGdex tiene vacíos. No hay
 * número, rareza ni imagen; el número de Pokédex se toma de otra versión de la misma carta (mismo idMetacard).
 */
export function cardsFromCardmarket(
  setId: string,
  expansion: number,
  singles: CmProduct[],
  guideById: Map<number, Partial<CmGuide>>,
  dexByMetacard: Map<number, number[]>,
): MarketCard[] {
  const products = singles.filter((p) => p.idExpansion === expansion).sort((a, b) => a.idProduct - b.idProduct);
  // Las cartas repetidas (la normal y su versión alternativa) se distinguen como en Cardmarket: (V.1), (V.2)...
  const total = new Map<string, number>();
  for (const p of products) total.set(cmCardName(p.name), (total.get(cmCardName(p.name)) ?? 0) + 1);
  const seen = new Map<string, number>();
  return products.map((p) => {
    const name = cmCardName(p.name);
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return {
      id: `${setId}-cm${p.idProduct}`, num: '', name: total.get(name)! > 1 ? `${name} (V.${n})` : name, rarity: null, image: null,
      cmId: p.idProduct, price: priceFromGuide(guideById.get(p.idProduct)), dex: (p.idMetacard != null && dexByMetacard.get(p.idMetacard)) || null,
    };
  });
}

/** Nombre de carta comparable entre TCGdex y Cardmarket (Cardmarket añade los ataques entre corchetes). */
export function baseName(name: string) {
  return name.replace(/\s*\[.*$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’`]/g, "'").toLowerCase().trim();
}

/**
 * Da id de Cardmarket a las cartas que TCGdex trae sin él, buscando por nombre en la expansión de Cardmarket del set.
 * Si la expansión no se conoce (ninguna carta tiene id), se elige la que más nombres del set comparte. Cuando hay
 * varias cartas con el mismo nombre se emparejan por orden (número de carta frente a id de producto), y solo si
 * hay tantos productos libres como cartas; si no, la carta se queda sin precio antes que con uno equivocado.
 * TCGdex a veces da el mismo id a varias cartas (la normal y su versión arte completo): se vuelven a emparejar, y si
 * no se puede, el id se queda solo en la de número más bajo. Devuelve la expansión usada.
 */
export function matchByName(cards: MarketCard[], expansion: number | null, singles: CmProduct[]): number | null {
  const byNum = (a: MarketCard, b: MarketCard) => a.num.localeCompare(b.num, 'en', { numeric: true });
  const shared = new Map<number, MarketCard[]>();
  for (const c of cards) if (c.cmId != null) shared.set(c.cmId, [...(shared.get(c.cmId) ?? []), c]);
  const fallback = new Map<MarketCard, number>();
  for (const [id, group] of shared) {
    if (group.length < 2) continue;
    fallback.set(group.sort(byNum)[0], id);
    for (const c of group) c.cmId = null;
  }
  const missing = cards.filter((c) => c.cmId == null);
  if (!missing.length) return expansion;
  if (expansion == null) {
    const names = new Set(cards.map((c) => baseName(c.name)));
    const hits = new Map<number, Set<string>>();
    for (const p of singles) {
      const n = baseName(p.name);
      if (p.idExpansion == null || !names.has(n)) continue;
      if (!hits.has(p.idExpansion)) hits.set(p.idExpansion, new Set());
      hits.get(p.idExpansion)!.add(n);
    }
    let max = 0;
    for (const [exp, found] of hits) if (found.size > max) [expansion, max] = [exp, found.size];
    if (max < Math.max(5, names.size / 2)) { restore(cards, fallback); return null; }
  }
  const used = new Set(cards.map((c) => c.cmId).filter((id) => id != null));
  const free = new Map<string, CmProduct[]>();
  for (const p of singles) {
    if (p.idExpansion !== expansion || used.has(p.idProduct)) continue;
    const n = baseName(p.name);
    free.set(n, [...(free.get(n) ?? []), p]);
  }
  const groups = new Map<string, MarketCard[]>();
  for (const c of missing) groups.set(baseName(c.name), [...(groups.get(baseName(c.name)) ?? []), c]);
  for (const [name, group] of groups) {
    const products = free.get(name) ?? [];
    if (products.length !== group.length) continue;
    products.sort((a, b) => a.idProduct - b.idProduct);
    group.sort(byNum).forEach((c, i) => { c.cmId = products[i].idProduct; });
  }
  restore(cards, fallback);
  return expansion;
}

function restore(cards: MarketCard[], fallback: Map<MarketCard, number>) {
  const taken = new Set(cards.map((c) => c.cmId));
  for (const [c, id] of fallback) if (c.cmId == null && !taken.has(id)) c.cmId = id;
}

/**
 * Tipo de producto sellado según el nombre de Cardmarket ("Destined Rivals Booster Box"). Se descartan cajas de 18,
 * sobres con fundas, cajas cerradas (case), displays de bundles y las ETB de Pokémon Center.
 */
export function sealedKind(p: Pick<CmProduct, 'name' | 'categoryName'>): SealedKind | null {
  const name = p.name.trim().toLowerCase();
  if (/case|pok[eé]mon center|sleeved|korean|chinese|thai|indonesian/.test(name)) return null;
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

/** Historial diario de precios de tendencia de un set (euros), alineado con `dates`. */
export interface PriceHistory {
  dates: string[];
  cards: Record<string, (number | null)[]>;
  sealed: Record<string, (number | null)[]>;
}

/** Cartas que se siguen en el historial: las de 1 € o más (y las que ya estaban, para no dejar huecos). */
export const HISTORY_MIN_EUR = 1;
export const HISTORY_MAX_DAYS = 400;

/**
 * Añade (o reemplaza, si se ejecuta dos veces el mismo día) los precios de `day` al historial.
 * Las series nuevas se rellenan con null en los días anteriores.
 */
export function appendHistory(prev: PriceHistory | null, day: string, set: Pick<MarketSet, 'cards' | 'sealed'>): PriceHistory {
  const h: PriceHistory = prev
    ? { dates: [...prev.dates], cards: { ...prev.cards }, sealed: { ...prev.sealed } }
    : { dates: [], cards: {}, sealed: {} };
  const sameDay = h.dates.at(-1) === day;
  if (!sameDay) h.dates.push(day);
  const n = h.dates.length;
  const put = (bucket: Record<string, (number | null)[]>, key: string, value: number | null) => {
    const series = [...(bucket[key] ?? [])];
    while (series.length < n - (sameDay ? 0 : 1)) series.push(null);
    if (sameDay && series.length === n) series[n - 1] = value;
    else series.push(value);
    bucket[key] = series;
  };
  const today = new Set<string>();
  for (const c of set.cards) {
    if ((c.price.trend ?? 0) >= HISTORY_MIN_EUR || h.cards[c.id]) {
      put(h.cards, c.id, c.price.trend);
      today.add(c.id);
    }
  }
  for (const s of set.sealed) put(h.sealed, s.kind, s.price.trend);
  // Series que hoy no tienen dato: null para que sigan alineadas.
  for (const [key, series] of Object.entries(h.cards)) if (!today.has(key) && series.length < n) h.cards[key] = [...series, null];
  for (const [key, series] of Object.entries(h.sealed)) if (series.length < n) h.sealed[key] = [...series, null];
  if (h.dates.length > HISTORY_MAX_DAYS) {
    const cut = h.dates.length - HISTORY_MAX_DAYS;
    h.dates = h.dates.slice(cut);
    for (const b of [h.cards, h.sealed]) for (const k of Object.keys(b)) b[k] = b[k].slice(cut);
  }
  return h;
}
