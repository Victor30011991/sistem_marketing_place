/**
 * Desenha as artes do Posta Aí num canvas (prévia e arquivo final em 1080 px de largura),
 * gera o carrossel e o vídeo curto com as fotos trocando.
 */
import type { CamadaArte, EstiloArte, FonteSalva, StoreInfo } from '../types';
import { ENFEITES, ESTILO_FINAL, ESTILO_SLIDE, FAMILIAS_ARTE, FORMATOS_ARTE, corArte, familiaCss, nomeFonte, type FormatoArte } from '../core/estilosArte';

export interface ConteudoArte {
  titulo: string;
  subtitulo: string;
  chamada: string;
  preco: string;
  itens: string[];
}
export interface AjusteFoto {
  zoom: number;
  /** -1 a 1: qual parte da foto aparece quando ela sobra */
  fx: number;
  fy: number;
}
export interface OpcoesArte {
  formato: FormatoArte;
  variacao: number;
  loja: StoreInfo;
  logo: HTMLImageElement | null;
  fontes: FonteSalva[];
  foto: HTMLImageElement | null;
  ajuste: AjusteFoto;
  /** prévia: mostra o lugar da foto vazia e a peça escolhida */
  previa?: boolean;
  selecionada?: string | null;
}

export const AJUSTE_PADRAO: AjusteFoto = { zoom: 1, fx: 0, fy: 0 };

export function carregarImagem(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((ok) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = src;
  });
}

const registradas = new Set<string>();
/** Registra as letras salvas e espera todas as letras das artes carregarem. */
export async function garantirFontes(fontes: FonteSalva[]): Promise<void> {
  for (const f of fontes) {
    if (registradas.has(f.id)) continue;
    try {
      const ff = new FontFace(nomeFonte(f), `url(${f.dados})`);
      await ff.load();
      document.fonts.add(ff);
      registradas.add(f.id);
    } catch {
      /* letra inválida: fica a padrão */
    }
  }
  await Promise.all(FAMILIAS_ARTE.map((f) => document.fonts.load(`${f.peso} 60px ${f.css}`).catch(() => undefined)));
}

// ----------------------------------------------------------------------- caminhos

const POTE = new Path2D('M30 0h40a4 4 0 0 1 4 4v7a4 4 0 0 1-2 3.5L86 20a12 10 0 0 1 10 9V93a7 7 0 0 1-7 7H11a7 7 0 0 1-7-7V29a12 10 0 0 1 10-9L28 14.5a4 4 0 0 1-2-3.5V4A4 4 0 0 1 30 0z');
const caminhosEnfeite = new Map<string, Path2D>();
const enfeite = (id: string) => {
  if (!caminhosEnfeite.has(id)) caminhosEnfeite.set(id, new Path2D(ENFEITES.find((e) => e.id === id)?.d ?? ''));
  return caminhosEnfeite.get(id)!;
};

interface Caixa {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Caixa centrada com a proporção pedida (largura/altura) dentro da caixa dada. */
function encaixar(b: Caixa, proporcao: number): Caixa {
  if (b.w / b.h > proporcao) {
    const w = b.h * proporcao;
    return { x: b.x + (b.w - w) / 2, y: b.y, w, h: b.h };
  }
  const h = b.w / proporcao;
  return { x: b.x, y: b.y + (b.h - h) / 2, w: b.w, h };
}

/** Recorta o contexto no formato da máscara (o recorte continua depois de voltar a transformação). */
function recortar(ctx: CanvasRenderingContext2D, m: CamadaArte['mascara'], b: Caixa): Caixa {
  ctx.beginPath();
  if (m === 'circulo') {
    const r = Math.min(b.w, b.h) / 2;
    ctx.arc(b.x + b.w / 2, b.y + b.h / 2, r, 0, Math.PI * 2);
    ctx.clip();
    return { x: b.x + b.w / 2 - r, y: b.y + b.h / 2 - r, w: 2 * r, h: 2 * r };
  }
  if (m === 'pote') {
    const p = encaixar(b, 0.8);
    const t = ctx.getTransform();
    ctx.translate(p.x, p.y);
    ctx.scale(p.w / 100, p.h / 100);
    ctx.clip(POTE);
    ctx.setTransform(t);
    return p;
  }
  if (m === 'arco') {
    const r = b.w / 2;
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x, b.y + r);
    ctx.arc(b.x + r, b.y + r, r, Math.PI, 0);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath();
    ctx.clip();
    return b;
  }
  if (m === 'arredondado') ctx.roundRect(b.x, b.y, b.w, b.h, Math.min(b.w, b.h) * 0.06);
  else ctx.rect(b.x, b.y, b.w, b.h);
  ctx.clip();
  return b;
}

