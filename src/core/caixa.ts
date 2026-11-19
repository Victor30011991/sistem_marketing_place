/** Caixa do dia: abertura com troco, sangrias e reforços, dinheiro previsto na gaveta e fechamento. */
import type { Caixa, Conta, MovimentoCaixa, Venda } from '../types';
import { dinheiroDeContas } from './contas';
import { diaLocal, resumoVendas, type ResumoVendas } from './vendas';
import { formatBRL } from './money';
import { newId } from './normalize';

export function abrirCaixa(trocoInicial: number, por: string, agora = new Date()): Caixa {
  return { id: newId(), dia: diaLocal(agora), abertoEm: agora.toISOString(), abertoPor: por, trocoInicial: Math.max(0, Math.round(trocoInicial)), movimentos: [] };
}

export function movimento(tipo: MovimentoCaixa['tipo'], valor: number, motivo: string, por: string): MovimentoCaixa {
  return { id: newId(), quando: new Date().toISOString(), tipo, valor: Math.max(0, Math.round(valor)), motivo: motivo.trim(), por };
}

/** Vendas que entram neste caixa: do mesmo dia, depois da abertura e (se fechado) até o fechamento. */
export function vendasDoCaixa(c: Caixa, vendas: Venda[]): Venda[] {
  return vendas.filter((v) => diaLocal(v.quando) === c.dia && v.quando >= c.abertoEm && (!c.fechadoEm || v.quando <= c.fechadoEm));
}

/** Dinheiro em espécie que ficou com a loja (o troco já foi descontado na venda). */
export function dinheiroRecebido(vendas: Venda[]): number {
  let t = 0;
  for (const v of vendas) {
    if (v.cancelada) continue;
    if (v.pagamentos?.length) t += v.pagamentos.filter((p) => p.forma === 'dinheiro').reduce((a, p) => a + p.valor, 0);
    else if (v.pagamento === 'dinheiro') t += v.total;
  }
  return t;
}

export interface ResumoCaixa {
  dinheiro: number;
  reforcos: number;
  sangrias: number;
  /** troco + dinheiro das vendas + reforços − sangrias */
  previsto: number;
  vendas: ResumoVendas;
  /** contado − previsto (só depois de fechado) */
  diferenca: number | null;
}

export function resumoCaixa(c: Caixa, todas: Venda[], contas: Conta[] = []): ResumoCaixa {
  const vs = vendasDoCaixa(c, todas);
  // dinheiro das vendas + fiado recebido em dinheiro enquanto o caixa estava aberto
  const dinheiro = dinheiroRecebido(vs) + dinheiroDeContas(contas, c.abertoEm, c.fechadoEm);
  const reforcos = c.movimentos.filter((m) => m.tipo === 'reforco').reduce((a, m) => a + m.valor, 0);
  const sangrias = c.movimentos.filter((m) => m.tipo === 'sangria').reduce((a, m) => a + m.valor, 0);
  const previsto = c.trocoInicial + dinheiro + reforcos - sangrias;
  return { dinheiro, reforcos, sangrias, previsto, vendas: resumoVendas(vs), diferenca: c.contado != null ? c.contado - (c.previsto ?? previsto) : null };
}

export function fecharCaixa(c: Caixa, todas: Venda[], contado: number, por: string, obs = '', agora = new Date(), contas: Conta[] = []): Caixa {
  const r = resumoCaixa({ ...c, fechadoEm: agora.toISOString() }, todas, contas);
  return { ...c, fechadoEm: agora.toISOString(), fechadoPor: por, previsto: r.previsto, contado: Math.round(contado), ...(obs.trim() ? { obs: obs.trim() } : {}) };
}

/** Caixa aberto (o mais recente sem fechamento). */
export const caixaAberto = (caixas: Caixa[]) => [...caixas].sort((a, b) => b.abertoEm.localeCompare(a.abertoEm)).find((c) => !c.fechadoEm) ?? null;

/** Texto do fechamento para mandar no WhatsApp. */
export function textoFechamento(c: Caixa, todas: Venda[], loja: string, contas: Conta[] = []): string {
  const r = resumoCaixa(c, todas, contas);
  const linhas = [
    `*${loja}* · Fechamento do caixa ${c.dia.split('-').reverse().join('/')}`,
    `Aberto por ${c.abertoPor || '—'}${c.fechadoPor ? ` · fechado por ${c.fechadoPor}` : ''}`,
    '',
    `Vendas: ${r.vendas.vendas} · ${formatBRL(r.vendas.total)}`,
    ...r.vendas.porPagamento.map((p) => `• ${p.label}: ${formatBRL(p.total)}`),
    '',
    `Troco inicial: ${formatBRL(c.trocoInicial)}`,
    ...(r.reforcos ? [`Reforços: + ${formatBRL(r.reforcos)}`] : []),
    ...(r.sangrias ? [`Sangrias: − ${formatBRL(r.sangrias)}`] : []),
    `Dinheiro previsto: ${formatBRL(c.previsto ?? r.previsto)}`,
    ...(c.contado != null ? [`Dinheiro contado: ${formatBRL(c.contado)}`, `Diferença: ${!r.diferenca ? 'nenhuma ✅' : r.diferenca > 0 ? `sobrou ${formatBRL(r.diferenca)}` : `faltou ${formatBRL(-r.diferenca)}`}`] : []),
    ...(c.obs ? ['', c.obs] : []),
  ];
  return linhas.join('\n');
}

export function caixasDe(raw: unknown): Caixa[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return raw.flatMap((x) => {
    if (!x || typeof x !== 'object') return [];
    const o = x as Record<string, unknown>;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s(o.dia)) || !s(o.abertoEm)) return [];
    const movimentos = (Array.isArray(o.movimentos) ? o.movimentos : []).flatMap((m) => {
      const q = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
      return q.tipo === 'sangria' || q.tipo === 'reforco' ? [{ id: s(q.id) || newId(), quando: s(q.quando), tipo: q.tipo, valor: n(q.valor), motivo: s(q.motivo), por: s(q.por) } as MovimentoCaixa] : [];
    });
    const c: Caixa = { id: s(o.id) || newId(), dia: s(o.dia), abertoEm: s(o.abertoEm), abertoPor: s(o.abertoPor), trocoInicial: n(o.trocoInicial), movimentos };
    if (s(o.fechadoEm)) Object.assign(c, { fechadoEm: s(o.fechadoEm), fechadoPor: s(o.fechadoPor), previsto: n(o.previsto), contado: n(o.contado), ...(s(o.obs) ? { obs: s(o.obs) } : {}) });
    return [c];
  });
}
