import { describe, expect, it } from 'vitest';
import { potencialEstoque, taxaMedia } from '../src/core/potencial';
import { defaultSettings } from '../src/core/defaults';
import type { Product, Settings, Venda } from '../src/types';

const prod = (o: Partial<Product> & { id: string }): Product => ({ nome: o.id, categoria: '', unidade: 'kg', custo: 4000, custosAdicionais: 0, venda: 10000, propQtd: 100, propUnidade: 'g', observacoes: '', estoque: 2, ...o });
const hoje = new Date('2026-11-23T15:00:00');
const cfg = (o: Partial<Settings> = {}): Settings => ({ ...defaultSettings(), custosFixos: [], custosVariaveis: [], proLabore: 0, ...o });
const venda = (dias: number, total: number, taxa = 0, itens: Venda['itens'] = []): Venda => ({ id: 'v' + dias + total, quando: new Date(hoje.getTime() - dias * 864e5).toISOString(), itens, desconto: 0, total, pagamento: 'pix', pagamentoLabel: 'Pix', taxa, cliente: '' });

describe('potencial do estoque', () => {
  it('vende tudo pelo preço de hoje: investimento, faturamento e lucros', () => {
    const r = potencialEstoque([prod({ id: 'a' })], [], cfg({ pagamentoBase: 'pix' }), { vende: 100, desconto: 0, forma: 'pix' }, hoje);
    expect(r).toMatchObject({ investimento: 8000, faturamento: 20000, lucroBruto: 12000, taxas: 0, lucroLiquido: 12000, margemBruta: 60, retorno: 1.5 });
    expect(r.linhas[0]).toMatchObject({ qtd: 2, retorno: 1.5, dias: null });
  });
  it('cenário: vende 80%, 10% de desconto, crédito, imposto e despesas fixas', () => {
    const s = cfg({ taxas: { debito: 2, creditoVista: 5, parcelado: [] }, custosVariaveis: [{ id: 'i', descricao: 'Simples', tipo: 'percentual', valor: 6 }], custosFixos: [{ id: 'f', descricao: 'Aluguel', valor: 3000 }] });
    const r = potencialEstoque([prod({ id: 'a', estoque: 10 })], [], s, { vende: 80, desconto: 10, forma: 'credito_vista' }, hoje);
    // 8 kg × R$ 100 × 0,9 = R$ 720; custo 8 × 40 = 320
    expect(r.faturamento).toBe(72000);
    expect(r.lucroBruto).toBe(40000);
    expect(r.taxas).toBe(3600);
    expect(r.variaveis).toBe(4320);
    expect(r.despesasFixas).toBe(3000); // sem ritmo de vendas: 1 mês
    expect(r.lucroLiquido).toBe(40000 - 3600 - 4320 - 3000);
    expect(r.investimento).toBe(40000);
  });
  it('tempo para vender pelo ritmo dos últimos 30 dias e despesas proporcionais', () => {
    const vs = [venda(5, 5000, 0, [{ produtoId: 'a', nome: 'a', qtd: 3000, unidade: 'g', total: 30000, custo: 12000 }])];
    const r = potencialEstoque([prod({ id: 'a', estoque: 6 })], vs, cfg({ custosFixos: [{ id: 'f', descricao: 'x', valor: 3000 }] }), { vende: 100, desconto: 0, forma: 'pix' }, hoje);
    // vendeu 3 kg em 30 dias → 0,1 kg/dia → 6 kg em 60 dias
    expect(r.linhas[0].dias).toBe(60);
    expect(r.dias).toBe(60);
    expect(r.despesasFixas).toBe(6000);
  });
  it('lista o que falta preencher', () => {
    const r = potencialEstoque([prod({ id: 'sc', custo: null }), prod({ id: 'sp', venda: null }), prod({ id: 'se', estoque: null }), prod({ id: 'z', estoque: 0 })], [], cfg(), undefined, hoje);
    expect(r.faltam.map((f) => f.motivo)).toEqual(['sem custo', 'sem preço de venda']);
    expect(r.semEstoqueInformado).toBe(1);
    expect(r.linhas).toHaveLength(0);
  });
  it('taxa média das vendas recentes', () => {
    expect(taxaMedia([venda(1, 10000, 300), venda(2, 10000, 100), venda(200, 10000, 5000)], cfg(), hoje)).toBe(2);
  });
});
