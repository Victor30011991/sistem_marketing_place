import type { Cliente, ConfigFidelidade, Venda } from '../types';
import { ehDele } from './clientes';

/** Cartão fidelidade e aniversários: tudo calculado das vendas, sem guardar contador à parte. */

export const FIDELIDADE_PADRAO: ConfigFidelidade = { ativo: false, compras: 10, premio: '100 g de tempero à escolha', minimo: 0 };

export function fidelidadeDe(raw: unknown): ConfigFidelidade | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
  return {
    ativo: o.ativo === true,
    compras: Math.min(50, Math.max(2, Math.round(n(o.compras, 10)))),
    premio: typeof o.premio === 'string' && o.premio.trim() ? o.premio.slice(0, 120) : FIDELIDADE_PADRAO.premio,
    minimo: Math.round(n(o.minimo, 0)),
  };
}

export interface Cartao {
  /** compras que contam desde o último prêmio entregue */
  contadas: number;
  meta: number;
  faltam: number;
  premioPronto: boolean;
  /** prêmios já entregues */
  premios: number;
}

/** Situação do cartão de um cliente. Conta vendas não canceladas acima do mínimo, depois do último prêmio. */
export function cartaoDe(c: Cliente, vendas: Venda[], cfg: ConfigFidelidade): Cartao {
  const ultimo = [...(c.resgates ?? [])].sort().pop() ?? '';
  const contadas = vendas.filter((v) => !v.cancelada && v.total >= cfg.minimo && v.quando > ultimo && ehDele(c, v)).length;
  return { contadas, meta: cfg.compras, faltam: Math.max(0, cfg.compras - contadas), premioPronto: contadas >= cfg.compras, premios: c.resgates?.length ?? 0 };
}

/** Linha para o recibo: "Cartão fidelidade: 4 de 10" ou "prêmio liberado". */
export function linhaCartao(k: Cartao, cfg: ConfigFidelidade): string {
  return k.premioPronto ? `🎁 Cartão fidelidade completo! Na próxima visita você ganha: ${cfg.premio}.` : `⭐ Cartão fidelidade: ${k.contadas} de ${k.meta} compras. Faltam ${k.faltam} para ganhar ${cfg.premio}.`;
}

/** Bolinhas do cartão (●●●○○○). */
export const bolinhas = (k: Cartao) => '●'.repeat(Math.min(k.contadas, k.meta)) + '○'.repeat(Math.max(0, k.meta - k.contadas));

/** Clientes com aniversário nos próximos `dias` (0 = hoje). */
export function aniversariantes(clientes: Cliente[], hoje = new Date(), dias = 7): { cliente: Cliente; emDias: number }[] {
  const out: { cliente: Cliente; emDias: number }[] = [];
  for (const c of clientes) {
    if (!c.aniversario) continue;
    const [m, d] = c.aniversario.split('-').map(Number);
    for (let k = 0; k <= dias; k++) {
      const dt = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + k);
      if (dt.getMonth() + 1 === m && dt.getDate() === d) {
        out.push({ cliente: c, emDias: k });
        break;
      }
    }
  }
  return out.sort((a, b) => a.emDias - b.emDias);
}

/** Mensagem de parabéns, com o mimo do cartão fidelidade se estiver ativo. */
export function mensagemAniversario(c: Cliente, loja: string, presente?: string): string {
  const primeiro = c.nome.trim().split(/\s+/)[0] || '';
  return `Feliz aniversário${primeiro ? `, ${primeiro}` : ''}! 🎉 Toda a equipe da ${loja} deseja um dia cheio de sabor.${presente ? ` Passa aqui esta semana que tem um presente para você: ${presente}. 🎁` : ''}`;
}
