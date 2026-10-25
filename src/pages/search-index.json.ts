// Índice para el buscador de la cabecera: sets y cartas con precio, en un JSON que se carga al usar el buscador.
import type { APIRoute } from 'astro';
import { allPokemon, allSets, rarityShort } from '../lib/market-data';

const ASSETS = 'https://assets.tcgdex.net/';

export const GET: APIRoute = () => {
  const sets = allSets();
  const body = {
    assets: ASSETS,
    // [slug, nombre en inglés, nombre en español, imagen de su carta más cara (ruta), número de cartas]
    pokemon: allPokemon().map((p) => [p.slug, p.en, p.es, p.cards[0]?.card.image?.replace(ASSETS, '') ?? null, p.cards.length]),
    // [slug, nombre, nombre del logo (ruta), fecha]
    sets: sets.map((s) => [s.slug, s.set.name, s.set.logo?.replace(ASSETS, '') ?? null, s.set.releaseDate]),
    // [índice del set, id, nombre, número, rareza, tendencia, imagen (ruta)]
    cards: sets.flatMap((s, i) =>
      s.set.cards
        .filter((c) => c.price.trend != null)
        .map((c) => [i, c.id, c.name, c.num, c.rarity ? rarityShort(c.rarity) : null, c.price.trend, c.image?.replace(ASSETS, '') ?? null]),
    ),
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
};
