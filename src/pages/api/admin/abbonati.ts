import type { APIRoute } from 'astro';
import { leggiAbbonati } from '../../../lib/storage';

export const prerender = false;

export const GET: APIRoute = async () => {
  const { records } = await leggiAbbonati();
  return new Response(JSON.stringify({ records }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
