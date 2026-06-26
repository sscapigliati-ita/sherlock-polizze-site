// Diagnosi KV: cerco discrepanze tra pro:codici set e i record pro:* effettivi
// e tra count:analizza:<g> e il log eventi.
import { Redis } from '@upstash/redis';
import fs from 'fs';

const env = Object.fromEntries(
  fs
    .readFileSync('C:/Users/Stefano/AppData/Local/Temp/claude/C--Users-Stefano/2ff7a7db-fe11-4f1a-9acb-994d96391785/scratchpad/prod.env', 'utf8')
    .split('\n')
    .map((l) => l.match(/^(\w+)="?([^"]*)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const r = new Redis({
  url: env.KV_REST_API_URL,
  token: env.KV_REST_API_TOKEN,
});

console.log('=== Abbonamenti ===');
const codiciSet = await r.smembers('pro:codici');
console.log('Set pro:codici contiene', codiciSet.length, 'codici:', codiciSet);

// Scan completo per chiavi pro:*
const keysPro = [];
let cursor = 0;
do {
  const [next, batch] = await r.scan(cursor, { match: 'pro:*', count: 100 });
  cursor = Number(next);
  for (const k of batch) {
    // escludo i set pro:codici e pro:email:*
    if (k === 'pro:codici') continue;
    if (k.startsWith('pro:email:')) continue;
    keysPro.push(k);
  }
} while (cursor !== 0);
console.log('Chiavi pro:<codice> effettive in KV:', keysPro.length);
console.log(keysPro);

const mancantiNelSet = keysPro.filter((k) => !codiciSet.includes(k.replace('pro:', '')));
console.log('Record presenti ma NON nel set pro:codici:', mancantiNelSet);

const noRecord = codiciSet.filter((c) => !keysPro.includes(`pro:${c}`));
console.log('Codici nel set ma SENZA record:', noRecord);

// Per ogni record, controllo data scadenza
const oraIso = new Date().toISOString();
const records = [];
for (const k of keysPro) {
  const rec = await r.get(k);
  if (rec) records.push(rec);
}
console.log('Record totali letti:', records.length);
console.log('Record attivi (scadenza > ora):', records.filter((rec) => rec.dataScadenza > oraIso).length);
console.log('Dettaglio record:');
for (const rec of records) {
  const attivo = rec.dataScadenza > oraIso ? 'ATTIVO' : 'SCADUTO';
  console.log(`  ${rec.codice} | ${rec.email} | ${rec.piano} | scad ${rec.dataScadenza.slice(0, 10)} | ${attivo}`);
}

console.log('\n=== Analisi oggi (counter vs log) ===');
const oggiUtc = new Date().toISOString().slice(0, 10);
const oggiRome = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
console.log('Data UTC:', oggiUtc, '| Data Europe/Rome:', oggiRome);

const counterUtc = await r.get(`count:analizza:${oggiUtc}`);
console.log(`Counter count:analizza:${oggiUtc} (UTC) =`, counterUtc);

// Conto dal log eventi quante analisi sono di oggi (Europe/Rome) vs UTC
const eventi = await r.lrange('log:api', 0, 499);
const parsed = eventi.map((e) => {
  try { return typeof e === 'string' ? JSON.parse(e) : e; } catch { return null; }
}).filter(Boolean);
console.log('Eventi totali nel log:', parsed.length);

const analisi = parsed.filter((e) => e.tipo === 'analizza');
console.log('Analisi totali nel log (max 500 ultimi):', analisi.length);

const ymdRome = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const ymdUtc = (iso) => new Date(iso).toISOString().slice(0, 10);

const oggiRomeCount = analisi.filter((e) => ymdRome(e.ts) === oggiRome).length;
const oggiUtcCount = analisi.filter((e) => ymdUtc(e.ts) === oggiUtc).length;
console.log(`Analisi oggi (Europe/Rome ${oggiRome}):`, oggiRomeCount);
console.log(`Analisi oggi (UTC ${oggiUtc}):`, oggiUtcCount);

// Vedo per ogni giorno UTC/Rome il count
const byRome = {};
const byUtc = {};
for (const e of analisi) {
  const dr = ymdRome(e.ts);
  const du = ymdUtc(e.ts);
  byRome[dr] = (byRome[dr] ?? 0) + 1;
  byUtc[du] = (byUtc[du] ?? 0) + 1;
}
console.log('Distribuzione per data Europe/Rome:', byRome);
console.log('Distribuzione per data UTC:', byUtc);
