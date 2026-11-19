import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Cliente, Product, Venda } from '../src/types';
import { acharCliente, historico, ligarCliente, mensagemSaudade, novoCliente, pedidoDe, pedidoParaPdv } from '../src/core/clientes';
import { montarCardapio } from '../src/core/vitrine';
import { defaultStore } from '../src/core/defaults';

const maria: Cliente = { id: 'c1', nome: 'Maria Souza', telefone: '(86) 98888-7777', endereco: 'Rua A, 10', obs: '', criado: '' };
const venda = (id: string, quando: string, total: number, extra: Partial<Venda> = {}): Venda => ({
  id, quando, itens: [{ produtoId: 'a', nome: 'Açafrão', qtd: 100, unidade: 'g', total, custo: 0 }], desconto: 0, total, pagamento: 'pix', pagamentoLabel: 'Pix', taxa: 0, cliente: '', ...extra,
});
const prod = (id: string, nome: string): Product => ({ id, nome, categoria: 'Temperos', unidade: 'kg', custo: 2000, custosAdicionais: 0, venda: 4400, propQtd: 100, propUnidade: 'g', observacoes: '' });

describe('clientes', () => {
  it('acha pelo telefone escrito de outro jeito, ou pelo nome', () => {
    expect(acharCliente([maria], { telefone: '+55 86 9 8888 7777' })?.id).toBe('c1');
    expect(acharCliente([maria], { nome: 'maria souza' })?.id).toBe('c1');
    expect(acharCliente([maria], { nome: 'Maria' })).toBeNull();
  });
  it('liga ou cria só quando tem WhatsApp', () => {
    expect(ligarCliente([maria], { nome: 'Maria Souza' }).id).toBe('c1');
    expect(ligarCliente([], { nome: 'João' }).id).toBeNull();
    const r = ligarCliente([], { nome: 'João', telefone: '86 99999-0000' });
    expect(r.lista).toHaveLength(1);
    expect(r.lista[0].nome).toBe('João');
    // completa o endereço que faltava
    expect(ligarCliente([{ ...maria, endereco: '' }], { nome: 'Maria Souza', endereco: 'Rua B' }).lista[0].endereco).toBe('Rua B');
  });
  it('histórico: compras, total, favoritos e dias sem comprar', () => {
    const vendas = [venda('1', '2026-09-01T10:00:00', 1000, { clienteId: 'c1' }), venda('2', '2026-09-20T10:00:00', 3000, { cliente: 'Maria Souza' }), venda('3', '2026-09-21T10:00:00', 999, { clienteId: 'outro' }), venda('4', '2026-09-22T10:00:00', 500, { clienteId: 'c1', cancelada: 'x' })];
    const h = historico(maria, vendas, [], new Date(2026, 10, 19));
    expect(h).toMatchObject({ compras: 2, total: 4000, ticket: 2000, ultima: '2026-09-20', diasSemComprar: 60 });
    expect(h.favoritos[0]).toEqual({ nome: 'Açafrão', total: 4000 });
    expect(mensagemSaudade(maria, 'Temperei', 'Açafrão')).toMatch(/^Oi, Maria! Aqui é da Temperei/);
    expect(novoCliente({ nome: '  Ana ' }).nome).toBe('Ana');
  });
});

describe('pedidos do cardápio', () => {
  const lib = (() => {
    const m: { exports: Record<string, (...a: unknown[]) => unknown> } = { exports: {} };
    new Function('module', readFileSync('public/cardapio/lib.js', 'utf8'))(m);
    return m.exports;
  })();
  it('o cardápio público leva o id do produto', () => {
    const r = montarCardapio({ nome: 'L', categorias: ['Temperos'], produtos: [prod('a', 'Açafrão')] }, defaultStore(), null);
    expect(r.arquivo.categorias[0].itens[0]).toEqual({ i: 'a', n: 'Açafrão', pk: 4400 });
  });
  it('o pedido vai no formato do Firestore e volta igual', () => {
    const corpo = lib.pedidoNuvem({ itens: [{ i: 'a', n: 'Açafrão', g: 250, total: 1100 }], nome: ' Maria ', telefone: '86 98888-7777', endereco: 'Rua A', obs: '', origem: 'instagram' }) as { fields: Record<string, unknown> };
    expect(corpo.fields.situacao).toEqual({ stringValue: 'novo' });
    expect(corpo.fields.total).toEqual({ integerValue: '1100' });
    expect(Object.keys(corpo.fields).sort()).toEqual(['criado', 'endereco', 'itens', 'nome', 'obs', 'origem', 'situacao', 'telefone', 'total']);
    // como o app lê (o SDK devolve os valores já convertidos)
    const p = pedidoDe('p1', { criado: '2026-11-19T10:00:00Z', nome: 'Maria', telefone: '86 98888-7777', endereco: 'Rua A', obs: '', origem: 'instagram', situacao: 'novo', total: 999999, itens: [{ i: 'a', n: 'Açafrão', g: 250, t: 1100 }, { n: '', g: 1 }] })!;
    expect(p.total).toBe(1100); // o total é sempre a soma dos itens
    expect(p.itens).toHaveLength(1);
    expect(pedidoDe('x', { itens: [] })).toBeNull();
  });
  it('vira venda no PDV com o mesmo valor, achando o produto pelo id ou pelo nome', () => {
    const p = pedidoDe('p1', { criado: '', nome: 'Maria', itens: [{ i: 'a', n: 'Açafrão', g: 250, t: 1100 }, { n: 'cominho', g: 100, t: 440 }, { n: 'Sumiu', g: 100, t: 10 }] })!;
    const r = pedidoParaPdv(p, [prod('a', 'Açafrão'), prod('c', 'Cominho')], 'c1');
    expect(r.venda.linhas).toEqual([{ produtoId: 'a', qtd: 250, unidade: 'g', total: 1100 }, { produtoId: 'c', qtd: 100, unidade: 'g', total: 440 }]);
    expect(r.faltando).toEqual(['Sumiu']);
    expect(r.venda.clienteId).toBe('c1');
  });
});
