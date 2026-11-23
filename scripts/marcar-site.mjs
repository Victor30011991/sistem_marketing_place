// Depois do build: põe o endereço completo do site nas prévias de link (WhatsApp, Instagram e Facebook pedem endereço completo da imagem).
// Usa SITE_URL; no GitHub Actions, monta a partir do repositório (https://dono.github.io/repositorio/). Sem endereço, tira essas linhas.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const repo = process.env.GITHUB_REPOSITORY || '';
let site = process.env.SITE_URL || (repo.includes('/') ? `https://${repo.split('/')[0].toLowerCase()}.github.io/${repo.split('/')[1]}/` : '');
if (site && !site.endsWith('/')) site += '/';

for (const arq of ['dist/cardapio/index.html', 'dist/loja/index.html']) {
  if (!existsSync(arq)) continue;
  let t = readFileSync(arq, 'utf8');
  if (!t.includes('__SITE__')) continue;
  t = site ? t.replaceAll('__SITE__', site) : t.replace(/^.*__SITE__.*\n/gm, '');
  writeFileSync(arq, t);
  console.log(`${arq}: ${site ? 'prévia de link com ' + site : 'sem endereço do site, prévia sem imagem'}`);
}
