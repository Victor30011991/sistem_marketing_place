import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { avaliarCupom, cupomDoTexto, cuponsDe, cuponsParaCardapio, conviteCupom, limparCodigo } from '../src/core/cupons';
import { pedidoDe, pedidoParaPdv } from '../src/core/clientes';
import { curvaABC, type LinhaRanking } from '../src/core/relatorios';
import { criarBackup, lerBackup } from '../src/core/backup';
import { defaultSettings, defaultStore } from '../src/core/defaults';
import type { CupomCardapio, Product } from '../src/types';

interface Lib {
  montarMensagem(d: Record<string, unknown>): string;
  pedidoNuvem(d: Record<string, unknown>): { fields: Record<string, { stringValue?: string; integerValue?: string }> };
  resumoEntrega(d: Record<string, unknown>): string;
  avaliarCupom(c: unknown, cod: string, sub: number, hoje: string): { ok: boolean; desconto?: number; codigo?: string; erro?: string };
  limparCodigo(c: string): string;
}
const m = { exports: {} as unknown };
new Function('module', readFileSync('public/cardapio/lib.js', 'utf8'))(m);
const L = m.exports as Lib;

const cupom = (o: Partial<CupomCardapio>): CupomCardapio => ({ id: 'x', codigo: 'PRIMEIRA10', tipo: 'pct', valor: 10, minimo: 0, ativo: true, ...o });
const itens = [{ i: 'p1', n: 'Orégano', g: 200, total: 2000 }, { i: 'p2', n: 'Páprica', g: 100, total: 1500 }];

describe('cupons', () => {
  it('limpa o código igual no sistema e no cardápio', () => {
    for (const c of ['primeira 10', 'Voltéi!', '  ab-c ']) expect(L.limparCodigo(c)).toBe(limparCodigo(c));
    expect(limparCodigo('Voltéi!')).toBe('VOLTEI');
  });

  it('publica só os que valem hoje, sem repetir', () => {
    const pub = cuponsParaCardapio(
      [cupom({}), cupom({ id: 'b', codigo: 'VELHO', ate: '2026-01-01' }), cupom({ id: 'c', codigo: 'OFF', ativo: false }), cupom({ id: 'd' }), cupom({ id: 'e', codigo: 'VOLTEI', tipo: 'valor', valor: 500, minimo: 3000 })],
      '2026-11-23',
    );
    expect(pub).toEqual([{ c: 'PRIMEIRA10', t: 'p', v: 10, m: 0 }, { c: 'VOLTEI', t: 'v', v: 500, m: 3000 }]);
  });

  it('a conta do cardápio é a mesma do sistema', () => {
    const pub = cuponsParaCardapio([cupom({}), cupom({ id: 'e', codigo: 'VOLTEI', tipo: 'valor', valor: 500, minimo: 3000 }), cupom({ id: 'f', codigo: 'TUDO', tipo: 'valor', valor: 99999 })], '2026-11-23');
    for (const [cod, sub] of [['primeira10', 3500], ['VOLTEI', 3500], ['VOLTEI', 2999], ['NADA', 3500], ['TUDO', 1200], ['', 100]] as const) {
      const a = avaliarCupom(pub, cod, sub, '2026-11-23');
      const b = L.avaliarCupom(pub, cod, sub, '2026-11-23');
      expect(b.ok).toBe(a.ok);
      if (a.ok) expect(b.desconto).toBe(a.desconto);
      else expect(b.erro).toBe(a.erro);
    }
    expect(avaliarCupom(pub, 'primeira10', 3500, '2026-11-23')).toEqual({ ok: true, codigo: 'PRIMEIRA10', desconto: 350 });
    expect(avaliarCupom(pub, 'TUDO', 1200, '2026-11-23')).toMatchObject({ desconto: 1200 });
    expect(avaliarCupom(pub, 'VOLTEI', 2999, '2026-11-23')).toMatchObject({ ok: false });
  });

  it('cupom vencido no cardápio aberto desde ontem', () => {
    expect(avaliarCupom([{ c: 'X', t: 'p', v: 10, m: 0, a: '2026-11-22' }], 'X', 1000, '2026-11-23')).toEqual({ ok: false, erro: 'Esse cupom já venceu.' });
  });

  it('lê cupons gravados com lixo', () => {
    const l = cuponsDe([{ codigo: 'a b', tipo: 'pct', valor: 150, ate: 'amanhã' }, null, { codigo: 'V', tipo: 'valor', valor: -5 }]);
    expect(l[0]).toMatchObject({ codigo: 'AB', valor: 90 });
    expect(l[0].ate).toBeUndefined();
    expect(l[1].valor).toBe(0);
  });
});

