/** Relatórios da loja: período, painel, ranking, resultado do mês, estoque e compras. Tudo puro (testável). */
import type { Lote, Product, Settings, Venda } from '../types';
import { diaLocal, qtdNoProduto, resumoVendas, type ResumoVendas } from './vendas';
import { calcularLote } from './lote';
import { suggestedCents } from './pricing';
import { convertQty, familyOf } from './units';
import { norm } from './normalize';

// ---------------------------------------------------------------- período

export interface Periodo {
  /** AAAA-MM-DD, inclusive */
  de: string;
  ate: string;
}
export type Atalho = 'hoje' | '7d' | '30d' | 'mes' | 'mesPassado' | 'ano';

const z = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const data = (s: string) => {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
};
const somaDias = (s: string, n: number) => {
  const d = data(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};

export function periodoDe(a: Atalho, hoje = new Date()): Periodo {
  const h = iso(hoje);
  switch (a) {
    case 'hoje':
      return { de: h, ate: h };
    case '7d':
      return { de: somaDias(h, -6), ate: h };
    case '30d':
      return { de: somaDias(h, -29), ate: h };
    case 'mes':
      return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: h };
    case 'mesPassado':
      return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), ate: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 0)) };
    case 'ano':
      return { de: `${hoje.getFullYear()}-01-01`, ate: h };
  }
}

export function diasNo(p: Periodo): number {
  return Math.round((data(p.ate).getTime() - data(p.de).getTime()) / 86400000) + 1;
}

/** Período para comparar: mês inteiro → mês anterior; mês até hoje → mesmos dias do mês anterior; senão, o mesmo tanto de dias logo antes. */
export function periodoAnterior(p: Periodo): Periodo {
  const d = data(p.de);
  const f = data(p.ate);
  if (d.getDate() === 1 && f.getMonth() === d.getMonth() && f.getFullYear() === d.getFullYear()) {
    const ini = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const ultimo = new Date(d.getFullYear(), d.getMonth(), 0).getDate();
    const dia = mesInteiro(p) ? ultimo : Math.min(f.getDate(), ultimo);
    return { de: iso(ini), ate: iso(new Date(ini.getFullYear(), ini.getMonth(), dia)) };
  }
  return { de: somaDias(p.de, -diasNo(p)), ate: somaDias(p.de, -1) };
}

export function mesInteiro(p: Periodo): boolean {
  const d = data(p.de);
  const f = data(p.ate);
  return d.getDate() === 1 && f.getMonth() === d.getMonth() && f.getFullYear() === d.getFullYear() && somaDias(p.ate, 1).endsWith('-01');
}

export const noPeriodo = (vendas: Venda[], p: Periodo) =>
  vendas.filter((v) => {
    const d = diaLocal(v.quando);
    return d >= p.de && d <= p.ate;
  });

/** Variação em % (null se não dá para comparar). */
export function variacao(agora: number, antes: number): number | null {
  if (!antes) return null;
  return Math.round(((agora - antes) / Math.abs(antes)) * 1000) / 10;
}

// ---------------------------------------------------------------- painel

export interface Painel {
  resumo: ResumoVendas;
  anterior: ResumoVendas;
  porDia: { dia: string; total: number; vendas: number }[];
  /** 0 = domingo; média por dia daquele tipo no período */
  porSemana: { dia: number; media: number; total: number }[];
  porHora: { hora: number; total: number; vendas: number }[];
}

export function painel(vendas: Venda[], p: Periodo): Painel {
  const atual = noPeriodo(vendas, p).filter((v) => !v.cancelada);
  const porDia = new Map<string, { total: number; vendas: number }>();
  for (let i = 0, d = p.de; i < diasNo(p); i++, d = somaDias(d, 1)) porDia.set(d, { total: 0, vendas: 0 });
  const semana = Array.from({ length: 7 }, (_, dia) => ({ dia, total: 0, dias: 0 }));
  for (const d of porDia.keys()) semana[data(d).getDay()].dias++;
  const horas = Array.from({ length: 24 }, (_, hora) => ({ hora, total: 0, vendas: 0 }));
  for (const v of atual) {
    const d = diaLocal(v.quando);
    const x = porDia.get(d);
    if (x) {
      x.total += v.total;
      x.vendas++;
    }
    semana[data(d).getDay()].total += v.total;
    const h = horas[new Date(v.quando).getHours()];
    h.total += v.total;
    h.vendas++;
  }
  return {
    resumo: resumoVendas(noPeriodo(vendas, p)),
    anterior: resumoVendas(noPeriodo(vendas, periodoAnterior(p))),
    porDia: [...porDia].map(([dia, x]) => ({ dia, ...x })),
    porSemana: semana.map((s) => ({ dia: s.dia, total: s.total, media: s.dias ? Math.round(s.total / s.dias) : 0 })),
    porHora: horas,
  };
}

