import { describe, expect, it } from 'vitest';
import { resumoCaixa, vendasDoCaixa } from '../src/core/caixa';
import { conferir, diaRelativo } from '../src/components/VendaOutroDia';
import type { Caixa, Venda } from '../src/types';

const local = (d: string) => new Date(d).toISOString(); // d em hora local
const venda = (quando: string, total: number, lancadaEm?: string): Venda =>
  ({ id: quando + total, quando: local(quando), ...(lancadaEm ? { lancadaEm: local(lancadaEm) } : {}), itens: [], desconto: 0, total, pagamento: 'dinheiro', pagamentoLabel: 'Dinheiro', taxa: 0, cliente: '', pagamentos: [{ forma: 'dinheiro', label: 'Dinheiro', valor: total }] }) as unknown as Venda;
const caixa = (dia: string, abre: string, fecha?: string): Caixa => ({ id: dia, dia, abertoEm: local(abre), abertoPor: '', trocoInicial: 5000, movimentos: [], ...(fecha ? { fechadoEm: local(fecha) } : {}) });

describe('venda de outro dia no caixa', () => {
  const hoje = caixa('2026-11-25', '2026-11-25T08:00');
  const ontem = caixa('2026-11-24', '2026-11-24T08:00', '2026-11-24T18:00');

  it('venda esquecida de hoje, lançada com o caixa aberto, entra (o dinheiro está na gaveta)', () => {
    expect(vendasDoCaixa(hoje, [venda('2026-11-25T10:00', 1000, '2026-11-25T15:00')])).toHaveLength(1);
  });
  it('venda de ontem lançada hoje não entra no caixa de hoje', () => {
    expect(vendasDoCaixa(hoje, [venda('2026-11-24T10:00', 1000, '2026-11-25T09:00')])).toHaveLength(0);
  });
  it('venda de ontem lançada hoje não mexe no caixa de ontem, já fechado', () => {
    const antes = resumoCaixa(ontem, [venda('2026-11-24T09:00', 2000)]);
    const depois = resumoCaixa(ontem, [venda('2026-11-24T09:00', 2000), venda('2026-11-24T10:00', 1000, '2026-11-25T09:00')]);
    expect(depois.previsto).toBe(antes.previsto);
    expect(depois.vendas.vendas).toBe(1);
  });
  it('venda de hoje antes do caixa abrir não entra', () => {
    expect(vendasDoCaixa(hoje, [venda('2026-11-25T07:00', 1000, '2026-11-25T09:00')])).toHaveLength(0);
  });
  it('venda normal continua igual', () => {
    expect(vendasDoCaixa(hoje, [venda('2026-11-25T09:00', 1000)])).toHaveLength(1);
  });
});

describe('conferência com o caderno', () => {
  it('compara o total lançado com o anotado', () => {
    expect(conferir(4500, null).estado).toBe('vazio');
    expect(conferir(4500, 4500)).toEqual({ estado: 'confere', diferenca: 0 });
    expect(conferir(3000, 4500)).toEqual({ estado: 'falta', diferenca: 1500 });
    expect(conferir(5000, 4500)).toEqual({ estado: 'passou', diferenca: 500 });
  });
  it('ontem e anteontem mantêm a hora escolhida, inclusive na virada do mês', () => {
    const agora = new Date(2026, 11, 1, 9, 30);
    expect(diaRelativo(1, '14:20', agora)).toBe('2026-11-30T14:20');
    expect(diaRelativo(2, undefined, agora)).toBe('2026-11-29T12:00');
  });
});
