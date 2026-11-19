/** Contas a receber (fiado) e a pagar: saldo, situação, recebimento/pagamento, cobrança e mensais. */
import type { Cliente, Conta, PagamentoConta } from '../types';
import { formatBRL } from './money';
import { newId } from './normalize';
import { diaLocal } from './vendas';

export type SituacaoConta = 'aberta' | 'parcial' | 'paga' | 'vencida' | 'cancelada';

const z = (n: number) => String(n).padStart(2, '0');
export const somaDias = (iso: string, d: number) => {
  const [a, m, dd] = iso.split('-').map(Number);
  const x = new Date(a, m - 1, dd + d);
  return `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())}`;
};
/** Mesmo dia no mês seguinte (31/01 → 28/02). */
export function proximoMes(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const ultimo = new Date(a, m + 1, 0).getDate();
  const x = new Date(a, m, Math.min(d, ultimo));
  return `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())}`;
}

export const pago = (c: Conta) => c.pagamentos.reduce((a, p) => a + p.valor, 0);
export const saldo = (c: Conta) => (c.cancelada ? 0 : Math.max(0, c.valor - pago(c)));

export function situacao(c: Conta, hoje = diaLocal(new Date())): SituacaoConta {
  if (c.cancelada) return 'cancelada';
  if (saldo(c) === 0) return 'paga';
  if (c.vencimento < hoje) return 'vencida';
  return pago(c) > 0 ? 'parcial' : 'aberta';
}

export function novaConta(d: Pick<Conta, 'tipo' | 'descricao' | 'valor' | 'vencimento'> & Partial<Conta>): Conta {
  return { ...d, id: newId(), criado: new Date().toISOString(), pagamentos: [], valor: Math.round(d.valor) };
}

/** Fiado que nasce de uma venda no PDV. */
export function contaFiado(valor: number, vendaId: string, clienteId: string, prazoDias = 30, hoje = new Date()): Conta {
  const dia = diaLocal(hoje);
  return novaConta({ tipo: 'receber', descricao: `Fiado da venda de ${dia.split('-').reverse().join('/')}`, valor, vencimento: somaDias(dia, prazoDias), clienteId, vendaId });
}

/**
 * Registra um pagamento (parcial ou total). Na conta mensal quitada, devolve também a do mês seguinte.
 * O valor nunca passa do saldo.
 */
export function quitar(c: Conta, valor: number, forma: string, por: string, quando = new Date()): { conta: Conta; proxima: Conta | null } {
  const v = Math.min(Math.round(valor), saldo(c));
  if (v <= 0) return { conta: c, proxima: null };
  const p: PagamentoConta = { id: newId(), quando: quando.toISOString(), valor: v, forma, por };
  const conta = { ...c, pagamentos: [...c.pagamentos, p] };
  const proxima = conta.mensal && saldo(conta) === 0 ? novaConta({ tipo: c.tipo, descricao: c.descricao, valor: c.valor, vencimento: proximoMes(c.vencimento), favorecido: c.favorecido, mensal: true }) : null;
  return { conta, proxima };
}

/** Recebimento de um cliente que tem várias contas: paga das mais antigas para as mais novas. */
export function receberDoCliente(contas: Conta[], clienteId: string, valor: number, forma: string, por: string): Conta[] {
  let resta = Math.round(valor);
  const abertas = contas.filter((c) => c.tipo === 'receber' && c.clienteId === clienteId && saldo(c) > 0).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const mudadas = new Map<string, Conta>();
  for (const c of abertas) {
    if (resta <= 0) break;
    const v = Math.min(resta, saldo(c));
    mudadas.set(c.id, quitar(c, v, forma, por).conta);
    resta -= v;
  }
  return contas.map((c) => mudadas.get(c.id) ?? c);
}

export interface Devedor {
  cliente: Cliente | null;
  clienteId: string;
  saldo: number;
  vencido: number;
  maisAntiga: string;
  contas: Conta[];
}

