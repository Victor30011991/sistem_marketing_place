import { describe, expect, it } from 'vitest';
import { defaultStore } from '../src/core/defaults';
import { mixesCfgDe, mixesPossiveis, montarCardapio, nomeMixPadrao, vitrineDe } from '../src/core/vitrine';
import type { ListState, Product } from '../src/types';

const prod = (id: string, nome: string): Product => ({ id, nome, categoria: 'Temperos', unidade: 'kg', custo: 1000, custosAdicionais: 0, venda: 4700, propQtd: 100, propUnidade: 'g' }) as Product;
const lista: ListState = { nome: 'L', categorias: ['Temperos'], produtos: [prod('p', 'Páprica defumada'), prod('a', 'Alho em pó'), prod('r', 'Alecrim'), prod('c', 'Cebola'), prod('o', 'Orégano')] };
const base = vitrineDe(defaultStore());

describe('mixes de temperos', () => {
  it('o nome padrão deixa claro que é tempero', () => {
    expect(nomeMixPadrao('Batata rústica crocante')).toBe('Temperos para batata rústica crocante');
    expect(nomeMixPadrao('Mix para frango assado')).toBe('Mix para frango assado');
    expect(nomeMixPadrao('Tempero de churrasco da casa')).toBe('Tempero de churrasco da casa');
  });

  it('acha a batata rústica e diz o que leva', () => {
    const b = mixesPossiveis(lista.produtos, base).find((m) => m.id === 'mix-batata')!;
    expect(b.nome).toBe('Temperos para batata rústica crocante');
    expect(b.temperos).toEqual(['Páprica defumada', 'Alho em pó', 'Alecrim']);
    expect(b.ativo).toBe(true);
  });

  it('a loja muda o nome, a frase e as gramas, e pode esconder', () => {
    const v = { ...base, mixesCfg: { 'mix-batata': { nome: 'Kit batata da casa', desc: 'Air fryer', g: 100 }, 'mix-frango': { ativo: false } } };
    const ms = mixesPossiveis(lista.produtos, v);
    expect(ms.find((m) => m.id === 'mix-batata')).toMatchObject({ nome: 'Kit batata da casa', desc: 'Air fryer', g: 100 });
    const { arquivo } = montarCardapio(lista, { ...defaultStore(), vitrine: v }, null);
    const pub = arquivo.mixes ?? [];
    expect(pub.some((m) => m.n === 'Kit batata da casa' && m.g === 100 && m.t?.join() === 'Páprica defumada,Alho em pó,Alecrim')).toBe(true);
    expect(pub.some((m) => /frango/i.test(m.n))).toBe(false);
  });

  it('nome apagado volta ao padrão no catálogo', () => {
    const v = { ...base, mixesCfg: { 'mix-batata': { nome: '  ' } } };
    expect(mixesPossiveis(lista.produtos, v).find((m) => m.id === 'mix-batata')!.nome).toBe('Temperos para batata rústica crocante');
  });

  it('lê ajustes gravados com lixo', () => {
    expect(mixesCfgDe(null)).toBeUndefined();
    expect(mixesCfgDe({ 'mix-batata': { g: 5000, ativo: 'x' }, 'Nome Ruim!': { ativo: false } })).toBeUndefined();
    expect(mixesCfgDe({ 'mix-batata': { g: 75.4, ativo: false } })).toEqual({ 'mix-batata': { g: 75, ativo: false } });
  });
});
