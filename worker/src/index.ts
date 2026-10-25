// Worker de avisos de stock: API para la web y revisión periódica de tiendas.
//
//   GET  /api/products?q=texto       productos vigilables (sellado de Pokémon de las tiendas)
//   POST /api/watch                  { email, productId, lang, consent, website }  crea un aviso
//   GET  /api/confirm?t=TOKEN        confirma el correo (doble confirmación) y vuelve a la web
//   GET  /api/unsubscribe?t=TOKEN    baja de todos los avisos y vuelve a la web
//   POST /api/unsubscribe?t=TOKEN    baja en un clic desde el gestor de correo (List-Unsubscribe)
//   GET  /api/shops                  estado de la última revisión de cada tienda
import { allow, cleanup, confirm, createWatch, notifyRestocks, searchProducts, syncShop, unsubscribe, type Env } from './alerts.ts';
import { SHOPS, fetchShop } from './shops.ts';

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

function cors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  return allowed.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
    : {};
}

const statusPage = (env: Env, lang: string, result: string) =>
  `${env.SITE_URL}${lang === 'en' ? '/en/alerts/status/' : '/avisos/estado/'}?r=${result}`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const workerUrl = env.WORKER_URL ?? url.origin;
    const headers = cors(request, env);
    const now = new Date().toISOString();
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    try {
      if (url.pathname === '/api/products' && request.method === 'GET') {
        const products = await searchProducts(env.DB, url.searchParams.get('q') ?? '', Number(url.searchParams.get('limit') ?? 40));
        return json({ products }, 200, { ...headers, 'Cache-Control': 'public, max-age=60' });
      }

      if (url.pathname === '/api/shops' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT shop, checked_at, ok, products FROM shop_state').all();
        return json({ shops: SHOPS.map((s) => ({ ...s, ...(results.find((r) => r.shop === s.id) ?? {}) })) }, 200, headers);
      }

      if (url.pathname === '/api/watch' && request.method === 'POST') {
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) return json({ ok: false, error: 'bad-request' }, 400, headers);
        // Campo trampa: los bots lo rellenan, las personas no lo ven.
        if (body.website) return json({ ok: true, status: 'pending' }, 200, headers);
        const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
        if (!(await allow(env.DB, `ip:${ip}`, 20, 3600, now))) return json({ ok: false, error: 'rate-limited' }, 429, headers);
        const result = await createWatch(env, workerUrl, {
          email: String(body.email ?? ''), productId: String(body.productId ?? ''),
          lang: body.lang === 'en' ? 'en' : 'es', consent: body.consent === true,
        }, now);
        return json(result, result.ok ? 200 : result.error === 'rate-limited' ? 429 : 400, headers);
      }

      if (url.pathname === '/api/confirm' && request.method === 'GET') {
        const lang = await confirm(env.DB, url.searchParams.get('t') ?? '', now);
        return Response.redirect(statusPage(env, lang ?? 'es', lang ? 'confirmed' : 'invalid'), 303);
      }

      if (url.pathname === '/api/unsubscribe') {
        const lang = await unsubscribe(env.DB, url.searchParams.get('t') ?? '');
        if (request.method === 'POST') return new Response(null, { status: 200 });
        return Response.redirect(statusPage(env, lang ?? 'es', lang ? 'unsubscribed' : 'invalid'), 303);
      }

      return json({ ok: false, error: 'not-found' }, 404, headers);
    } catch (e) {
      console.error(e);
      return json({ ok: false, error: 'server' }, 500, headers);
    }
  },

  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    // Una tienda por ejecución, por turnos, para repartir la carga y no pasarse del tiempo de CPU.
    const slot = Math.floor(event.scheduledTime / (5 * 60 * 1000));
    const shop = SHOPS[slot % SHOPS.length];
    const now = new Date(event.scheduledTime).toISOString();
    const workerUrl = env.WORKER_URL ?? '';
    try {
      const products = await fetchShop(shop);
      const restocked = await syncShop(env.DB, shop.id, products, now);
      const sent = workerUrl ? await notifyRestocks(env, workerUrl, restocked, now) : 0;
      await env.DB.prepare('INSERT OR REPLACE INTO shop_state (shop, checked_at, ok, error, products) VALUES (?, ?, 1, NULL, ?)').bind(shop.id, now, products.length).run();
      console.log(`${shop.id}: ${products.length} productos, ${restocked.length} repuestos, ${sent} correos`);
    } catch (e) {
      await env.DB.prepare('INSERT OR REPLACE INTO shop_state (shop, checked_at, ok, error, products) VALUES (?, ?, 0, ?, NULL)').bind(shop.id, now, String((e as Error).message).slice(0, 300)).run();
      console.error(`${shop.id}: ${(e as Error).message}`);
    }
    if (slot % SHOPS.length === 0) await cleanup(env.DB, now);
  },
};
