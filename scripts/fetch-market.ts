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
  appendHistory, cmCardName, expansionOf, inferRarity, guideDate, japaneseSetName, matchByName, pickSealed, priceFromGuide,
  type CmGuide, type CmProduct, type MarketCard, type MarketIndex, type MarketSet, type PriceHistory,
} from '../src/lib/market.ts';

const TCGDEX = 'https://api.tcgdex.net/v2';
const CM = 'https://downloads.s3.cardmarket.com/productCatalog';
/** Series de TCGdex con cartas físicas a la venta (fuera TCG Pocket, kits de entrenador y cartas jumbo). */
const SERIES = ['me', 'sv', 'swsh', 'sm', 'xy', 'bw', 'col', 'hgss', 'pl', 'dp', 'pop', 'ex', 'ecard', 'lc', 'neo', 'gym', 'base', 'mc'];
/** Subsets que TCGdex separa pero que salen en los mismos sobres: se unen a su expansión, como hace Cardmarket. */
const PARENT: Record<string, string> = {
  '30th-c': '30th', 'swsh9tg': 'swsh9', 'swsh10tg': 'swsh10', 'swsh11tg': 'swsh11', 'swsh12tg': 'swsh12',
  'swsh12.5gg': 'swsh12.5', 'swsh4.5sv': 'swsh4.5', 'sma': 'sm115', 'cel25cc': 'cel25', 'exu': 'ex10',
};
/**
 * Series japonesas: TCGdex trae id de Cardmarket desde Sol y Luna (las anteriores no tendrían precios). Los nombres
 * vienen en japonés: el de cada carta se toma de Cardmarket (en inglés) y el del set, de su sobre en Cardmarket.
 */
const JA_SERIES: Record<string, string> = { M: 'Mega Evolution', SV: 'Scarlet & Violet', S: 'Sword & Shield', SM: 'Sun & Moon' };
/** Prefijo de los ids japoneses: evita choques con los internacionales (XY1 frente a xy1) y deja claro el idioma. */
const JA = 'ja-';
/** Sets sin interés de precio (energías básicas). */
const SKIP = new Set(['sve', 'mee']);
/** Sets publicados hace menos de esto se vuelven a pedir enteros a TCGdex (cartas nuevas, ids que cambian). */
const REFRESH_DAYS = 90;
const OUT = new URL('../src/data/market/', import.meta.url);
const HEADERS = { 'User-Agent': 'PullRadar/0.1 (calculadora y precios para coleccionistas)' };

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

interface DexSetBrief { id: string; name: string; lang?: 'en' | 'ja'; serieEn?: string }
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

/** `saved` es el fichero guardado de la expansión (la madre, en un subset); se usan solo las cartas de este set. */
async function catalogOf(brief: DexSetBrief, saved: MarketSet | null): Promise<MarketSet | null> {
  const lang = brief.lang ?? 'en';
  const prefix = lang === 'ja' ? JA : '';
  const mine = saved?.cards.filter((c) => c.id.startsWith(`${prefix}${brief.id}-`)) ?? [];
  const previous = saved && mine.length ? { ...saved, cards: mine } : null;
  const set = await get<DexSet>(`${TCGDEX}/${lang}/sets/${encodeURIComponent(brief.id)}`);
  if (!set?.cards?.length) return null;
  const recent = !set.releaseDate || Date.now() - new Date(set.releaseDate).getTime() < REFRESH_DAYS * 864e5;
  const base = {
    id: prefix + set.id, name: set.name, serie: brief.serieEn ?? set.serie?.name ?? '', releaseDate: set.releaseDate ?? null,
    logo: set.logo ?? null, symbol: set.symbol ?? null, officialCount: set.cardCount?.official ?? null,
    totalCount: set.cardCount?.total ?? set.cards.length,
    ...(lang === 'ja' ? { lang: 'ja' as const, nameLocal: set.name } : {}),
  };
  // Se reutiliza el catálogo guardado salvo en sets recientes, si cambia el número de cartas o le faltan campos nuevos.
  if (previous && !recent && previous.cards.length === set.cards.length && previous.cards.every((c) => 'dex' in c)) {
    return { ...previous, ...base, name: previous.name };
  }
  const cards = await pool(set.cards, 8, async (brief): Promise<MarketCard> => {
    const c = await get<DexCard>(`${TCGDEX}/${lang}/cards/${encodeURIComponent(brief.id)}`);
    const cm = c?.pricing?.cardmarket ?? null;
    return {
      id: prefix + brief.id, num: brief.localId, name: c?.name ?? brief.name, rarity: c?.rarity ?? null,
      image: c?.image ?? brief.image ?? null, cmId: cm?.idProduct ?? null, price: priceFromGuide(cm),
      dex: c?.dexId ?? null,
    };
  });
  return { ...base, name: previous?.name ?? base.name, cmExpansion: previous?.cmExpansion ?? null, sealed: previous?.sealed ?? [], cards };
}

