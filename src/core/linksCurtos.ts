/**
 * Links curtos com o nome da loja (ex.: temperei.github.io/insta).
 * O endereço curto é um site à parte, só com páginas que levam ao cardápio ou ao WhatsApp.
 */
import { linkCardapio, type Origem } from './vitrine';

export interface Atalho {
  caminho: string;
  rotulo: string;
  dica: string;
  origem?: Origem;
  tipo: 'cartao' | 'cardapio' | 'whatsapp';
}

export const ATALHOS: Atalho[] = [
  { caminho: '', rotulo: 'Cartão de visitas', dica: 'Para a bio, panfleto e etiqueta', tipo: 'cartao' },
  { caminho: 'insta', rotulo: 'Instagram', dica: 'Link da bio e stories: conta os pedidos do Instagram', origem: 'instagram', tipo: 'cartao' },
  { caminho: 'face', rotulo: 'Facebook', dica: 'Página e posts do Facebook', origem: 'facebook', tipo: 'cartao' },
  { caminho: 'pedir', rotulo: 'Cardápio direto', dica: 'Para mandar no WhatsApp: abre já no cardápio', origem: 'whatsapp', tipo: 'cardapio' },
  { caminho: 'zap', rotulo: 'WhatsApp da loja', dica: 'Abre a conversa com vocês', tipo: 'whatsapp' },
];

/** "https://Temperei.github.io/insta" -> "temperei.github.io" */
export function limparDominio(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split(/[/?#\s]/)[0]
    .replace(/[^a-z0-9.-]/g, '')
    .slice(0, 80);
}

export function dominioValido(d: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d);
}

/** Endereço curto que a pessoa digita/vê: temperei.github.io/insta */
export function linkCurto(dominio: string, a: Atalho): string {
  return `https://${dominio}/${a.caminho}`;
}

/** Para onde o atalho leva. */
export function destinoAtalho(a: Atalho, baseSistema: string, whatsapp: string): string {
  if (a.tipo === 'whatsapp') return whatsapp ? `https://wa.me/${whatsapp}` : linkCardapio(baseSistema) + '#/loja';
  const c = linkCardapio(baseSistema, a.origem);
  return a.tipo === 'cartao' ? `${c}#/loja` : c;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** Página do atalho: leva na hora para o destino e mostra nome e logo quando o link é compartilhado. */
export function paginaAtalho(destino: string, loja: string, descricao: string, imagem: string): string {
  const d = esc(destino);
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(loja)}</title>
<meta name="description" content="${esc(descricao)}">
<meta property="og:title" content="${esc(loja)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:image" content="${esc(imagem)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<meta http-equiv="refresh" content="0; url=${d}">
<link rel="canonical" href="${d}">
<script>location.replace(${JSON.stringify(destino)})</script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F1E3C8;font:16px system-ui,sans-serif;color:#3a2a20}a{color:#A8432A;font-weight:700}</style>
</head><body><p>Abrindo <a href="${d}">${esc(loja)}</a>…</p></body></html>
`;
}
