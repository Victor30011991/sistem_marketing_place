import type { ConfigBalanca, Product } from '../types';
import { familyOf, convertQty } from './units';
import { norm } from './normalize';

export const BALANCA_PADRAO: ConfigBalanca = { etiqueta: 'codigo6-valor5', validadeDias: 0, setor: 1 };

export const FORMATOS_ETIQUETA: { id: ConfigBalanca['etiqueta']; rotulo: string; exemplo: string }[] = [
  { id: 'codigo6-valor5', rotulo: 'Código (6) + valor total (5)', exemplo: '2 001234 00984 D' },
  { id: 'codigo5-valor6', rotulo: 'Código (5) + valor total (6)', exemplo: '2 01234 000984 D' },
  { id: 'codigo6-peso5', rotulo: 'Código (6) + peso em gramas (5)', exemplo: '2 001234 00500 D' },
  { id: 'codigo5-peso6', rotulo: 'Código (5) + peso em gramas (6)', exemplo: '2 01234 000500 D' },
];

export function balancaDe(raw: unknown): ConfigBalanca {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof ConfigBalanca, unknown>>;
  const fmt = FORMATOS_ETIQUETA.some((f) => f.id === r.etiqueta) ? (r.etiqueta as ConfigBalanca['etiqueta']) : BALANCA_PADRAO.etiqueta;
  const int = (v: unknown, d: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), max) : d);
  return { etiqueta: fmt, validadeDias: int(r.validadeDias, 0, 999), setor: int(r.setor, 1, 99) || 1 };
}

/** Produto que a balança consegue vender: tem preço e é por peso (kg/g) ou por unidade. */
export function vaiParaBalanca(p: Product): boolean {
  return p.venda != null && p.venda > 0 && (familyOf(p.unidade) === 'massa' || familyOf(p.unidade) === 'contagem');
}

/** Dá um código de balança (PLU) a quem ainda não tem, sem nunca mudar os que já existem. */
export function atribuirPlus(produtos: Product[]): { produtos: Product[]; novos: number } {
  const usados = new Set(produtos.map((p) => p.plu).filter((x): x is number => typeof x === 'number' && x > 0));
  let prox = 1;
  let novos = 0;
  const out = produtos.map((p) => {
    if ((p.plu && p.plu > 0) || !vaiParaBalanca(p)) return p;
    while (usados.has(prox)) prox++;
    usados.add(prox);
    novos++;
    return { ...p, plu: prox };
  });
  return { produtos: out, novos };
}