describe('pedido com cupom', () => {
  const base = { itens, nome: 'Ana', telefone: '86999990000', endereco: 'Rua 1', obs: '', origem: '', modo: 'entrega', taxa: 500, gratis: false, pagamento: 'pix', cupom: 'PRIMEIRA10', desconto: 350 };

  it('a mensagem mostra o cupom e o total certo', () => {
    const t = L.montarMensagem({ loja: 'Temperei', abertura: '', fechamento: '', ...base });
    expect(t).toContain('Subtotal: R$ 35,00');
    expect(t).toContain('🏷️ Cupom PRIMEIRA10: − R$ 3,50');
    expect(t).toContain('*Total: R$ 36,50*');
  });

  it('sem cupom, nada muda', () => {
    const t = L.montarMensagem({ loja: 'T', abertura: '', fechamento: '', ...base, cupom: '', desconto: 0 });
    expect(t).not.toContain('Cupom');
    expect(t).toContain('*Total: R$ 40,00*');
  });

  it('o desconto não passa dos produtos', () => {
    const t = L.montarMensagem({ loja: 'T', abertura: '', fechamento: '', ...base, desconto: 999999 });
    expect(t).toContain('*Total: R$ 5,00*');
  });

  it('vai para a nuvem só nos campos que as regras aceitam e volta para o sistema com o desconto', () => {
    const doc = L.pedidoNuvem(base);
    expect(Object.keys(doc.fields).sort()).toEqual(['criado', 'endereco', 'itens', 'nome', 'obs', 'origem', 'situacao', 'telefone', 'total'].sort());
    expect(doc.fields.total.integerValue).toBe('3150');
    const obs = doc.fields.obs.stringValue as string;
    expect(obs).toContain('Cupom PRIMEIRA10 (− R$ 3,50)');
    const p = pedidoDe('id1', { criado: '2026-11-23T10:00:00Z', nome: 'Ana', telefone: '', endereco: '', obs, itens: itens.map((i) => ({ i: i.i, n: i.n, g: i.g, t: i.total })), total: 3150, origem: '', situacao: 'novo' });
    expect(p).toMatchObject({ total: 3150, cupom: 'PRIMEIRA10', desconto: 350 });
    const prods = [{ id: 'p1', nome: 'Orégano' }, { id: 'p2', nome: 'Páprica' }] as Product[];
    const { venda } = pedidoParaPdv(p!, prods, null);
    expect(venda.desconto).toBe(350);
  });

  it('cliente não consegue inventar desconto maior que o pedido', () => {
    expect(cupomDoTexto('Cupom X (− R$ 1.000,00)')).toEqual({ cupom: 'X', desconto: 100000 });
    const p = pedidoDe('id', { nome: 'A', obs: 'Cupom X (− R$ 1.000,00)', itens: [{ n: 'Sal', g: 100, t: 500 }] });
    expect(p!.total).toBe(0);
    expect(p!.desconto).toBe(500);
  });

  it('o desconto da venda pausada sobrevive ao backup', () => {
    const txt = criarBackup({ nome: 'L', produtos: [], categorias: [] } as never, defaultStore(), { ...defaultSettings(), vendasPausadas: [{ id: 'v', quando: '', cliente: 'A', linhas: [{ produtoId: 'p1', qtd: 100, unidade: 'g' }], desconto: 350 }] });
    const r = lerBackup(txt);
    expect(r.ok && r.config.vendasPausadas?.[0].desconto).toBe(350);
  });

  it('convite de volta com cupom e link', () => {
    expect(conviteCupom(cupom({ codigo: 'VOLTEI', tipo: 'valor', valor: 500, minimo: 3000 }), 'https://x/cardapio/')).toBe(
      '\n\nPara matar a saudade: use o cupom *VOLTEI* no pedido e ganhe R$ 5,00 de desconto em pedidos a partir de R$ 30,00.\nNosso cardápio: https://x/cardapio/',
    );
    expect(conviteCupom(null, '')).toBe('');
  });
});

describe('curva ABC', () => {
  const l = (chave: string, total: number, custo: number): LinhaRanking => ({ chave, nome: chave, categoria: 'X', total, custo, lucro: total - custo, margem: null, qtd: 1, unidade: 'kg', vendas: 1 });

  it('A dá ~80% do lucro, B ~15%, C o resto', () => {
    const c = curvaABC([l('a', 10000, 2000), l('b', 3000, 1000), l('c', 1500, 500), l('d', 500, 300), l('e', 300, 250), l('f', 100, 200)]);
    expect(c.base).toBe('lucro');
    // lucros 8000, 2000, 1000, 200, 50, 0: 'b' começa em 71% (A), 'c' em 89% (B), 'd' em 98% (C)
    expect(Object.fromEntries(c.classe)).toEqual({ a: 'A', b: 'A', c: 'B', d: 'C', e: 'C', f: 'C' });
    expect(c.resumo.A).toMatchObject({ produtos: 2, valor: 10000 });
    expect(c.resumo.A.parte + c.resumo.B.parte + c.resumo.C.parte).toBeCloseTo(100, 0);
  });

  it('sem custo cadastrado usa o faturado', () => {
    const c = curvaABC([l('a', 500, 0), l('b', 500, 0)]);
    expect(c.base).toBe('total');
    expect(c.classe.get('a')).toBe('A');
    expect(c.classe.get('b')).toBe('A');
  });

  it('sem vendas não quebra', () => {
    expect(curvaABC([]).resumo.A.produtos).toBe(0);
  });
});
