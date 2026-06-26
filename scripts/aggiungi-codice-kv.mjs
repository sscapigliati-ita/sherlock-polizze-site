// Inserisce manualmente un record codice Pro nel KV per migrare gli abbonati
// esistenti da Manus.space (che non aveva export). Uso una tantum.
import { Redis } from '@upstash/redis';
import fs from 'fs';

const env = Object.fromEntries(
  fs
    .readFileSync('C:/Users/Stefano/AppData/Local/Temp/test2.env', 'utf8')
    .split('\n')
    .map((l) => l.match(/^(\w+)="?([^"]*)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const r = new Redis({
  url: env.KV_REST_API_URL,
  token: env.KV_REST_API_TOKEN,
});

const arg = process.argv.slice(2);
const codice = arg[0];
const email = arg[1].toLowerCase();
const piano = arg[2] || 'annuale';
const meseScadenza = arg[3] ? Number(arg[3]) : 12;

const now = new Date();
const scad = new Date(now);
scad.setMonth(scad.getMonth() + meseScadenza);

const record = {
  codice,
  email,
  piano,
  dataEmissione: now.toISOString(),
  dataScadenza: scad.toISOString(),
  paypalOrderId: 'MANUS-MIGRATION',
};

await r.set(`pro:${codice}`, record);
await r.sadd('pro:codici', codice);
await r.sadd(`pro:email:${email}`, codice);

console.log('Inserito:', record);
