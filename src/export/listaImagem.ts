/**
 * Lista de preços em imagem (1080 × 1350, formato do feed e bom no status do WhatsApp).
 * Usa o mesmo conteúdo do catálogo: só produtos à venda, preço por 100 g e por kg, ofertas marcadas.
 * Quando não cabe numa imagem, divide em várias.
 */
import type { CardapioArquivo } from '../core/vitrine';
import { formatBRL } from '../core/money';

const W = 1080;
const H = 1350;
const SERIF = '"Fraunces Variable", Georgia, serif';
const SANS = '"DM Sans Variable", "DM Sans", Arial, sans-serif';
const INK = '#2b1d17';
const MUTED = '#6b5b50';

type Linha = { tipo: 'cat'; nome: string } | { tipo: 'item'; nome: string; pk?: number; pu?: number; ud?: string; pa?: number };

function carregar(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((ok) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = src;
  });
}

export async function listaEmImagens(c: CardapioArquivo, logoUrl: string, rodape: string): Promise<Blob[]> {
  await Promise.all([document.fonts.load(`700 48px ${SERIF}`), document.fonts.load(`400 30px ${SANS}`), document.fonts.load(`700 30px ${SANS}`)]).catch(() => undefined);
  const logo = await carregar(logoUrl);
  // ofertas uma vez só (no topo); as outras categorias "de destaque" não entram, para não repetir
  const linhas: Linha[] = [];
  const ja = new Set<string>();
  for (const cat of c.categorias) {
    if (cat.nome === 'Mais vendidos' || cat.nome === 'Chegou agora') continue;
    const itens = cat.itens.filter((i) => cat.nome === 'Ofertas' || !ja.has(i.n));
    if (!itens.length) continue;
    linhas.push({ tipo: 'cat', nome: cat.nome });
    for (const i of itens) {
      if (cat.nome === 'Ofertas') ja.add(i.n);
      linhas.push({ tipo: 'item', nome: i.n, pk: i.pk, pu: i.pu, ud: i.ud, pa: i.pa });
    }
  }
  // páginas: cabeçalho ~250 px, rodapé ~110 px; categoria 70 px, item 52 px
  const pag: Linha[][] = [[]];
  let usado = 0;
  const util = H - 250 - 120;
  for (const l of linhas) {
    const alt = l.tipo === 'cat' ? 74 : 52;
    if (usado + alt > util || (l.tipo === 'cat' && usado + alt + 52 > util)) {
      pag.push([]);
      usado = 0;
    }
    pag[pag.length - 1].push(l);
    usado += alt;
  }
  const blobs: Blob[] = [];
  for (let k = 0; k < pag.length; k++) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d')!;
    g.fillStyle = c.loja.cores.f;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fffdf9';
    g.beginPath();
    g.roundRect(40, 210, W - 80, H - 210 - 110, 32);
    g.fill();
    // cabeçalho
    if (logo) {
      g.save();
      g.beginPath();
      g.arc(120, 110, 70, 0, Math.PI * 2);
      g.fillStyle = '#fff';
      g.fill();
      g.clip();
      const s = Math.min(140 / logo.width, 140 / logo.height);
      g.drawImage(logo, 120 - (logo.width * s) / 2, 110 - (logo.height * s) / 2, logo.width * s, logo.height * s);
      g.restore();
    }
    const tx = logo ? 220 : 64;
    g.fillStyle = INK;
    g.font = `700 54px ${SERIF}`;
    g.textAlign = 'left';
    g.fillText(c.loja.nome, tx, 100);
    g.fillStyle = c.loja.cores.p;
    g.font = `700 30px ${SANS}`;
    g.fillText(`Tabela de preços${pag.length > 1 ? ` · ${k + 1}/${pag.length}` : ''}`, tx, 148);
    g.fillStyle = MUTED;
    g.font = `400 24px ${SANS}`;
    g.textAlign = 'right';
    g.fillText('por 100 g', W - 88, 270);
    g.fillText('por kg', W - 88 - 210, 270);
    let y = 270;
    for (const l of pag[k]) {
      if (l.tipo === 'cat') {
        y += 66;
        g.textAlign = 'left';
        g.fillStyle = l.nome === 'Ofertas' ? c.loja.cores.d : c.loja.cores.p;
        g.font = `700 34px ${SERIF}`;
        g.fillText(l.nome, 88, y);
        y += 8;
        continue;
      }
      y += 52;
      g.textAlign = 'left';
      g.fillStyle = INK;
      g.font = `500 30px ${SANS}`;
      let nome = l.nome;
      while (g.measureText(nome).width > W - 88 - 88 - 430 && nome.length > 4) nome = nome.slice(0, -2);
      if (nome !== l.nome) nome = nome.trimEnd() + '…';
      g.fillText(nome, 88, y);
      g.textAlign = 'right';
      g.font = `700 30px ${SANS}`;
      g.fillStyle = l.pa ? c.loja.cores.p : INK;
      g.fillText(formatBRL(l.pk ? Math.round(l.pk / 10) : (l.pu ?? 0)), W - 88, y);
      g.font = `400 26px ${SANS}`;
      g.fillStyle = MUTED;
      if (l.pk) g.fillText(formatBRL(l.pk), W - 88 - 210, y);
      else if (l.ud) {
        let ud = l.ud;
        g.font = `400 22px ${SANS}`;
        while (g.measureText(ud).width > 190 && ud.length > 4) ud = ud.slice(0, -2);
        g.fillText(ud, W - 88 - 210, y);
      }
      if (l.pa) {
        const antes = formatBRL(l.pk ? Math.round(l.pa / 10) : l.pa);
        g.font = `400 22px ${SANS}`;
        const w = g.measureText(antes).width;
        g.fillText(antes, W - 88 - 128, y);
        g.fillRect(W - 88 - 128 - w, y - 8, w, 2);
      }
    }
    // rodapé
    g.textAlign = 'center';
    g.fillStyle = INK;
    g.font = `700 30px ${SANS}`;
    g.fillText(rodape, W / 2, H - 52);
    blobs.push(await new Promise<Blob>((ok, erro) => cv.toBlob((b) => (b ? ok(b) : erro(new Error('imagem'))), 'image/png')));
  }
  return blobs;
}