// ---------------------------------------------------------------- ranking

export interface LinhaRanking {
  chave: string;
  nome: string;
  categoria: string;
  total: number;
  custo: number;
  lucro: number;
  /** % do lucro sobre o total */
  margem: number | null;
  /** quantidade vendida: kg para produtos por peso, unidades para os outros */
  qtd: number;
  unidade: string;
  vendas: number;
}

export function ranking(vendas: Venda[], produtos: Product[]): { produtos: LinhaRanking[]; categorias: LinhaRanking[] } {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const prods = new Map<string, LinhaRanking>();
  for (const v of vendas) {
    if (v.cancelada) continue;
    const vistos = new Set<string>();
    for (const i of v.itens) {
      const p = porId.get(i.produtoId);
      const peso = familyOf(i.unidade) === 'massa' || (p && familyOf(p.unidade) === 'massa');
      const x = prods.get(i.produtoId) ?? {
        chave: i.produtoId,
        nome: p?.nome ?? i.nome,
        categoria: p?.categoria || 'Sem categoria',
        total: 0,
        custo: 0,
        lucro: 0,
        margem: null,
        qtd: 0,
        unidade: peso ? 'kg' : p?.unidade ?? i.unidade,
        vendas: 0,
      };
      x.total += i.total;
      x.custo += i.custo ?? 0;
      if (peso) x.qtd += convertQty(i.qtd, i.unidade, 'kg')?.toNumber() ?? 0;
      else x.qtd += p ? qtdNoProduto(p, i.qtd, i.unidade)?.toNumber() ?? i.qtd : i.qtd;
      if (!vistos.has(i.produtoId)) x.vendas++;
      vistos.add(i.produtoId);
      prods.set(i.produtoId, x);
    }
  }
  const fechar = (x: LinhaRanking): LinhaRanking => ({ ...x, lucro: x.total - x.custo, margem: x.total ? Math.round(((x.total - x.custo) / x.total) * 1000) / 10 : null, qtd: Math.round(x.qtd * 1000) / 1000 });
  const lista = [...prods.values()].map(fechar).sort((a, b) => b.total - a.total);
  const cats = new Map<string, LinhaRanking>();
  for (const x of lista) {
    const c = cats.get(x.categoria) ?? { chave: x.categoria, nome: x.categoria, categoria: x.categoria, total: 0, custo: 0, lucro: 0, margem: null, qtd: 0, unidade: 'kg', vendas: 0 };
    c.total += x.total;
    c.custo += x.custo;
    if (x.unidade === 'kg') c.qtd += x.qtd;
    c.vendas += x.vendas;
    cats.set(x.categoria, c);
  }
  return { produtos: lista, categorias: [...cats.values()].map(fechar).sort((a, b) => b.total - a.total) };
}

// ---------------------------------------------------------------- curva ABC

export type ClasseABC = 'A' | 'B' | 'C';
export interface CurvaABC {
  classe: Map<string, ClasseABC>;
  /** pelo que foi medido: lucro (com custo) ou faturado (sem custo cadastrado) */
  base: 'lucro' | 'total';
  resumo: Record<ClasseABC, { produtos: number; valor: number; parte: number }>;
}

/**
 * Curva ABC: A são os produtos que juntos dão ~80% do lucro, B os próximos ~15%, C o resto.
 * Sem custo cadastrado em nada, usa o faturado.
 */
export function curvaABC(linhas: LinhaRanking[]): CurvaABC {
  const base: CurvaABC['base'] = linhas.some((l) => l.custo > 0) ? 'lucro' : 'total';
  const val = (l: LinhaRanking) => Math.max(0, base === 'lucro' ? l.lucro : l.total);
  const ord = [...linhas].sort((a, b) => val(b) - val(a));
  const soma = ord.reduce((a, l) => a + val(l), 0);
  const classe = new Map<string, ClasseABC>();
  const resumo: CurvaABC['resumo'] = { A: { produtos: 0, valor: 0, parte: 0 }, B: { produtos: 0, valor: 0, parte: 0 }, C: { produtos: 0, valor: 0, parte: 0 } };
  let antes = 0;
  for (const l of ord) {
    const v = val(l);
    // a classe vem de onde o produto começa na soma: quem começa antes de 80% é A, antes de 95% é B
    const c: ClasseABC = !soma || v <= 0 ? 'C' : antes / soma < 0.8 ? 'A' : antes / soma < 0.95 ? 'B' : 'C';
    classe.set(l.chave, c);
    resumo[c].produtos++;
    resumo[c].valor += v;
    antes += v;
  }
  for (const k of ['A', 'B', 'C'] as const) resumo[k].parte = soma ? Math.round((resumo[k].valor / soma) * 1000) / 10 : 0;
  return { classe, base, resumo };
}

