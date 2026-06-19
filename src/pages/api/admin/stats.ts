import type { APIRoute } from 'astro';
import { leggiStats } from '../../../lib/log';
import { leggiAbbonati } from '../../../lib/storage';

export const prerender = false;

export const GET: APIRoute = async () => {
  const [stats, abb] = await Promise.all([leggiStats(), leggiAbbonati()]);
  return new Response(
    JSON.stringify({
      api: stats,
      abbonamenti: {
        attivi: abb.attivi,
        totali: abb.totali,
        ricavoEuroCent: abb.ricavoEuroCent,
      },
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
