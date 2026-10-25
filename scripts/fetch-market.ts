// Descarga diaria de datos de mercado para la sección de expansiones.
//
//   node scripts/fetch-market.ts            (Node 22.18 o superior: ejecuta TypeScript sin compilar)
//
// Fuentes:
//   - TCGdex (api.tcgdex.net): catálogo de sets y cartas, rareza, imagen e id de producto de Cardmarket.
//   - Cardmarket (downloads.s3.cardmarket.com): guía de precios diaria y catálogo de productos, públicos.
//     Condiciones de Cardmarket: decir claramente que los precios son suyos y usar su marca solo desde su kit.
//
// Salida (versionada en el repo, la lee el build de Astro):
//   src/data/market/index.json        sets sin cartas + fecha de los precios
//   src/data/market/sets/<id>.json    un set con sus cartas y su producto sellado
//   src/data/market/history/<id>.json historial diario de tendencias (cartas de 1 € o más y sellado)
//
// El catálogo de cartas de cada set se guarda y solo se vuelve a pedir a TCGdex si el set es reciente o no existe:
// los precios salen cada día de la guía de Cardmarket por id de producto.

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  appendHistory, expansionOf, guideDate, pickSealed, priceFromGuide,
  type CmGuide, type CmProduct, type MarketCard, type MarketIndex, type MarketSet, type PriceHistory,
} from '../src/lib/market.ts';

const TCGDEX = 'https://api.tcgdex.net/v2';
const CM = 'https://downloads.s3.cardmarket.com/productCatalog';
const SERIES = ['me', 'sv'];
/** Sets publicados hace menos de esto se vuelven a pedir enteros a TCGdex (cartas nuevas, ids que cambian). */
const REFRESH_DAYS = 90;
const OUT = new URL('../src/data/market/', import.meta.url);
const HEADERS = { 'User-Agent': 'PokeHub/0.1 (calculadora y precios para coleccionistas)' };

async function get<T>(url: string, attempts = 4): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404) return null;
    } catch {
      // fallo de red puntual: reintento
    }
    await new Promise((r) => setTimeout(r, 700 * (i + 1)));
  }
  throw new Error(`No se pudo descargar ${url}`);
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

interface DexSetBrief { id: string; name: string }
interface DexSet {
  id: string; name: string; logo?: string; symbol?: string; releaseDate?: string;
  serie?: { id: string; name: string }; cardCount?: { total?: number; official?: number };
  cards: { id: string; localId: string; name: string; image?: string }[];
}
interface DexCard {
  id: string; localId: string; name: string; rarity?: string; image?: string; dexId?: number[];
  pricing?: { cardmarket?: (Partial<CmGuide> & { idProduct?: number }) | null };
}

async function readJson<T>(file: URL): Promise<T | null> {
  return existsSync(file) ? (JSON.parse(await readFile(file, 'utf8')) as T) : null;
}

async function catalogOf(brief: DexSetBrief, previous: MarketSet | null): Promise<MarketSet | null> {
  const set = await get<DexSet>(`${TCGDEX}/en/sets/${brief.id}`);
  if (!set?.cards?.length) return null;
  const recent = !set.releaseDate || Date.now() - new Date(set.releaseDate).getTime() < REFRESH_DAYS * 864e5;
  const base = {
    id: set.id, name: set.name, serie: set.serie?.name ?? '', releaseDate: set.releaseDate ?? null,
    logo: set.logo ?? null, symbol: set.symbol ?? null, officialCount: set.cardCount?.official ?? null,
    totalCount: set.cardCount?.total ?? set.cards.length,
  };
  // Se reutiliza el catálogo guardado salvo en sets recientes, si cambia el número de cartas o le faltan campos nuevos.
  if (previous && !recent && previous.cards.length === set.cards.length && previous.cards.every((c) => 'dex' in c)) {
    return { ...previous, ...base };
  }
  const cards = await pool(set.cards, 8, async (brief): Promise<MarketCard> => {
    const c = await get<DexCard>(`${TCGDEX}/en/cards/${brief.id}`);
    const cm = c?.pricing?.cardmarket ?? null;
    return {
      id: brief.id, num: brief.localId, name: c?.name ?? brief.name, rarity: c?.rarity ?? null,
      image: c?.image ?? brief.image ?? null, cmId: cm?.idProduct ?? null, price: priceFromGuide(cm),
      dex: c?.dexId ?? null,
    };
  });
  return { ...base, cmExpansion: previous?.cmExpansion ?? null, sealed: previous?.sealed ?? [], cards };
}

