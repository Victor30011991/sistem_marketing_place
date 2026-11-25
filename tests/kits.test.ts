import { describe, expect, it } from 'vitest';
import { contaKit, kitsDe, kitsParaCardapio, mensagemKit, ratearKit, sugerirChamadas } from '../src/core/kits';
import { montarCardapio, vitrineDe } from '../src/core/vitrine';
import { defaultStore } from '../src/core/defaults';
import type { KitCardapio, ListState, Product } from '../src/types';

const prod = (id: string, nome: string, venda: number, custo: number | null = null): Product => ({
  id, nome, categoria: 'Temperos', unidade: 'kg', custo, custosAdicionais: 0, venda, propQtd: 100, propUnidade: 'g', observacoes: '',
});
const produtos = [prod('p', 'Páprica defumada', 4750, 2376), prod('c', 'Chimichurri', 7300, 3641), prod('l', 'Lemon pepper', 5800, 2910)];
const kit: KitCardapio = { id: 'k1', nome: 'Churrasco no ponto', tipo: 'combo', itens: [{ produtoId: 'p', gramas: 100 }, { produtoId: 'c', gramas: 100 }, { produtoId: 'l', gramas: 100 }], preco: 1590, descricao: '', carrossel: true, ativo: true };

describe('kits: conta', () => {
  it('separado, economia, custo e lucro', () => {
    const c = contaKit(kit, produtos);
    expect(c.separado).toBe(1785);
    expect(c.economia).toBe(195);
    expect(c.economiaPct).toBe(11);
    expect(c.custo).toBe(893);
    expect(c.lucro).toBe(697);
    expect(c.margem).toBe(44);
  });
  it('sem custo de algum item, o lucro fica em aberto', () => {
    const c = contaKit(kit, [prod('p', 'Páprica', 4750), ...produtos.slice(1)]);
    expect(c.custo).toBeNull();
    expect(c.lucro).toBeNull();
  });
  it('item apagado aparece em faltando', () => {
    expect(contaKit(kit, produtos.slice(0, 2)).faltando).toEqual(['l']);
  });
});

describe('kits: chamadas e mensagem', () => {
  it('três jeitos, com o tema do churrasco e a economia', () => {
    const c = contaKit(kit, produtos);
    const ch = sugerirChamadas(kit, c);
    expect(ch.map((x) => x.jeito)).toEqual(['Pela economia', 'Pelo momento', 'Pela curiosidade']);
    expect(ch[0].linha).toContain('R$ 1,95');
    expect(ch[1].titulo).toMatch(/churrasco|carne|Fogo/i);
    expect(ch[1].linha).toBe('Páprica defumada, chimichurri e lemon pepper, pesados na hora.');
    expect(sugerirChamadas(kit, c, 1)[1].titulo).not.toBe(ch[1].titulo);
  });
  it('mensagem com de/por e link', () => {
    const c = contaKit(kit, produtos);
    const m = mensagemKit(kit, c, sugerirChamadas(kit, c)[0], 'https://x/cardapio/');
    expect(m).toContain('De R$ 17,85 por *R$ 15,90*');
    expect(m).toContain('Peça pelo catálogo: https://x/cardapio/');
  });
});

describe('kits: o que vai para o site', () => {
  it('lê só kits válidos', () => {
    const lidos = kitsDe([kit, { nome: '' }, { ...kit, id: 'k2', itens: [{ produtoId: 'p', gramas: -5 }], cor: 'roxo', foto: 'http://x' }]);
    expect(lidos).toHaveLength(2);
    expect(lidos[1].itens).toEqual([]);
    expect(lidos[1].cor).toBeUndefined();
    expect(lidos[1].foto).toBeUndefined();
  });
  it('publica com preço, separado e itens; fora quando falta item, vencido ou desligado', () => {
    const tem = new Set(['p', 'c', 'l']);
    expect(kitsParaCardapio([kit], produtos, tem, '2026-11-23')).toEqual([{ k: 'k1', n: 'Churrasco no ponto', t: 'combo', p: 1590, s: 1785, i: [['p', 100], ['c', 100], ['l', 100]], r: 1 }]);
    expect(kitsParaCardapio([kit], produtos, new Set(['p', 'c']), '2026-11-23')).toEqual([]);
    expect(kitsParaCardapio([{ ...kit, ate: '2026-11-20' }], produtos, tem, '2026-11-23')).toEqual([]);
    expect(kitsParaCardapio([{ ...kit, ativo: false }], produtos, tem, '2026-11-23')).toEqual([]);
  });
  it('vai no arquivo do catálogo sem custo nem lucro', () => {
    const lista: ListState = { nome: 'L', categorias: ['Temperos'], produtos };
    const loja = { ...defaultStore(), vitrine: { ...vitrineDe(defaultStore()), kits: [kit] } };
    const { arquivo } = montarCardapio(lista, { ...loja, vitrine: vitrineDe(loja) }, null);
    expect(arquivo.kits).toHaveLength(1);
    const txt = JSON.stringify(arquivo.kits);
    expect(txt).not.toContain('893');
    expect(txt).not.toContain('697');
  });
  it('ratear fecha a soma', () => {
    expect(ratearKit(1590, [475, 730, 580])).toEqual([423, 650, 517]);
  });
});
