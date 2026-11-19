import { describe, expect, it } from 'vitest';
import type { Product, Venda } from '../src/types';
import { defaultSettings, defaultStore } from '../src/core/defaults';
import { aplicarOps, dividir, emLotes, igual, inicioJanela, juntar, nuvemVazia, planejarEscritas, type Estado } from '../src/nuvem/modelo';

const prod = (id: string, nome: string, estoque: number | null = null): Product => ({
  id, nome, categoria: 'Temperos', unidade: 'kg', custo: 2000, custosAdicionais: 0, venda: 4400,
  propQtd: 100, propUnidade: 'g', observacoes: '', estoque,
});
const venda = (id: string, quando: string, total = 1000): Venda => ({
  id, quando, itens: [{ produtoId: 'a', nome: 'Açafrão', qtd: 100, unidade: 'g', total, custo: 200 }],
  desconto: 0, total, pagamento: 'pix', pagamentoLabel: 'Pix', taxa: 0, cliente: '',
});
const LOJA = defaultStore();
const CONFIG = defaultSettings();
const estado = (produtos: Product[], vendas: Venda[] = []): Estado => ({
  lista: { nome: 'Lista', categorias: ['Temperos'], produtos },
  loja: LOJA,
  config: { ...CONFIG, vendas },
});

describe('nuvem: dividir e juntar', () => {
  it('ida e volta não muda nada (e não gera gravações)', () => {
    const e = estado([prod('b', 'Cominho', 3), prod('a', 'Açafrão', 1.5)], [venda('v1', '2026-11-10T13:00:00'), venda('v2', '2026-11-11T09:00:00')]);
    const n = dividir(e);
    const volta = juntar(n, estado([]));
    expect(volta.lista.produtos.map((p) => p.id)).toEqual(['b', 'a']);
    expect(volta.config.vendas!.map((v) => v.id)).toEqual(['v2', 'v1']);
    expect(planejarEscritas(n, dividir(volta))).toEqual([]);
  });

  it('nuvem vazia: grava tudo, com as vendas agrupadas por dia', () => {
    const e = estado([prod('a', 'Açafrão')], [venda('v1', '2026-11-10T13:00:00'), venda('v2', '2026-11-10T15:00:00')]);
    const ops = planejarEscritas(nuvemVazia(), dividir(e));
    const caminhos = ops.map((o) => o.caminho.join('/'));
    expect(caminhos).toEqual(['lojas/temperei', 'lojas/temperei/meta/loja', 'lojas/temperei/produtos/a', 'lojas/temperei/vendasDia/2026-11-10']);
    const dia = ops[3];
    expect(Object.keys(dia.dados!.v as object)).toEqual(['v1', 'v2']);
    expect(dia.campos).toEqual([['dia'], ['v', 'v1'], ['v', 'v2']]);
  });
});

describe('nuvem: orçamentos', () => {
  it('cada orçamento é um documento e volta igual', () => {
    const o = { id: 'o1', numero: 3, criado: '2026-11-19T10:00:00', atualizado: '2026-11-19T10:00:00', cliente: { nome: 'Ana', telefone: '', endereco: '' }, itens: [], desconto: { tipo: 'valor' as const, valor: null }, parcelas: 1, validade: '', obs: '', situacao: 'enviado' as const };
    const e = { ...estado([]), config: { ...CONFIG, orcamentos: [o] } };
    const n = dividir(e);
    expect(n.col.orcamentos.get('o1')).toEqual(o);
    expect('orcamentos' in (n.raiz!.config as object)).toBe(false);
    expect(planejarEscritas(nuvemVazia(), n).some((op) => op.caminho.join('/') === 'lojas/temperei/orcamentos/o1')).toBe(true);
    expect(juntar(n, estado([])).config.orcamentos).toEqual([o]);
  });
});

describe('nuvem: o que gravar', () => {
  it('estoque vai como incremento, para duas vendas ao mesmo tempo não se perderem', () => {
    const antes = dividir(estado([prod('a', 'Açafrão', 5)]));
    const agora = dividir(estado([prod('a', 'Açafrão', 4.75)]));
    const ops = planejarEscritas(antes, agora);
    expect(ops).toHaveLength(1);
    expect(ops[0].dados).toEqual({ estoque: { __inc: -0.25 } });
    expect(ops[0].campos).toEqual([['estoque']]);
    // a outra pessoa vendeu 1 kg enquanto isso: a nuvem soma as duas
    const outra = dividir(estado([prod('a', 'Açafrão', 4)]));
    expect(aplicarOps(outra, ops).produtos.get('a')!.estoque).toBe(3.75);
  });

  it('só os campos que mudaram; campo removido é apagado', () => {
    const p = { ...prod('a', 'Açafrão'), plu: 12 };
    const antes = dividir(estado([p]));
    const { plu: _x, ...semPlu } = p;
    const agora = dividir(estado([{ ...semPlu, venda: 4600 }]));
    const [op] = planejarEscritas(antes, agora);
    expect(op.dados).toEqual({ venda: 4600, plu: { __del: true } });
  });

  it('produto excluído, lista reordenada, venda cancelada', () => {
    const v = venda('v1', '2026-11-10T13:00:00');
    const antes = dividir(estado([prod('a', 'A'), prod('b', 'B'), prod('c', 'C')], [v]));
    const agora = dividir(estado([prod('c', 'C'), prod('a', 'A')], [{ ...v, cancelada: '2026-11-10T14:00:00' }]));
    const ops = planejarEscritas(antes, agora);
    expect(ops.find((o) => o.apagar)!.caminho.at(-1)).toBe('b');
    const raiz = ops.find((o) => o.caminho.length === 2)!;
    expect(raiz.dados).toEqual({ ordem: ['c', 'a'] });
    const dia = ops.find((o) => o.caminho.includes('vendasDia'))!;
    expect(dia.campos).toEqual([['dia'], ['v', 'v1']]);
    expect(igual(aplicarOps(antes, ops), agora)).toBe(true);
  });

  it('venda apagada some do dia', () => {
    const antes = dividir(estado([], [venda('v1', '2026-11-10T13:00:00'), venda('v2', '2026-11-10T14:00:00')]));
    const agora = dividir(estado([], [venda('v2', '2026-11-10T14:00:00')]));
    const ops = planejarEscritas(antes, agora);
    expect(ops[0].dados!.v).toEqual({ v1: { __del: true } });
    expect(Object.keys(aplicarOps(antes, ops).dias.get('2026-11-10')!)).toEqual(['v2']);
  });

  it('compara sem ligar para a ordem das chaves nem undefined', () => {
    expect(igual({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1, d: undefined })).toBe(true);
    expect(igual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(igual(new Map([['a', { e: 1 }]]), new Map([['a', { e: 2 }]]))).toBe(false);
    expect(igual(new Map([['a', { e: 1 }]]), new Map([['a', { e: 1 }]]))).toBe(true);
    // retrato inteiro: um estoque diferente basta para não ser igual
    expect(igual(dividir(estado([prod('a', 'A', 1)])), dividir(estado([prod('a', 'A', 2)])))).toBe(false);
  });

  it('janela de vendas e lotes de gravação', () => {
    expect(inicioJanela(new Date(2026, 10, 18), 30)).toBe('2026-10-19');
    expect(emLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
