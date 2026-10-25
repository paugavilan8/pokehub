import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Dominio pendiente de decidir: se define con SITE_URL al desplegar.
const site = process.env.SITE_URL ?? 'https://pokehub.pages.dev';

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