// ---------------------------------------------------------------- resultado

export interface Resultado {
  faturamento: number;
  custoMercadoria: number;
  taxas: number;
  /** impostos, embalagens e outros custos variáveis cadastrados na precificação */
  variaveis: number;
  /** o que sobra de cada venda para pagar as despesas fixas */
  contribuicao: number;
  despesasFixas: number;
  /** contribuição − despesas fixas */
  lucro: number;
  proLabore: number;
  lucroFinal: number;
  /** % sobre o faturamento */
  margemLiquida: number | null;
  /** faturamento que paga todas as despesas (e o pró-labore) no período */
  pontoEquilibrio: number | null;
  /** quanto falta vender para chegar no ponto de equilíbrio (0 = já chegou) */
  falta: number | null;
  /** fração do mês usada para as despesas fixas (1 = mês inteiro) */
  fracaoMes: number;
}

/** Despesas fixas e pró-labore são mensais: entram proporcionais aos dias (mês inteiro = valor cheio). */
export function fracaoDoMes(p: Periodo): number {
  if (mesInteiro(p)) return 1;
  const d = data(p.de);
  if (d.getDate() === 1 && data(p.ate).getMonth() === d.getMonth()) return 1; // mês corrente: compara com o mês inteiro
  return Math.round((diasNo(p) / 30) * 1000) / 1000;
}

export function resultado(vendas: Venda[], s: Settings, p: Periodo): Resultado {
  const ok = noPeriodo(vendas, p).filter((v) => !v.cancelada);
  const r = resumoVendas(ok);
  let variaveis = 0;
  const unidades = ok.reduce((a, v) => a + v.itens.length, 0);
  for (const c of s.custosVariaveis) {
    if (c.tipo === 'percentual') variaveis += Math.round((r.total * c.valor) / 100);
    else if (c.tipo === 'percentualCusto') variaveis += Math.round((r.custo * c.valor) / 100);
    else variaveis += c.valor * unidades;
  }
  const fracao = fracaoDoMes(p);
  const despesasFixas = Math.round(s.custosFixos.reduce((a, c) => a + c.valor, 0) * fracao);
  const proLabore = Math.round((s.proLabore ?? 0) * fracao);
  const contribuicao = r.total - r.custo - r.taxas - variaveis;
  const lucro = contribuicao - despesasFixas;
  const pct = r.total > 0 ? contribuicao / r.total : null;
  const pe = pct && pct > 0 ? Math.round((despesasFixas + proLabore) / pct) : null;
  return {
    faturamento: r.total,
    custoMercadoria: r.custo,
    taxas: r.taxas,
    variaveis,
    contribuicao,
    despesasFixas,
    lucro,
    proLabore,
    lucroFinal: lucro - proLabore,
    margemLiquida: r.total ? Math.round((lucro / r.total) * 1000) / 10 : null,
    pontoEquilibrio: pe,
    falta: pe == null ? null : Math.max(0, pe - r.total),
    fracaoMes: fracao,
  };
}

// ---------------------------------------------------------------- estoque

export interface LinhaEstoque {
  produto: Product;
  /** custo do que está na prateleira, em centavos */
  valor: number;
  /** vendido nos últimos 30 dias, na unidade do produto */
  vendido30: number;
  /** dias até acabar no ritmo atual (null = sem vendas) */
  diasRestantes: number | null;
  /** dias desde a última venda (null = nunca vendeu no histórico) */
  semVenderHa: number | null;
}

