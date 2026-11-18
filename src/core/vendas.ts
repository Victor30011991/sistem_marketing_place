import Decimal from 'decimal.js';
import type { Product, Settings, Venda, VendaItem } from '../types';
import { roundCents } from './money';
import { contentOf, convertQty } from './units';
import { norm } from './normalize';
import { paymentById } from './pricing';

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
export function itemVenda(p: Product, qtd: number, unidade = unidadeDeVenda(p)): VendaItem | null {
  if (!(qtd > 0) || p.venda == null) return null;
  const q = qtdNoProduto(p, qtd, unidade);
  if (q == null) return null;
  const total = roundCents(D(p.venda).times(q));
  const custo = p.custo != null ? roundCents(D(p.custo).times(q)) : null;
  return { produtoId: p.id, nome: p.nome, qtd, unidade, total, custo };
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
  const bruto = soma((v) => v.itens.reduce((a, i) => a + i.total, 0));
  const descontos = soma((v) => v.desconto);
  const total = soma((v) => v.total);
  const taxas = soma((v) => v.taxa);
  const custo = soma((v) => v.itens.reduce((a, i) => a + (i.custo ?? 0), 0));
  const pag = new Map<string, { label: string; vendas: number; total: number }>();
  const prod = new Map<string, { nome: string; total: number }>();
  for (const v of ok) {
    const k = v.pagamento.startsWith('parcelado:') ? v.pagamentoLabel : v.pagamento;
    const x = pag.get(k) ?? { label: v.pagamentoLabel, vendas: 0, total: 0 };
    x.vendas++;
    x.total += v.total;
    pag.set(k, x);
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

// ---------- pedido que chegou pelo WhatsApp (mensagem do cardápio) ----------

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

/** Lê a mensagem que o cardápio monta (nome numa linha, "  250 g   R$ 7,48" na seguinte) e acha os produtos. */
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
