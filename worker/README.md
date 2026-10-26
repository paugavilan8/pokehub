# Avisos de stock por correo (Cloudflare Worker)

Revisa cada 5 minutos una de las tiendas de `src/shops.ts` (por turnos), guarda el catálogo de producto sellado de
Pokémon en D1 y, cuando algo pasa de agotado a disponible, envía un correo a quien lo sigue. La web lo usa desde
`/avisos/` con la variable `PUBLIC_ALERTS_API`.

- Doble confirmación: el aviso no se activa hasta pulsar el enlace del correo. Sin confirmar, se borra a los 7 días.
- Baja en un clic desde cualquier correo (enlace y cabecera `List-Unsubscribe`): borra el correo y todos sus avisos.
- Máximo 25 productos por correo, un aviso por producto cada 12 horas como mucho, límites por IP y por correo.
- Tiendas: catálogo público (Shopify `/products.json`, WooCommerce Store API) a baja frecuencia y con un
  `User-Agent` que nos identifica. Antes de añadir una tienda, revisa sus condiciones y su `robots.txt`.

## Cómo funciona

- **GitHub Actions** (`.github/workflows/stock-sync.yml`, cada 10 minutos) lee el catálogo de las tiendas con
  `worker/src/sync-node.ts` y manda al worker solo el producto sellado de Pokémon (`POST /api/sync`). Así el worker no
  gasta CPU leyendo catálogos grandes, que no caben en el plan gratuito de Workers.
- **El worker** guarda los cambios en D1, envía los correos con Resend y atiende la web (`/api/products`, `/api/watch`,
  confirmación y baja). Su cron solo limpia una vez al día los avisos sin confirmar.

## Ponerlo en marcha (una vez, sin instalar nada)

1. En Cloudflare, crea un token de API (Mi perfil → Tokens de API → Crear token → plantilla "Editar Cloudflare
   Workers") y añádele el permiso **Cuenta → D1 → Editar**.
2. En GitHub (Settings → Secrets and variables → Actions) crea los secretos `CLOUDFLARE_API_TOKEN` (el token) y
   `CLOUDFLARE_ACCOUNT_ID` (el id de cuenta, en la portada de Workers y Pages del panel de Cloudflare).
3. En [Resend](https://resend.com) crea una API key y guárdala como secreto `RESEND_API_KEY`. Sin dominio verificado,
   Resend solo entrega a tu propio correo (remitente `onboarding@resend.dev`), que sirve para probar.
4. Con dominio propio: verifícalo en Resend (registros DNS en Cloudflare) y crea la **variable** `MAIL_FROM`, por
   ejemplo `PullRadar <avisos@tudominio.es>`.
5. Lanza el workflow "Desplegar avisos de stock" (pestaña Actions → Run workflow). Crea la base de datos, el esquema,
   publica el worker en `https://pullradar-alerts.<tu-subdominio>.workers.dev` y le pone los secretos.
6. En la web, `PUBLIC_ALERTS_API` con la dirección del worker (fichero `.env.production` o variable de compilación).

Desde entonces, cada cambio en `worker/` se vuelve a desplegar solo.

## Coste y límites

- Todo cabe en los planes gratuitos: Workers y D1 de Cloudflare, Actions de GitHub (repo público) y Resend.
  Solo se escribe en D1 lo que cambia.
- Si un día hay más de 100 correos, Resend gratuito deja de enviar hasta el día siguiente.

## Desarrollo

```sh
npm test                                               # incluye una prueba con D1 local
node worker/src/check-shops.ts                         # lee las tiendas reales desde Node
npx wrangler dev --config worker/wrangler.toml --local --test-scheduled
```

Sin `RESEND_API_KEY` los correos no se envían: se escriben en el registro.
