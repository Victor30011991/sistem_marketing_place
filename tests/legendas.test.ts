import { describe, expect, it } from 'vitest';
import type { Product } from '../src/types';
import { entender, sugerirLegendas, semEmoji, TEMAS } from '../src/core/legendas';
import { frasesArriscadas } from '../src/core/postaai';
import { defaultStore } from '../src/core/defaults';

const prod = (id: string, nome: string, extra: Partial<Product> = {}): Product => ({
  id, nome, categoria: 'Temperos', unidade: 'kg', custo: 2000, custosAdicionais: 0, venda: 5000, propQtd: 100, propUnidade: 'g', observacoes: '', ...extra,
});
const produtos = [prod('a', 'Páprica defumada'), prod('b', 'Cúrcuma'), prod('c', 'Canela em pó'), prod('d', 'Castanha de caju', { unidade: 'un', venda: 1500 })];
const base = { produtos, loja: defaultStore(), cidade: 'Parnaíba', insta: '@temperei_natural' };

describe('entender o que vai ser postado', () => {
  it('acha produto, prato e tema', () => {
    const r = entender('Frango assado com a nossa páprica', produtos);
    expect(r.produtos.map((p) => p.id)).toEqual(['a']);
    expect(r.pratos[0].id).toBe('frango');
    expect(r.tema).toBe('receita');
    expect(entender('chegou cúrcuma nova', produtos).tema).toBe('novidade');
    expect(entender('foto do pote de canela na bancada', produtos).tema).toBe('produto');
    expect(entender('fachada da loja de manhã', produtos).tema).toBe('loja');
    expect(entender('páprica doce no frango da loja', produtos).tema).toBe('receita');
    expect(entender('pacote novo', produtos).pratos).toEqual([]);
  });
});

describe('sugestões', () => {
  it('4 formatos diferentes, hashtags variadas e no máximo 5', () => {
    const r = sugerirLegendas({ ...base, texto: 'frango assado com páprica', semente: 1 });
    expect(r).toHaveLength(4);
    expect(new Set(r.map((x) => x.angulo)).size).toBe(4);
    for (const x of r) {
      expect(x.hashtags.length).toBeLessThanOrEqual(5);
      expect(x.hashtags[0]).toBe('#temperei');
      expect(x.legenda).toContain('@temperei_natural');
      expect(x.legenda).not.toMatch(/\{[a-zP_]+\}/);
      expect(x.gancho.length).toBeLessThanOrEqual(125);
    }
    const outra = sugerirLegendas({ ...base, texto: 'frango assado com páprica', semente: 2 });
    expect(outra.map((x) => x.legenda).join()).not.toBe(r.map((x) => x.legenda).join());
  });
  it('nenhuma combinação promete efeito no corpo nem deixa lacuna', () => {
    const textos = ['frango assado com páprica', 'chegou cúrcuma', 'kit de presente', 'embalando canela', 'castanha de caju em oferta', 'cliente mandou foto', 'dica de como guardar', 'fachada', ''];
    for (const texto of textos)
      for (const tema of [undefined, ...TEMAS.map((t) => t.id)])
        for (let semente = 1; semente <= 12; semente++)
          for (const x of sugerirLegendas({ ...base, cidade: semente % 2 ? 'Parnaíba' : '', texto, tema, semente })) {
            expect(frasesArriscadas(x.legenda), x.legenda).toEqual([]);
            expect(x.legenda).not.toMatch(/\{|\}|undefined|NaN/);
          }
  });
  it('texto da arte sem emojis', () => {
    expect(semEmoji('Salva pra não esquecer 📌')).toBe('Salva pra não esquecer');
    expect(semEmoji('Comida sem tempero? Aqui não 🙅‍♀️')).toBe('Comida sem tempero? Aqui não');
  });
});
