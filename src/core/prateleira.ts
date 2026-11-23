/**
 * Ordem da prateleira: a loja põe as categorias e os potes na ordem em que estão na loja,
 * e os códigos da balança seguem essa ordem (de 10 em 10, cada prateleira numa centena nova…).
 */
import type { Prateleira, Product } from '../types';
import { CODIGO_MAX, codigo4, precoBalanca, vaiParaBalanca } from './balanca';
import { familyOf } from './units';
import { formatBRL } from './money';

export const PRATELEIRA_PADRAO: Prateleira = { cats: [], itens: [], inicio: 10, passo: 10, centena: true };
export const SEM_CATEGORIA = 'Outros';

const num = (v: unknown, d: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(Math.round(v), min), max) : d);
const textos = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 120).slice(0, max) : []);

export function prateleiraDe(raw: unknown): Prateleira {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const p: Prateleira = {
    cats: [...new Set(textos(r.cats, 200))],
    itens: [...new Set(textos(r.itens, 5000))],
    inicio: num(r.inicio, PRATELEIRA_PADRAO.inicio, 1, CODIGO_MAX),
    passo: num(r.passo, PRATELEIRA_PADRAO.passo, 1, 100),
    centena: r.centena !== false,
  };
  if (Array.isArray(r.antes)) {
    const antes = r.antes.flatMap((x): [string, number | null][] =>
      Array.isArray(x) && typeof x[0] === 'string' && (x[1] === null || (typeof x[1] === 'number' && x[1] > 0 && x[1] <= CODIGO_MAX)) ? [[x[0], x[1] as number | null]] : [],
    );
    if (antes.length) p.antes = antes;
  }
  return p;
}

export interface GrupoPrateleira {
  cat: string;
  itens: Product[];
}

/** Produtos da balança agrupados por prateleira, na ordem escolhida (o que não foi arrumado vai no fim, em ordem alfabética). */
export function gruposPrateleira(produtos: Product[], categorias: string[], p: Prateleira): GrupoPrateleira[] {
  const daBalanca = produtos.filter(vaiParaBalanca);
  const catDe = (x: Product) => (x.categoria?.trim() ? x.categoria.trim() : SEM_CATEGORIA);
  const existentes = new Set(daBalanca.map(catDe));
  const ordemCats = [...p.cats, ...categorias, ...[...existentes].sort((a, b) => a.localeCompare(b, 'pt-BR'))].filter((c, i, a) => existentes.has(c) && a.indexOf(c) === i);
  const pos = new Map(p.itens.map((id, i) => [id, i]));
  return ordemCats.map((cat) => ({
    cat,
    itens: daBalanca
      .filter((x) => catDe(x) === cat)
      .sort((a, b) => {
        const pa = pos.get(a.id) ?? Infinity;
        const pb = pos.get(b.id) ?? Infinity;
        return pa !== pb ? pa - pb : a.nome.localeCompare(b.nome, 'pt-BR');
      }),
  }));
}

/** Grava a ordem atual (categorias e potes) de volta na configuração. */
export function ordemDosGrupos(grupos: GrupoPrateleira[], p: Prateleira): Prateleira {
  return { ...p, cats: grupos.map((g) => g.cat), itens: grupos.flatMap((g) => g.itens.map((x) => x.id)) };
}

/** Move um elemento de uma lista para outra posição. */
export function mover<T>(lista: T[], de: number, para: number): T[] {
  if (de === para || de < 0 || de >= lista.length) return lista;
  const n = [...lista];
  const [x] = n.splice(de, 1);
  n.splice(Math.max(0, Math.min(para, n.length)), 0, x);
  return n;
}

/**
 * Códigos novos na ordem da prateleira. Com `centena`, cada prateleira começa numa centena nova
 * (1ª em 0100, 2ª em 0200…; se uma prateleira passar dos 100, a seguinte vai para a próxima centena livre).
 */
export function numerarPrateleira(grupos: GrupoPrateleira[], p: Prateleira): { codigos: Map<string, number>; erro: string | null } {
  const codigos = new Map<string, number>();
  let atual = p.inicio;
  grupos.forEach((g, i) => {
    if (p.centena) {
      const proxCentena = Math.ceil(atual / 100) * 100;
      atual = i === 0 ? Math.max(100, Math.ceil(p.inicio / 100) * 100) : Math.max(proxCentena, (i + 1) * 100);
    }
    for (const x of g.itens) {
      codigos.set(x.id, atual);
      atual += p.passo;
    }
  });
  const maior = Math.max(0, ...codigos.values());
  return { codigos, erro: maior > CODIGO_MAX ? `Os códigos passariam de ${CODIGO_MAX}. Use um passo menor ou desligue a centena por prateleira.` : null };
}

