import Decimal from 'decimal.js';
import type { PagamentoVenda, Product, Settings, Venda, VendaItem } from '../types';
import { roundCents } from './money';
import { contentOf, convertQty } from './units';
import { norm } from './normalize';
import { paymentById, paymentOptions } from './pricing';
import { comPromo } from './promo';

const D = (n: number | Decimal) => new Decimal(n);

/** Unidade em que o balcão digita a quantidade: g para produtos por quilo, ml por litro, a própria nos demais. */
export function unidadeDeVenda(p: Pick<Product, 'unidade'>): string {
  if (p.unidade === 'kg') return 'g';
  if (p.unidade === 'L') return 'ml';
  return p.unidade;
}

/** Quantidade na unidade do produto. Aceita gramas para pacote com conteúdo (250 g de um pacote de 500 g = 0,5). */
export function qtdNoProduto(p: Product, qtd: number, unidade: string): Decimal | null {
  const q = convertQty(qtd, unidade, p.unidade);
  if (q) return q;
  const c = contentOf(p);
  if (!c) return null;
  const emConteudo = convertQty(qtd, unidade, c.unidade);
  return emConteudo ? emConteudo.div(c.qtd) : null;
}

/** Monta o item com o preço cadastrado e o custo do que sai do estoque. null = sem preço ou quantidade inválida. */
export function itemVenda(produto: Product, qtd: number, unidade = unidadeDeVenda(produto)): VendaItem | null {
  const p = comPromo(produto); // promoção ativa vale no balcão também
  if (!(qtd > 0) || p.venda == null) return null;
  const q = qtdNoProduto(p, qtd, unidade);
  if (q == null) return null;
  const total = roundCents(D(p.venda).times(q));
  const custo = p.custo != null ? roundCents(D(p.custo).times(q)) : null;
  return { produtoId: p.id, nome: p.nome, qtd, unidade, total, custo };
}

/**
 * Venda pelo valor ("R$ 4 de páprica"): quantas gramas (ou unidades) esse valor compra, já com promoção.
 * Gramas e ml saem inteiros; unidade com até 3 casas. Sem preço ou valor zero = null.
 */
export function qtdPorValor(produto: Product, centavos: number): { qtd: number; unidade: string } | null {
  const unidade = unidadeDeVenda(produto);
  const base = unidade === 'g' || unidade === 'ml' ? 1000 : 1;
  const preco = itemVenda(produto, base, unidade)?.total;
  if (!preco || !(centavos > 0)) return null;
  const bruto = (centavos / preco) * base;
  const qtd = base === 1000 ? Math.max(1, Math.round(bruto)) : Math.max(0.001, Math.round(bruto * 1000) / 1000);
  return { qtd, unidade };
}

/**
 * Desconto de um item digitado no balcão: "10%" (percentual) ou "2,50" (reais).
 * Devolve o desconto em centavos, limitado ao valor do item. Texto vazio ou inválido = 0.
 */
