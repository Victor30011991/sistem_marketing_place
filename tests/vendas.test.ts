import { describe, expect, it } from 'vitest';
import { diaLocal, fecharVenda, itemVenda, lerPedidoWhatsapp, qtdPorValor, moverEstoque, resumoVendas, unidadeDeVenda } from '../src/core/vendas';
import { defaultSettings, defaultStore } from '../src/core/defaults';
import { montarCardapio, VITRINE_PADRAO } from '../src/core/vitrine';
import { criarBackup, lerBackup } from '../src/core/backup';
import type { Product, Venda } from '../src/types';

const prod = (o: Partial<Product> & { id: string; nome: string }): Product => ({
  categoria: 'Temperos', unidade: 'kg', custo: 2191, custosAdicionais: 0, venda: 5250, propQtd: 100, propUnidade: 'g', observacoes: '', estoque: 3, ...o,
});
const acafrao = prod({ id: 'a', nome: 'Açafrão em Pó Puro' });
const chia = prod({ id: 'c', nome: 'Chia Premium', venda: 6300, custo: 2700, estoque: null });
const pacote = prod({ id: 'p', nome: 'Granola 500 g', unidade: 'pacote', venda: 2000, custo: 1000, estoque: 10, conteudoQtd: 500, conteudoUnidade: 'g' });

const venda = (itens: ReturnType<typeof itemVenda>[], o: Partial<Venda> = {}): Venda => {
  const its = itens.filter((x): x is NonNullable<typeof x> => !!x);
  const f = fecharVenda(its, { tipo: 'valor', valor: o.desconto ?? 0 }, defaultSettings(), o.pagamento ?? 'pix');
  return { id: Math.random().toString(36), quando: '2026-11-18T15:00:00', itens: its, desconto: f.desconto, total: f.total, pagamento: 'pix', pagamentoLabel: 'Dinheiro ou Pix', taxa: f.taxa, cliente: '', ...o };
};

describe('PDV: itens e fechamento', () => {
  it('vende por grama com preço de tabela e custo do que sai do estoque', () => {
    expect(unidadeDeVenda(acafrao)).toBe('g');
    expect(itemVenda(acafrao, 250)).toEqual({ produtoId: 'a', nome: 'Açafrão em Pó Puro', qtd: 250, unidade: 'g', total: 1313, custo: 548 });
    expect(itemVenda(acafrao, 0)).toBeNull();
    expect(itemVenda({ ...acafrao, venda: null }, 100)).toBeNull();
  });
  it('pacote com conteúdo: vende inteiro ou por grama', () => {
    expect(itemVenda(pacote, 2)?.total).toBe(4000);
    expect(itemVenda(pacote, 250, 'g')?.total).toBe(1000);
  });
  it('desconto e taxa da maquininha', () => {
    const s = defaultSettings();
    s.taxas.debito = 1.99;
    const f = fecharVenda([itemVenda(acafrao, 1000)!], { tipo: 'pct', valor: 10 }, s, 'debito');
    expect(f).toEqual({ subtotal: 5250, desconto: 525, total: 4725, taxa: 94, liquido: 4631 });
    expect(fecharVenda([itemVenda(acafrao, 100)!], { tipo: 'valor', valor: 99999 }, s, 'pix').total).toBe(0);
  });
});

describe('PDV: estoque', () => {
  it('baixa na venda, devolve no cancelamento e não mexe em produto sem controle', () => {
    const its = [itemVenda(acafrao, 250)!, itemVenda(chia, 300)!, itemVenda(pacote, 250, 'g')!];
    const depois = moverEstoque([acafrao, chia, pacote], its, -1);
    expect(depois.map((p) => p.estoque)).toEqual([2.75, null, 9.5]);
    expect(moverEstoque(depois, its, 1).map((p) => p.estoque)).toEqual([3, null, 10]);
  });
  it('o catálogo esconde sozinho o que zerou (e só quando a opção está ligada)', () => {
    const zerado = { ...acafrao, estoque: 0 };
    const loja = { ...defaultStore(), vitrine: { ...VITRINE_PADRAO } };
    const r = montarCardapio({ nome: 'L', categorias: ['Temperos'], produtos: [zerado, chia] }, loja, null);
    expect(r.fora.map((f) => f.motivo)).toEqual(['sem-estoque']);
    const r2 = montarCardapio({ nome: 'L', categorias: ['Temperos'], produtos: [zerado, chia] }, { ...loja, vitrine: { ...VITRINE_PADRAO, ocultarSemEstoque: false } }, null);
    expect(r2.total).toBe(2);
  });
});

