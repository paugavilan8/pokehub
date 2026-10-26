// Precios de cartas gradeadas (PSA, CGC, BGS) de PokemonPriceTracker: medianas de ventas reales en eBay y Fanatics
// Collect, en dólares. Lo descarga scripts/fetch-graded.ts para las cartas más caras, unas pocas cada día.

/** Notas que se guardan y se muestran, en este orden. */
export const GRADES = ['psa10', 'psa9', 'cgc10', 'bgs10'] as const;
export type Grade = (typeof GRADES)[number];

export interface GradedPrice {
  /** Precio de mercado en USD: el "smart market price" de la API, o la mediana si no lo hay. */
  usd: number;
  /** Ventas en las que se basa. */
  count: number;
}

export interface GradedEntry {
  /** Id de TCGplayer de la carta (lo usa la API); null si se buscó y no se encontró. */
  tcg: string | null;
  /** Día de la última consulta (AAAA-MM-DD). */
  checked: string;
  prices?: Partial<Record<Grade, GradedPrice>>;
}

export interface GradedFile {
  /** Euros por dólar el día de la última descarga (BCE, vía Frankfurter). */
  eurPerUsd: number | null;
  fxDate: string | null;
  cards: Record<string, GradedEntry>;
}

interface SalesStats {
  count?: number;
  medianPrice?: number | null;
  averagePrice?: number | null;
  smartMarketPrice?: { price?: number | null } | null;
}

/** Saca de la respuesta de la API (`ebay.salesByGrade`) las notas que nos interesan. */
export function parseGraded(ebay: { salesByGrade?: Record<string, SalesStats> } | null | undefined): Partial<Record<Grade, GradedPrice>> {
  const out: Partial<Record<Grade, GradedPrice>> = {};
  for (const grade of GRADES) {
    const s = ebay?.salesByGrade?.[grade];
    const usd = s?.smartMarketPrice?.price ?? s?.medianPrice ?? s?.averagePrice ?? null;
    if (usd != null && usd > 0 && (s?.count ?? 0) > 0) out[grade] = { usd: Math.round(usd * 100) / 100, count: s!.count! };
  }
  return out;
}

/** Número de carta comparable: "025/162" -> "25", "SV049" -> "SV49", "TG01" -> "TG1". */
export function normNumber(n: string | null | undefined) {
  const head = (n ?? '').split('/')[0].trim().toUpperCase();
  return head.replace(/^([A-Z]*)0+(\d)/, '$1$2');
}

const simple = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export interface ApiCard { tcgPlayerId?: string | number; name?: string; setName?: string; cardNumber?: string | null }

/**
 * La carta de la API que corresponde a la nuestra: mismo número y nombre que empieza igual ("Umbreon ex - 161/131"
 * vale para "Umbreon ex"), y si se sabe el set, que el nombre del set coincida en parte. null si hay duda.
 */
export function pickMatch(results: ApiCard[], card: { name: string; num: string }, setName?: string): ApiCard | null {
  const num = normNumber(card.num);
  if (!num) return null;
  const name = simple(card.name);
  const set = setName ? simple(setName.replace(/\(JP\)/, '')) : '';
  const hits = results.filter((r) => {
    if (normNumber(r.cardNumber) !== num) return false;
    if (!simple(r.name ?? '').startsWith(name)) return false;
    if (!set) return true;
    // TCGplayer antepone el código del set: "SV10: Destined Rivals", "ME01: Mega Evolution".
    const rs = simple((r.setName ?? '').split(':').pop()!);
    return !!rs && (rs === set || rs.includes(set) || set.includes(rs));
  });
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Cartas a consultar hoy, en orden: primero las que nunca se han mirado (de más cara a más barata), después las que
 * llevan más días sin actualizar (como mínimo `staleDays`). Las que no se encontraron se reintentan cada 30 días.
 */
export function gradedQueue<T extends { id: string }>(candidates: T[], store: Record<string, GradedEntry>, today: string, staleDays = 7): T[] {
  const age = (d: string) => (Date.parse(today) - Date.parse(d)) / 864e5;
  const fresh = candidates.filter((c) => !store[c.id]);
  const stale = candidates
    .filter((c) => store[c.id] && age(store[c.id].checked) >= (store[c.id].tcg ? staleDays : 30))
    .sort((a, b) => store[a.id].checked.localeCompare(store[b.id].checked));
  return [...fresh, ...stale];
}
