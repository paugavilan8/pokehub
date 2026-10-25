// Prueba de integración con una base de datos D1 local (workerd, vía getPlatformProxy de wrangler).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { cleanup, confirm, createWatch, notifyRestocks, searchProducts, syncShop, unsubscribe, type Env } from './alerts.ts';
import { restockMail, confirmMail } from './mail.ts';
import type { ShopProduct } from './shops.ts';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let env: Env;
const W = 'https://worker.test';

const product = (id: string, available: boolean, price = 59.95): ShopProduct => ({
  id: `surcollect:${id}`, shop: 'surcollect', name: `ETB Caos Creciente ${id} - (Idioma Español)`, url: `https://surcollect.com/products/${id}`,
  image: null, price, available, kind: 'etb', lang: 'es',
});

beforeAll(async () => {
  proxy = await getPlatformProxy<Env>({ configPath: 'worker/wrangler.toml', persist: false });
  env = { ...proxy.env, RESEND_API_KEY: undefined };
  const schema = readFileSync('worker/schema.sql', 'utf8').replace(/--.*$/gm, '');
  for (const stmt of schema.split(';').map((s) => s.trim()).filter(Boolean)) await env.DB.prepare(stmt).run();
}, 60000);

afterAll(async () => { await proxy?.dispose(); });

describe('ciclo completo de un aviso', () => {
  it('guarda el catálogo y detecta reposiciones', async () => {
    expect(await syncShop(env.DB, 'surcollect', [product('a', false), product('b', true)], '2026-10-25T10:00:00.000Z')).toEqual([]);
    expect(await syncShop(env.DB, 'surcollect', [product('a', true), product('b', true)], '2026-10-25T10:30:00.000Z')).toEqual(['surcollect:a']);
    // Lo que desaparece del catálogo pasa a agotado.
    await syncShop(env.DB, 'surcollect', [product('a', true)], '2026-10-25T11:00:00.000Z');
    const b = await env.DB.prepare('SELECT available FROM products WHERE id = ?').bind('surcollect:b').first<{ available: number }>();
    expect(b?.available).toBe(0);
  });

  it('busca sin tildes ni mayúsculas', async () => {
    const found = await searchProducts(env.DB, 'CAOS creciente');
    expect(found.map((p) => p.id).sort()).toEqual(['surcollect:a', 'surcollect:b']);
    expect(found[0].shopName).toBe('Surcollect');
  });

  it('valida el formulario', async () => {
    const base = { email: 'ash@example.com', productId: 'surcollect:b', lang: 'es' as const, consent: true };
    expect(await createWatch(env, W, { ...base, consent: false }, '2026-10-25T12:00:00.000Z')).toEqual({ ok: false, error: 'consent' });
    expect(await createWatch(env, W, { ...base, email: 'no-es-un-correo' }, '2026-10-25T12:00:00.000Z')).toEqual({ ok: false, error: 'invalid-email' });
    expect(await createWatch(env, W, { ...base, productId: 'x:y' }, '2026-10-25T12:00:00.000Z')).toEqual({ ok: false, error: 'unknown-product' });
  });

  it('pide confirmación, no avisa hasta confirmar y avisa una sola vez', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await createWatch(env, W, { email: 'Ash@Example.com', productId: 'surcollect:b', lang: 'es', consent: true }, '2026-10-25T12:00:00.000Z');
    expect(res).toEqual({ ok: true, status: 'pending' });
    expect(log.mock.calls.at(-1)?.[0]).toContain('Confirma tu aviso de stock');
    const token = (await env.DB.prepare('SELECT token FROM subscribers WHERE email = ?').bind('ash@example.com').first<{ token: string }>())!.token;

    // Repuesto antes de confirmar: no se avisa.
    await syncShop(env.DB, 'surcollect', [product('a', true), product('b', true)], '2026-10-25T12:10:00.000Z');
    expect(await notifyRestocks(env, W, ['surcollect:b'], '2026-10-25T12:10:00.000Z')).toBe(0);

    expect(await confirm(env.DB, token, '2026-10-25T12:20:00.000Z')).toBe('es');
    expect(await notifyRestocks(env, W, ['surcollect:b'], '2026-10-25T12:30:00.000Z')).toBe(1);
    expect(log.mock.calls.at(-1)?.[0]).toContain('Vuelve a haber stock');
    // Mismo producto otra vez antes de 12 horas: no se repite.
    expect(await notifyRestocks(env, W, ['surcollect:b'], '2026-10-25T14:00:00.000Z')).toBe(0);
    // Con el correo ya confirmado, los avisos nuevos quedan activos sin otro correo.
    expect(await createWatch(env, W, { email: 'ash@example.com', productId: 'surcollect:a', lang: 'es', consent: true }, '2026-10-25T15:00:00.000Z'))
      .toEqual({ ok: true, status: 'active' });
    log.mockRestore();
  });

  it('la baja borra el correo y sus avisos', async () => {
    const token = (await env.DB.prepare('SELECT token FROM subscribers WHERE email = ?').bind('ash@example.com').first<{ token: string }>())!.token;
    expect(await unsubscribe(env.DB, token)).toBe('es');
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM watches').first<{ n: number }>()).toEqual({ n: 0 });
    expect(await unsubscribe(env.DB, token)).toBeNull();
  });

  it('borra las suscripciones sin confirmar al cabo de una semana', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await createWatch(env, W, { email: 'misty@example.com', productId: 'surcollect:a', lang: 'en', consent: true }, '2026-10-01T10:00:00.000Z');
    await cleanup(env.DB, '2026-10-25T10:00:00.000Z');
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM subscribers').first<{ n: number }>()).toEqual({ n: 0 });
  });
});

describe('correos', () => {
  it('llevan enlace de baja y cabecera de baja en un clic', () => {
    const m = restockMail('a@b.es', 'es', [{ name: 'ETB <Caos>', shop: 'Surcollect', url: 'https://x', price: 59.95, image: null }], 'https://w/u', 'https://w/u1');
    expect(m.html).toContain('https://w/u');
    expect(m.html).toContain('ETB &lt;Caos&gt;');
    expect(m.headers?.['List-Unsubscribe']).toBe('<https://w/u1>');
    expect(confirmMail('a@b.es', 'en', 'Box', 'https://c', 'https://u').subject).toBe('Confirm your stock alert');
  });
});
