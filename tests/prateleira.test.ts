import { describe, expect, it } from 'vitest';
import { aplicarNumeracao, desfazerNumeracao, gruposPrateleira, listaCodigos, mover, numerarPrateleira, ordemDosGrupos, prateleiraDe, PRATELEIRA_PADRAO, textoCodigos } from '../src/core/prateleira';
import { atribuirPlus, balancaDe } from '../src/core/balanca';
import type { Product } from '../src/types';

const prod = (id: string, nome: string, categoria: string, plu: number | null = null, venda: number | null = 5000): Product => ({
  id, nome, categoria, unidade: 'kg', custo: null, custosAdicionais: 0, venda, propQtd: 100, propUnidade: 'g', observacoes: '', plu,
});
const produtos = [
  prod('a', 'Hortelã', 'Chás', 19), prod('b', 'Chá verde', 'Chás', 7), prod('c', 'Erva doce', 'Chás', 12),
  prod('d', 'Grão de bico', 'Grãos', 21), prod('e', 'Chia', 'Sementes', 3), prod('f', 'Sem preço', 'Chás', 40, null),
];
const cats = ['Grãos', 'Chás', 'Sementes'];

describe('ordem da prateleira', () => {
  it('sem ordem salva: categorias da lista e alfabética; produto sem preço fica fora', () => {
    const g = gruposPrateleira(produtos, cats, PRATELEIRA_PADRAO);
    expect(g.map((x) => x.cat)).toEqual(['Grãos', 'Chás', 'Sementes']);
    expect(g[1].itens.map((x) => x.nome)).toEqual(['Chá verde', 'Erva doce', 'Hortelã']);
  });
  it('a ordem escolhida vale, e quem não foi arrumado vai no fim', () => {
    const p = { ...PRATELEIRA_PADRAO, cats: ['Chás', 'Grãos'], itens: ['a', 'c'] };
    const g = gruposPrateleira(produtos, cats, p);
    expect(g.map((x) => x.cat)).toEqual(['Chás', 'Grãos', 'Sementes']);
    expect(g[0].itens.map((x) => x.id)).toEqual(['a', 'c', 'b']);
    expect(ordemDosGrupos(g, p).itens).toEqual(['a', 'c', 'b', 'd', 'e']);
  });
  it('mover', () => {
    expect(mover(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(mover(['a', 'b', 'c'], 0, 9)).toEqual(['b', 'c', 'a']);
  });
});

describe('numerar na ordem da prateleira', () => {
  const p = { ...PRATELEIRA_PADRAO, cats: ['Chás', 'Grãos', 'Sementes'], itens: ['b', 'a', 'c'] };
  it('de 10 em 10, cada prateleira numa centena', () => {
    const { codigos, erro } = numerarPrateleira(gruposPrateleira(produtos, cats, p), p);
    expect(erro).toBeNull();
    expect(Object.fromEntries(codigos)).toEqual({ b: 100, a: 110, c: 120, d: 200, e: 300 });
  });
  it('sem centena: seguido a partir do início', () => {
    const { codigos } = numerarPrateleira(gruposPrateleira(produtos, cats, p), { ...p, centena: false, inicio: 10 });
    expect([...codigos.values()]).toEqual([10, 20, 30, 40, 50]);
  });
  it('prateleira com mais de 100 empurra a próxima para a centena seguinte', () => {
    const muitos = Array.from({ length: 12 }, (_, i) => prod('x' + i, 'Item ' + String(i).padStart(2, '0'), 'Chás'));
    const { codigos } = numerarPrateleira(gruposPrateleira([...muitos, prod('g', 'Grão', 'Grãos')], ['Chás', 'Grãos'], PRATELEIRA_PADRAO), PRATELEIRA_PADRAO);
    expect(codigos.get('x11')).toBe(210);
    expect(codigos.get('g')).toBe(300);
  });
  it('avisa quando passa de 9999', () => {
    const muitos = Array.from({ length: 1001 }, (_, i) => prod('y' + i, 'P' + i, 'Chás'));
    expect(numerarPrateleira(gruposPrateleira(muitos, ['Chás'], PRATELEIRA_PADRAO), PRATELEIRA_PADRAO).erro).toMatch(/9999/);
  });
  it('aplicar e desfazer', () => {
    const { codigos } = numerarPrateleira(gruposPrateleira(produtos, cats, p), p);
    const r = aplicarNumeracao(produtos, codigos, p);
    expect(r.produtos.find((x) => x.id === 'b')!.plu).toBe(100);
    expect(r.produtos.find((x) => x.id === 'f')!.plu).toBe(40);
    const volta = desfazerNumeracao(r.produtos, prateleiraDe(r.prateleira));
    expect(volta.produtos.find((x) => x.id === 'b')!.plu).toBe(7);
    expect(volta.prateleira.antes).toBeUndefined();
  });
  it('produto novo entra depois do último da prateleira dele', () => {
    const numerados = aplicarNumeracao(produtos, numerarPrateleira(gruposPrateleira(produtos, cats, p), p).codigos, p).produtos;
    const r = atribuirPlus([...numerados, prod('n', 'Camomila', 'Chás')], cats, 'prateleira', p);
    expect(r.produtos.find((x) => x.id === 'n')!.plu).toBe(130);
  });
  it('a configuração da balança guarda a prateleira', () => {
    const c = balancaDe({ numeracao: 'prateleira', prateleira: { cats: ['Chás'], itens: ['a'], inicio: 0, passo: 500, centena: false, antes: [['a', 19], ['b', 'x']] } });
    expect(c.numeracao).toBe('prateleira');
    expect(c.prateleira).toEqual({ cats: ['Chás'], itens: ['a'], inicio: 1, passo: 100, centena: false, antes: [['a', 19]] });
  });
});

describe('lista de códigos', () => {
  it('só marcados, pelo código, e o texto para o WhatsApp', () => {
    const g = gruposPrateleira(produtos, cats, PRATELEIRA_PADRAO);
    const s = listaCodigos(g, new Set(['a', 'b', 'd']));
    expect(s.map((x) => [x.cat, x.linhas.map((l) => l.codigo)])).toEqual([['Grãos', [21]], ['Chás', [7, 19]]]);
    const t = textoCodigos(s, 'Temperei', true, true, new Date(2026, 10, 23));
    expect(t).toContain('*Temperei · Códigos da balança*');
    expect(t).toContain('23/11/2026 · 3 produtos');
    expect(t).toContain('*2 · Chás*');
    expect(t).toContain('0007  Chá verde · R$ 50,00/kg');
    expect(textoCodigos(s, 'T', false, false)).toMatch(/0007 {2}Chá verde\n0019 {2}Hortelã\n0021 {2}Grão de bico/);
  });
});
