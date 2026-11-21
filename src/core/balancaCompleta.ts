import type { ConfigBalanca, InfoNutricional, Product, StoreInfo } from '../types';
import { linhaMgv5, nomeNaBalanca, precoBalanca, vaiParaBalanca } from './balanca';
import { CONSERVACAO_PADRAO } from './etiquetas';

/**
 * Carga completa para balanças no padrão Toledo MGV (UPX Wind Mega, Thunder…):
 * ITENSMGV.TXT (produtos), INFNUTR.TXT (tabela nutricional), TXINFO.TXT (ingredientes, alérgenos, glúten, modo de uso
 * e conservação) e FRACIONA.TXT (quem fracionou e embalou). Layouts conforme o ACBrCargaBal (Toledo MGV6/MGV7).
 */

/** Texto livre para a balança: maiúsculas, sem acento, só ASCII imprimível. */
export function textoLivre(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ºª°]/g, '')
    .toUpperCase()
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const zeros = (n: number, tam: number) => String(Math.max(0, Math.round(n))).padStart(tam, '0').slice(-tam);
const esp = (t: string, tam: number) => t.padEnd(tam, ' ').slice(0, tam);
/** número com casas decimais implícitas: (2,5 ; 3 dígitos ; 1 casa) → "025" */
const dec = (v: number, tam: number, casas: number) => zeros(v * 10 ** casas, tam);

