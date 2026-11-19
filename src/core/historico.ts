/**
 * Histórico de alterações: a partir do que um aparelho manda para a nuvem, descreve o que mudou
 * (preço, custo, nome, produto novo/excluído, estoque ajustado à mão, venda cancelada, lote aplicado).
 */
import type { Product, Registro, Venda } from '../types';
import type { Nuvem } from '../nuvem/modelo';
import { formatBRL } from './money';
import { newId } from './normalize';

const n3 = (x: number | null | undefined) => (x == null ? '—' : String(Math.round(x * 1000) / 1000).replace('.', ','));
const brl = (x: number | null | undefined) => (x == null ? '—' : formatBRL(x));

export function registrosDe(antes: Nuvem, agora: Nuvem, por: string, quando = new Date().toISOString()): Registro[] {
  if (!antes.raiz) return []; // primeira subida: não é alteração
  const out: Registro[] = [];
  const r = (acao: string, detalhe: string) => out.push({ id: newId(), quando, por, acao, detalhe });

  const vendasNovas = new Set<string>();
  for (const [d, mapa] of agora.dias) {
    const velho = antes.dias.get(d) ?? {};
    for (const [id, v] of Object.entries(mapa) as [string, Venda][]) {
      if (!velho[id]) vendasNovas.add(id);
      else if (v.cancelada && !velho[id].cancelada) r('Venda cancelada', `${formatBRL(v.total)}${v.cliente ? ` · ${v.cliente}` : ''} · ${v.quando.slice(11, 16)}`);
    }
  }
  const lotesNovos = [...agora.col.lotes.keys()].filter((id) => !antes.col.lotes.has(id));
  for (const id of lotesNovos) {
    const l = agora.col.lotes.get(id) as unknown as { fornecedor?: string; numero?: string; itens?: unknown[] };
    r('Lote de compra aplicado', `${l.fornecedor || 'Sem fornecedor'}${l.numero ? ` · nota ${l.numero}` : ''} · ${l.itens?.length ?? 0} item(ns)`);
  }
  // cancelamentos também mexem no estoque: só conta ajuste manual quando nada disso aconteceu
  const mexeuEstoquePorOutroMotivo = vendasNovas.size > 0 || lotesNovos.length > 0 || out.some((x) => x.acao === 'Venda cancelada');

  for (const p of agora.produtos.values()) {
    const a = antes.produtos.get(p.id) as Product | undefined;
    if (!a) {
      r('Produto novo', `${p.nome} · ${brl(p.venda)}/${p.unidade}`);
      continue;
    }
    if (a.nome !== p.nome) r('Nome mudou', `${a.nome} → ${p.nome}`);
    if (a.venda !== p.venda) r('Preço mudou', `${p.nome}: ${brl(a.venda)} → ${brl(p.venda)}/${p.unidade}`);
    if (a.custo !== p.custo && !lotesNovos.length) r('Custo mudou', `${p.nome}: ${brl(a.custo)} → ${brl(p.custo)}/${p.unidade}`);
    if ((a.estoque ?? null) !== (p.estoque ?? null) && !mexeuEstoquePorOutroMotivo) r('Estoque ajustado', `${p.nome}: ${n3(a.estoque)} → ${n3(p.estoque)} ${p.unidade}`);
  }
  for (const [id, a] of antes.produtos) if (!agora.produtos.has(id)) r('Produto excluído', a.nome);
  // muitos itens de uma vez (importação, lista nova): resume em uma linha
  const porAcao = new Map<string, Registro[]>();
  for (const x of out) porAcao.set(x.acao, [...(porAcao.get(x.acao) ?? []), x]);
  return [...porAcao.values()].flatMap((l) => (l.length > 8 ? [{ ...l[0], id: newId(), detalhe: `${l.length} itens (ex.: ${l.slice(0, 3).map((x) => x.detalhe.split(':')[0]).join(', ')}…)` }] : l));
}
