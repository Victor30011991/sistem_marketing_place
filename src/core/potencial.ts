import type { Product, Settings, Venda } from '../types';
import { paymentById } from './pricing';
import { diaLocal, qtdNoProduto } from './vendas';

/**
 * Potencial do estoque: quanto rende vender o que está na prateleira hoje, pelo preço de hoje.
 * Tudo em centavos. É uma estimativa: usa o ritmo de vendas e a mistura de pagamentos dos últimos dias.
 */

export interface Cenario {
  /** % do estoque que vende (100 = tudo) */
  vende: number;
  /** desconto médio dado, % */
  desconto: number;
  /** 'mix' = como os clientes pagam hoje; ou o id da forma (pix, debito, credito_vista, parcelado:…) */
  forma: string;
}
export const CENARIO_PADRAO: Cenario = { vende: 100, desconto: 0, forma: 'mix' };

export interface LinhaPotencial {
  produto: Product;
  /** quanto vende, na unidade do produto */
  qtd: number;
  investimento: number;
  faturamento: number;
  /** faturamento − custo */
  lucroBruto: number;
  /** lucro bruto por real investido (0,85 = 85%) */
  retorno: number | null;
  /** dias para vender no ritmo dos últimos 30 dias (null = não vendeu) */
  dias: number | null;
}

export interface Potencial {
  linhas: LinhaPotencial[];
  /** custo do estoque inteiro (o que está empatado) */
  investimento: number;
  /** custo da parte que vende no cenário */
  custoVendido: number;
  faturamento: number;
  lucroBruto: number;
  taxas: number;
  /** % de taxa usada (média das vendas ou da forma escolhida) */
  taxaPct: number;
  variaveis: number;
  /** dias para vender tudo no ritmo atual (null = sem vendas recentes) */
  dias: number | null;
  /** despesas fixas proporcionais aos dias para vender (sem ritmo: 1 mês) */
  despesasFixas: number;
  lucroLiquido: number;
  proLabore: number;
  sobra: number;
  /** lucro líquido ÷ investimento */
  retorno: number | null;
  /** lucro bruto ÷ faturamento */
  margemBruta: number | null;
  /** lucro líquido ÷ faturamento */
  margemLiquida: number | null;
  faltam: { produto: Product; motivo: string }[];
  semEstoqueInformado: number;
}

const d1 = 86400000;

/** % média de taxa nas vendas recentes (taxas ÷ faturamento). Sem vendas, usa a forma de preço da loja. */
export function taxaMedia(vendas: Venda[], s: Settings, hoje = new Date(), dias = 90): number {
  const desde = new Date(hoje.getTime() - dias * d1).toISOString();
  const ok = vendas.filter((v) => !v.cancelada && v.quando >= desde);
  const total = ok.reduce((a, v) => a + v.total, 0);
  if (total <= 0) return paymentById(s, s.pagamentoBase).taxa;
  return Math.round((ok.reduce((a, v) => a + v.taxa, 0) / total) * 10000) / 100;
}