/** Desenha a imagem cobrindo a caixa, com zoom e deslocamento. */
function cobrir(ctx: CanvasRenderingContext2D, img: HTMLImageElement, b: Caixa, a: AjusteFoto) {
  const s = Math.max(b.w / img.width, b.h / img.height) * Math.max(1, a.zoom);
  const dw = img.width * s, dh = img.height * s;
  const ox = dw - b.w, oy = dh - b.h;
  ctx.drawImage(img, b.x - (ox * (a.fx + 1)) / 2, b.y - (oy * (a.fy + 1)) / 2, dw, dh);
}

// ----------------------------------------------------------------------- texto

function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  for (const par of texto.split('\n')) {
    let atual = '';
    for (const p of par.split(/\s+/).filter(Boolean)) {
      const t = atual ? `${atual} ${p}` : p;
      if (atual && ctx.measureText(t).width > largura) {
        linhas.push(atual);
        atual = p;
      } else atual = t;
    }
    linhas.push(atual);
  }
  return linhas;
}

function texto(ctx: CanvasRenderingContext2D, c: CamadaArte, valor: string, b: Caixa, W: number, op: OpcoesArte) {
  const { css, peso } = familiaCss(c.familia, op.fontes);
  const t = c.maiusculas ? valor.toLocaleUpperCase('pt-BR') : valor;
  const alt = css.includes('Bebas') ? 1.0 : css.includes('Caveat') || css.includes('Dancing') ? 1.0 : 1.12;
  let tam = (c.tamanho ?? 0.06) * W;
  let linhas: string[] = [];
  for (let i = 0; i < 30; i++) {
    ctx.font = `${peso} ${tam}px ${css}`;
    linhas = quebrar(ctx, t, b.w);
    const larga = Math.max(...linhas.map((l) => ctx.measureText(l).width));
    if ((linhas.length * tam * alt <= b.h * 1.05 && larga <= b.w * 1.01) || tam < (c.tamanho ?? 0.06) * W * 0.35) break;
    tam *= 0.93;
  }
  ctx.fillStyle = corArte(c.cor ?? 'escuro', op.loja, op.variacao);
  ctx.textBaseline = 'middle';
  const al = c.alinhar ?? 'centro';
  ctx.textAlign = al === 'esquerda' ? 'left' : al === 'direita' ? 'right' : 'center';
  const x = al === 'esquerda' ? b.x : al === 'direita' ? b.x + b.w : b.x + b.w / 2;
  if (c.sombra) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = tam * 0.18;
    ctx.shadowOffsetY = tam * 0.04;
  }
  const total = linhas.length * tam * alt;
  linhas.forEach((l, i) => ctx.fillText(l, x, b.y + b.h / 2 - total / 2 + tam * alt * (i + 0.5)));
  ctx.shadowColor = 'transparent';
}

function lista(ctx: CanvasRenderingContext2D, c: CamadaArte, itens: string[], b: Caixa, W: number, op: OpcoesArte) {
  if (!itens.length) return;
  const n = itens.length;
  const fh = b.h / n;
  const pad = W * 0.06;
  itens.forEach((it, i) => {
    const y = b.y + i * fh;
    ctx.globalAlpha = i % 2 ? 0.25 : 0.5;
    ctx.fillStyle = corArte(c.faixa ?? 'escuro', op.loja, op.variacao);
    ctx.fillRect(b.x, y, b.w, fh);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = corArte('creme', op.loja, op.variacao);
    if (i) ctx.fillRect(b.x, y - 1.5, b.w, 3);
    ctx.globalAlpha = 1;
    texto(ctx, { ...c, tamanho: Math.min(c.tamanho ?? 0.04, (fh / W) * 0.32), alinhar: i % 2 ? 'direita' : 'esquerda', sombra: true }, it, { x: b.x + pad, y: y + fh * 0.1, w: b.w - 2 * pad, h: fh * 0.8 }, W, op);
  });
}