/** Quebra o texto em linhas de até `largura` letras, sem cortar palavras. */
export function quebrarLinhas(texto: string, largura: number): string[] {
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of texto.split(' ').filter(Boolean)) {
    const p = palavra.length > largura ? palavra.slice(0, largura) : palavra;
    if (!atual) atual = p;
    else if (atual.length + 1 + p.length <= largura) atual += ' ' + p;
    else {
      linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Linhas da informação extra do produto (cada uma com até 56 letras). */
export function linhasInfoExtra(p: Product): string[] {
  const blocos: string[] = [];
  if (p.ingredientes?.trim()) blocos.push(`INGREDIENTES: ${p.ingredientes.trim().replace(/\.$/, '')}.`);
  if (p.alergenicos?.trim()) blocos.push(`ALERGICOS: ${p.alergenicos.trim().replace(/\.$/, '')}.`);
  if (p.gluten === 'contem') blocos.push('CONTEM GLUTEN.');
  if (p.gluten === 'nao-contem') blocos.push('NAO CONTEM GLUTEN.');
  if (p.modoUso?.trim()) blocos.push(`MODO DE USO: ${p.modoUso.trim().replace(/\.$/, '')}.`);
  if (!blocos.length) return [];
  blocos.push(CONSERVACAO_PADRAO);
  return quebrarLinhas(textoLivre(blocos.join(' ')), 56);
}

/** Uma linha do TXINFO.TXT: código(6) + observação(100) + texto(840 = 15 linhas de 56). */
export function linhaTxInfo(codigo: number, nome: string, linhas: string[]): string {
  return zeros(codigo, 6) + esp(textoLivre(nome), 100) + linhas.slice(0, 15).map((l) => esp(l, 56)).join('').padEnd(840, ' ');
}

/** Medida caseira estimada pela porção: até 5 g = colheres de chá; acima, colheres de sopa (~10 g cada). */
export function medidaCaseira(porcaoG: number): { qtd: number; codigo: string; texto: string } {
  if (porcaoG <= 5) return { qtd: 1, codigo: '02', texto: '1 colher de chá' };
  const qtd = Math.max(1, Math.min(99, Math.round(porcaoG / 10)));
  return { qtd, codigo: '00', texto: `${qtd} colher${qtd > 1 ? 'es' : ''} de sopa` };
}

/**
 * Uma linha do INFNUTR.TXT (Toledo MGV7, com a parte RDC 429 depois do "|").
 * Parte antiga: valores da porção. Parte RDC 429: valores em 100 g, e a balança calcula as porções pelo peso.
 */
export function linhaInfNutr(codigo: number, n: InfoNutricional): string {
  const f = n.porcao / 100;
  const m = medidaCaseira(n.porcao);
  const antiga =
    'N' +
    zeros(codigo, 6) +
    '0' +
    zeros(n.porcao, 3) +
    '0' + // gramas
    zeros(m.qtd, 2) +
    '0' + // sem fração
    m.codigo +
    zeros(n.kcal * f, 4) +
    dec(n.carboidratos * f, 4, 1) +
    dec(n.proteinas * f, 3, 1) +
    dec(n.gorduras * f, 3, 1) +
    dec(n.saturadas * f, 3, 1) +
    dec(0, 3, 1) + // gordura trans
    dec(n.fibras * f, 3, 1) +
    dec(n.sodio * f, 5, 1) +
    '0000';
  const rdc429 =
    '1' + // porções calculadas automaticamente pelo peso
    zeros(0, 3) +
    zeros(n.porcao, 3) +
    '0' +
    zeros(m.qtd, 2) +
    '0' +
    m.codigo +
    zeros(n.kcal, 4) +
    dec(n.carboidratos, 4, 1) +
    dec(n.acucares, 3, 1) +
    dec(0, 3, 1) + // açúcares adicionados
    dec(n.proteinas, 3, 1) +
    dec(n.gorduras, 3, 1) +
    dec(n.saturadas, 3, 1) +
    dec(0, 3, 1) + // trans
    dec(n.fibras, 3, 1) +
    dec(n.sodio, 5, 1) +
    '0' + // alto em açúcar adicionado: o sistema não guarda açúcar adicionado
    (n.saturadas >= 6 ? '1' : '0') +
    (n.sodio >= 600 ? '1' : '0') +
    dec(0, 5, 1) +
    dec(0, 5, 1) +
    '0';
  return antiga + '|' + rdc429;
}

/** Uma linha do FRACIONA.TXT: código(4) + observação(100) + 3 linhas de 56. */
export function linhaFraciona(codigo: number, loja: StoreInfo): string | null {
  const nome = (loja.razaoSocial || loja.nomeFantasia).trim();
  if (!nome) return null;
  const l1 = textoLivre(`FRACIONADO E EMBALADO POR: ${nome}`);
  const l2 = textoLivre([loja.cnpj.trim() && `CNPJ ${loja.cnpj.trim()}`, loja.telefone.trim() && `SAC ${loja.telefone.trim()}`].filter(Boolean).join(' '));
  const l3 = textoLivre(loja.endereco);
  const linhas = quebrarLinhas([l1, l2, l3].filter(Boolean).join(' '), 56);
  return zeros(codigo, 4) + esp(textoLivre(loja.nomeFantasia || nome), 100) + [0, 1, 2].map((i) => esp(linhas[i] ?? '', 56)).join('');
}

export interface CargaCompleta {
  arquivos: { nome: string; texto: string }[];
  produtos: number;
  comNutricao: number;
  comInfo: number;
  /** produtos com texto maior que as 7 linhas que a Wind Mega imprime */
  infoLonga: string[];
  fracionador: boolean;
  fora: { produto: Product; motivo: string }[];
}

const CRLF = (linhas: string[]) => (linhas.length ? linhas.join('\r\n') + '\r\n' : '');

/** Gera todos os arquivos da carga, com os produtos que têm código e preço. */
export function gerarCargaCompleta(produtos: Product[], cfg: ConfigBalanca, loja: StoreInfo): CargaCompleta {
  const itens: string[] = [];
  const nutr: string[] = [];
  const info: string[] = [];
  const fora: CargaCompleta['fora'] = [];
  const infoLonga: string[] = [];
  const fraciona = linhaFraciona(1, loja);
  for (const p of [...produtos].sort((a, b) => (a.plu ?? 0) - (b.plu ?? 0))) {
    if (p.venda == null || p.venda <= 0) continue;
    if (!vaiParaBalanca(p)) {
      fora.push({ produto: p, motivo: 'unidade que a balança não vende' });
      continue;
    }
    if (!p.plu) {
      fora.push({ produto: p, motivo: 'sem código da balança' });
      continue;
    }
    if ((precoBalanca(p) ?? 0) > 999999) {
      fora.push({ produto: p, motivo: 'preço acima de R$ 9.999,99' });
      continue;
    }
    const codigo = p.plu;
    const temNutri = !!p.nutricao && !p.especiariaPura;
    const linhas = linhasInfoExtra(p);
    if (temNutri) nutr.push(linhaInfNutr(codigo, p.nutricao as InfoNutricional));
    if (linhas.length) {
      info.push(linhaTxInfo(codigo, nomeNaBalanca(p), linhas));
      if (linhas.length > 7) infoLonga.push(p.nome);
    }
    itens.push(linhaMgv5(p, cfg, { nutri: temNutri ? codigo : 0, infoExtra: linhas.length ? codigo : 0, fracionador: fraciona ? 1 : 0 }));
  }
  const arquivos = [{ nome: 'ITENSMGV.TXT', texto: CRLF(itens) }];
  if (nutr.length) arquivos.push({ nome: 'INFNUTR.TXT', texto: CRLF(nutr) });
  if (info.length) arquivos.push({ nome: 'TXINFO.TXT', texto: CRLF(info) });
  if (fraciona && itens.length) arquivos.push({ nome: 'FRACIONA.TXT', texto: CRLF([fraciona]) });
  return { arquivos, produtos: itens.length, comNutricao: nutr.length, comInfo: info.length, infoLonga, fracionador: !!fraciona, fora };
}

// ---------- ZIP simples (sem compressão), para baixar tudo de uma vez ----------

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = TABELA_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Monta um .zip "armazenado" (método 0) com os arquivos de texto ASCII. */
export function montarZip(arquivos: { nome: string; texto: string }[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let pos = 0;
  for (const a of arquivos) {
    const nome = enc.encode(a.nome);
    const dados = enc.encode(a.texto);
    const crc = crc32(dados);
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true);
    loc.setUint16(4, 10, true);
    loc.setUint16(8, 0, true);
    loc.setUint32(14, crc, true);
    loc.setUint32(18, dados.length, true);
    loc.setUint32(22, dados.length, true);
    loc.setUint16(26, nome.length, true);
    partes.push(new Uint8Array(loc.buffer), nome, dados);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 10, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, dados.length, true);
    cen.setUint32(24, dados.length, true);
    cen.setUint16(28, nome.length, true);
    cen.setUint32(42, pos, true);
    central.push(new Uint8Array(cen.buffer), nome);
    pos += 30 + nome.length + dados.length;
  }
  const tamCentral = central.reduce((s, b) => s + b.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, pos, true);
  const todas = [...partes, ...central, new Uint8Array(fim.buffer)];
  const out = new Uint8Array(new ArrayBuffer(todas.reduce((s, b) => s + b.length, 0)));
  let o = 0;
  for (const b of todas) {
    out.set(b, o);
    o += b.length;
  }
  return out;
}
