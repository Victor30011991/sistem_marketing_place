/**
 * Orçamento em imagem (PNG em pé, 1080 px de largura) para mandar no WhatsApp.
 * Desenhado direto no canvas: sai igual em qualquer celular e não depende de biblioteca.
 */
import type { ConfigOrcamento, OrcamentoSalvo, StoreInfo } from '../types';
import { formatBRL } from '../core/money';
import { installments } from '../core/orcamento';
import { contatosLoja, dataBR, precoTexto, qtdTexto, totaisOrcamento, validadeTexto } from '../core/orcamentos';
import { qrMatriz } from '../core/qr';
import { vitrineDe } from '../core/vitrine';

const W = 1080;
const SERIF = '"Fraunces Variable", Georgia, serif';
const SANS = '"DM Sans Variable", "DM Sans", Arial, sans-serif';
const INK = '#2b1d17';
const MUTED = '#6b5b50';
const LINHA = '#eee3d1';
const VERDE = '#3b6a2a';

type Op = (c: CanvasRenderingContext2D) => void;

function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

function luminancia(hex: string) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function quebrar(c: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const out: string[] = [];
  for (const par of texto.split('\n')) {
    let linha = '';
    for (const p of par.split(/\s+/)) {
      const t = linha ? `${linha} ${p}` : p;
      if (c.measureText(t).width > largura && linha) {
        out.push(linha);
        linha = p;
      } else linha = t;
    }
    out.push(linha);
  }
  return out;
}

