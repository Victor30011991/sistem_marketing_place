import { describe, expect, it } from 'vitest';
import type { Lote, Product, Venda } from '../src/types';
import { comPromo, promoAtiva } from '../src/core/promo';
import { itemVenda } from '../src/core/vendas';
import { LIMITE_FOTOS, montarCardapio } from '../src/core/vitrine';
import { defaultStore } from '../src/core/defaults';

const p = (id: string, nome: string, extra: Partial<Product> = {}): Product => ({ id, nome, categoria: 'Temperos', unidade: 'kg', custo: 2000, custosAdicionais: 0, venda: 4400, propQtd: 100, propUnidade: 'g', observacoes: '', ...extra });

describe('promoção', () => {
  it('vale enquanto ativa e só se for menor que o preço', () => {
    const x = p('a', 'Açafrão', { promo: { preco: 3900, ate: '2026-11-30', selo: 'Oferta' } });
    expect(promoAtiva(x, '2026-11-19')).toBe(true);
    expect(promoAtiva(x, '2026-12-01')).toBe(false);
    expect(promoAtiva({ ...x, promo: { preco: 5000, ate: '', selo: '' } }, '2026-11-19')).toBe(false);
    expect(comPromo(x, '2026-11-19').venda).toBe(3900);
    // no PDV cobra o preço da promoção (data de hoje: sem fim)
    expect(itemVenda({ ...x, promo: { ...x.promo!, ate: '' } }, 500, 'g')!.total).toBe(1950);
  });
  it('cardápio: preço com promoção, preço antigo, selo, foto e destaques', () => {
    const hoje = new Date(2026, 10, 19, 12);
    const prods = [
      p('a', 'Açafrão', { promo: { preco: 3900, ate: '', selo: 'Oferta da semana' }, foto: 'data:image/jpeg;base64,AAAA' }),
      p('b', 'Cominho'),
      p('c', 'Orégano', { foto: 'data:image/jpeg;base64,' + 'x'.repeat(LIMITE_FOTOS) }),
    ];
    const vendas: Venda[] = [{ id: 'v', quando: '2026-11-18T10:00:00', itens: [{ produtoId: 'b', nome: 'Cominho', qtd: 100, unidade: 'g', total: 440, custo: 0 }], desconto: 0, total: 440, pagamento: 'pix', pagamentoLabel: 'Pix', taxa: 0, cliente: '' }];
    const lotes = [{ id: 'l', data: '2026-11-15', aplicadoEm: '2026-11-15T10:00:00', itens: [{ produtoId: 'c' }] } as unknown as Lote];
    const r = montarCardapio({ nome: 'L', categorias: ['Temperos'], produtos: prods }, defaultStore(), null, hoje, { vendas, lotes });
    expect(r.arquivo.categorias.map((c) => c.nome)).toEqual(['Ofertas', 'Mais vendidos', 'Chegou agora', 'Temperos']);
    const a = r.arquivo.categorias[0].itens[0];
    expect(a).toMatchObject({ i: 'a', pk: 3900, pa: 4400, s: 'Oferta da semana', f: 'data:image/jpeg;base64,AAAA' });
    expect(r.total).toBe(3);
    expect(r.semFoto).toBe(1);
    // sem destaques
    const s = montarCardapio({ nome: 'L', categorias: ['Temperos'], produtos: prods }, { ...defaultStore(), vitrine: { ...(defaultStore().vitrine ?? {}), destaques: false } as never }, null, hoje, { vendas, lotes });
    expect(s.arquivo.categorias.map((c) => c.nome)).toEqual(['Temperos']);
  });
});