async function main() {
  await mkdir(new URL('sets/', OUT), { recursive: true });
  await mkdir(new URL('history/', OUT), { recursive: true });

  // 1. Catálogo de sets de las series recientes.
  const briefs: DexSetBrief[] = [];
  for (const serie of SERIES) {
    const s = await get<{ sets: DexSetBrief[] }>(`${TCGDEX}/en/series/${serie}`);
    briefs.push(...(s?.sets ?? []).filter((b) => !SKIP.has(b.id)));
  }
  for (const [serie, serieEn] of Object.entries(JA_SERIES)) {
    const s = await get<{ sets: DexSetBrief[] }>(`${TCGDEX}/ja/series/${serie}`);
    briefs.push(...(s?.sets ?? []).map((b) => ({ ...b, lang: 'ja' as const, serieEn })));
  }
  console.log(`TCGdex: ${briefs.length} sets`);

  const sets: MarketSet[] = [];
  const children: MarketSet[] = [];
  for (const b of briefs) {
    const file = b.lang === 'ja' ? JA + b.id : PARENT[b.id] ?? b.id;
    const saved = await readJson<MarketSet>(new URL(`sets/${file}.json`, OUT));
    const set = await catalogOf(b, saved);
    if (set) (PARENT[b.id] ? children : sets).push(set);
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  for (const child of children) {
    const parent = sets.find((s) => s.id === PARENT[child.id]);
    if (!parent) continue;
    parent.cards.push(...child.cards);
    parent.totalCount += child.totalCount;
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
      const known = expansionOf(set.cards.map((c) => c.cmId), singlesById);
      set.cmExpansion = matchByName(set.cards, known, singles.products);
      for (const card of set.cards) {
        const g = card.cmId ? guideById.get(card.cmId) : undefined;
        if (g) card.price = priceFromGuide(g);
      }
      set.sealed = pickSealed(nonsingles.products, guideById, set.cmExpansion);
      if (set.lang === 'ja') {
        for (const card of set.cards) {
          const p = card.cmId ? singlesById.get(card.cmId) : undefined;
          if (p) card.name = cmCardName(p.name);
        }
        const en = japaneseSetName(set.id, set.serie, set.sealed);
        set.name = en ? `${en} (JP)` : set.nameLocal ?? set.name;
      }
    }
    historyDay = guide.createdAt.slice(0, 10);
    console.log(`Cardmarket: guía del ${guide.createdAt}, ${guide.priceGuides.length} productos`);
  } catch (e) {
    console.warn(`Cardmarket no disponible (${(e as Error).message}): se mantienen los precios anteriores`);
    const previousIndex = await readJson<MarketIndex>(new URL('index.json', OUT));
    pricesDate = previousIndex?.pricesDate ?? null;
  }

  for (const set of sets) for (const card of set.cards) card.rarity = inferRarity(card, set.officialCount);

  // 3. Escribir. Los sets japoneses sin nombre en inglés (barajas, sets de inicio) o con menos de un tercio de cartas
  //    enlazadas a Cardmarket (TCGdex las apunta a otra expansión) no se guardan.
  for (let i = sets.length - 1; i >= 0; i--) {
    const set = sets[i];
    const linked = set.cards.filter((c) => c.cmId).length;
    if (set.lang === 'ja' && (!set.name.endsWith('(JP)') || linked < set.cards.length / 3)) sets.splice(i, 1);
  }
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
