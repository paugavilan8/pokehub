// Lógica de los avisos sobre la base de datos D1: productos, suscriptores, avisos y envíos.
import { confirmMail, isValidEmail, restockMail, sendMail, type Lang, type Mail } from './mail.ts';
import { SHOPS, type ShopProduct } from './shops.ts';
import affiliates from '../../src/data/affiliates.json';
import { shopUrl, type AffiliateConfig } from '../../src/lib/affiliates.ts';

/** Enlace a la tienda con su código de afiliado, si lo hay (src/data/affiliates.json). */
const withRef = (shop: string, url: string) => shopUrl(affiliates as AffiliateConfig, shop, url);

export interface Env {
  DB: D1Database;
  SITE_URL: string;
  ALLOWED_ORIGINS: string;
  MAIL_FROM: string;
  RESEND_API_KEY?: string;
  /** Dirección pública del propio worker (para los enlaces de los correos). Por defecto, la de la petición. */
  WORKER_URL?: string;
}

/** Máximo de productos vigilados por correo, y horas mínimas entre dos avisos del mismo producto. */
export const MAX_WATCHES = 25;
export const RENOTIFY_HOURS = 12;
export const PENDING_DAYS = 7;

export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const shopName = (id: string) => SHOPS.find((s) => s.id === id)?.name ?? id;

export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Guarda el catálogo de una tienda y devuelve los productos que han vuelto a tener stock. Solo escribe lo que cambia
 * (stock o precio) para no gastar escrituras de D1. Lo que desaparece del catálogo pasa a agotado.
 */