export interface MudancaCodigo {
  produto: Product;
  cat: string;
  antes: number | null;
  depois: number;
}

export function previaNumeracao(grupos: GrupoPrateleira[], codigos: Map<string, number>): MudancaCodigo[] {
  return grupos.flatMap((g) => g.itens.map((x) => ({ produto: x, cat: g.cat, antes: x.plu ?? null, depois: codigos.get(x.id) as number })));
}

/** Aplica os códigos novos e guarda os de antes para poder desfazer. */
export function aplicarNumeracao(produtos: Product[], codigos: Map<string, number>, p: Prateleira): { produtos: Product[]; prateleira: Prateleira } {
  const antes: [string, number | null][] = produtos.filter((x) => codigos.has(x.id)).map((x) => [x.id, x.plu ?? null]);
  // quem não está na ordem (ex.: sem preço) e tem um código que agora é de outro perde o código
  const novos = new Set(codigos.values());
  return {
    produtos: produtos.map((x) => (codigos.has(x.id) ? { ...x, plu: codigos.get(x.id) as number } : x.plu && novos.has(x.plu) ? { ...x, plu: null } : x)),
    prateleira: { ...p, antes },
  };
}

export function desfazerNumeracao(produtos: Product[], p: Prateleira): { produtos: Product[]; prateleira: Prateleira } {
  const antes = new Map(p.antes ?? []);
  const { antes: _feito, ...resto } = p;
  return { produtos: produtos.map((x) => (antes.has(x.id) ? { ...x, plu: antes.get(x.id) ?? null } : x)), prateleira: resto };
}

/** Próximo código para um produto novo: depois do maior código da prateleira dele, se estiver livre. */
export function codigoNovoNaPrateleira(x: Product, grupos: GrupoPrateleira[], p: Prateleira, usados: Set<number>): number | null {
  const g = grupos.find((gr) => gr.itens.some((i) => i.id === x.id));
  const maior = Math.max(0, ...(g?.itens.map((i) => i.plu ?? 0) ?? [0]));
  if (maior > 0) {
    const limite = p.centena ? (Math.floor(maior / 100) + 1) * 100 : CODIGO_MAX + 1;
    for (let c = maior + p.passo; c < limite && c <= CODIGO_MAX; c += p.passo) if (!usados.has(c)) return c;
  }
  for (let c = 1; c <= CODIGO_MAX; c++) if (!usados.has(c)) return c;
  return null;
}

// ---------- lista de códigos (relatório e WhatsApp) ----------

export interface LinhaCodigo {
  codigo: number;
  nome: string;
  nomeBalanca: string;
  preco: number;
  porKg: boolean;
}
export interface SecaoCodigos {
  cat: string;
  linhas: LinhaCodigo[];
}

/** Só produtos com código, na ordem da prateleira (ou das categorias); dentro de cada uma, pelo código. */
export function listaCodigos(grupos: GrupoPrateleira[], marcados?: Set<string>): SecaoCodigos[] {
  return grupos
    .map((g) => ({
      cat: g.cat,
      linhas: g.itens
        .filter((x) => x.plu && (!marcados || marcados.has(x.id)))
        .map((x) => ({ codigo: x.plu as number, nome: x.nome.trim(), nomeBalanca: (x.nomeBalanca || x.nome).trim(), preco: precoBalanca(x) ?? 0, porKg: familyOf(x.unidade) === 'massa' }))
        .sort((a, b) => a.codigo - b.codigo),
    }))
    .filter((s) => s.linhas.length);
}

/** Texto para mandar no WhatsApp da loja e conferir rápido. */
export function textoCodigos(secoes: SecaoCodigos[], loja: string, comPreco: boolean, porPrateleira: boolean, data = new Date()): string {
  const d = data.toLocaleDateString('pt-BR');
  const total = secoes.reduce((a, s) => a + s.linhas.length, 0);
  const linhas = [`*${loja ? loja + ' · ' : ''}Códigos da balança*`, `${d} · ${total} produto${total === 1 ? '' : 's'}`];
  const fmt = (l: LinhaCodigo) => `${codigo4(l.codigo)}  ${l.nome}${comPreco ? ` · ${formatBRL(l.preco)}${l.porKg ? '/kg' : '/un'}` : ''}`;
  if (porPrateleira) {
    secoes.forEach((s, i) => {
      linhas.push('', `*${i + 1} · ${s.cat}*`);
      s.linhas.forEach((l) => linhas.push(fmt(l)));
    });
  } else {
    linhas.push('');
    secoes
      .flatMap((s) => s.linhas)
      .sort((a, b) => a.codigo - b.codigo)
      .forEach((l) => linhas.push(fmt(l)));
  }
  return linhas.join('\n');
}
