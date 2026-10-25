// Datos de las cartas de un set para la ficha de carta. Se piden solo al abrir una ficha.
import type { APIRoute } from 'astro';
import { allSets, historyOf, type SetSummary } from '../../../lib/market-data';
import { normRarity } from '../../../lib/market';

export function getStaticPaths() {
  return allSets().map((summary) => ({ params: { slug: summary.slug }, props: { summary } }));
}

export const GET: APIRoute = ({ props }) => {
  const { set, rates, slug } = (props as { summary: SetSummary }).summary;
  const countBy = new Map<string, number>();
  for (const c of set.cards) countBy.set(normRarity(c.rarity), (countBy.get(normRarity(c.rarity)) ?? 0) + 1);
  const oddsOf = (rarity: string | null) => {
    const rate = rates?.rates.find((r) => normRarity(r.rarity) === normRarity(rarity));
    const n = countBy.get(normRarity(rarity)) ?? 0;
    return rate && n ? Math.round(n / rate.perPack) : null;
  };
  const history = historyOf(set.id);
  const body = {
    slug, name: set.name, logo: set.logo, total: set.officialCount,
    dates: history?.dates ?? [],
    // id -> [nombre, número, rareza, imagen, id de Cardmarket, tendencia, desde, media 1 d, media 7 d, media 30 d, 1 de N sobres, historial]
    cards: Object.fromEntries(set.cards.map((c) => [c.id, [
      c.name, c.num, c.rarity, c.image, c.cmId, c.price.trend, c.price.low,
      c.price.avg1 ?? null, c.price.avg7 ?? null, c.price.avg30, oddsOf(c.rarity), history?.cards[c.id] ?? null,
    ]])),
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
};
