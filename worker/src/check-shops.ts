// Prueba manual de las tiendas desde Node: node worker/src/check-shops.ts
import { SHOPS, fetchShop } from './shops.ts';

for (const shop of SHOPS) {
  try {
    const products = await fetchShop(shop);
    const inStock = products.filter((p) => p.available).length;
    console.log(`${shop.name}: ${products.length} productos sellados de Pokémon, ${inStock} disponibles`);
    for (const p of products.slice(0, 4)) console.log(`   ${p.available ? 'SI' : 'no'} ${p.kind.padEnd(10)} ${p.price ?? '-'} € ${p.name}`);
  } catch (e) {
    console.log(`${shop.name}: error ${(e as Error).message}`);
  }
}
