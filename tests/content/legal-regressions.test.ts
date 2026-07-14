import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/**
 * Test statico anti-regressione delle formulazioni giuridiche/marketing che
 * sono state esplicitamente identificate come errate o non prudenti negli
 * audit R1 → R6.
 *
 * Ogni riga qui dovrebbe restituire ZERO match nei file scansionati.
 * Se un test fallisce significa che qualcuno ha reintrodotto una formulazione
 * bandita — il commit va rivisto prima del merge.
 *
 * SCOPE: solo file di CONTENUTO pubblico (src/pages, src/content, public/app,
 * src/layouts, src/components). Test/dev/docs esclusi.
 */

// Estensioni scansionate. Escludiamo binari, immagini, node_modules, dist.
const EXTS = ['.astro', '.md', '.mdx', '.ts', '.tsx', '.html', '.jsx', '.js'];
const ROOTS = [
  'src/pages',
  'src/content',
  'src/layouts',
  'src/components',
  'public',
];

function walk(dir: string, acc: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const full = join(dir, name);
    let s: ReturnType<typeof statSync>;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(full, acc);
    else if (EXTS.includes(extname(name))) acc.push(full);
  }
  return acc;
}

const REPO_ROOT = process.cwd();
const files = ROOTS.flatMap((r) => walk(join(REPO_ROOT, r)));

function findMatches(pattern: RegExp): Array<{ file: string; line: number; text: string }> {
  const hits: Array<{ file: string; line: number; text: string }> = [];
  for (const f of files) {
    let content: string;
    try {
      content = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (pattern.test(line)) {
        hits.push({
          file: f.replace(REPO_ROOT, '').replace(/^[\\/]/, '').replace(/\\/g, '/'),
          line: i + 1,
          text: line.trim().slice(0, 200),
        });
      }
    });
  }
  return hits;
}

