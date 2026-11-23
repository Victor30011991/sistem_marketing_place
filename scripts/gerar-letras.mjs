// Gera public/letras.webp: o nome de cada letra escrito nela mesma, na ordem de src/core/letras.ts.
// Uso: node scripts/gerar-letras.mjs   (precisa do Playwright; rode depois de mudar a lista de letras)
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const raiz = resolve(new URL('..', import.meta.url).pathname);
const src = readFileSync(resolve(raiz, 'src/core/letras.ts'), 'utf8');
const letras = [...src.matchAll(/l\('([a-z-]+)', '([^']+)', '(\w+)', (\d+)(, \{[^}]*\})?\)/g)].map(([, id, nome, , peso, extra = '']) => {
  const pacote = /pacote: '([^']+)'/.exec(extra)?.[1] ?? `@fontsource/${id}`;
  const variavel = extra.includes('variavel: true');
  const base = pacote.split('/')[1];
  const arq = variavel ? `${base}-latin-wght-normal.woff2` : `${base}-latin-${peso}-normal.woff2`;
  return { id, nome, peso: Number(peso), dados: readFileSync(resolve(raiz, 'node_modules', pacote, 'files', arq)).toString('base64') };
});

const L = 300, A = 40, E = 2;
const b = await chromium.launch();
const p = await b.newPage();
await p.setContent('<html><body></body></html>');
const dados = await p.evaluate(async ({ letras, L, A, E }) => {
  for (const x of letras) {
    const bin = Uint8Array.from(atob(x.dados), (ch) => ch.charCodeAt(0));
    const f = new FontFace('L-' + x.id, bin, { weight: x.peso > 400 ? `100 900` : '400' });
    document.fonts.add(await f.load());
  }
  const cv = document.createElement('canvas');
  cv.width = L * E;
  cv.height = A * E * letras.length;
  const c = cv.getContext('2d');
  c.scale(E, E);
  c.fillStyle = '#2b1d17';
  c.textBaseline = 'middle';
  letras.forEach((x, i) => {
    let t = 24;
    c.font = `${x.peso} ${t}px "L-${x.id}"`;
    while (c.measureText(x.nome).width > L - 8 && t > 12) c.font = `${x.peso} ${(t -= 1)}px "L-${x.id}"`;
    c.fillText(x.nome, 4, i * A + A / 2 + 1);
  });
  return cv.toDataURL('image/webp', 0.8);
}, { letras, L, A, E });
await b.close();
writeFileSync(resolve(raiz, 'public/letras.webp'), Buffer.from(dados.split(',')[1], 'base64'));
console.log(`public/letras.webp: ${letras.length} letras`);
