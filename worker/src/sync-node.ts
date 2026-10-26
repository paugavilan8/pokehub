// Lee el catálogo público de cada tienda y lo manda al worker de avisos (/api/sync). Se ejecuta en GitHub Actions
// cada 10 minutos (.github/workflows/stock-sync.yml): ahí no hay límite de CPU y es gratis en un repo público.
//
//   ALERTS_WORKER_URL=https://pullradar-alerts.<cuenta>.workers.dev SYNC_TOKEN=... node worker/src/sync-node.ts

import { SHOPS, fetchShop } from './shops.ts';

const WORKER = process.env.ALERTS_WORKER_URL?.replace(/\/$/, '');
const TOKEN = process.env.SYNC_TOKEN;
if (!WORKER || !TOKEN) {
  console.log('Sin ALERTS_WORKER_URL o SYNC_TOKEN: los avisos de stock no están desplegados todavía.');
  process.exit(0);
}

async function send(body: unknown) {
  const res = await fetch(`${WORKER}/api/sync`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`worker ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as { products?: number; restocked?: number; sent?: number };
}

let failed = 0;
for (const shop of SHOPS) {
  try {
    const products = await fetchShop(shop);
    const r = await send({ shop: shop.id, products });
    console.log(`${shop.id}: ${r.products} productos, ${r.restocked} repuestos, ${r.sent} correos`);
  } catch (e) {
    failed++;
    const message = (e as Error).message;
    console.error(`${shop.id}: ${message}`);
    if (!message.startsWith('worker')) await send({ shop: shop.id, error: message }).catch(() => {});
  }
}
// Si fallan todas, que el workflow salga en rojo para verlo en GitHub.
if (failed === SHOPS.length) process.exit(1);
