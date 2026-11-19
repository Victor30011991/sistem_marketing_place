import { describe, expect, it } from 'vitest';
import type { Lote, Product } from '../src/types';
import { vencendo } from '../src/core/validade';
import { compactar, descompactar } from '../src/core/compactar';
import { criarBackup, lerBackup } from '../src/core/backup';
import { defaultSettings, defaultStore } from '../src/core/defaults';

const p = (id: string, nome: string, estoque: number | null): Product => ({ id, nome, categoria: '', unidade: 'kg', custo: 1, custosAdicionais: 0, venda: 2, propQtd: null, propUnidade: null, observacoes: '', estoque });
const lote = (data: string, itens: [string | null, string, string | undefined][]): Lote => ({
  id: data, data, fornecedor: 'Zona', numero: '1', frete: 0, juros: 0, outras: 0, desconto: 0, rateio: 'peso', custo: 'medio', aplicadoEm: data,
  itens: itens.map(([produtoId, nome, validade], i) => ({ id: String(i), nome, produtoId, categoria: '', ncm: '', unidade: 'kg', qtd: 5, valor: 100, desconto: 0, ...(validade ? { validade } : {}) })),
});

describe('validade dos lotes', () => {
  it('avisa só o que vence em até 30 dias e ainda tem estoque, o mais próximo por produto', () => {
    const prods = [p('a', 'Açafrão', 2), p('b', 'Cominho', 0), p('c', 'Orégano', null)];
    const l = [
      lote('2026-09-01', [['a', 'Açafrão', '2026-12-01'], ['b', 'Cominho', '2026-11-25'], [null, 'orégano', '2026-11-10']]),
      lote('2026-10-01', [['a', 'Açafrão', '2026-11-30'], ['a', 'Açafrão', '2027-06-01'], ['c', 'Orégano', undefined]]),
    ];
    const r = vencendo(l, prods, '2026-11-19', 30);
    expect(r.map((x) => [x.nome, x.validade, x.dias])).toEqual([
      ['Orégano', '2026-11-10', -9],
      ['Açafrão', '2026-11-30', 11],
    ]);
  });
  it('validade volta do backup', () => {
    const l = lote('2026-10-01', [['a', 'Açafrão', '2026-11-30']]);
    const r = lerBackup(criarBackup({ nome: 'L', categorias: [], produtos: [p('a', 'Açafrão', 1)] }, defaultStore(), { ...defaultSettings(), lotes: [l] }));
    if (!r.ok) throw new Error('backup');
    expect(r.config.lotes?.[0].itens[0].validade).toBe('2026-11-30');
  });
});

describe('cópia compactada', () => {
  it('compacta e volta igual, ocupando bem menos', async () => {
    const texto = criarBackup({ nome: 'L', categorias: [], produtos: Array.from({ length: 200 }, (_, i) => p('id' + i, `Produto ${i}`, i)) }, defaultStore(), defaultSettings());
    const gz = (await compactar(texto))!;
    expect(gz.length).toBeLessThan(texto.length / 3);
    expect(await descompactar(gz)).toBe(texto);
  });
});