describe('PDV: resumo do dia', () => {
  it('soma por forma de pagamento, ignora canceladas e calcula o lucro bruto', () => {
    const v1 = venda([itemVenda(acafrao, 1000)], { desconto: 250 });
    const v2 = venda([itemVenda(chia, 500)], { pagamento: 'debito', pagamentoLabel: 'Cartão de débito', taxa: 63 });
    const v3 = venda([itemVenda(acafrao, 100)], { cancelada: '2026-11-18T16:00:00' });
    const r = resumoVendas([v1, v2, v3]);
    expect(r.vendas).toBe(2);
    expect(r.canceladas).toBe(1);
    expect(r.bruto).toBe(5250 + 3150);
    expect(r.descontos).toBe(250);
    expect(r.total).toBe(5000 + 3150);
    expect(r.custo).toBe(2191 + 1350);
    expect(r.taxas).toBe(63);
    expect(r.lucroBruto).toBe(8150 - 3541 - 63);
    expect(r.ticketMedio).toBe(4075);
    expect(r.porPagamento.map((p) => p.label)).toEqual(['Dinheiro ou Pix', 'Cartão de débito']);
    expect(r.maisVendidos[0].nome).toBe('Açafrão em Pó Puro');
  });
  it('data local', () => {
    expect(diaLocal(new Date(2026, 10, 18, 23, 59))).toBe('2026-11-18');
  });
});

describe('PDV: pedido do WhatsApp', () => {
  const msg = `Olá, Temperei! Gostaria de fazer este pedido pelo catálogo:

\`\`\`
Açafrão em Pó Puro
  250 g                R$ 13,13
Chia Premium
  1,5 kg              R$ 94,50
Produto que não existe
  100 g                R$ 1,00
Granola 500 g
  250 g                R$ 10,00
------------------------------
Subtotal             R$ 118,63
Entrega             a combinar
\`\`\`

*Nome:* Samara
*Endereço:* Quadra M2`;
  it('acha os produtos e as gramas, e lista o que não achou', () => {
    const r = lerPedidoWhatsapp(msg, [acafrao, chia, pacote]);
    expect(r.itens).toEqual([
      { produtoId: 'a', qtd: 250, unidade: 'g' },
      { produtoId: 'c', qtd: 1500, unidade: 'g' },
      { produtoId: 'p', qtd: 250, unidade: 'g' },
    ]);
    expect(r.naoAchados).toEqual(['Produto que não existe']);
    expect(r.cliente).toBe('Samara');
  });
  it('nome cortado com "…" na mensagem ainda é achado', () => {
    const longo = prod({ id: 'm', nome: 'Amendoim Crocante Mostarda e Mel' });
    const r = lerPedidoWhatsapp('x\nAmendoim Crocante Mostarda e …\n  1,5 kg   R$ 94,50', [longo]);
    expect(r.itens).toEqual([{ produtoId: 'm', qtd: 1500, unidade: 'g' }]);
  });
});

describe('vendas e lista de compras no backup', () => {
  it('sobrevivem ao backup .txt', () => {
    const cfg = defaultSettings();
    cfg.vendas = [venda([itemVenda(acafrao, 250)])];
    cfg.compras = { fornecedor: 'Reis', telefone: '45 3016', obs: 'urgente', itens: [{ produtoId: 'a', qtd: 3, unidade: 'kg' }] };
    const r = lerBackup(criarBackup({ nome: 'L', produtos: [acafrao], categorias: [] }, defaultStore(), cfg));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.vendas).toEqual(cfg.vendas);
      expect(r.config.compras).toEqual(cfg.compras);
    }
  });
});