// ----------------------------------------------------------------------- arte

const valorDe = (c: CamadaArte, k: ConteudoArte) => (c.campo && c.campo !== 'livre' ? (k[c.campo] ?? '') : (c.texto ?? ''));

export function desenharArte(ctx: CanvasRenderingContext2D, estilo: EstiloArte, k: ConteudoArte, op: OpcoesArte, escala = 1) {
  const { w: W, h: H } = FORMATOS_ARTE[op.formato];
  ctx.save();
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.fillStyle = corArte(estilo.fundo, op.loja, op.variacao);
  ctx.fillRect(0, 0, W, H);
  for (const c of estilo.camadas) {
    const b: Caixa = { x: c.x * W, y: c.y * H, w: c.w * W, h: c.h * H };
    ctx.save();
    ctx.globalAlpha = c.opacidade ?? 1;
    if (c.girar) {
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
      ctx.rotate((c.girar * Math.PI) / 180);
      ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
    }
    if (c.tipo === 'foto') {
      const r = recortar(ctx, c.mascara, b);
      if (op.foto) cobrir(ctx, op.foto, r, op.ajuste);
      else {
        ctx.fillStyle = corArte('escuro', op.loja, op.variacao);
        ctx.globalAlpha = 0.25;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        if (op.previa) {
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = '#fff';
          ctx.font = `600 ${W * 0.035}px "DM Sans Variable", Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('📷 Sua foto aqui', r.x + r.w / 2, r.y + r.h * 0.82);
        }
      }
      if (c.escurecer) {
        ctx.globalAlpha = c.escurecer;
        ctx.fillStyle = '#000';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
    } else if (c.tipo === 'logo') {
      if (op.logo) {
        const s = Math.min(b.w, b.h);
        const q = { x: b.x + (b.w - s) / 2, y: b.y + (b.h - s) / 2, w: s, h: s };
        recortar(ctx, 'circulo', q);
        cobrir(ctx, op.logo, q, AJUSTE_PADRAO);
      }
    } else if (c.tipo === 'forma') {
      ctx.fillStyle = corArte(c.cor ?? 'primaria', op.loja, op.variacao);
      ctx.beginPath();
      if ((c.raio ?? 0) >= 1) ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
      else ctx.roundRect(b.x, b.y, b.w, b.h, (c.raio ?? 0) * Math.min(W, H));
      ctx.fill();
    } else if (c.tipo === 'enfeite' && c.enfeite) {
      const e = ENFEITES.find((x) => x.id === c.enfeite);
      const q = b; // estica para a caixa, como desenho à mão
      const t = ctx.getTransform();
      ctx.translate(q.x, q.y);
      ctx.scale(q.w / 100, q.h / 100);
      ctx.strokeStyle = ctx.fillStyle = corArte(c.cor ?? 'branco', op.loja, op.variacao);
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (e?.cheio) ctx.fill(enfeite(c.enfeite));
      else ctx.stroke(enfeite(c.enfeite));
      ctx.setTransform(t);
    } else if (c.tipo === 'texto') {
      const v = valorDe(c, k).trim();
      if (v) texto(ctx, c, v, b, W, op);
    } else if (c.tipo === 'lista') {
      lista(ctx, c, k.itens.slice(0, 7), b, W, op);
    }
    ctx.restore();
    if (op.previa && op.selecionada === c.id) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.setLineDash([16, 10]);
      ctx.shadowColor = 'rgba(0,0,0,.6)';
      ctx.shadowBlur = 6;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Peça de cima que está no ponto (frações da arte). */
export function camadaEm(estilo: EstiloArte, x: number, y: number): CamadaArte | null {
  for (let i = estilo.camadas.length - 1; i >= 0; i--) {
    const c = estilo.camadas[i];
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c;
  }
  return null;
}

function canvasDe(formato: FormatoArte): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = FORMATOS_ARTE[formato].w;
  cv.height = FORMATOS_ARTE[formato].h;
  return [cv, cv.getContext('2d')!];
}
const paraBlob = (cv: HTMLCanvasElement) => new Promise<Blob>((ok, erro) => cv.toBlob((b) => (b ? ok(b) : erro(new Error('Não foi possível gerar a imagem.'))), 'image/jpeg', 0.92));

export async function arteEmImagem(estilo: EstiloArte, k: ConteudoArte, op: OpcoesArte): Promise<Blob> {
  const [cv, ctx] = canvasDe(op.formato);
  desenharArte(ctx, estilo, k, { ...op, previa: false, selecionada: null });
  return paraBlob(cv);
}

/** Capa + um slide por item + slide final. */
export async function carrosselEmImagens(estilo: EstiloArte, k: ConteudoArte, op: OpcoesArte, fim: { titulo: string; subtitulo: string }): Promise<Blob[]> {
  const out = [await arteEmImagem(estilo, k, op)];
  const base = { ...op, foto: null };
  for (let i = 0; i < k.itens.length; i++) out.push(await arteEmImagem(ESTILO_SLIDE, { titulo: k.itens[i], subtitulo: k.titulo, chamada: '', preco: String(i + 1).padStart(2, '0'), itens: [] }, base));
  out.push(await arteEmImagem(ESTILO_FINAL, { titulo: fim.titulo, subtitulo: fim.subtitulo, chamada: '', preco: '', itens: [] }, base));
  return out;
}

export function tipoVideo(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const [mime, ext] of [
    ['video/mp4;codecs=avc1.42E01E', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm', 'webm'],
  ] as const)
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  return null;
}

/** Vídeo curto: a arte com as fotos trocando (1,6 s cada, com transição e zoom suave). */
export async function videoDasFotos(estilo: EstiloArte, k: ConteudoArte, op: OpcoesArte, fotos: HTMLImageElement[], progresso: (p: number) => void): Promise<{ blob: Blob; ext: string }> {
  const tipo = tipoVideo();
  if (!tipo) throw new Error('Este navegador não grava vídeo. Use o Chrome ou o Safari atualizados.');
  const [cv, ctx] = canvasDe(op.formato);
  const [cv2, ctx2] = canvasDe(op.formato);
  const fps = 30;
  const porFoto = 1.6, troca = 0.4;
  const lista = fotos.length ? fotos : [null];
  const total = lista.length * porFoto + 0.6;
  const stream = cv.captureStream(fps);
  const rec = new MediaRecorder(stream, { mimeType: tipo.mime, videoBitsPerSecond: 6_000_000 });
  const partes: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
  const fim = new Promise<void>((ok) => (rec.onstop = () => ok()));
  const quadro = (t: number) => {
    const i = Math.min(lista.length - 1, Math.floor(t / porFoto));
    const dentro = t - i * porFoto;
    const aj = (d: number) => ({ ...op.ajuste, zoom: op.ajuste.zoom * (1 + 0.08 * Math.min(1, d / porFoto)) });
    desenharArte(ctx, estilo, k, { ...op, previa: false, selecionada: null, foto: lista[i], ajuste: aj(dentro) });
    const prox = lista[i + 1];
    if (prox !== undefined && dentro > porFoto - troca) {
      desenharArte(ctx2, estilo, k, { ...op, previa: false, selecionada: null, foto: prox, ajuste: aj(0) });
      ctx.globalAlpha = (dentro - (porFoto - troca)) / troca;
      ctx.drawImage(cv2, 0, 0);
      ctx.globalAlpha = 1;
    }
  };
  quadro(0);
  rec.start(250);
  const inicio = performance.now();
  await new Promise<void>((ok) => {
    const passo = () => {
      const t = (performance.now() - inicio) / 1000;
      if (t >= total) return ok();
      quadro(t);
      progresso(t / total);
      requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
  rec.stop();
  await fim;
  stream.getTracks().forEach((s) => s.stop());
  progresso(1);
  return { blob: new Blob(partes, { type: tipo.mime.split(';')[0] }), ext: tipo.ext };
}