/** Texto que a balança imprime: maiúsculas, sem acento e só caracteres simples (as balanças não têm acentos). */
export function textoBalanca(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 .,%/()+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Descrição em duas linhas de 25 caracteres, quebrando entre palavras. */
export function duasLinhas(nome: string): [string, string] {
  const t = textoBalanca(nome);
  if (t.length <= 25) return [t, ''];
  let corte = t.lastIndexOf(' ', 25);
  if (corte < 10) corte = 25;
  return [t.slice(0, corte).trim().slice(0, 25), t.slice(corte).trim().slice(0, 25)];
}

const zeros = (n: number, tam: number) => String(Math.max(0, Math.trunc(n))).padStart(tam, '0').slice(-tam);
const esp = (t: string, tam: number) => t.padEnd(tam, ' ').slice(0, tam);

/** Preço que vai para a balança: por kg (produto em kg ou g) ou por unidade. */
export function precoBalanca(p: Product): number | null {
  if (p.venda == null) return null;
  if (familyOf(p.unidade) === 'massa') {
    const q = convertQty(1, 'kg', p.unidade);
    return q ? Math.round(q.times(p.venda).toNumber()) : null;
  }
  return p.venda;
}

/**
 * Uma linha do ITENSMGV.TXT no layout Toledo MGV5 (o mesmo do ACBr, "Versão 2"), que o UPX Thunder importa.
 * 150 caracteres: setor(2) tipo(1) código(6) preço(6) validade(3) descrição(25+25) info extra(6) imagem(4) nutricional(6)
 * imprime validade(1) imprime embalagem(1) fornecedor(4) lote(12) código especial(11) versão do preço(1) som(4) tara(4)
 * fracionador(4) extra 1(4) extra 2(4) conservação(4) EAN-13 do fornecedor(12).
 */
export function linhaMgv5(p: Product, cfg: ConfigBalanca): string {
  const tipo = familyOf(p.unidade) === 'massa' ? '0' : '1';
  const [d1, d2] = duasLinhas(p.nome);
  return [
    zeros(cfg.setor, 2),
    tipo,
    zeros(p.plu ?? 0, 6),
    zeros(precoBalanca(p) ?? 0, 6),
    zeros(cfg.validadeDias, 3),
    esp(d1, 25) + esp(d2, 25),
    zeros(0, 6),
    zeros(0, 4),
    zeros(0, 6),
    cfg.validadeDias > 0 ? '1' : '0',
    '1',
    zeros(0, 4),
    zeros(0, 12),
    zeros(0, 11),
    '0',
    zeros(0, 4),
    zeros(0, 4),
    zeros(0, 4),
    zeros(0, 4),
    zeros(0, 4),
    zeros(0, 4),
    zeros(0, 12),
  ].join('');
}

export interface ArquivoBalanca {
  texto: string;
  incluidos: number;
  fora: { produto: Product; motivo: string }[];
}

/** Gera o ITENSMGV.TXT (uma linha por produto, fim de linha CRLF, só caracteres ASCII). */
export function gerarItensMgv(produtos: Product[], cfg: ConfigBalanca): ArquivoBalanca {
  const fora: ArquivoBalanca['fora'] = [];
  const linhas: string[] = [];
  for (const p of [...produtos].sort((a, b) => (a.plu ?? 0) - (b.plu ?? 0))) {
    if (p.venda == null || p.venda <= 0) fora.push({ produto: p, motivo: 'sem preço de venda' });
    else if (!vaiParaBalanca(p)) fora.push({ produto: p, motivo: 'unidade que a balança não vende' });
    else if (!p.plu) fora.push({ produto: p, motivo: 'sem código da balança' });
    else if ((precoBalanca(p) ?? 0) > 999999) fora.push({ produto: p, motivo: 'preço acima de R$ 9.999,99' });
    else linhas.push(linhaMgv5(p, cfg));
  }
  return { texto: linhas.length ? linhas.join('\r\n') + '\r\n' : '', incluidos: linhas.length, fora };
}

// ---------- leitura da etiqueta no PDV ----------

/** Dígito verificador EAN-13 dos 12 primeiros dígitos. */
export function digitoEan13(doze: string): number {
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(doze[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (s % 10)) % 10;
}

export type LeituraEtiqueta =
  | { ok: true; produto: Product; plu: number; valor?: number; gramas?: number }
  | { ok: false; motivo: string };

/** Lê o código de barras de uma etiqueta da balança e acha o produto pelo código (PLU). */
export function lerEtiquetaBalanca(codigo: string, cfg: ConfigBalanca, produtos: Product[]): LeituraEtiqueta {
  const d = codigo.replace(/\D/g, '');
  if (d.length !== 13) return { ok: false, motivo: 'O código de barras da balança tem 13 números.' };
  if (d[0] !== '2') return { ok: false, motivo: 'Este código não é de etiqueta de balança (deveria começar com 2).' };
  if (digitoEan13(d.slice(0, 12)) !== Number(d[12])) return { ok: false, motivo: 'Leitura com erro (dígito verificador não confere). Passe a etiqueta de novo.' };
  const tamCod = cfg.etiqueta.startsWith('codigo6') ? 6 : 5;
  const plu = Number(d.slice(1, 1 + tamCod));
  const num = Number(d.slice(1 + tamCod, 12));
  const produto = produtos.find((p) => p.plu === plu);
  if (!produto) return { ok: false, motivo: `Nenhum produto com o código de balança ${plu}. Confira em Balança.` };
  return cfg.etiqueta.endsWith('valor5') || cfg.etiqueta.endsWith('valor6') ? { ok: true, produto, plu, valor: num } : { ok: true, produto, plu, gramas: num };
}

/** Busca rápida pelo nome, para a tela da balança. */
export const casa = (p: Product, q: string) => !q || norm(p.nome).includes(norm(q)) || String(p.plu ?? '') === q.trim();