export function estoque(produtos: Product[], vendas: Venda[], hoje = new Date()): { linhas: LinhaEstoque[]; valorTotal: number; acabando: LinhaEstoque[]; parados: LinhaEstoque[]; semCusto: number } {
  const h = iso(hoje);
  const ini30 = somaDias(h, -29);
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const vendido = new Map<string, number>();
  const ultima = new Map<string, string>();
  for (const v of vendas) {
    if (v.cancelada) continue;
    const d = diaLocal(v.quando);
    for (const i of v.itens) {
      if ((ultima.get(i.produtoId) ?? '') < d) ultima.set(i.produtoId, d);
      const p = porId.get(i.produtoId);
      if (!p || d < ini30 || d > h) continue;
      vendido.set(i.produtoId, (vendido.get(i.produtoId) ?? 0) + (qtdNoProduto(p, i.qtd, i.unidade)?.toNumber() ?? 0));
    }
  }
  let semCusto = 0;
  const linhas = produtos
    .filter((p) => p.estoque != null)
    .map((p) => {
      const est = Math.max(0, p.estoque ?? 0);
      if (p.custo == null && est > 0) semCusto++;
      const v30 = Math.round((vendido.get(p.id) ?? 0) * 1000) / 1000;
      const u = ultima.get(p.id);
      return {
        produto: p,
        valor: Math.round(est * (p.custo ?? 0)),
        vendido30: v30,
        diasRestantes: v30 > 0 ? Math.floor(est / (v30 / 30)) : null,
        semVenderHa: u ? diasNo({ de: u, ate: h }) - 1 : null,
      };
    });
  return {
    linhas,
    valorTotal: linhas.reduce((a, l) => a + l.valor, 0),
    acabando: linhas.filter((l) => (l.produto.estoque ?? 0) <= 0 || (l.diasRestantes != null && l.diasRestantes <= 14)).sort((a, b) => (a.diasRestantes ?? -1) - (b.diasRestantes ?? -1)),
    parados: linhas.filter((l) => (l.produto.estoque ?? 0) > 0 && (l.semVenderHa == null || l.semVenderHa >= 30)).sort((a, b) => b.valor - a.valor),
    semCusto,
  };
}

// ---------------------------------------------------------------- compras

export interface Compras {
  total: number;
  lotes: number;
  porFornecedor: { nome: string; total: number; lotes: number }[];
  porMes: { mes: string; total: number }[];
  /** custo por kg/unidade nas duas últimas compras de cada produto */
  precos: { nome: string; unidade: string; antes: number; agora: number; variacao: number | null; data: string }[];
  /** produto vendido abaixo do preço que o sistema sugere com os custos atuais */
  margemBaixa: { produto: Product; venda: number; sugerido: number }[];
}

export function compras(lotes: Lote[], produtos: Product[], s: Settings, p: Periodo): Compras {
  const aplicados = lotes.filter((l) => l.aplicadoEm);
  const doPeriodo = aplicados.filter((l) => l.data >= p.de && l.data <= p.ate);
  const forn = new Map<string, { nome: string; total: number; lotes: number }>();
  const meses = new Map<string, number>();
  let total = 0;
  for (const l of doPeriodo) {
    const t = calcularLote(l).totais.total;
    total += t;
    const nome = l.fornecedor.trim() || 'Sem fornecedor';
    const f = forn.get(norm(nome)) ?? { nome, total: 0, lotes: 0 };
    f.total += t;
    f.lotes++;
    forn.set(norm(nome), f);
    meses.set(l.data.slice(0, 7), (meses.get(l.data.slice(0, 7)) ?? 0) + t);
  }
  // histórico de preço: todas as compras aplicadas, da mais antiga para a mais nova
  const hist = new Map<string, { nome: string; unidade: string; data: string; custo: number }[]>();
  const porId = new Map(produtos.map((x) => [x.id, x]));
  for (const l of [...aplicados].sort((a, b) => a.data.localeCompare(b.data))) {
    const calc = calcularLote(l);
    l.itens.forEach((it, i) => {
      const c = calc.itens[i];
      const custo = c?.custoKg ?? c?.custoUnidade;
      if (custo == null || custo <= 0) return;
      const prod = it.produtoId ? porId.get(it.produtoId) : produtos.find((x) => norm(x.nome) === norm(it.nome));
      const chave = prod?.id ?? norm(it.nome);
      const arr = hist.get(chave) ?? [];
      arr.push({ nome: prod?.nome ?? it.nome, unidade: c.custoKg != null ? 'kg' : it.unidade, data: l.data, custo });
      hist.set(chave, arr);
    });
  }
  const precos = [...hist.values()]
    .filter((a) => a.length >= 2)
    .map((a) => {
      const [x, y] = a.slice(-2);
      return { nome: y.nome, unidade: y.unidade, antes: x.custo, agora: y.custo, variacao: variacao(y.custo, x.custo), data: y.data };
    })
    .sort((a, b) => Math.abs(b.variacao ?? 0) - Math.abs(a.variacao ?? 0));
  const margemBaixa = produtos.flatMap((x) => {
    const sug = x.venda != null && x.custo != null ? suggestedCents(x, s) : null;
    return sug != null && x.venda != null && x.venda < sug ? [{ produto: x, venda: x.venda, sugerido: sug }] : [];
  });
  return {
    total,
    lotes: doPeriodo.length,
    porFornecedor: [...forn.values()].sort((a, b) => b.total - a.total),
    porMes: [...meses].sort().map(([mes, t]) => ({ mes, total: t })),
    precos,
    margemBaixa: margemBaixa.sort((a, b) => b.sugerido - b.venda - (a.sugerido - a.venda)),
  };
}