export function descontoDoTexto(texto: string | undefined, totalItem: number): number {
  const t = String(texto ?? '').trim().replace(/^-/, '');
  if (!t) return 0;
  const pct = t.endsWith('%');
  const n = Number(t.replace('%', '').replace(/R\$\s*/i, '').replace(/\./g, '').replace(',', '.').trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  const d = pct ? roundCents(D(totalItem).times(Math.min(n, 100)).div(100)) : Math.round(n * 100);
  return Math.min(d, totalItem);
}

/** Aplica o desconto do item: o total passa a ser o valor cobrado e o desconto fica registrado. */
export function comDesconto(item: VendaItem, desconto: number): VendaItem {
  if (!(desconto > 0)) return item;
  const d = Math.min(desconto, item.total);
  return { ...item, total: item.total - d, desconto: d };
}

/** Formas de pagamento do PDV: dinheiro separado do Pix (só o dinheiro dá troco). */
export function formasPdv(s: Settings): { id: string; label: string; taxa: number }[] {
  const outras = paymentOptions(s).filter((o) => o.id !== 'pix');
  return [{ id: 'dinheiro', label: 'Dinheiro', taxa: 0 }, { id: 'pix', label: 'Pix', taxa: 0 }, ...outras, { id: 'fiado', label: 'Fiado', taxa: 0 }];
}

export function formaPdv(s: Settings, id: string): { id: string; label: string; taxa: number } {
  return formasPdv(s).find((f) => f.id === id) ?? { id, label: id, taxa: 0 };
}

export interface FechamentoPdv {
  /** soma dos itens pelo preço de tabela, antes de qualquer desconto */
  bruto: number;
  /** descontos dados nos itens */
  descontoItens: number;
  /** soma dos itens já com o desconto de cada um */
  subtotal: number;
  /** desconto na venda inteira */
  desconto: number;
  total: number;
  /** soma do que o cliente entregou */
  pago: number;
  /** quanto ainda falta pagar */
  falta: number;
  /** troco a devolver (só existe quando entra dinheiro a mais) */
  troco: number;
  /** pago a mais sem dinheiro para dar troco (ex.: Pix maior que a conta) */
  excesso: number;
  pagamentos: PagamentoVenda[];
  taxa: number;
  liquido: number;
}

/** Fecha a venda com uma ou mais formas de pagamento, calculando falta, troco e a taxa de cada forma. */
export function fecharPdv(itens: VendaItem[], desconto: { tipo: 'valor' | 'pct'; valor: number | null }, pagos: { forma: string; valor: number }[], s: Settings): FechamentoPdv {
  const subtotal = itens.reduce((a, i) => a + i.total, 0);
  const descontoItens = itens.reduce((a, i) => a + (i.desconto ?? 0), 0);
  let desc = 0;
  if (desconto.valor && desconto.valor > 0) desc = desconto.tipo === 'pct' ? roundCents(D(subtotal).times(Math.min(desconto.valor, 100)).div(100)) : desconto.valor;
  desc = Math.min(desc, subtotal);
  const total = subtotal - desc;
  const validos = pagos.filter((p) => p.valor > 0);
  const pago = validos.reduce((a, p) => a + p.valor, 0);
  const sobra = Math.max(0, pago - total);
  const dinheiro = validos.filter((p) => p.forma === 'dinheiro').reduce((a, p) => a + p.valor, 0);
  const troco = Math.min(sobra, dinheiro);
  // o troco sai do dinheiro: a loja fica só com o que cobre a conta
  let tirar = troco;
  const pagamentos: PagamentoVenda[] = validos.map((p) => {
    let valor = p.valor;
    if (p.forma === 'dinheiro' && tirar > 0) {
      const t = Math.min(tirar, valor);
      valor -= t;
      tirar -= t;
    }
    const f = formaPdv(s, p.forma);
    return { forma: p.forma, label: f.label, valor, taxa: roundCents(D(valor).times(f.taxa).div(100)) };
  }).filter((p) => p.valor > 0);
  const taxa = pagamentos.reduce((a, p) => a + p.taxa, 0);
  return {
    bruto: subtotal + descontoItens,
    descontoItens,
    subtotal,
    desconto: desc,
    total,
    pago,
    falta: Math.max(0, total - pago),
    troco,
    excesso: sobra - troco,
    pagamentos,
    taxa,
    liquido: total - taxa,
  };
}

export interface FechamentoVenda {
  subtotal: number;
  desconto: number;
  total: number;
  taxa: number;
  liquido: number;
}

export function fecharVenda(itens: VendaItem[], desconto: { tipo: 'valor' | 'pct'; valor: number | null }, s: Settings, pagamento: string): FechamentoVenda {
  const subtotal = itens.reduce((a, i) => a + i.total, 0);
  let desc = 0;
  if (desconto.valor && desconto.valor > 0) desc = desconto.tipo === 'pct' ? roundCents(D(subtotal).times(Math.min(desconto.valor, 100)).div(100)) : desconto.valor;
  desc = Math.min(desc, subtotal);
  const total = subtotal - desc;
  const taxa = roundCents(D(total).times(paymentById(s, pagamento).taxa).div(100));
  return { subtotal, desconto: desc, total, taxa, liquido: total - taxa };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Baixa (sinal −1) ou devolve (sinal +1) o estoque. Produto sem estoque controlado (null) não muda. */
export function moverEstoque(produtos: Product[], itens: VendaItem[], sinal: 1 | -1): Product[] {
  const delta = new Map<string, number>();
  const porId = new Map(produtos.map((p) => [p.id, p]));
  for (const i of itens) {
    const p = porId.get(i.produtoId);
    if (!p || p.estoque == null) continue;
    const q = qtdNoProduto(p, i.qtd, i.unidade);
    if (q == null) continue;
    delta.set(p.id, (delta.get(p.id) ?? 0) + q.toNumber() * sinal);
  }
  return produtos.map((p) => (delta.has(p.id) ? { ...p, estoque: r3((p.estoque ?? 0) + delta.get(p.id)!) } : p));
}

/** Data local AAAA-MM-DD de um ISO. */
export function diaLocal(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export interface ResumoVendas {
  vendas: number;
  canceladas: number;
  bruto: number;
  descontos: number;
  total: number;
  taxas: number;
  liquido: number;
  custo: number;
  /** total − custo − taxas (sem custos fixos) */
  lucroBruto: number;
  ticketMedio: number;
  porPagamento: { label: string; vendas: number; total: number }[];
  maisVendidos: { nome: string; total: number }[];
  /** quanto foi vendido abaixo do preço de tabela (descontos) em % do bruto */
  descontoPct: number;
}

export function resumoVendas(vendas: Venda[]): ResumoVendas {
  const ok = vendas.filter((v) => !v.cancelada);
  const soma = (f: (v: Venda) => number) => ok.reduce((a, v) => a + f(v), 0);
  const bruto = soma((v) => v.itens.reduce((a, i) => a + i.total + (i.desconto ?? 0), 0));
  const descontos = soma((v) => v.desconto + v.itens.reduce((a, i) => a + (i.desconto ?? 0), 0));
  const total = soma((v) => v.total);
  const taxas = soma((v) => v.taxa);
  const custo = soma((v) => v.itens.reduce((a, i) => a + (i.custo ?? 0), 0));
  const pag = new Map<string, { label: string; vendas: number; total: number }>();
  const prod = new Map<string, { nome: string; total: number }>();
  for (const v of ok) {
    const partes = v.pagamentos?.length ? v.pagamentos.map((p) => ({ forma: p.forma, label: p.label, valor: p.valor })) : [{ forma: v.pagamento, label: v.pagamentoLabel, valor: v.total }];
    for (const pt of partes) {
      const k = pt.forma.startsWith('parcelado:') ? pt.label : pt.forma;
      const x = pag.get(k) ?? { label: pt.label, vendas: 0, total: 0 };
      x.vendas++;
      x.total += pt.valor;
      pag.set(k, x);
    }
    for (const i of v.itens) {
      const y = prod.get(i.produtoId) ?? { nome: i.nome, total: 0 };
      y.total += i.total;
      prod.set(i.produtoId, y);
    }
  }
  return {
    vendas: ok.length,
    canceladas: vendas.length - ok.length,
    bruto,
    descontos,
    total,
    taxas,
    liquido: total - taxas,
    custo,
    lucroBruto: total - custo - taxas,
    ticketMedio: ok.length ? Math.round(total / ok.length) : 0,
    porPagamento: [...pag.values()].sort((a, b) => b.total - a.total),
    maisVendidos: [...prod.values()].sort((a, b) => b.total - a.total).slice(0, 5),
    descontoPct: bruto > 0 ? D(descontos).div(bruto).times(100).toDecimalPlaces(1).toNumber() : 0,
  };
}

// ---------- pedido que chegou pelo WhatsApp (mensagem do catálogo) ----------

export interface PedidoLido {
  itens: { produtoId: string; qtd: number; unidade: string }[];
  naoAchados: string[];
  cliente: string;
}

function gramas(t: string): number | null {
  const m = t.trim().toLowerCase().match(/^([\d.,]+)\s*(kg|g)$/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(m[2] === 'kg' ? n * 1000 : n);
}

/** Lê a mensagem que o catálogo monta (nome numa linha, "  250 g   R$ 7,48" na seguinte) e acha os produtos. */
export function lerPedidoWhatsapp(texto: string, produtos: Product[]): PedidoLido {
  const linhas = texto.replace(/\r/g, '').split('\n');
  const itens: PedidoLido['itens'] = [];
  const naoAchados: string[] = [];
  for (let i = 1; i < linhas.length; i++) {
    const m = linhas[i].match(/^\s+([\d.,]+\s*(?:kg|g))\s+R\$\s*[\d.,]+\s*$/i);
    if (!m) continue;
    const g = gramas(m[1]);
    const nomeBruto = linhas[i - 1].trim();
    if (!g || !nomeBruto) continue;
    const truncado = nomeBruto.endsWith('…');
    const alvo = norm(nomeBruto.replace(/…$/, ''));
    const p =
      produtos.find((x) => norm(x.nome) === alvo) ??
      (truncado ? produtos.find((x) => norm(x.nome).startsWith(alvo)) : undefined);
    if (!p || qtdNoProduto(p, g, 'g') == null) {
      naoAchados.push(nomeBruto);
      continue;
    }
    itens.push({ produtoId: p.id, qtd: g, unidade: 'g' });
  }
  const cli = texto.match(/\*Nome:\*\s*(.+)/);
  return { itens, naoAchados, cliente: cli ? cli[1].trim() : '' };
}
