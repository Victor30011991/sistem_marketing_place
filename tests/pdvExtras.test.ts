import { describe, expect, it } from 'vitest';
import { estoqueBaixo, linkWhatsapp, maisVendidos, porNaListaCompras, reciboTexto, resumoDiaTexto, semanaPassada, ultimaCompra, variacao } from '../src/core/pdvExtras';
import { resumoVendas } from '../src/core/vendas';
import { defaultStore } from '../src/core/defaults';
import type { Product, Venda } from '../src/types';

const prod = (o: Partial<Product> & { id: string; nome: string }): Product => ({ categoria: '', unidade: 'kg', custo: 2000, custosAdicionais: 0, venda: 8000, propQtd: 100, propUnidade: 'g', observacoes: '', ...o });
const venda = (o: Partial<Venda> & { id: string; quando: string }): Venda => ({ itens: [{ produtoId: 'a', nome: 'Páprica', qtd: 50, unidade: 'g', total: 400, custo: 100 }], desconto: 0, total: 400, pagamento: 'pix', pagamentoLabel: 'Pix', taxa: 0, cliente: '', ...o });

describe('extras do PDV', () => {
  it('link do WhatsApp com 55 e sem número', () => {
    expect(linkWhatsapp('(11) 98888-7777', 'oi')).toBe('https://wa.me/5511988887777?text=oi');
    expect(linkWhatsapp('', 'a b')).toBe('https://wa.me/?text=a%20b');
  });
  it('recibo com itens, total e pagamento', () => {
    const t = reciboTexto(venda({ id: 'v', quando: '2026-11-22T15:00:00Z', cliente: 'Bruna Lima', troco: 100 }), { ...defaultStore(), nomeFantasia: 'Temperei' });
    expect(t).toContain('Oi, Bruna!');
    expect(t).toContain('• Páprica (50 g) — R$');
    expect(t).toContain('*Total: R$');
    expect(t).toContain('Pagamento: Pix');
    expect(t).toContain('Troco: R$');
  });
  it('última compra do cliente, ignorando canceladas', () => {
    const vs = [venda({ id: '1', quando: '2026-11-01T10:00:00Z', cliente: 'Bruna' }), venda({ id: '2', quando: '2026-11-10T10:00:00Z', cliente: 'bruna' }), venda({ id: '3', quando: '2026-11-12T10:00:00Z', cliente: 'Bruna', cancelada: 'x' })];
    expect(ultimaCompra(vs, { nome: 'Bruna' })?.id).toBe('2');
    expect(ultimaCompra(vs, { nome: 'Br' })).toBeNull();
  });
  it('mais vendidos pelo número de vendas nos últimos 30 dias', () => {
    const ps = [prod({ id: 'a', nome: 'Páprica' }), prod({ id: 'b', nome: 'Alho' }), prod({ id: 'c', nome: 'Sem preço', venda: null })];
    const vs = [venda({ id: '1', quando: '2026-11-20T10:00:00Z', itens: [{ produtoId: 'b', nome: 'Alho', qtd: 1, unidade: 'g', total: 1, custo: 0 }] }), venda({ id: '2', quando: '2026-11-21T10:00:00Z', itens: [{ produtoId: 'b', nome: 'Alho', qtd: 1, unidade: 'g', total: 1, custo: 0 }] }), venda({ id: '3', quando: '2026-09-01T10:00:00Z' })];
    expect(maisVendidos(vs, ps, 8, 30, new Date('2026-11-22T12:00:00Z')).map((p) => p.id)).toEqual(['b', 'a']);
  });
  it('semana passada, variação e resumo', () => {
    const vs = [venda({ id: '1', quando: '2026-11-15T15:00:00', total: 1000 }), venda({ id: '2', quando: '2026-11-22T15:00:00', total: 1500 })];
    const comp = semanaPassada(vs, '2026-11-22');
    expect(comp).toMatchObject({ dia: '2026-11-15', total: 1000, vendas: 1 });
    expect(variacao(1500, 1000)).toBe(50);
    expect(variacao(10, 0)).toBeNull();
    const t = resumoDiaTexto(resumoVendas([vs[1]]), '2026-11-22', { ...defaultStore(), nomeFantasia: 'Temperei' }, comp);
    expect(t).toContain('*Fechamento 22/11/2026 · Temperei*');
    expect(t).toContain('+50% em relação à semana passada');
  });
  it('estoque baixo e lista de compras', () => {
    const ps = [prod({ id: 'a', nome: 'Páprica', estoque: 0.2, estoqueMinimo: 0.5 }), prod({ id: 'b', nome: 'Alho', estoque: 3, estoqueMinimo: 1 }), prod({ id: 'c', nome: 'Sem mínimo', estoque: 0 })];
    const baixos = estoqueBaixo(ps, ['a', 'b', 'c']);
    expect(baixos.map((p) => p.id)).toEqual(['a']);
    const l = porNaListaCompras(undefined, baixos);
    expect(l.itens).toEqual([{ produtoId: 'a', qtd: 0.8, unidade: 'kg' }]);
    expect(porNaListaCompras(l, baixos).itens).toHaveLength(1);
  });
});
