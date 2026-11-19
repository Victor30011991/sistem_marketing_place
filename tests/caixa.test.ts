import { describe, expect, it } from 'vitest';
import type { Product, Venda } from '../src/types';
import { abrirCaixa, caixaAberto, caixasDe, fecharCaixa, movimento, resumoCaixa, textoFechamento } from '../src/core/caixa';
import { registrosDe } from '../src/core/historico';
import { dividir } from '../src/nuvem/modelo';
import { defaultSettings, defaultStore } from '../src/core/defaults';

const v = (id: string, quando: string, total: number, extra: Partial<Venda> = {}): Venda => ({
  id, quando, itens: [], desconto: 0, total, pagamento: 'pix', pagamentoLabel: 'Pix', taxa: 0, cliente: '', ...extra,
});

describe('caixa do dia', () => {
  const ab = abrirCaixa(5000, 'Victor', new Date(2026, 10, 19, 8, 0));
  const vendas = [
    v('1', new Date(2026, 10, 19, 9).toISOString(), 3000, { pagamento: 'dinheiro', pagamentos: [{ forma: 'dinheiro', label: 'Dinheiro', valor: 3000, taxa: 0 }] }),
    v('2', new Date(2026, 10, 19, 10).toISOString(), 4000, { pagamentos: [{ forma: 'pix', label: 'Pix', valor: 1000, taxa: 0 }, { forma: 'dinheiro', label: 'Dinheiro', valor: 3000, taxa: 0 }] }),
    v('3', new Date(2026, 10, 19, 11).toISOString(), 999, { pagamento: 'dinheiro', cancelada: 'x' }),
    v('4', new Date(2026, 10, 19, 7).toISOString(), 777, { pagamento: 'dinheiro' }), // antes de abrir
    v('5', new Date(2026, 10, 18, 9).toISOString(), 555, { pagamento: 'dinheiro' }), // outro dia
  ];
  it('previsto = troco + dinheiro das vendas + reforços − sangrias', () => {
    const c = { ...ab, movimentos: [movimento('sangria', 2000, 'motoboy', 'Samara'), movimento('reforco', 1000, '', 'Victor')] };
    const r = resumoCaixa(c, vendas);
    expect(r).toMatchObject({ dinheiro: 6000, reforcos: 1000, sangrias: 2000, previsto: 10000, diferenca: null });
    expect(r.vendas.vendas).toBe(2);
    const f = fecharCaixa(c, vendas, 9800, 'Samara', '', new Date(2026, 10, 19, 18));
    expect(f).toMatchObject({ previsto: 10000, contado: 9800, fechadoPor: 'Samara' });
    expect(resumoCaixa(f, vendas).diferenca).toBe(-200);
    expect(textoFechamento(f, vendas, 'Temperei')).toContain('Diferença: faltou R$');
    expect(caixaAberto([f])).toBeNull();
    expect(caixaAberto([f, ab])?.id).toBe(ab.id);
    expect(caixasDe([f, { dia: 'x' }])).toEqual([f]);
  });
});

describe('histórico de alterações', () => {
  const p = (extra: Partial<Product> = {}): Product => ({ id: 'a', nome: 'Açafrão', categoria: 'T', unidade: 'kg', custo: 2000, custosAdicionais: 0, venda: 4400, propQtd: null, propUnidade: null, observacoes: '', estoque: 5, ...extra });
  const est = (prods: Product[], vendas: Venda[] = []) => dividir({ lista: { nome: 'L', categorias: [], produtos: prods }, loja: defaultStore(), config: { ...defaultSettings(), vendas } });
  it('preço, estoque à mão, produto novo e excluído', () => {
    const r = registrosDe(est([p(), p({ id: 'b', nome: 'Cominho' })]), est([p({ venda: 4600, estoque: 4 }), p({ id: 'c', nome: 'Orégano' })]), 'Samara', 'Q');
    expect(r.map((x) => [x.acao, x.detalhe, x.por])).toEqual([
      ['Preço mudou', 'Açafrão: R$ 44,00 → R$ 46,00/kg', 'Samara'],
      ['Estoque ajustado', 'Açafrão: 5 → 4 kg', 'Samara'],
      ['Produto novo', 'Orégano · R$ 44,00/kg', 'Samara'],
      ['Produto excluído', 'Cominho', 'Samara'],
    ].map(([a, d, q]) => [a, d.replace(/ /g, ' '), q]).map(([a, d, q]) => [a, expect.stringContaining(d.split(':')[0]), q]));
  });
  it('estoque que baixou por venda não vira "ajuste"; venda cancelada é registrada', () => {
    const venda = v('1', '2026-11-19T10:00:00', 1100);
    expect(registrosDe(est([p()]), est([p({ estoque: 4.75 })], [venda]), 'Victor')).toEqual([]);
    const r = registrosDe(est([p()], [venda]), est([p({ estoque: 5.25 })], [{ ...venda, cancelada: 'x' }]), 'Victor');
    expect(r.map((x) => x.acao)).toEqual(['Venda cancelada']);
  });
  it('primeira subida não gera histórico', () => {
    expect(registrosDe({ ...est([]), raiz: null }, est([p()]), 'Victor')).toEqual([]);
  });
});
