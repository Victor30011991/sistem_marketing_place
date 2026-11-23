import type { Cliente, ListaCompras, Product, StoreInfo, Venda } from '../types';
import { formatBRL } from './money';
import { formatCounterQty } from './units';
import { diaLocal, type ResumoVendas } from './vendas';

/** Extras do PDV: recibo e resumo pelo WhatsApp, última compra do cliente, mais vendidos e estoque baixo. */

const qtdTxt = (qtd: number, un: string) => (un === 'g' || un === 'ml' ? formatCounterQty(qtd, un) : `${String(Number(qtd.toFixed(3))).replace('.', ',')} ${un}`);
const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Link do WhatsApp; sem telefone, abre o WhatsApp para escolher o contato. Número brasileiro ganha o 55. */
export function linkWhatsapp(telefone: string | undefined, texto: string): string {
  let n = (telefone ?? '').replace(/\D/g, '');
  if (n.length === 10 || n.length === 11) n = '55' + n;
  return `https://wa.me/${n.length >= 12 ? n : ''}?text=${encodeURIComponent(texto)}`;
}

/** Recibo da venda para mandar ao cliente. */
export function reciboTexto(v: Venda, loja: StoreInfo, extra?: string): string {
  const nomeLoja = loja.nomeFantasia || 'nossa loja';
  const primeiro = v.cliente.trim().split(/\s+/)[0];
  const linhas = [
    `Oi${primeiro ? `, ${primeiro}` : ''}! Aqui está o seu recibo da *${nomeLoja}* 🌿`,
    `🗓️ ${dataBR(v.quando)}`,
    '',
    ...v.itens.map((i) => `• ${i.nome} (${qtdTxt(i.qtd, i.unidade)}) — ${formatBRL(i.total)}`),
  ];
  if (v.desconto > 0) linhas.push(`Desconto: − ${formatBRL(v.desconto)}`);
  linhas.push('', `*Total: ${formatBRL(v.total)}*`, `Pagamento: ${v.pagamentoLabel}`);
  if (v.troco) linhas.push(`Troco: ${formatBRL(v.troco)}`);
  if (extra) linhas.push('', extra);
  linhas.push('', 'Obrigado pela preferência! 💚');
  return linhas.join('\n');
}

/** Última compra (não cancelada) do cliente, pelo id ou pelo nome. */
export function ultimaCompra(vendas: Venda[], cliente: { id?: string; nome: string }): Venda | null {
  const nome = cliente.nome.trim().toLowerCase();
  if (!cliente.id && nome.length < 3) return null;
  const doCliente = vendas.filter((v) => !v.cancelada && ((cliente.id && v.clienteId === cliente.id) || (nome && v.cliente.trim().toLowerCase() === nome)));
  return doCliente.sort((a, b) => b.quando.localeCompare(a.quando))[0] ?? null;
}

/** Os produtos que mais aparecem nas vendas dos últimos `dias` (por número de vendas). Completa com outros se faltar. */
export function maisVendidos(vendas: Venda[], produtos: Product[], n = 8, dias = 30, hoje = new Date()): Product[] {
  const desde = new Date(hoje.getTime() - dias * 864e5).toISOString();
  const conta = new Map<string, number>();
  for (const v of vendas) {
    if (v.cancelada || v.quando < desde) continue;
    for (const id of new Set(v.itens.map((i) => i.produtoId))) conta.set(id, (conta.get(id) ?? 0) + 1);
  }
  const vendaveis = produtos.filter((p) => p.venda != null && p.venda > 0);
  return [...vendaveis].sort((a, b) => (conta.get(b.id) ?? 0) - (conta.get(a.id) ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, n);
}

/** Total do mesmo dia da semana anterior, para comparar. */
export function semanaPassada(vendas: Venda[], dia: string): { dia: string; total: number; vendas: number } {
  const [a, m, d] = dia.split('-').map(Number);
  const antes = diaLocal(new Date(a, m - 1, d - 7));
  const ok = vendas.filter((v) => !v.cancelada && diaLocal(v.quando) === antes);
  return { dia: antes, total: ok.reduce((s, v) => s + v.total, 0), vendas: ok.length };
}

/** Variação em % (null quando não há base). */
export const variacao = (agora: number, antes: number) => (antes > 0 ? Math.round(((agora - antes) / antes) * 100) : null);

/** Resumo do dia para mandar no WhatsApp. */
export function resumoDiaTexto(res: ResumoVendas, dia: string, loja: StoreInfo, comp: { total: number }): string {
  const [a, m, d] = dia.split('-');
  const pct = variacao(res.total, comp.total);
  const linhas = [
    `*Fechamento ${d}/${m}/${a}${loja.nomeFantasia ? ` · ${loja.nomeFantasia}` : ''}*`,
    '',
    `💰 Faturado: ${formatBRL(res.total)} em ${res.vendas} venda(s)`,
    `🧾 Ticket médio: ${formatBRL(res.ticketMedio)}`,
  ];
  if (pct != null) linhas.push(`${pct >= 0 ? '📈' : '📉'} ${pct >= 0 ? '+' : ''}${pct}% em relação à semana passada (${formatBRL(comp.total)})`);
  if (res.descontos > 0) linhas.push(`🏷️ Descontos: ${formatBRL(res.descontos)}`);
  linhas.push(`✅ Lucro bruto estimado: ${formatBRL(res.lucroBruto)}`, '', '*Por forma de pagamento*');
  for (const p of res.porPagamento) linhas.push(`• ${p.label}: ${formatBRL(p.total)} (${p.vendas})`);
  if (res.taxas > 0) linhas.push(`• Taxas das maquininhas: − ${formatBRL(res.taxas)}`);
  if (res.maisVendidos.length) {
    linhas.push('', '*Mais vendidos*');
    res.maisVendidos.slice(0, 5).forEach((p, i) => linhas.push(`${i + 1}. ${p.nome}: ${formatBRL(p.total)}`));
  }
  return linhas.join('\n');
}

/** Produtos da venda que ficaram no estoque mínimo ou abaixo (só os que têm estoque e mínimo cadastrados). */
export function estoqueBaixo(produtos: Product[], idsVendidos: string[]): Product[] {
  const ids = new Set(idsVendidos);
  return produtos.filter((p) => ids.has(p.id) && p.estoque != null && p.estoqueMinimo != null && p.estoqueMinimo > 0 && p.estoque <= p.estoqueMinimo);
}

/** Põe os produtos na lista de compras (sem repetir), pedindo o dobro do mínimo menos o que sobrou. */
export function porNaListaCompras(lista: ListaCompras | undefined, produtos: Product[]): ListaCompras {
  const base: ListaCompras = lista ?? { fornecedor: '', telefone: '', obs: '', itens: [] };
  const ja = new Set(base.itens.map((i) => i.produtoId));
  const novos = produtos
    .filter((p) => !ja.has(p.id))
    .map((p) => ({ produtoId: p.id, qtd: Math.max(p.estoqueMinimo ?? 1, Math.round((2 * (p.estoqueMinimo ?? 0) - (p.estoque ?? 0)) * 1000) / 1000), unidade: p.unidade }));
  return { ...base, itens: [...base.itens, ...novos] };
}

/** Cliente cadastrado ligado à venda (para pegar o telefone do recibo). */
export const clienteDaVenda = (clientes: Cliente[], v: Venda) => (v.clienteId ? clientes.find((c) => c.id === v.clienteId) : undefined);
