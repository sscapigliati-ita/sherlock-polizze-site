// Genera codici Pro nel formato SHK-XXXX-XXXX con checksum compatibile
// (somma ASCII dei 8 caratteri payload % 7 === 0)
// Uso: node scripts/genera-codici.mjs [numero]

const ALFA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const N = Number(process.argv[2] ?? 10);

function generaCodice() {
  // 7 caratteri random + 1 ottavo scelto per centrare il checksum
  const prefix = Array.from({ length: 7 }, () => ALFA[Math.floor(Math.random() * ALFA.length)]).join('');
  const sommaParz = [...prefix].reduce((s, c) => s + c.charCodeAt(0), 0);
  const ottavo = [...ALFA].find((c) => (sommaParz + c.charCodeAt(0)) % 7 === 0);
  if (!ottavo) return null;
  const payload = prefix + ottavo;
  return `SHK-${payload.slice(0, 4)}-${payload.slice(4)}`;
}

const codici = new Set();
while (codici.size < N) {
  const c = generaCodice();
  if (c) codici.add(c);
}

console.log([...codici].join('\n'));
console.log(`\n# ${codici.size} codici generati. Per Vercel:`);
console.log(`PRO_CODES=${[...codici].join(',')}`);
