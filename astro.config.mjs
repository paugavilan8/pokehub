import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Dirección pública de la web. Al pasar a un dominio propio, se define con SITE_URL en las variables de compilación
// de Cloudflare (o se cambia aquí).
const site = process.env.SITE_URL ?? 'https://pokehub.elpaueto8.workers.dev';

export default defineConfig({
  site,
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      filter: (page) => !/\/(avisos\/estado|alerts\/status)\//.test(page),
      i18n: { defaultLocale: 'es', locales: { es: 'es-ES', en: 'en' } },
    }),
  ],
});
