import type { APIRoute } from 'astro';
import { leggiUltimiEventi } from '../../../lib/log';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '50'), 1), 200);
  const eventi = await leggiUltimiEventi(limit);
  return new Response(JSON.stringify({ eventi }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