function retangulo(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export async function orcamentoImagem(o: OrcamentoSalvo, loja: StoreInfo, logoUrl: string, cfg: ConfigOrcamento, pix: string | null): Promise<Blob> {
  await Promise.all([document.fonts.load(`700 54px ${SERIF}`), document.fonts.load(`400 28px ${SANS}`), document.fonts.load(`700 28px ${SANS}`)]).catch(() => undefined);
  const logo = await carregarImagem(logoUrl);
  const prim = loja.cores.primaria;
  const fundo = loja.cores.fundo;
  const sobrePrim = luminancia(prim) > 0.45 ? INK : '#ffffff';
  const t = totaisOrcamento(o);

  const medida = document.createElement('canvas').getContext('2d')!;
  const ops: Op[] = [];
  const fonte = (peso: number, tam: number, fam = SANS) => `${peso} ${tam}px ${fam}`;
  const texto = (s: string, x: number, y: number, f: string, cor: string, alinhar: CanvasTextAlign = 'left') =>
    ops.push((c) => {
      c.font = f;
      c.fillStyle = cor;
      c.textAlign = alinhar;
      c.textBaseline = 'alphabetic';
      c.fillText(s, x, y);
    });

  const M = 64;
  let y = 64;

  // ---------- cabeçalho da loja ----------
  const LOGO = 136;
  if (logo) {
    const yy = y;
    ops.push((c) => {
      c.save();
      c.beginPath();
      c.arc(M + LOGO / 2, yy + LOGO / 2, LOGO / 2, 0, Math.PI * 2);
      c.fillStyle = '#fff';
      c.fill();
      c.clip();
      const k = Math.min(LOGO / logo.width, LOGO / logo.height);
      c.drawImage(logo, M + (LOGO - logo.width * k) / 2, yy + (LOGO - logo.height * k) / 2, logo.width * k, logo.height * k);
      c.restore();
    });
  }
  const tx = logo ? M + LOGO + 32 : M;
  medida.font = fonte(700, 56, SERIF);
  texto(loja.nomeFantasia || 'Orçamento', tx, y + 70, fonte(700, 56, SERIF), INK);
  const slogan = (vitrineDe(loja).slogan || loja.informacoes).trim();
  if (slogan) {
    medida.font = fonte(400, 28);
    const l = quebrar(medida, slogan, W - tx - M)[0];
    texto(l, tx, y + 114, fonte(400, 28), MUTED);
  }
  y += LOGO + 40;

  // ---------- cartão ----------
  const cardY = y;
  const CX = 40;
  const CW = W - 2 * CX;
  const PX = CX + 48;
  const DX = W - CX - 48;
  const larguraUtil = DX - PX;
  y += 64;

  texto(`ORÇAMENTO Nº ${o.numero}`, PX, y, fonte(700, 26), prim);
  texto(dataBR(o.criado), DX, y, fonte(400, 26), MUTED, 'right');
  y += 66;
  if (o.cliente.nome.trim()) {
    medida.font = fonte(600, 50, SERIF);
    for (const l of quebrar(medida, `Para ${o.cliente.nome.trim()}`, larguraUtil).slice(0, 2)) {
      texto(l, PX, y, fonte(600, 50, SERIF), INK);
      y += 60;
    }
    y += 6;
  }
  const divisor = (yy: number) =>
    ops.push((c) => {
      c.fillStyle = LINHA;
      c.fillRect(PX, yy, larguraUtil, 2);
    });
  divisor(y);
  y += 22;

  // ---------- itens ----------
  for (const i of o.itens) {
    medida.font = fonte(700, 32);
    const valor = formatBRL(i.total);
    const wValor = medida.measureText(valor).width;
    medida.font = fonte(600, 32);
    const nomes = quebrar(medida, i.nome, larguraUtil - wValor - 32);
    y += 44;
    nomes.forEach((l, k) => texto(l, PX, y + k * 40, fonte(600, 32), INK));
    texto(valor, DX, y, fonte(700, 32), INK, 'right');
    y += (nomes.length - 1) * 40 + 38;
    texto(`${qtdTexto(i)}  ·  ${precoTexto(i)}`, PX, y, fonte(400, 26), MUTED);
    y += 24;
    divisor(y);
  }

  // ---------- totais ----------
  y += 52;
  if (t.desconto > 0) {
    texto('Subtotal', PX, y, fonte(400, 28), MUTED);
    texto(formatBRL(t.subtotal), DX, y, fonte(400, 28), MUTED, 'right');
    const yRisco = y - 10;
    ops.push((c) => {
      c.font = fonte(400, 28);
      const w = c.measureText(formatBRL(t.subtotal)).width;
      c.fillStyle = MUTED;
      c.fillRect(DX - w, yRisco, w, 2);
    });
    y += 44;
    texto('Desconto', PX, y, fonte(400, 28), VERDE);
    texto(`− ${formatBRL(t.desconto)}`, DX, y, fonte(600, 28), VERDE, 'right');
    y += 30;
  }
  // caixa do total
  const boxY = y;
  const boxH = 132;
  ops.push((c) => {
    retangulo(c, PX - 8, boxY, larguraUtil + 16, boxH, 24);
    c.fillStyle = prim;
    c.fill();
  });
  texto('Total', PX + 28, boxY + 80, fonte(600, 32), sobrePrim);
  texto(formatBRL(t.total), DX - 20, boxY + 92, fonte(700, 72, SERIF), sobrePrim, 'right');
  y = boxY + boxH;
  if (o.parcelas > 1) {
    y += 48;
    texto(`ou ${o.parcelas}× de ${formatBRL(installments(t.total, o.parcelas)[0])} no cartão`, W / 2, y, fonte(600, 30), INK, 'center');
  }
  if (t.desconto > 0) {
    y += 34;
    const msg = `Você economiza ${formatBRL(t.desconto)}`;
    medida.font = fonte(700, 28);
    const w = medida.measureText(msg).width + 56;
    const py = y;
    ops.push((c) => {
      retangulo(c, W / 2 - w / 2, py, w, 56, 28);
      c.fillStyle = '#e5f0dc';
      c.fill();
    });
    texto(msg, W / 2, py + 38, fonte(700, 28), VERDE, 'center');
    y += 56;
  }

  // ---------- validade e pagamento ----------
  y += 40;
  const infos: string[] = [];
  if (o.validade) infos.push(`Preços garantidos até ${validadeTexto(o.validade)}`);
  if (cfg.formas.trim()) infos.push(`Pagamento: ${cfg.formas.trim()}`);
  for (const s of infos) {
    y += 40;
    texto(s, W / 2, y, fonte(s.startsWith('Preços') ? 700 : 400, 28), s.startsWith('Preços') ? prim : INK, 'center');
  }

  // ---------- Pix ----------
  if (pix) {
    y += 48;
    divisor(y);
    y += 40;
    const Q = 236;
    const m = qrMatriz(pix);
    const qy = y;
    ops.push((c) => {
      c.fillStyle = '#fff';
      c.fillRect(PX, qy, Q, Q);
      const cel = (Q - 16) / m.length;
      c.fillStyle = '#000';
      m.forEach((lin, r) => lin.forEach((on, k) => on && c.fillRect(PX + 8 + k * cel, qy + 8 + r * cel, Math.ceil(cel), Math.ceil(cel))));
    });
    const qx = PX + Q + 36;
    texto('Pague com Pix', qx, y + 48, fonte(700, 34), INK);
    medida.font = fonte(400, 25);
    const linhas = quebrar(medida, `Valor já preenchido: ${formatBRL(t.total)}. No app do banco, escolha Pix › Ler QR code (dá para ler da galeria) ou use o Pix copia e cola da mensagem.`, DX - qx);
    linhas.forEach((l, k) => texto(l, qx, y + 92 + k * 34, fonte(400, 25), MUTED));
    y += Math.max(Q, 92 + linhas.length * 34);
  }

  // ---------- observações e chamada ----------
  if (o.obs.trim()) {
    y += 36;
    medida.font = fonte(400, 26);
    for (const l of quebrar(medida, o.obs.trim(), larguraUtil).slice(0, 8)) {
      y += 36;
      texto(l, PX, y, fonte(400, 26), INK);
    }
  }
  if (cfg.mensagem.trim()) {
    y += 76;
    medida.font = fonte(700, 34);
    for (const l of quebrar(medida, cfg.mensagem.trim(), larguraUtil)) {
      texto(l, W / 2, y, fonte(700, 34), prim, 'center');
      y += 44;
    }
    y -= 44;
  }
  y += 56;
  const cardH = y - cardY;
  ops.unshift((c) => {
    c.fillStyle = fundo;
    c.fillRect(0, 0, W, c.canvas.height);
    c.save();
    c.shadowColor = 'rgba(43,29,23,0.12)';
    c.shadowBlur = 24;
    c.shadowOffsetY = 6;
    retangulo(c, CX, cardY, CW, cardH, 36);
    c.fillStyle = '#fffdf9';
    c.fill();
    c.restore();
  });

  // ---------- rodapé ----------
  y += 56;
  const ct = contatosLoja(loja);
  const contatos = [ct.whats ? `WhatsApp ${ct.whats}` : '', ct.insta].filter(Boolean).join('   ·   ');
  if (contatos) {
    texto(contatos, W / 2, y, fonte(600, 26), INK, 'center');
    y += 40;
  }
  texto('Orçamento sem valor fiscal', W / 2, y, fonte(400, 22), MUTED, 'center');
  y += 48;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = Math.ceil(y);
  const ctx = canvas.getContext('2d')!;
  for (const op of ops) op(ctx);
  return new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error('imagem'))), 'image/png'));
}
