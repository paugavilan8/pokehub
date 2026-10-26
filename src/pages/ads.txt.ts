// ads.txt: declara qué cuenta de AdSense puede vender anuncios en esta web (Google lo exige).
import type { APIRoute } from 'astro';
import { affiliates } from '../lib/market-data';
import { adsTxt } from '../lib/affiliates';

export const GET: APIRoute = () => new Response(adsTxt(affiliates), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
