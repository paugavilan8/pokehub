// Precios de cartas gradeadas (PSA 10, PSA 9, CGC 10, BGS 10) para las cartas más caras.
//
//   PPT_API_KEY=... node scripts/fetch-graded.ts
//
// Fuente: PokemonPriceTracker (www.pokemonpricetracker.com/api-docs), medianas de ventas en eBay y Fanatics Collect,
// en dólares. El plan gratis da 100 créditos al día: buscar una carta cuesta 1 crédito por resultado y sus datos
// gradeados, 2. Por eso cada día se consultan unas pocas, de la más cara a la más barata, y se van refrescando por
// turnos (src/lib/graded.ts, gradedQueue). Con un plan de pago basta subir PPT_DAILY_CREDITS.
//
// Salida: src/data/graded.json (id de carta -> id de TCGplayer, día de consulta y precios por nota).
// Sin PPT_API_KEY no hace nada: la web funciona igual, sin la sección de gradeadas.

import { existsSync, readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { gradedQueue, parseGraded, pickMatch, type ApiCard, type GradedFile } from '../src/lib/graded.ts';
import type { MarketSet } from '../src/lib/market.ts';
import { isCommercial, type AffiliateConfig } from '../src/lib/affiliates.ts';

const API = process.env.PPT_API_URL ?? 'https://www.pokemonpricetracker.com/api/v2';
const KEY = process.env.PPT_API_KEY;
const BUDGET = Number(process.env.PPT_DAILY_CREDITS ?? 100);
/** Cartas candidatas: las de más precio en Cardmarket (con ofertas), hasta este número. */
const TOP = Number(process.env.PPT_TOP ?? 500);
const MIN_EUR = 20;
const SETS = new URL('../src/data/market/sets/', import.meta.url);
const OUT = new URL('../src/data/graded.json', import.meta.url);

if (!KEY) {
  console.log('Sin PPT_API_KEY: no se descargan precios de gradeadas.');
  process.exit(0);
}
const affiliates = JSON.parse(await readFile(new URL('../src/data/affiliates.json', import.meta.url), 'utf8')) as AffiliateConfig;
if (isCommercial(affiliates)) {
  // El plan gratis de PokemonPriceTracker no permite uso comercial, y con afiliados la web lo es.
  console.log('Afiliados activos (src/data/affiliates.json): no se descargan precios de gradeadas.');
  process.exit(0);
}

let spent = 0;

/** Llama a la API y suma los créditos gastados (cabecera X-API-Calls-Consumed). Devuelve null si hay que parar. */
async function api(path: string, estimate: number): Promise<{ data: ApiCard[] } | null> {
  if (spent + estimate > BUDGET) return null;
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  spent += Number(res.headers.get('x-api-calls-consumed')) || estimate;
  if (res.status === 401 || res.status === 403) throw new Error(`Clave rechazada (${res.status})`);
  if (res.status === 429 || res.status === 402) return null; // créditos del día agotados
  if (!res.ok) {
    console.warn(`  ${res.status} en ${path}`);
    return { data: [] };
  }
  const body = (await res.json()) as { data?: ApiCard[] | ApiCard | null };
  const data = Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];
  return { data };
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const store: GradedFile = existsSync(OUT)
    ? JSON.parse(await readFile(OUT, 'utf8'))
    : { eurPerUsd: null, fxDate: null, cards: {} };

  // Tipo de cambio del BCE para mostrar los precios en euros (aproximados).
  try {
    const fx = (await (await fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=EUR')).json()) as { date: string; rates: { EUR: number } };
    store.eurPerUsd = fx.rates.EUR;
    store.fxDate = fx.date;
  } catch {
    console.warn('Sin tipo de cambio nuevo: se mantiene el anterior');
  }

  // Candidatas: cartas con número y ofertas en Cardmarket, de la más cara a la más barata.
  const candidates: { id: string; name: string; num: string; set: string; ja: boolean; trend: number }[] = [];
  for (const file of readdirSync(SETS).filter((f) => f.endsWith('.json'))) {
    const set = JSON.parse(await readFile(new URL(file, SETS), 'utf8')) as MarketSet;
    for (const c of set.cards) {
      const { trend, low } = c.price;
      if (!c.num || trend == null || low == null || trend < MIN_EUR || trend > low * 15) continue;
      candidates.push({ id: c.id, name: c.name, num: c.num, set: set.name, ja: set.lang === 'ja', trend });
    }
  }
  candidates.sort((a, b) => b.trend - a.trend);
  const queue = gradedQueue(candidates.slice(0, TOP), store.cards, today);
  console.log(`Gradeadas: ${queue.length} cartas pendientes, ${BUDGET} créditos`);

  let done = 0;
  for (const card of queue) {
    const lang = card.ja ? '&language=japanese' : '';
    let tcg = store.cards[card.id]?.tcg ?? null;
    if (!tcg) {
      // 1. Buscar la carta por nombre y set (1 crédito por resultado, hasta 5).
      const setName = card.set.replace(/\s*\(JP\)$/, '');
      const found = await api(`/cards?search=${encodeURIComponent(card.name)}&set=${encodeURIComponent(setName)}&limit=5${lang}`, 5);
      if (!found) break;
      const match = pickMatch(found.data, card, card.set);
      if (!match?.tcgPlayerId) {
        store.cards[card.id] = { tcg: null, checked: today };
        continue;
      }
      tcg = String(match.tcgPlayerId);
    }
    // 2. Precios gradeados de esa carta (2 créditos).
    const full = await api(`/cards?tcgPlayerId=${encodeURIComponent(tcg)}&includeEbay=true&days=30${lang}`, 2);
    if (!full) {
      store.cards[card.id] = { ...store.cards[card.id], tcg, checked: store.cards[card.id]?.checked ?? '1970-01-01' };
      break;
    }
    const ebay = (full.data[0] as ApiCard & { ebay?: Parameters<typeof parseGraded>[0] } | undefined)?.ebay;
    store.cards[card.id] = { tcg, checked: today, prices: parseGraded(ebay) };
    done++;
  }

  await writeFile(OUT, JSON.stringify(store) + '\n');
  const withPrices = Object.values(store.cards).filter((e) => e.prices && Object.keys(e.prices).length).length;
  console.log(`Actualizadas ${done} cartas, ${spent} créditos. ${withPrices} cartas con precios de gradeadas.`);
}

await main();