describe('PDV novo: desconto por item e pagamento dividido', () => {
  it('desconto do item em % ou em R$, limitado ao valor do item', async () => {
    const { descontoDoTexto, comDesconto } = await import('../src/core/vendas');
    expect(descontoDoTexto('10%', 1313)).toBe(131);
    expect(descontoDoTexto('2,50', 1313)).toBe(250);
    expect(descontoDoTexto('R$ 1,00', 1313)).toBe(100);
    expect(descontoDoTexto('-5%', 1000)).toBe(50);
    expect(descontoDoTexto('99', 1313)).toBe(1313);
    expect(descontoDoTexto('abc', 1313)).toBe(0);
    expect(descontoDoTexto('', 1313)).toBe(0);
    const it = comDesconto(itemVenda(acafrao, 250)!, 131);
    expect(it).toMatchObject({ total: 1182, desconto: 131 });
  });

  it('dividir em Pix + débito: falta, taxa de cada parte e nada de troco', async () => {
    const { fecharPdv } = await import('../src/core/vendas');
    const s = defaultSettings();
    s.taxas.debito = 2;
    const its = [itemVenda(acafrao, 1000)!]; // R$ 52,50
    const meio = fecharPdv(its, { tipo: 'valor', valor: null }, [{ forma: 'pix', valor: 3000 }], s);
    expect(meio).toMatchObject({ total: 5250, pago: 3000, falta: 2250, troco: 0 });
    const f = fecharPdv(its, { tipo: 'valor', valor: null }, [{ forma: 'pix', valor: 3000 }, { forma: 'debito', valor: 2250 }], s);
    expect(f).toMatchObject({ falta: 0, troco: 0, excesso: 0, taxa: 45, liquido: 5205 });
    expect(f.pagamentos.map((p) => [p.label, p.valor, p.taxa])).toEqual([['Pix', 3000, 0], ['Cartão de débito', 2250, 45]]);
  });

  it('dinheiro a mais vira troco e sai do valor em dinheiro; Pix a mais não dá troco', async () => {
    const { fecharPdv } = await import('../src/core/vendas');
    const s = defaultSettings();
    const its = [itemVenda(acafrao, 1000)!];
    const f = fecharPdv(its, { tipo: 'valor', valor: null }, [{ forma: 'dinheiro', valor: 10000 }], s);
    expect(f).toMatchObject({ total: 5250, pago: 10000, troco: 4750, excesso: 0 });
    expect(f.pagamentos).toEqual([{ forma: 'dinheiro', label: 'Dinheiro', valor: 5250, taxa: 0 }]);
    const g = fecharPdv(its, { tipo: 'valor', valor: null }, [{ forma: 'pix', valor: 6000 }], s);
    expect(g).toMatchObject({ troco: 0, excesso: 750 });
  });

  it('descontos dos itens e da venda entram no total e no resumo do dia', async () => {
    const { fecharPdv, comDesconto } = await import('../src/core/vendas');
    const its = [comDesconto(itemVenda(acafrao, 1000)!, 250)]; // 52,50 − 2,50
    const f = fecharPdv(its, { tipo: 'valor', valor: 500 }, [{ forma: 'pix', valor: 4500 }], defaultSettings());
    expect(f).toMatchObject({ bruto: 5250, descontoItens: 250, subtotal: 5000, desconto: 500, total: 4500, falta: 0 });
    const v = venda([], { itens: its, desconto: 500, total: 4500, pagamentos: f.pagamentos });
    const r = resumoVendas([v]);
    expect(r).toMatchObject({ bruto: 5250, descontos: 750, total: 4500 });
  });

  it('resumo do dia separa as formas de uma venda dividida', async () => {
    const v = venda([itemVenda(acafrao, 1000)], {
      total: 5250,
      pagamentos: [
        { forma: 'pix', label: 'Pix', valor: 3000, taxa: 0 },
        { forma: 'debito', label: 'Cartão de débito', valor: 2250, taxa: 45 },
      ],
    });
    const r = resumoVendas([v]);
    expect(r.porPagamento).toEqual([
      { label: 'Pix', vendas: 1, total: 3000 },
      { label: 'Cartão de débito', vendas: 1, total: 2250 },
    ]);
  });

  it('pagamentos, troco, desconto do item e vendas pausadas sobrevivem ao backup', async () => {
    const { comDesconto } = await import('../src/core/vendas');
    const cfg = defaultSettings();
    cfg.vendas = [venda([comDesconto(itemVenda(acafrao, 250)!, 100)], { troco: 750, pagamentos: [{ forma: 'dinheiro', label: 'Dinheiro', valor: 1213, taxa: 0 }] })];
    cfg.vendasPausadas = [{ id: 'p1', quando: '2026-11-18T15:00:00', cliente: 'Samara', linhas: [{ produtoId: 'a', qtd: 250, unidade: 'g', desconto: '10%' }] }];
    const r = lerBackup(criarBackup({ nome: 'L', produtos: [acafrao], categorias: [] }, defaultStore(), cfg));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.vendas).toEqual(cfg.vendas);
      expect(r.config.vendasPausadas).toEqual(cfg.vendasPausadas);
    }
  });
});

describe('venda pelo valor (R$ 4 de páprica)', () => {
  const base = { categoria: '', custo: 3000, custosAdicionais: 0, propQtd: 100, propUnidade: 'g', observacoes: '' };
  it('converte o valor em gramas pelo preço do kg', () => {
    const paprica = { ...base, id: 'p', nome: 'Páprica', unidade: 'kg', venda: 8000 } as Product; // R$ 80/kg
    expect(qtdPorValor(paprica, 400)).toEqual({ qtd: 50, unidade: 'g' });
    expect(qtdPorValor(paprica, 0)).toBeNull();
  });
  it('produto por unidade vira fração', () => {
    const pote = { ...base, id: 'u', nome: 'Pote', unidade: 'un', venda: 1500 } as Product;
    expect(qtdPorValor(pote, 3000)).toEqual({ qtd: 2, unidade: 'un' });
  });
  it('sem preço não calcula', () => {
    expect(qtdPorValor({ ...base, id: 'x', nome: 'X', unidade: 'kg', venda: null } as Product, 400)).toBeNull();
  });
  it('venda lançada depois guarda lancadaEm no backup', () => {
    const v: Venda = { id: 'v', quando: '2026-11-20T15:00:00.000Z', lancadaEm: '2026-11-22T23:00:00.000Z', itens: [{ produtoId: 'p', nome: 'P', qtd: 50, unidade: 'g', total: 400, custo: 150 }], desconto: 0, total: 400, pagamento: 'pix', pagamentoLabel: 'Pix', taxa: 0, cliente: '' };
    const b = lerBackup(criarBackup({ nome: 'x', produtos: [], categorias: [] }, defaultStore(), { ...defaultSettings(), vendas: [v] }));
    expect(b.ok && b.config.vendas?.[0].lancadaEm).toBe('2026-11-22T23:00:00.000Z');
  });
});