export async function syncShop(db: D1Database, shop: string, products: ShopProduct[], now: string): Promise<string[]> {
  const { results } = await db.prepare('SELECT id, available, price FROM products WHERE shop = ?').bind(shop).all<{ id: string; available: number; price: number | null }>();
  const before = new Map(results.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const restocked: string[] = [];
  const stmts: D1PreparedStatement[] = [];
  for (const p of products) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const prev = before.get(p.id);
    if (!prev) {
      stmts.push(db.prepare(`INSERT INTO products (id, shop, name, search, url, image, price, available, kind, lang, first_seen, last_change)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(p.id, shop, p.name, normalize(p.name), p.url, p.image, p.price, p.available ? 1 : 0, p.kind, p.lang, now, now));
      continue;
    }
    const wasAvailable = prev.available === 1;
    if (wasAvailable !== p.available || prev.price !== p.price) {
      stmts.push(db.prepare(`UPDATE products SET name = ?, search = ?, url = ?, image = ?, price = ?, available = ?, kind = ?, lang = ?, last_change = ? WHERE id = ?`)
        .bind(p.name, normalize(p.name), p.url, p.image, p.price, p.available ? 1 : 0, p.kind, p.lang, now, p.id));
      if (!wasAvailable && p.available) restocked.push(p.id);
    }
  }
  for (const [id, prev] of before) {
    if (!seen.has(id) && prev.available === 1) stmts.push(db.prepare('UPDATE products SET available = 0, last_change = ? WHERE id = ?').bind(now, id));
  }
  for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
  return restocked;
}

interface WatchRow {
  subscriber_id: number; email: string; lang: Lang; token: string;
  product_id: string; name: string; shop: string; url: string; price: number | null; image: string | null;
}

/** Envía un correo por suscriptor con todos sus productos repuestos y marca los avisos como enviados. */
export async function notifyRestocks(env: Env, workerUrl: string, productIds: string[], now: string): Promise<number> {
  if (!productIds.length) return 0;
  const cutoff = new Date(Date.parse(now) - RENOTIFY_HOURS * 3600e3).toISOString();
  const marks = productIds.map(() => '?').join(',');
  const { results } = await env.DB.prepare(`SELECT w.subscriber_id, s.email, s.lang, s.token, w.product_id, p.name, p.shop, p.url, p.price, p.image
      FROM watches w JOIN subscribers s ON s.id = w.subscriber_id JOIN products p ON p.id = w.product_id
      WHERE w.product_id IN (${marks}) AND s.confirmed_at IS NOT NULL AND (w.notified_at IS NULL OR w.notified_at < ?)`)
    .bind(...productIds, cutoff).all<WatchRow>();
  const bySubscriber = new Map<number, WatchRow[]>();
  for (const r of results) bySubscriber.set(r.subscriber_id, [...(bySubscriber.get(r.subscriber_id) ?? []), r]);
  const mails: Mail[] = [];
  for (const rows of bySubscriber.values()) {
    const { email, lang, token } = rows[0];
    mails.push(restockMail(email, lang, rows.map((r) => ({ name: r.name, shop: shopName(r.shop), url: withRef(r.shop, r.url), price: r.price, image: r.image })),
      `${workerUrl}/api/unsubscribe?t=${token}`, `${workerUrl}/api/unsubscribe?t=${token}&oneclick=1`));
  }
  await sendMail(mails, env);
  const updates = results.map((r) => env.DB.prepare('UPDATE watches SET notified_at = ? WHERE subscriber_id = ? AND product_id = ?').bind(now, r.subscriber_id, r.product_id));
  for (let i = 0; i < updates.length; i += 80) await env.DB.batch(updates.slice(i, i + 80));
  return mails.length;
}

export type WatchResult =
  | { ok: true; status: 'pending' | 'active' }
  | { ok: false; error: 'invalid-email' | 'unknown-product' | 'too-many' | 'rate-limited' | 'consent' };

export async function createWatch(env: Env, workerUrl: string, input: { email: string; productId: string; lang: Lang; consent: boolean }, now: string): Promise<WatchResult> {
  const email = input.email.trim().toLowerCase();
  if (!input.consent) return { ok: false, error: 'consent' };
  if (!isValidEmail(email)) return { ok: false, error: 'invalid-email' };
  const product = await env.DB.prepare('SELECT id, name FROM products WHERE id = ?').bind(input.productId).first<{ id: string; name: string }>();
  if (!product) return { ok: false, error: 'unknown-product' };
  if (!(await allow(env.DB, `email:${email}`, 6, 3600, now))) return { ok: false, error: 'rate-limited' };

  let sub = await env.DB.prepare('SELECT id, token, confirmed_at FROM subscribers WHERE email = ?').bind(email).first<{ id: number; token: string; confirmed_at: string | null }>();
  if (!sub) {
    const token = newToken();
    await env.DB.prepare('INSERT INTO subscribers (email, token, lang, created_at) VALUES (?, ?, ?, ?)').bind(email, token, input.lang, now).run();
    sub = { id: (await env.DB.prepare('SELECT id FROM subscribers WHERE email = ?').bind(email).first<{ id: number }>())!.id, token, confirmed_at: null };
  }
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM watches WHERE subscriber_id = ?').bind(sub.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_WATCHES) return { ok: false, error: 'too-many' };
  await env.DB.prepare('INSERT OR IGNORE INTO watches (subscriber_id, product_id, created_at) VALUES (?, ?, ?)').bind(sub.id, product.id, now).run();

  if (sub.confirmed_at) return { ok: true, status: 'active' };
  await sendMail([confirmMail(email, input.lang, product.name, `${workerUrl}/api/confirm?t=${sub.token}`, `${workerUrl}/api/unsubscribe?t=${sub.token}`)], env);
  return { ok: true, status: 'pending' };
}

export async function confirm(db: D1Database, token: string, now: string) {
  const sub = await db.prepare('SELECT id, lang FROM subscribers WHERE token = ?').bind(token).first<{ id: number; lang: Lang }>();
  if (!sub) return null;
  await db.prepare('UPDATE subscribers SET confirmed_at = COALESCE(confirmed_at, ?) WHERE id = ?').bind(now, sub.id).run();
  return sub.lang;
}

/** Baja total: borra el correo y todos sus avisos (no guardamos nada más). */
export async function unsubscribe(db: D1Database, token: string) {
  const sub = await db.prepare('SELECT id, lang FROM subscribers WHERE token = ?').bind(token).first<{ id: number; lang: Lang }>();
  if (!sub) return null;
  await db.batch([
    db.prepare('DELETE FROM watches WHERE subscriber_id = ?').bind(sub.id),
    db.prepare('DELETE FROM subscribers WHERE id = ?').bind(sub.id),
  ]);
  return sub.lang;
}

/** Borra suscripciones que nunca se confirmaron. */
export async function cleanup(db: D1Database, now: string) {
  const cutoff = new Date(Date.parse(now) - PENDING_DAYS * 864e5).toISOString();
  const { results } = await db.prepare('SELECT id FROM subscribers WHERE confirmed_at IS NULL AND created_at < ?').bind(cutoff).all<{ id: number }>();
  for (const r of results) {
    await db.batch([db.prepare('DELETE FROM watches WHERE subscriber_id = ?').bind(r.id), db.prepare('DELETE FROM subscribers WHERE id = ?').bind(r.id)]);
  }
  await db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(Math.floor(Date.parse(now) / 1000) - 86400).run();
}

/** Límite simple por clave y ventana de tiempo. */
export async function allow(db: D1Database, key: string, limit: number, windowSec: number, now: string) {
  const t = Math.floor(Date.parse(now) / 1000);
  const row = await db.prepare('SELECT count, window_start FROM rate_limits WHERE key = ?').bind(key).first<{ count: number; window_start: number }>();
  if (!row || t - row.window_start >= windowSec) {
    await db.prepare('INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)').bind(key, t).run();
    return true;
  }
  if (row.count >= limit) return false;
  await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}

export interface ProductRow {
  id: string; shop: string; name: string; url: string; image: string | null; price: number | null;
  available: number; kind: string | null; lang: string | null; last_change: string;
}

export async function searchProducts(db: D1Database, q: string, limit = 40) {
  const tokens = normalize(q).split(' ').filter((t) => t.length >= 2).slice(0, 6);
  const where = tokens.map(() => 'search LIKE ?').join(' AND ') || '1 = 1';
  const { results } = await db.prepare(`SELECT id, shop, name, url, image, price, available, kind, lang, last_change FROM products
      WHERE ${where} ORDER BY available DESC, last_change DESC LIMIT ?`)
    .bind(...tokens.map((t) => `%${t}%`), Math.min(limit, 60)).all<ProductRow>();
  return results.map((r) => ({ ...r, url: withRef(r.shop, r.url), available: r.available === 1, shopName: shopName(r.shop) }));
}
