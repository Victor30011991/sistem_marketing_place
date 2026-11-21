import type { ConfigBalanca, InfoNutricional, Product, StoreInfo } from '../types';
import { linhaMgv5, nomeNaBalanca, precoBalanca, vaiParaBalanca } from './balanca';
import { CONSERVACAO_PADRAO } from './etiquetas';

/**
 * Carga completa para balanças no padrão Toledo MGV (UPX Wind Mega, Thunder…):
 * ITENSMGV.TXT (produtos), INFNUTRI.TXT (tabela nutricional RDC 429), TXINFO.TXT (ingredientes, alérgenos, modo de uso
 * e conservação), CAMPEXT1.TXT (contém / não contém glúten) e FRACIONA.TXT (quem fracionou e embalou).
 * Layouts conferidos com os arquivos de exemplo do UPX Wind Mega (pasta importa\Exemplo).
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
  if (p.modoUso?.trim()) blocos.push(`MODO DE USO: ${p.modoUso.trim().replace(/\.$/, '')}.`);
  if (!blocos.length) return [];
  blocos.push(CONSERVACAO_PADRAO);
  return quebrarLinhas(textoLivre(blocos.join(' ')), 56);
}

/** Uma linha do TXINFO.TXT: código(6) + observação(100) + linhas de 56 (até 15), como nos exemplos da Wind Mega. */
export function linhaTxInfo(codigo: number, nome: string, linhas: string[]): string {
  return zeros(codigo, 6) + esp(textoLivre(nome), 100) + linhas.slice(0, 15).map((l) => esp(l, 56)).join('');
}

/** CAMPEXT1.TXT: código(4) + observação(100) + 3 linhas de 56. Código 1 = contém glúten, 2 = não contém. */
export function linhaCampoExtra(codigo: number, texto: string): string {
  return zeros(codigo, 4) + esp('', 100) + esp(textoLivre(texto), 56) + esp('', 112);
}
export const GLUTEN_EXTRA = { contem: 1, 'nao-contem': 2 } as const;

/** Medida caseira estimada pela porção: até 5 g = colheres de chá; acima, colheres de sopa (~10 g cada). */
export function medidaCaseira(porcaoG: number): { qtd: number; codigo: string; texto: string } {
  if (porcaoG <= 5) return { qtd: 1, codigo: '02', texto: '1 colher de chá' };
  const qtd = Math.max(1, Math.min(99, Math.round(porcaoG / 10)));
  return { qtd, codigo: '00', texto: `${qtd} colher${qtd > 1 ? 'es' : ''} de sopa` };
}

/**
 * Uma linha do INFNUTRI.TXT no formato dos exemplos da Wind Mega: "N" + código(6) + 38 zeros (parte antiga, não usada)
 * + "|" + parte RDC 429 com os valores DA PORÇÃO (o sistema guarda por 100 g e converte aqui).
 */
export function linhaInfNutr(codigo: number, n: InfoNutricional): string {
  const f = n.porcao / 100;
  const m = medidaCaseira(n.porcao);
  const rdc429 =
    '1' + // porções calculadas automaticamente pelo peso
    zeros(0, 3) +
    zeros(n.porcao, 3) +
    '0' + // gramas
    zeros(m.qtd, 2) +
    '0' + // sem fração
    m.codigo +
    zeros(n.kcal * f, 4) +
    dec(n.carboidratos * f, 4, 1) +
    dec(n.acucares * f, 3, 1) +
    dec(0, 3, 1) + // açúcares adicionados: o sistema não guarda
    dec(n.proteinas * f, 3, 1) +
    dec(n.gorduras * f, 3, 1) +
    dec(n.saturadas * f, 3, 1) +
    dec(0, 3, 1) + // trans
    dec(n.fibras * f, 3, 1) +
    dec(n.sodio * f, 5, 1) +
    '0' + // alto em açúcar adicionado
    (n.saturadas >= 6 ? '1' : '0') + // alto em gordura saturada (≥ 6 g em 100 g)
    (n.sodio >= 600 ? '1' : '0') + // alto em sódio (≥ 600 mg em 100 g)
    dec(0, 5, 1) +
    dec(0, 5, 1) +
    '0';
  return 'N' + zeros(codigo, 6) + '0'.repeat(38) + '|' + rdc429;
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
  const extras = new Set<number>();
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
    const gl = p.gluten ? GLUTEN_EXTRA[p.gluten] : 0;
    if (gl) extras.add(gl);
    itens.push(linhaMgv5(p, cfg, { nutri: temNutri ? codigo : 0, infoExtra: linhas.length ? codigo : 0, fracionador: fraciona ? 1 : 0, extra1: gl }));
  }
  const arquivos = [{ nome: 'ITENSMGV.TXT', texto: CRLF(itens) }];
  if (nutr.length) arquivos.push({ nome: 'INFNUTRI.TXT', texto: CRLF(nutr) });
  if (info.length) arquivos.push({ nome: 'TXINFO.TXT', texto: CRLF(info) });
  if (extras.size) arquivos.push({ nome: 'CAMPEXT1.TXT', texto: CRLF([...extras].sort().map((c) => linhaCampoExtra(c, c === 1 ? 'CONTEM GLUTEN' : 'NAO CONTEM GLUTEN'))) });
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
