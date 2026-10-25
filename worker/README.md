# Avisos de stock por correo (Cloudflare Worker)

Revisa cada 5 minutos una de las tiendas de `src/shops.ts` (por turnos), guarda el catálogo de producto sellado de
Pokémon en D1 y, cuando algo pasa de agotado a disponible, envía un correo a quien lo sigue. La web lo usa desde
`/avisos/` con la variable `PUBLIC_ALERTS_API`.

- Doble confirmación: el aviso no se activa hasta pulsar el enlace del correo. Sin confirmar, se borra a los 7 días.
- Baja en un clic desde cualquier correo (enlace y cabecera `List-Unsubscribe`): borra el correo y todos sus avisos.
- Máximo 25 productos por correo, un aviso por producto cada 12 horas como mucho, límites por IP y por correo.
- Tiendas: catálogo público (Shopify `/products.json`, WooCommerce Store API) a baja frecuencia y con un
  `User-Agent` que nos identifica. Antes de añadir una tienda, revisa sus condiciones y su `robots.txt`.

## Ponerlo en marcha (una vez)

Desde la raíz del repo:

```sh
npx wrangler login
npx wrangler d1 create pokehub-alerts                 # copia el database_id en worker/wrangler.toml
npx wrangler d1 execute pokehub-alerts --remote --file=worker/schema.sql --config worker/wrangler.toml
```

Correo con [Resend](https://resend.com) (plan gratuito: 100 correos al día, 3.000 al mes):

1. Crea la cuenta y verifica tu dominio (te da unos registros DNS para añadir en Cloudflare).
2. Crea una API key y guárdala como secreto: `npx wrangler secret put RESEND_API_KEY --config worker/wrangler.toml`
3. En `worker/wrangler.toml`, pon `SITE_URL`, `ALLOWED_ORIGINS`, `MAIL_FROM` (con tu dominio) y `WORKER_URL`.

Publicar:

```sh
npx wrangler deploy --config worker/wrangler.toml
```

Por último, en el proyecto de Cloudflare Pages añade la variable `PUBLIC_ALERTS_API` con la dirección del worker
(la misma que `WORKER_URL`) y vuelve a publicar la web. Sin esa variable, `/avisos/` dice "muy pronto" y la política
de privacidad no menciona los avisos.

## Coste y límites

- D1 y los cron del plan gratuito de Workers bastan para empezar. Solo se escribe en D1 lo que cambia.
- El plan gratuito de Workers limita el tiempo de CPU de cada ejecución. Si en los registros (`npx wrangler tail`)
  aparece que se supera, pasa al plan Workers Paid (unos 5 $ al mes) o quita la tienda con el catálogo más grande.
- Si un día hay más de 100 correos, Resend gratuito deja de enviar hasta el día siguiente.

## Desarrollo

```sh
npm test                                               # incluye una prueba con D1 local
node worker/src/check-shops.ts                         # lee las tiendas reales desde Node
npx wrangler dev --config worker/wrangler.toml --local --test-scheduled
```

Sin `RESEND_API_KEY` los correos no se envían: se escriben en el registro.