async function main() {
  await mkdir(new URL('sets/', OUT), { recursive: true });
  await mkdir(new URL('history/', OUT), { recursive: true });

  // 1. Catálogo de sets de las series recientes.
  const briefs: DexSetBrief[] = [];
  for (const serie of SERIES) {
    const s = await get<{ sets: DexSetBrief[] }>(`${TCGDEX}/en/series/${serie}`);
    briefs.push(...(s?.sets ?? []));
  }
  console.log(`TCGdex: ${briefs.length} sets`);

  const sets: MarketSet[] = [];
  for (const b of briefs) {
    const previous = await readJson<MarketSet>(new URL(`sets/${b.id}.json`, OUT));
    const set = await catalogOf(b, previous);
    if (set) sets.push(set);
  }

  // 2. Guía de precios y catálogo de Cardmarket. Si fallan, se quedan los precios de TCGdex (copia de la misma guía
  //    con uno o dos días de retraso) y el sellado de la última ejecución.
  let pricesDate: string | null = null;
  /** Día de la guía en hora de Cardmarket ("2026-10-25T02:47:18+0200" -> "2026-10-25"); null si no se descargó. */
  let historyDay: string | null = null;
  try {
    const [guide, singles, nonsingles] = await Promise.all([
      get<{ createdAt: string; priceGuides: CmGuide[] }>(`${CM}/priceGuide/price_guide_6.json`),
      get<{ products: CmProduct[] }>(`${CM}/productList/products_singles_6.json`),
      get<{ products: CmProduct[] }>(`${CM}/productList/products_nonsingles_6.json`),
    ]);
    if (!guide || !singles || !nonsingles) throw new Error('fichero vacío');
    pricesDate = guideDate(guide.createdAt);
    const guideById = new Map(guide.priceGuides.map((g) => [g.idProduct, g]));
    const singlesById = new Map(singles.products.map((p) => [p.idProduct, p]));
    for (const set of sets) {
      for (const card of set.cards) {
        const g = card.cmId ? guideById.get(card.cmId) : undefined;
        if (g) card.price = priceFromGuide(g);
      }
      set.cmExpansion = expansionOf(set.cards.map((c) => c.cmId), singlesById);
      set.sealed = pickSealed(nonsingles.products, guideById, set.cmExpansion);
    }
    historyDay = guide.createdAt.slice(0, 10);
    console.log(`Cardmarket: guía del ${guide.createdAt}, ${guide.priceGuides.length} productos`);
  } catch (e) {
    console.warn(`Cardmarket no disponible (${(e as Error).message}): se mantienen los precios anteriores`);
    const previousIndex = await readJson<MarketIndex>(new URL('index.json', OUT));
    pricesDate = previousIndex?.pricesDate ?? null;
  }

  // 3. Escribir.
  sets.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
  for (const set of sets) {
    await writeFile(new URL(`sets/${set.id}.json`, OUT), JSON.stringify(set) + '\n');
    // El historial solo avanza con una guía de Cardmarket nueva, nunca con precios de la ejecución anterior.
    if (historyDay) {
      const file = new URL(`history/${set.id}.json`, OUT);
      const history = appendHistory(await readJson<PriceHistory>(file), historyDay, set);
      await writeFile(file, JSON.stringify(history) + '\n');
    }
  }
  const index: MarketIndex = {
    pricesDate,
    generatedAt: new Date().toISOString(),
    sets: sets.map(({ cards: _cards, ...rest }) => rest),
  };
  await writeFile(new URL('index.json', OUT), JSON.stringify(index, null, 1) + '\n');
  console.log(`Escritos ${sets.length} sets`);
}

await main();