describe('Regressioni giuridiche R1-R6 (contenuto pubblico)', () => {
  // R6 § 4.1 — art. 1913 c.c. il termine generale è 3 giorni, non 8
  it('nessuna occorrenza di "8 giorni ex/art. 1913" (termine reale: 3 giorni)', () => {
    const hits = findMatches(/(8|otto)\s*giorni[^.]{0,40}1913|1913[^.]{0,40}(8|otto)\s*giorni/i);
    expect(hits, `Formulazione errata sull'art. 1913 c.c.: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  // R6 § 4.4 — IVASS svolge vigilanza, non decide controversie individuali,
  // nessun termine legale generale di 120 giorni
  it('nessuna occorrenza di "IVASS ... 120 giorni" come termine legale', () => {
    const hits = findMatches(/IVASS[^.]{0,80}120\s*giorni|120\s*giorni[^.]{0,80}IVASS/i);
    // Ammessi: menzioni generiche di "tempi variabili" (già corrette), no numeri fissi
    expect(hits, `IVASS 120 giorni non è un termine legale generale: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  // R6 § 4.4 — "ricorso IVASS" è terminologia scorretta (usare "esposto" o "segnalazione")
  it('nessuna occorrenza di "ricorso IVASS" (usare esposto/segnalazione)', () => {
    const hits = findMatches(/ricorso\s+IVASS/i);
    expect(hits, `"Ricorso IVASS" errato — usare esposto/segnalazione: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  // R6 § 3.1 — nessuna promessa di "precisione legale"
  it('nessuna promessa di "precisione legale"', () => {
    const hits = findMatches(/precisione\s+legale/i);
    expect(hits, `Claim "precisione legale" vietato: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  // R1-R5 — "verdetto imparziale" già rimosso, previene ritorno
  it('nessuna occorrenza di "verdetto imparziale"', () => {
    const hits = findMatches(/verdetto\s+imparziale/i);
    expect(hits, `"Verdetto imparziale" bandito: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  // R1-R5 — "riferimenti normativi corretti" (claim assoluto) → "pertinenti"
  it('nessuna occorrenza di "riferimenti normativi corretti"', () => {
    const hits = findMatches(/riferimenti\s+normativi\s+corretti/i);
    expect(hits, `"Riferimenti normativi corretti" (claim assoluto): ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  // R6 § 4.3 — no automatismi "clausola automaticamente vessatoria/nulla"
  it('nessuna dichiarazione automatica di vessatorietà o nullità', () => {
    const hits = findMatches(/(automaticamente|sempre|senz['a]\s*(dubbio|eccezioni))\s+(vessator|null[ao]|illegittim)/i);
    expect(hits, `Automatismi giuridici vietati: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  // R1-R5 — tempi marketing incoerenti "in N secondi" (esclusi contesti tecnici)
  it('nessuna promessa marketing di analisi "in N secondi"', () => {
    // Consentito: privacy/trasparenza usano "tipicamente entro 30 secondi"
    // riferito al timeout serverless (fatto tecnico verificabile).
    const raw = findMatches(/in\s+(\d+)\s+second[oi]/i);
    const marketing = raw.filter((h) => {
      // Escludi solo occorrenze tecniche già documentate: file privacy/trasparenza + commenti
      // Escludi anche i .md di guide dove è già stato corretto (residui accettabili se contestuali).
      const t = h.text.toLowerCase();
      if (t.includes('tipicamente') || t.includes('serverless')) return false;
      // Escludi file di documentazione strategica
      if (h.file.includes('docs/')) return false;
      return true;
    });
    expect(marketing, `Promesse marketing sul tempo: ${JSON.stringify(marketing, null, 2)}`).toHaveLength(0);
  });

  // R6 § 4.4 — non dichiarare che IVASS decida la controversia individuale
  it('nessuna dichiarazione che IVASS "decida" la controversia', () => {
    const hits = findMatches(/IVASS[^.]{0,60}\bdecide(re)?\b/i);
    expect(hits, `IVASS non decide controversie individuali: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  // R6 — nessuna promessa di rimborso/successo garantito
  it('nessuna promessa di "rimborso garantito" / "risultato garantito"', () => {
    const hits = findMatches(/(rimborso|risultato|successo|esito)\s+(garantit[oi]|certo|assicurato|sicuro)/i);
    expect(hits, `Promesse di risultato vietate: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  it('nessun termine generale di otto giorni per la denuncia', () => {
    const hits = findMatches(/(entro|termine[^.]{0,20}di)\s+(gli\s+)?(8|otto)\s+giorni/i);
    expect(hits, `Termine generale errato per la denuncia: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  it('nessuna lettera dichiarata pronta da inviare senza verifica', () => {
    const hits = findMatches(/(lettera|reclamo)\s+(già\s+)?pront[ao]\s+da\s+inviare/i);
    expect(hits, `Bozza presentata come pronta senza verifica: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  it('nessuna scarsità artificiale basata sui primi iscritti', () => {
    const hits = findMatches(/solo\s+(i\s+)?primi\s+\d+\s+(iscritti|clienti|utenti)/i);
    expect(hits, `Scarsità non documentata: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  it('nessuna promessa pubblica di analisi AI illimitate', () => {
    const hits = findMatches(/analisi\s+(AI\s+)?illimitate/i);
    expect(hits, `Uso AI illimitato senza controllo costi: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  it('non indica l’AAS come operativo nel 2024', () => {
    const hits = findMatches(/AAS[^.]{0,80}(operativ[oa]|entrato in vigore)[^.]{0,30}2024|operativ[oa][^.]{0,30}2024[^.]{0,80}AAS/i);
    expect(hits, `Data di operatività AAS errata: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  it('non pubblica il limite AAS di 150.000 euro', () => {
    const hits = findMatches(/(?:AAS|Arbitro Assicurativo|Arbitro)[^.\n]{0,100}150[.\s]?000\s*€/i);
    expect(hits, `Limite AAS non verificato: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  it('non indica 60 giorni come termine generale di risposta al reclamo', () => {
    const hits = findMatches(/(?:compagnia|impresa)[^.\n]{0,80}60\s+giorni[^.\n]{0,60}(?:reclamo|rispondere)|60\s+giorni[^.\n]{0,80}(?:risposta|reclamo)/i);
    expect(hits, `Termine reclamo errato: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  it('non attribuisce a IVASS un termine generale di 45 giorni', () => {
    const hits = findMatches(/IVASS\s+(?:ha|deve|istruisce|risponde)[^.\n]{0,50}45\s+giorni|45\s+giorni[^.\n]{0,40}tempo\s+per\s+IVASS/i);
    expect(hits, `Termine IVASS non previsto in via generale: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  it('non parla di decisione IVASS sulla controversia', () => {
    const hits = findMatches(/decisione\s+IVASS|attendi\s+la\s+decisione\s+IVASS/i);
    expect(hits, `IVASS presentato come decisore: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  it('non usa percentuali promozionali di successo del reclamo o esposto', () => {
    const hits = findMatches(/(?:60\s*[-–]\s*70|68|80|90)\s*%[^.\n]{0,100}(?:casi|dinieghi|reclamo|esposto|risolv)/i);
    expect(hits, `Percentuale di successo non documentata: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });

  it('non trasforma il caso fondatore in una vittoria certa', () => {
    const hits = findMatches(/avrei\s+vinto|non\s+c['’]è\s+dubbio/i);
    expect(hits, `Conclusione certa non dimostrata: ${JSON.stringify(hits, null, 2)}`).toHaveLength(0);
  });
});
