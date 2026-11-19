/** Mercadoria perto de vencer, a partir da validade informada nos lotes de compra. */
import type { Lote, Product } from '../types';
import { norm } from './normalize';

export interface Vencendo {
  produto: Product | null;
  nome: string;
  /** AAAA-MM-DD */
  validade: string;
  /** dias até vencer (negativo = já venceu) */
  dias: number;
  qtd: number;
  unidade: string;
  lote: string;
}

const diaNum = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d) / 86400000;
};

/**
 * Itens de lotes aplicados que vencem em até `dias` dias (ou já venceram), de produtos que ainda têm estoque
 * (ou sem estoque controlado). Um aviso por produto: o vencimento mais próximo.
 */
export function vencendo(lotes: Lote[], produtos: Product[], hoje: string, dias = 30): Vencendo[] {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const melhor = new Map<string, Vencendo>();
  for (const l of lotes) {
    if (!l.aplicadoEm) continue;
    for (const it of l.itens) {
      if (!it.validade) continue;
      const falta = diaNum(it.validade) - diaNum(hoje);
      if (falta > dias) continue;
      const p = (it.produtoId && porId.get(it.produtoId)) || produtos.find((x) => norm(x.nome) === norm(it.nome)) || null;
      if (p && p.estoque != null && p.estoque <= 0) continue;
      const k = p?.id ?? norm(it.nome);
      const v: Vencendo = { produto: p, nome: p?.nome ?? it.nome, validade: it.validade, dias: falta, qtd: it.qtd, unidade: it.unidade, lote: `${l.fornecedor || 'Compra'} de ${l.data.split('-').reverse().join('/')}` };
      const atual = melhor.get(k);
      if (!atual || v.validade < atual.validade) melhor.set(k, v);
    }
  }
  return [...melhor.values()].sort((a, b) => a.dias - b.dias);
}
