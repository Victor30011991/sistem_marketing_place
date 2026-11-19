import { describe, expect, it } from 'vitest';
import type { Lote, Product, Venda } from '../src/types';
import { defaultSettings } from '../src/core/defaults';
import { compras, estoque, painel, periodoAnterior, periodoDe, ranking, resultado, variacao } from '../src/core/relatorios';

const HOJE = new Date(2026, 10, 19, 10); // 19/11/2026 (quinta)
const prod = (id: string, nome: string, extra: Partial<Product> = {}): Product => ({
  id, nome, categoria: 'Temperos', unidade: 'kg', custo: 2000, custosAdicionais: 0, venda: 4400, propQtd: 100, propUnidade: 'g', observacoes: '', ...extra,
});
const venda = (id: string, quando: string, itens: [string, number, number, number][], extra: Partial<Venda> = {}): Venda => ({
  id, quando, desconto: 0, pagamento: 'pix', pagamentoLabel: 'Pix', taxa: 0, cliente: '',
  itens: itens.map(([produtoId, g, total, custo]) => ({ produtoId, nome: produtoId, qtd: g, unidade: 'g', total, custo })),
  total: itens.reduce((a, i) => a + i[2], 0),
  ...extra,
});

const P = [prod('a', 'Açafrão', { estoque: 2 }), prod('c', 'Cominho', { categoria: 'Sementes', estoque: 5 }), prod('x', 'Parado', { estoque: 3, custo: 1000 })];
const V = [
  venda('1', '2026-11-19T09:30:00', [['a', 500, 2200, 1000]]),
  venda('2', '2026-11-18T15:10:00', [['a', 250, 1100, 500], ['c', 100, 440, 200]], { taxa: 30 }),
  venda('3', '2026-11-03T11:00:00', [['c', 1000, 4400, 2000]]),
  venda('4', '2026-10-10T11:00:00', [['a', 1000, 4400, 2000]]),
  venda('5', '2026-11-18T16:00:00', [['a', 1000, 4400, 2000]], { cancelada: '2026-11-18T16:05:00' }),
];

describe('períodos', () => {
  it('atalhos e comparação', () => {
    expect(periodoDe('7d', HOJE)).toEqual({ de: '2026-11-13', ate: '2026-11-19' });
    expect(periodoDe('mesPassado', HOJE)).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
    expect(periodoAnterior(periodoDe('mes', HOJE))).toEqual({ de: '2026-10-01', ate: '2026-10-19' });
    expect(periodoAnterior({ de: '2026-10-01', ate: '2026-10-31' })).toEqual({ de: '2026-09-01', ate: '2026-09-30' });
    expect(periodoAnterior(periodoDe('7d', HOJE))).toEqual({ de: '2026-11-06', ate: '2026-11-12' });
    expect(variacao(120, 100)).toBe(20);
    expect(variacao(5, 0)).toBeNull();
  });
});

describe('painel', () => {
  it('soma por dia, dia da semana e hora, sem as canceladas', () => {
    const r = painel(V, periodoDe('mes', HOJE));
    expect(r.resumo.total).toBe(2200 + 1540 + 4400);
    expect(r.anterior.total).toBe(4400);
    expect(r.porDia).toHaveLength(19);
    expect(r.porDia.at(-2)).toEqual({ dia: '2026-11-18', total: 1540, vendas: 1 });
    expect(r.porHora[15].total).toBe(1540);
    expect(r.porSemana[3].total).toBe(1540); // quarta-feira
  });
});

describe('ranking', () => {
  it('produtos e categorias com kg e lucro', () => {
    const r = ranking(V, P);
    expect(r.produtos[0]).toMatchObject({ nome: 'Açafrão', total: 7700, lucro: 4200, qtd: 1.75, unidade: 'kg', vendas: 3 });
    expect(r.categorias.map((c) => c.nome)).toEqual(['Temperos', 'Sementes']);
    expect(r.produtos[0].margem).toBe(54.5);
  });
});

describe('resultado do mês', () => {
  it('desconta custos, taxas, variáveis, fixas e pró-labore', () => {
    const s = { ...defaultSettings(), custosFixos: [{ id: 'f', descricao: 'Aluguel', valor: 5000 }], custosVariaveis: [{ id: 'v', descricao: 'Simples', tipo: 'percentual' as const, valor: 6 }], proLabore: 1000 };
    const r = resultado(V, s, { de: '2026-10-01', ate: '2026-10-31' });
    expect(r).toMatchObject({ faturamento: 4400, custoMercadoria: 2000, taxas: 0, variaveis: 264, contribuicao: 2136, despesasFixas: 5000, lucro: -2864, lucroFinal: -3864, fracaoMes: 1 });
    // contribuição de 48,5%: precisa vender 6000 / 0,4855 para pagar fixas + pró-labore
    expect(r.pontoEquilibrio).toBe(Math.round(6000 / (2136 / 4400)));
    expect(r.falta).toBe(r.pontoEquilibrio! - 4400);
    expect(resultado(V, s, periodoDe('7d', HOJE)).fracaoMes).toBeCloseTo(7 / 30, 3);
  });
});

describe('estoque', () => {
  it('valor parado, ritmo e produtos sem venda', () => {
    const r = estoque(P, V, HOJE);
    expect(r.valorTotal).toBe(2 * 2000 + 5 * 2000 + 3 * 1000);
    const a = r.linhas.find((l) => l.produto.id === 'a')!;
    expect(a.vendido30).toBe(0.75);
    expect(a.diasRestantes).toBe(80);
    expect(r.parados.map((l) => l.produto.id)).toEqual(['x']);
  });
});

describe('compras', () => {
  it('total por fornecedor e variação do custo por kg', () => {
    const lote = (id: string, data: string, valor: number): Lote => ({
      id, data, fornecedor: 'Zona Cerealista', numero: id, frete: 0, juros: 0, outras: 0, desconto: 0, rateio: 'peso', custo: 'medio', aplicadoEm: data,
      itens: [{ id: 'i' + id, nome: 'Açafrão', produtoId: 'a', categoria: '', ncm: '', unidade: 'kg', qtd: 10, valor, desconto: 0 }],
    });
    const r = compras([lote('1', '2026-09-01', 20000), lote('2', '2026-11-05', 22000)], P, defaultSettings(), periodoDe('mes', HOJE));
    expect(r.total).toBe(22000);
    expect(r.porFornecedor).toEqual([{ nome: 'Zona Cerealista', total: 22000, lotes: 1 }]);
    expect(r.precos[0]).toMatchObject({ nome: 'Açafrão', antes: 2000, agora: 2200, variacao: 10 });
  });
});