export function devedores(contas: Conta[], clientes: Cliente[], hoje = diaLocal(new Date())): Devedor[] {
  const m = new Map<string, Devedor>();
  for (const c of contas) {
    if (c.tipo !== 'receber' || saldo(c) === 0) continue;
    const k = c.clienteId ?? `sem:${c.descricao}`;
    const d = m.get(k) ?? { cliente: clientes.find((x) => x.id === c.clienteId) ?? null, clienteId: k, saldo: 0, vencido: 0, maisAntiga: c.vencimento, contas: [] };
    d.saldo += saldo(c);
    if (c.vencimento < hoje) d.vencido += saldo(c);
    if (c.vencimento < d.maisAntiga) d.maisAntiga = c.vencimento;
    d.contas.push(c);
    m.set(k, d);
  }
  return [...m.values()].sort((a, b) => b.vencido - a.vencido || b.saldo - a.saldo);
}

export function totais(contas: Conta[], hoje = diaLocal(new Date())) {
  const em7 = somaDias(hoje, 7);
  const t = { receber: 0, receberVencido: 0, pagar: 0, pagarVencido: 0, pagar7dias: 0 };
  for (const c of contas) {
    const s = saldo(c);
    if (!s) continue;
    if (c.tipo === 'receber') {
      t.receber += s;
      if (c.vencimento < hoje) t.receberVencido += s;
    } else {
      t.pagar += s;
      if (c.vencimento < hoje) t.pagarVencido += s;
      else if (c.vencimento <= em7) t.pagar7dias += s;
    }
  }
  return t;
}

/** Mensagem gentil de cobrança, com o Pix copia e cola quando houver. */
export function textoCobranca(d: Devedor, loja: string, pix: string | null): string {
  const nome = d.cliente?.nome.trim().split(/\s+/)[0] ?? '';
  const linhas = [
    `Oi${nome ? `, ${nome}` : ''}! Tudo bem? Aqui é da ${loja} 🌿`,
    `Passando para lembrar do seu saldo em aberto: *${formatBRL(d.saldo)}*.`,
    ...d.contas.map((c) => `• ${c.descricao}: ${formatBRL(saldo(c))} (vence ${c.vencimento.split('-').reverse().join('/')})`),
  ];
  if (pix) linhas.push('', 'Se preferir, é só pagar pelo Pix copia e cola (valor já preenchido):', pix);
  linhas.push('', 'Qualquer dúvida, é só chamar. Obrigado!');
  return linhas.join('\n');
}

/** Pagamentos de contas a receber em dinheiro dentro de um intervalo (para o caixa). */
export function dinheiroDeContas(contas: Conta[], de: string, ate?: string): number {
  let t = 0;
  for (const c of contas) if (c.tipo === 'receber') for (const p of c.pagamentos) if (p.forma === 'dinheiro' && p.quando >= de && (!ate || p.quando <= ate)) t += p.valor;
  return t;
}

/** Contas a pagar quitadas dentro do período (AAAA-MM-DD), pelo dia do pagamento. */
export function pagoNoPeriodo(contas: Conta[], de: string, ate: string): number {
  let t = 0;
  for (const c of contas) if (c.tipo === 'pagar') for (const p of c.pagamentos) {
    const d = diaLocal(p.quando);
    if (d >= de && d <= ate) t += p.valor;
  }
  return t;
}

export function contasDe(raw: unknown): Conta[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
  return raw.flatMap((x) => {
    if (!x || typeof x !== 'object') return [];
    const o = x as Record<string, unknown>;
    if ((o.tipo !== 'receber' && o.tipo !== 'pagar') || !/^\d{4}-\d{2}-\d{2}$/.test(s(o.vencimento))) return [];
    const pagamentos = (Array.isArray(o.pagamentos) ? o.pagamentos : []).flatMap((p) => {
      const q = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      return n(q.valor) > 0 ? [{ id: s(q.id) || newId(), quando: s(q.quando), valor: n(q.valor), forma: s(q.forma) || 'dinheiro', por: s(q.por) }] : [];
    });
    const c: Conta = { id: s(o.id) || newId(), tipo: o.tipo, descricao: s(o.descricao), valor: n(o.valor), vencimento: s(o.vencimento), criado: s(o.criado), pagamentos };
    for (const k of ['clienteId', 'vendaId', 'favorecido'] as const) if (s(o[k])) c[k] = s(o[k]);
    if (o.mensal === true) c.mensal = true;
    if (o.cancelada === true) c.cancelada = true;
    return [c];
  });
}
