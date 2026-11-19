import { newId } from './normalize';
import { normalizeUnit } from './units';
import type { LoteItem } from '../types';

/** O que dá para ler de uma nota de compra (XML da NF-e ou texto copiado do PDF). */
export interface NotaLida {
  fornecedor: string;
  numero: string;
  /** AAAA-MM-DD ou '' */
  data: string;
  frete: number;
  /** desconto que não está dentro dos itens */
  desconto: number;
  outras: number;
  itens: LoteItem[];
  avisos: string[];
}

export type ResultadoNota = ({ ok: true } & NotaLida) | { ok: false; motivo: string };

const cents = (n: number) => Math.round(n * 100);
const brNum = (s: string): number => Number(s.replace(/\./g, '').replace(',', '.'));

const ENTIDADES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" };
const decodificar = (t: string) => t.replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENTIDADES[m] ?? m).trim();

/** Nome da nota em "Título": ACAFRAO EM PO PURO -> Acafrao em po puro (a pessoa corrige se quiser). */
function capitalizar(t: string): string {
  const s = t
    .replace(/[-–]?\s*\*+\s*oferta\b/gi, '') // "- ***oferta" do fornecedor
    .replace(/\s+kg$/i, '') // "CHA VERDE BANCHA kg"
    .trim()
    .replace(/\s+/g, ' ');
  const letras = s.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const maiusculas = letras.replace(/[^A-ZÀ-Þ]/g, '').length;
  if (letras.length === 0 || maiusculas / letras.length < 0.7) return s;
  const baixo = s.toLowerCase();
  return baixo.charAt(0).toUpperCase() + baixo.slice(1);
}

/** Unidade da nota -> unidade do sistema. "UN" é tratado como kg (pedido do dono da loja) e avisado. */
function unidadeDaNota(u: string): { unidade: string; ajustada: boolean } {
  const n = normalizeUnit(u) ?? 'kg';
  if (n === 'un') return { unidade: 'kg', ajustada: true };
  return { unidade: n, ajustada: false };
}

function finalizar(base: Omit<NotaLida, 'avisos'>, ajustados: number, extras: string[] = []): ResultadoNota {
  if (base.itens.length === 0) return { ok: false, motivo: 'Não encontrei nenhum item nesta nota.' };
  const avisos = [...extras];
  if (ajustados > 0) avisos.push(`${ajustados} item(ns) vieram como "UN" e foram tratados como kg. Confira a unidade na tabela.`);
  return { ok: true, ...base, avisos };
}

// ---------- XML da NF-e ----------

