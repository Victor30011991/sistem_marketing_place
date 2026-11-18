import { describe, expect, it } from 'vitest';
import { diaLocal, fecharVenda, itemVenda, lerPedidoWhatsapp, moverEstoque, resumoVendas, unidadeDeVenda } from '../src/core/vendas';
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
  it('o cardápio esconde sozinho o que zerou (e só quando a opção está ligada)', () => {
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
  const msg = `Olá, Temperei! Gostaria de fazer este pedido pelo cardápio:

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