export function potencialEstoque(produtos: Product[], vendas: Venda[], s: Settings, c: Cenario = CENARIO_PADRAO, hoje = new Date()): Potencial {
  const fr = Math.min(100, Math.max(0, c.vende)) / 100;
  const desc = Math.min(90, Math.max(0, c.desconto)) / 100;
  const taxaPct = c.forma === 'mix' ? taxaMedia(vendas, s, hoje) : paymentById(s, c.forma).taxa;

  // ritmo dos últimos 30 dias, por produto (na unidade do produto) e em itens vendidos
  const ini = diaLocal(new Date(hoje.getTime() - 29 * d1));
  const fim = diaLocal(hoje);
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const vendido30 = new Map<string, number>();
  let itens30 = 0;
  let valorItens30 = 0;
  for (const v of vendas) {
    if (v.cancelada) continue;
    const d = diaLocal(v.quando);
    if (d < ini || d > fim) continue;
    for (const i of v.itens) {
      itens30++;
      valorItens30 += i.total;
      const p = porId.get(i.produtoId);
      if (p) vendido30.set(p.id, (vendido30.get(p.id) ?? 0) + (qtdNoProduto(p, i.qtd, i.unidade)?.toNumber() ?? 0));
    }
  }

  const faltam: Potencial['faltam'] = [];
  const linhas: LinhaPotencial[] = [];
  let investimento = 0;
  let adicionais = 0;
  for (const p of produtos) {
    const est = p.estoque ?? 0;
    if (p.estoque == null || est <= 0) continue;
    if (p.custo == null) {
      faltam.push({ produto: p, motivo: 'sem custo' });
      continue;
    }
    if (p.venda == null || p.venda <= 0) {
      faltam.push({ produto: p, motivo: 'sem preço de venda' });
      continue;
    }
    const inv = Math.round(est * p.custo);
    investimento += inv;
    const qtd = Math.round(est * fr * 1000) / 1000;
    const faturamento = Math.round(qtd * p.venda * (1 - desc));
    const custo = Math.round(qtd * p.custo);
    adicionais += Math.round(qtd * (p.custosAdicionais || 0));
    const v30 = vendido30.get(p.id) ?? 0;
    linhas.push({
      produto: p,
      qtd,
      investimento: inv,
      faturamento,
      lucroBruto: faturamento - custo,
      retorno: inv > 0 ? Math.round(((faturamento - custo) / inv) * 1000) / 1000 : null,
      dias: v30 > 0 ? Math.ceil(qtd / (v30 / 30)) : null,
    });
  }

  const faturamento = linhas.reduce((a, l) => a + l.faturamento, 0);
  const custoVendido = linhas.reduce((a, l) => a + (l.faturamento - l.lucroBruto), 0);
  const lucroBruto = faturamento - custoVendido;
  const taxas = Math.round((faturamento * taxaPct) / 100);
  // itens que a venda deste estoque deve gerar (para custos por item vendido, como embalagem)
  const ticketItem = itens30 > 0 ? valorItens30 / itens30 : 2000;
  const itensEstimados = faturamento > 0 ? Math.round(faturamento / Math.max(100, ticketItem)) : 0;
  let variaveis = adicionais;
  for (const v of s.custosVariaveis) {
    if (v.tipo === 'percentual') variaveis += Math.round((faturamento * v.valor) / 100);
    else if (v.tipo === 'percentualCusto') variaveis += Math.round((custoVendido * v.valor) / 100);
    else variaveis += v.valor * itensEstimados;
  }

  // tempo para vender tudo: faturamento do cenário ÷ faturamento por dia dos últimos 30 dias (dos produtos em estoque)
  const ritmoDia = linhas.reduce((a, l) => a + ((vendido30.get(l.produto.id) ?? 0) / 30) * (l.produto.venda ?? 0), 0);
  const dias = ritmoDia > 0 && faturamento > 0 ? Math.ceil(faturamento / ritmoDia) : null;
  const meses = (dias ?? 30) / 30;
  const despesasFixas = Math.round(s.custosFixos.reduce((a, x) => a + x.valor, 0) * meses);
  const proLabore = Math.round((s.proLabore ?? 0) * meses);
  const lucroLiquido = lucroBruto - taxas - variaveis - despesasFixas;
  return {
    linhas: linhas.sort((a, b) => (b.retorno ?? -9) - (a.retorno ?? -9)),
    investimento,
    custoVendido,
    faturamento,
    lucroBruto,
    taxas,
    taxaPct,
    variaveis,
    dias,
    despesasFixas,
    lucroLiquido,
    proLabore,
    sobra: lucroLiquido - proLabore,
    retorno: investimento > 0 ? Math.round((lucroLiquido / investimento) * 1000) / 1000 : null,
    margemBruta: faturamento > 0 ? Math.round((lucroBruto / faturamento) * 1000) / 10 : null,
    margemLiquida: faturamento > 0 ? Math.round((lucroLiquido / faturamento) * 1000) / 10 : null,
    faltam,
    semEstoqueInformado: produtos.filter((p) => p.estoque == null && p.venda != null && p.venda > 0).length,
  };
}
