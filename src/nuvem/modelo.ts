/**
 * Como o sistema fica guardado na nuvem (Firestore) e como saber o que gravar.
 * Tudo aqui é puro (sem Firebase) para poder ser testado.
 *
 *   lojas/temperei                 nome da lista, categorias, ordem dos produtos e configurações
 *   lojas/temperei/meta/loja       dados da loja (nome, logo, cores, página da loja)
 *   lojas/temperei/produtos/{id}   um documento por produto (estoque gravado por incremento)
 *   lojas/temperei/vendasDia/{dia} as vendas de um dia, num mapa por id (duas pessoas vendendo não se atrapalham)
 *   lojas/temperei/lotes/{id}      um documento por lote de compra
 *   lojas/temperei/{coleção}/{id}  orçamentos, clientes… um documento por item (veja COLECOES)
 *   publico/cardapio               o cardápio que o cliente vê (sem custos)
 */
import type { ListState, Lote, Product, Settings, StoreInfo, Venda } from '../types';
import { diaLocal } from '../core/vendas';

export const LOJA_ID = 'temperei';

/** Listas do sistema que ficam um documento por item na nuvem (o nome é o mesmo campo em Settings). */
export const COLECOES = ['lotes', 'orcamentos', 'clientes', 'caixas', 'contas', 'fontes', 'imagens'] as const;
export type Colecao = (typeof COLECOES)[number];
export interface ItemColecao {
  id: string;
}
const quandoLote = (l: Lote) => l.aplicadoEm ?? l.data ?? '';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ORDEM: Record<Colecao, (a: any, b: any) => number> = {
  lotes: (a: Lote, b: Lote) => quandoLote(b).localeCompare(quandoLote(a)),
  orcamentos: (a: { numero: number }, b: { numero: number }) => b.numero - a.numero,
  clientes: (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR'),
  caixas: (a: { dia: string }, b: { dia: string }) => b.dia.localeCompare(a.dia),
  contas: (a: { vencimento: string }, b: { vencimento: string }) => a.vencimento.localeCompare(b.vencimento),
  fontes: (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR'),
  imagens: (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id),
};
const colecoesVazias = () => Object.fromEntries(COLECOES.map((c) => [c, new Map()])) as Record<Colecao, Map<string, ItemColecao>>;
export const RAIZ = ['lojas', LOJA_ID];

export interface Raiz {
  nome: string;
  categorias: string[];
  /** ids dos produtos na ordem da lista */
  ordem: string[];
  /** configurações sem as vendas e os lotes (que ficam em documentos próprios) */
  config: Omit<Settings, 'vendas' | Colecao>;
}

/** O retrato da nuvem (ou do sistema, no mesmo formato). */
export interface Nuvem {
  raiz: Raiz | null;
  loja: StoreInfo | null;
  produtos: Map<string, Product>;
  /** dia (AAAA-MM-DD) → vendas daquele dia, por id */
  dias: Map<string, Record<string, Venda>>;
  /** lotes, orçamentos, clientes…: um documento por item */
  col: Record<Colecao, Map<string, ItemColecao>>;
}

export interface Estado {
  lista: ListState;
  loja: StoreInfo;
  config: Settings;
}

/** Marcadores trocados pelo Firebase na hora de gravar. */
export type Valor = unknown;
export const INC = '__inc';
export const DEL = '__del';
export const inc = (n: number) => ({ [INC]: n });
export const del = () => ({ [DEL]: true });

/** Uma gravação: documento inteiro (sem `campos`), só alguns campos (com `campos`) ou exclusão. */
export interface Op {
  caminho: string[];
  dados?: Record<string, Valor>;
  /** caminhos dos campos que são substituídos; o resto do documento fica como está */
  campos?: string[][];
  apagar?: true;
}

export const nuvemVazia = (): Nuvem => ({ raiz: null, loja: null, produtos: new Map(), dias: new Map(), col: colecoesVazias() });

/** Comparação profunda que não liga para a ordem das chaves nem para campos `undefined`. */
export function igual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map && b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !igual(v, b.get(k))) return false;
    return true;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((x, i) => igual(x, bb[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ka = Object.keys(ao).filter((k) => ao[k] !== undefined);
  const kb = Object.keys(bo).filter((k) => bo[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => igual(ao[k], bo[k]));
}

/** Tira `undefined` (o Firestore não guarda) para que o que sai seja igual ao que volta. */
export function limpo<T>(v: T): T {
  if (Array.isArray(v)) return v.map(limpo) as T;
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = limpo(x);
    return o as T;
  }
  return v;
}

const arred = (n: number) => Math.round(n * 1e6) / 1e6;

/** Divide o estado do sistema no formato da nuvem. */
export function dividir(e: Estado): Nuvem {
  const { vendas, ...resto } = e.config;
  const config = stripConfig(e.config);
  void resto;
  const dias = new Map<string, Record<string, Venda>>();
  for (const v of vendas ?? []) {
    const d = diaLocal(v.quando);
    if (!dias.has(d)) dias.set(d, {});
    dias.get(d)![v.id] = limpo(v);
  }
  return {
    raiz: limpo({ nome: e.lista.nome, categorias: e.lista.categorias, ordem: e.lista.produtos.map((p) => p.id), config }),
    loja: limpo(e.loja),
    produtos: new Map(e.lista.produtos.map((p) => [p.id, limpo(p)])),
    dias,
    col: Object.fromEntries(COLECOES.map((c) => [c, new Map(((e.config[c] ?? []) as ItemColecao[]).map((x) => [x.id, limpo(x)]))])) as Nuvem['col'],
  };
}

/** Junta o retrato da nuvem de volta no estado do sistema. `base` dá o que falta (nuvem ainda vazia). */
export function juntar(n: Nuvem, base: Estado): Estado {
  const pos = new Map((n.raiz?.ordem ?? []).map((id, i) => [id, i]));
  const produtos = [...n.produtos.values()]
    .map((p) => (p.estoque != null ? { ...p, estoque: arred(p.estoque) } : p))
    .sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const vendas = [...n.dias.values()].flatMap((d) => Object.values(d)).sort((a, b) => b.quando.localeCompare(a.quando));
  const listas: Partial<Settings> = {};
  for (const c of COLECOES) {
    const arr = [...n.col[c].values()].sort(ORDEM[c]);
    if (arr.length) (listas as Record<string, unknown>)[c] = arr;
  }
  const config = (n.raiz?.config ?? stripConfig(base.config)) as Settings;
  return {
    lista: { nome: n.raiz?.nome ?? base.lista.nome, categorias: n.raiz?.categorias ?? base.lista.categorias, produtos },
    loja: n.loja ?? base.loja,
    config: { ...config, ...(vendas.length ? { vendas } : {}), ...listas },
  };
}

function stripConfig(c: Settings): Raiz['config'] {
  const resto: Record<string, unknown> = { ...c };
  delete resto.vendas;
  for (const k of COLECOES) delete resto[k];
  return resto as Raiz['config'];
}

const caminho = (...p: string[]) => [...RAIZ, ...p];

/** Diferença de um produto: só os campos que mudaram; estoque como incremento. */
function opProduto(antes: Product | undefined, agora: Product): Op | null {
  if (!antes) return { caminho: caminho('produtos', agora.id), dados: agora as unknown as Record<string, Valor> };
  if (igual(antes, agora)) return null;
  const dados: Record<string, Valor> = {};
  const chaves = new Set([...Object.keys(antes), ...Object.keys(agora)]);
  for (const k of chaves) {
    const a = (antes as unknown as Record<string, unknown>)[k];
    const b = (agora as unknown as Record<string, unknown>)[k];
    if (igual(a, b)) continue;
    if (k === 'estoque' && typeof a === 'number' && typeof b === 'number') dados[k] = inc(arred(b - a));
    else dados[k] = b === undefined ? del() : b;
  }
  return { caminho: caminho('produtos', agora.id), dados, campos: Object.keys(dados).map((k) => [k]) };
}

/** O que gravar para a nuvem passar de `antes` para `agora`. */
export function planejarEscritas(antes: Nuvem, agora: Nuvem): Op[] {
  const ops: Op[] = [];

  if (agora.raiz && !igual(antes.raiz, agora.raiz)) {
    if (!antes.raiz) ops.push({ caminho: [...RAIZ], dados: agora.raiz as unknown as Record<string, Valor> });
    else {
      const dados: Record<string, Valor> = {};
      for (const k of ['nome', 'categorias', 'ordem', 'config'] as const) if (!igual(antes.raiz[k], agora.raiz[k])) dados[k] = agora.raiz[k];
      ops.push({ caminho: [...RAIZ], dados, campos: Object.keys(dados).map((k) => [k]) });
    }
  }
  if (agora.loja && !igual(antes.loja, agora.loja)) ops.push({ caminho: caminho('meta', 'loja'), dados: agora.loja as unknown as Record<string, Valor> });

  for (const p of agora.produtos.values()) {
    const op = opProduto(antes.produtos.get(p.id), p);
    if (op) ops.push(op);
  }
  for (const id of antes.produtos.keys()) if (!agora.produtos.has(id)) ops.push({ caminho: caminho('produtos', id), apagar: true });

  const dias = new Set([...antes.dias.keys(), ...agora.dias.keys()]);
  for (const d of [...dias].sort()) {
    const a = antes.dias.get(d) ?? {};
    const b = agora.dias.get(d) ?? {};
    const mapa: Record<string, Valor> = {};
    for (const [id, v] of Object.entries(b)) if (!igual(a[id], v)) mapa[id] = v;
    for (const id of Object.keys(a)) if (!(id in b)) mapa[id] = del();
    const ids = Object.keys(mapa);
    if (ids.length) ops.push({ caminho: caminho('vendasDia', d), dados: { dia: d, v: mapa }, campos: [['dia'], ...ids.map((id) => ['v', id])] });
  }

  for (const c of COLECOES) {
    const a = antes.col[c];
    const b = agora.col[c];
    for (const x of b.values()) if (!igual(a.get(x.id), x)) ops.push({ caminho: caminho(c, x.id), dados: x as unknown as Record<string, Valor> });
    for (const id of a.keys()) if (!b.has(id)) ops.push({ caminho: caminho(c, id), apagar: true });
  }

  return ops;
}

/** Aplica as gravações num retrato (o que a nuvem terá depois delas). Usado para seguir em frente sem esperar a resposta. */
export function aplicarOps(n: Nuvem, ops: Op[]): Nuvem {
  const r: Nuvem = { raiz: n.raiz, loja: n.loja, produtos: new Map(n.produtos), dias: new Map(n.dias), col: Object.fromEntries(COLECOES.map((c) => [c, new Map(n.col[c])])) as Nuvem['col'] };
  const val = (atual: unknown, novo: unknown) => {
    if (novo && typeof novo === 'object' && INC in novo) return arred(((typeof atual === 'number' ? atual : 0) as number) + (novo as Record<string, number>)[INC]);
    if (novo && typeof novo === 'object' && DEL in novo) return undefined;
    return novo;
  };
  for (const op of ops) {
    const [, , col, id] = op.caminho;
    if (op.caminho.length === 2) {
      r.raiz = (op.campos ? { ...r.raiz, ...op.dados } : op.dados) as unknown as Raiz;
    } else if (col === 'meta') {
      r.loja = op.dados as unknown as StoreInfo;
    } else if (col === 'produtos') {
      if (op.apagar) r.produtos.delete(id);
      else {
        const atual = (op.campos ? { ...r.produtos.get(id) } : {}) as Record<string, unknown>;
        for (const [k, v] of Object.entries(op.dados!)) atual[k] = val(atual[k], v);
        r.produtos.set(id, limpo(atual) as unknown as Product);
      }
    } else if (col === 'vendasDia') {
      const dia = { ...(r.dias.get(id) ?? {}) };
      for (const [vid, v] of Object.entries((op.dados!.v ?? {}) as Record<string, unknown>)) {
        const x = val(undefined, v);
        if (x === undefined) delete dia[vid];
        else dia[vid] = x as Venda;
      }
      if (Object.keys(dia).length) r.dias.set(id, dia);
      else r.dias.delete(id);
    } else if ((COLECOES as readonly string[]).includes(col)) {
      const m = r.col[col as Colecao];
      if (op.apagar) m.delete(id);
      else m.set(id, op.dados as unknown as ItemColecao);
    }
  }
  return r;
}

/** Dia mais antigo de vendas que o sistema acompanha ao vivo (um ano: ~365 leituras ao abrir, bem dentro do grátis). */
export function inicioJanela(hoje = new Date(), dias = 366): string {
  const d = new Date(hoje);
  d.setDate(d.getDate() - dias);
  return diaLocal(d);
}

/** Separa as gravações em lotes de até 450 (o limite do Firestore é 500). */
export function emLotes<T>(ops: T[], tam = 450): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < ops.length; i += tam) r.push(ops.slice(i, i + tam));
  return r;
}
