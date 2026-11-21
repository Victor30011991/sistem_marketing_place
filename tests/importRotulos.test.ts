import { describe, expect, it } from 'vitest';
import { aplicarRotulos, camposCsv, casarRotulos, lerRotulosCsv, numeroBr } from '../src/core/importRotulos';
import type { Product } from '../src/types';

const prod = (o: Partial<Product> & { id: string; nome: string }): Product => ({
  categoria: '', unidade: 'kg', custo: null, custosAdicionais: 0, venda: 5000, propQtd: 100, propUnidade: 'g', observacoes: '', ...o,
});
const CSV = [
  'Produto;Porção (g);Valor energético (kcal);Carboidratos (g);Açúcares totais (g);Proteínas (g);Gorduras totais (g);Gorduras saturadas (g);Fibras (g);Sódio (mg);Ingredientes;Alérgicos;Glúten;Observação',
  'Tempero Baiano;10;230;40;0;0;0;0;17;3533;"Coentro, cominho; sal";;Contém;',
  'Chia Premium;12;373;7,7;0;17;31;3,3;35;18;Semente de chia;;Não contém;ok',
  'Argila;100;;;;;;;;;Argila;;;não é alimento',
  'Produto Que Não Existe;5;1;1;1;1;1;1;1;1;;;;',
].join('\r\n');

describe('importar informações dos rótulos (CSV)', () => {
  it('lê números com vírgula e campos com aspas', () => {
    expect(numeroBr('1.234,5')).toBe(1234.5);
    expect(numeroBr('')).toBeNull();
    expect(camposCsv('a;"b; c";d')).toEqual(['a', 'b; c', 'd']);
  });
  it('lê tabela, ingredientes e glúten; sem kcal fica sem tabela', () => {
    const l = lerRotulosCsv('﻿' + CSV);
    expect(l).toHaveLength(4);
    expect(l[0]).toMatchObject({ nome: 'Tempero Baiano', ingredientes: 'Coentro, cominho; sal', gluten: 'contem' });
    expect(l[0].nutricao).toMatchObject({ porcao: 10, kcal: 230, fibras: 17, sodio: 3533 });
    expect(l[1].nutricao?.carboidratos).toBe(7.7);
    expect(l[1].gluten).toBe('nao-contem');
    expect(l[2].nutricao).toBeNull();
  });
  it('liga pelo nome e aplica sem apagar o que já existe', () => {
    const ps = [prod({ id: '1', nome: 'Tempero baiano', modoUso: 'a gosto' }), prod({ id: '2', nome: 'Chia Premium' }), prod({ id: '3', nome: 'Argila Branca / Dourada', ingredientes: 'velho', nutricao: null })];
    const c = casarRotulos(lerRotulosCsv(CSV), ps);
    expect(c.pares.map((x) => x.produto.id)).toEqual(['1', '2', '3']);
    expect(c.semProduto.map((x) => x.nome)).toEqual(['Produto Que Não Existe']);
    const r = aplicarRotulos(ps, c.pares);
    expect(r[0]).toMatchObject({ modoUso: 'a gosto', gluten: 'contem', ingredientes: 'Coentro, cominho; sal' });
    expect(r[2]).toMatchObject({ ingredientes: 'Argila', nutricao: null });
  });
});
