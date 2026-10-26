// Worker de avisos de stock: API para la web y revisión periódica de tiendas.
//
//   GET  /api/products?q=texto       productos vigilables (sellado de Pokémon de las tiendas)
//   POST /api/watch                  { email, productId, lang, consent, website }  crea un aviso
//   GET  /api/confirm?t=TOKEN        confirma el correo (doble confirmación) y vuelve a la web
//   GET  /api/unsubscribe?t=TOKEN    baja de todos los avisos y vuelve a la web
//   POST /api/unsubscribe?t=TOKEN    baja en un clic desde el gestor de correo (List-Unsubscribe)
//   GET  /api/shops                  estado de la última revisión de cada tienda
//   POST /api/sync                   { shop, products } o { shop, error }  catálogo de una tienda (lo envía GitHub
//                                    Actions con la clave SYNC_TOKEN): guarda los cambios y avisa de lo repuesto
//
// Las tiendas no se leen desde aquí: sus catálogos pesan demasiado para el tiempo de CPU del plan gratuito de Workers.
// Las lee worker/src/sync-node.ts en GitHub Actions cada 10 minutos y manda solo el producto sellado de Pokémon.
import { allow, cleanup, confirm, createWatch, notifyRestocks, searchProducts, syncShop, unsubscribe, type Env } from './alerts.ts';
import { SHOPS, validProducts } from './shops.ts';

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

      if (url.pathname === '/api/sync' && request.method === 'POST') {
        if (!env.SYNC_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.SYNC_TOKEN}`) return json({ ok: false, error: 'unauthorized' }, 401);
        const body = await request.json().catch(() => null) as { shop?: string; products?: unknown; error?: string } | null;
        const shop = SHOPS.find((s) => s.id === body?.shop);
        if (!body || !shop) return json({ ok: false, error: 'bad-request' }, 400);
        const state = 'INSERT OR REPLACE INTO shop_state (shop, checked_at, ok, error, products) VALUES (?, ?, ?, ?, ?)';
        if (body.error) {
          await env.DB.prepare(state).bind(shop.id, now, 0, String(body.error).slice(0, 300), null).run();
          return json({ ok: true });
        }
        const products = validProducts(shop, body.products);
        if (!products) return json({ ok: false, error: 'bad-products' }, 400);
        const restocked = await syncShop(env.DB, shop.id, products, now);
        const sent = await notifyRestocks(env, workerUrl, restocked, now);
        await env.DB.prepare(state).bind(shop.id, now, 1, null, products.length).run();
        return json({ ok: true, products: products.length, restocked: restocked.length, sent });
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
    // Una vez al día: borrar los avisos sin confirmar de más de 7 días.
    await cleanup(env.DB, new Date(event.scheduledTime).toISOString());
  },
};