function bloco(xml: string, nome: string): string | null {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`));
  return m ? m[1] : null;
}
const campo = (xml: string | null, nome: string): string => (xml ? decodificar(bloco(xml, nome) ?? '') : '');

/** Lê o arquivo XML de uma NF-e. Não usa nenhuma biblioteca: o navegador só precisa do texto. */
export function lerNFeXml(xml: string): ResultadoNota {
  if (!/<(?:\w+:)?infNFe[\s>]/.test(xml)) return { ok: false, motivo: 'Este arquivo não parece ser o XML de uma NF-e.' };
  const itens: LoteItem[] = [];
  let ajustados = 0;
  const re = /<(?:\w+:)?det\b[^>]*>([\s\S]*?)<\/(?:\w+:)?det>/g;
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    const prod = bloco(m[1], 'prod');
    if (!prod) continue;
    const u = unidadeDaNota(campo(prod, 'uCom'));
    if (u.ajustada) ajustados++;
    itens.push({
      id: newId(),
      nome: capitalizar(decodificar(campo(prod, 'xProd'))),
      produtoId: null,
      categoria: '',
      ncm: campo(prod, 'NCM'),
      unidade: u.unidade,
      qtd: Number(campo(prod, 'qCom')) || 0,
      valor: cents(Number(campo(prod, 'vProd')) || 0),
      desconto: cents(Number(campo(prod, 'vDesc')) || 0),
    });
  }
  const tot = bloco(xml, 'ICMSTot');
  const descTotal = cents(Number(campo(tot, 'vDesc')) || 0);
  const descItens = itens.reduce((a, i) => a + i.desconto, 0);
  const ide = bloco(xml, 'ide');
  const emit = bloco(xml, 'emit');
  const data = (campo(ide, 'dhEmi') || campo(ide, 'dEmi')).slice(0, 10);
  return finalizar(
    {
      fornecedor: campo(emit, 'xNome'),
      numero: campo(ide, 'nNF'),
      data: /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : '',
      frete: cents(Number(campo(tot, 'vFrete')) || 0),
      desconto: Math.max(0, descTotal - descItens),
      // impostos que entram no custo de quem compra: IPI, ICMS-ST e FCP-ST, além de seguro e outras despesas
      outras: cents(['vOutro', 'vSeg', 'vIPI', 'vST', 'vFCPST'].reduce((a, k) => a + (Number(campo(tot, k)) || 0), 0)),
      itens,
    },
    ajustados,
  );
}

// ---------- texto copiado do PDF (DANFE) ----------

// CST (0/00) ou CSOSN do Simples Nacional (0/102, 102)
const LINHA_ITEM = /(\d{8})\s+(\d{1,2}\/?\d{2,3})\s+(\d{4})\s+([A-Za-z]{1,4})\s+([\d.]*\d,\d{1,4})\s+([\d.]*\d,\d{2,4})\s+([\d.]*\d,\d{2})\s+([\d.]*\d,\d{2})/g;

/** Tira do começo os códigos do produto (números, barras e códigos com dígitos) e deixa só o nome. */
function nomeSemCodigos(trecho: string): string {
  const t = trecho.replace(/\s+/g, ' ').trim().split(' ');
  while (t.length > 1 && (/\d/.test(t[0]) || /^[/\-]$/.test(t[0]))) t.shift();
  return t.join(' ');
}

// rótulos do quadro "Cálculo do imposto" do DANFE (os mais longos primeiro, para "VALOR DO ICMS SUBST." não virar "VALOR DO ICMS")
const ROTULOS_TOTAIS: [string, RegExp][] = [
  ['bcIcmsSt', /BASE DE C[ÁA]LC\.? (?:DO )?ICMS S\.?T\.?/i],
  ['bcIcms', /BASE DE C[ÁA]LC\.? DO ICMS/i],
  ['icmsSt', /VALOR DO ICMS SUBST\.?/i],
  ['icms', /VALOR DO ICMS/i],
  ['importacao', /V\.? IMP\.? IMPORTA[ÇC][ÃA]O/i],
  ['pis', /VALOR DO PIS/i],
  ['totalProdutos', /V(?:\.|ALOR)? TOTAL (?:DOS )?PRODUTOS/i],
  ['frete', /VALOR DO FRETE/i],
  ['seguro', /VALOR DO SEGURO/i],
  ['desconto', /DESCONTO/i],
  ['outras', /OUTRAS DESPESAS/i],
  ['ipi', /VALOR TOTAL (?:DO )?IPI/i],
  ['cofins', /VALOR DA COFINS/i],
  ['totalNota', /V(?:\.|ALOR)? TOTAL DA NOTA/i],
];

/**
 * No PDF o quadro de totais vem como tabela: uma linha com vários rótulos e, na linha de baixo, os valores na mesma ordem.
 * Casa cada rótulo com o valor da mesma posição (só quando a quantidade de rótulos e de valores é igual).
 */
export function totaisEmTabela(texto: string): Record<string, number> {
  const out: Record<string, number> = {};
  const linhas = texto.replace(/\r/g, '').split('\n');
  for (let i = 0; i + 1 < linhas.length; i++) {
    let resto = linhas[i];
    const achados: { k: string; pos: number }[] = [];
    for (const [k, re] of ROTULOS_TOTAIS) {
      const m = resto.match(re);
      if (!m || m.index == null) continue;
      achados.push({ k, pos: m.index });
      resto = resto.slice(0, m.index) + ' '.repeat(m[0].length) + resto.slice(m.index + m[0].length); // não casa duas vezes
    }
    if (achados.length < 2) continue;
    const valores = linhas[i + 1].trim().split(/\s+/);
    if (valores.length !== achados.length || !valores.every((v) => /^[\d.]*\d,\d{2}$/.test(v))) continue;
    achados.sort((a, b) => a.pos - b.pos).forEach((a, j) => {
      if (!(a.k in out)) out[a.k] = brNum(valores[j]);
    });
  }
  return out;
}

function numeroDepois(texto: string, rotulo: RegExp): number {
  const m = texto.match(new RegExp(rotulo.source + '\\s*:?\\s*([\\d.]*\\d,\\d{2})', rotulo.flags));
  return m ? brNum(m[1]) : 0;
}

/**
 * Lê o texto selecionado e copiado de um PDF de DANFE. É um "melhor esforço": a pessoa confere tudo na tabela.
 * Procura pelas linhas de produto (NCM, CST, CFOP, unidade, quantidade, valor unitário, valor total, desconto).
 */
export function lerTextoNota(texto: string): ResultadoNota {
  const t = texto.replace(/\r/g, '').replace(/[ \t]+/g, ' ');
  const plano = t.replace(/\s+/g, ' ');
  const itens: LoteItem[] = [];
  let ajustados = 0;
  let cursor = 0;
  // só existe coluna de desconto quando o cabeçalho tem "DESC" (VALOR DESC / V. DESC); senão o 8º número é a base do ICMS
  // a coluna "VALOR DESC" pode vir quebrada em duas linhas ("VALOR … / … DESC"): basta a palavra DESC sozinha no cabeçalho
  const temDesconto = /(^|\s)DESC(\.|\s|$)/i.test(plano);
  LINHA_ITEM.lastIndex = 0;
  for (let m = LINHA_ITEM.exec(plano); m; m = LINHA_ITEM.exec(plano)) {
    let trecho = plano.slice(cursor, m.index);
    // cabeçalho da tabela (início da nota e início de cada página): o nome vem depois de "ALÍQ. IPI"
    // (no PDF o cabeçalho pode vir quebrado: "…ALÍQ. ALÍQ. … UNIT TOTAL DESC ICMS ICMS IPI ICMS IPI"; cortamos no último IPI/ALÍQ)
    if (/NCM|QUANT|DESCRI[ÇC][ÃA]O DO PRODUTO|AL[ÍI]Q/i.test(trecho)) {
      const cab = [...trecho.matchAll(/\bIPI\b|AL[ÍI]Q\./gi)].pop();
      if (cab && cab.index != null) trecho = trecho.slice(cab.index + cab[0].length);
    }
    cursor = m.index + m[0].length;
    const nome = nomeSemCodigos(trecho);
    if (!nome) continue;
    const u = unidadeDaNota(m[4]);
    if (u.ajustada) ajustados++;
    itens.push({
      id: newId(), nome: capitalizar(nome), produtoId: null, categoria: '', ncm: m[1], unidade: u.unidade,
      qtd: brNum(m[5]), valor: cents(brNum(m[7])), desconto: 0,
    });
    const desc = temDesconto ? cents(brNum(m[8])) : 0;
    const it = itens[itens.length - 1];
    if (desc > 0 && desc < it.valor) it.desconto = desc; // desconto igual ou maior que o item = coluna errada
  }
  const forn = plano.match(/RECEBEMOS DE (.+?) OS PRODUTOS/i);
  const num = plano.match(/N[º°o]\.?\s*([\d.]{3,})/i);
  const dt = plano.match(/EMISS[ÃA]O:?\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  const tab = totaisEmTabela(texto);
  const total = (k: string, re: RegExp) => cents(k in tab ? tab[k] : numeroDepois(plano, re));
  const frete = total('frete', /VALOR DO FRETE/i);
  const seguro = total('seguro', /VALOR DO SEGURO/i);
  const outrasDesp = total('outras', /OUTRAS DESPESAS/i);
  const ipi = total('ipi', /VALOR TOTAL (?:DO )?IPI/i);
  const st = total('icmsSt', /VALOR DO ICMS SUBST\.?/i);
  const descTotal = total('desconto', /\bDESCONTO/i);
  const descItens = itens.reduce((a, i) => a + i.desconto, 0);
  const avisos: string[] = [];
  const totalProdutos = total('totalProdutos', /V\. TOTAL PRODUTOS/i);
  const somaItens = itens.reduce((a, i) => a + i.valor, 0);
  if (totalProdutos && itens.length && Math.abs(totalProdutos - somaItens) > 1) {
    avisos.push('A soma dos itens lidos não bate com o total de produtos da nota. Pode haver item faltando: confira a tabela.');
  }
  return finalizar(
    {
      fornecedor: forn ? forn[1].trim() : '',
      numero: num ? num[1].replace(/\./g, '').replace(/^0+/, '') : '',
      data: dt ? `${dt[3]}-${dt[2]}-${dt[1]}` : '',
      frete,
      desconto: Math.max(0, descTotal - descItens),
      outras: seguro + outrasDesp + ipi + st,
      itens,
    },
    ajustados,
    avisos,
  );
}
