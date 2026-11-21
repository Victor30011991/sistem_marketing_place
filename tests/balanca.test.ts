import { describe, expect, it } from 'vitest';
import { atribuirPlus, balancaDe, codigo4, listaBalanca, renumerar, tabelaBalanca, BALANCA_PADRAO, digitoEan13, duasLinhas, gerarItensMgv, lerEtiquetaBalanca, linhaMgv5, textoBalanca } from '../src/core/balanca';
import { criarBackup, lerBackup } from '../src/core/backup';
import { buildExtras, mergeExtras } from '../src/core/extras';
import { defaultSettings, defaultStore } from '../src/core/defaults';
import type { Product } from '../src/types';

const prod = (o: Partial<Product> & { id: string; nome: string }): Product => ({
  categoria: 'Temperos', unidade: 'kg', custo: 2000, custosAdicionais: 0, venda: 5250, propQtd: 100, propUnidade: 'g', observacoes: '', ...o,
});

describe('códigos da balança (PLU)', () => {
  it('dá código a quem não tem, sem mudar os existentes nem repetir', () => {
    const ps = [prod({ id: 'a', nome: 'A', plu: 2 }), prod({ id: 'b', nome: 'B' }), prod({ id: 'c', nome: 'C', venda: null }), prod({ id: 'd', nome: 'D' })];
    const r = atribuirPlus(ps);
    expect(r.produtos.map((p) => p.plu)).toEqual([2, 1, undefined, 3]);
    expect(r.novos).toBe(2);
    expect(atribuirPlus(r.produtos).novos).toBe(0);
  });
});

describe('códigos por categoria e tabela da balança', () => {
  const cats = ['Castanhas', 'Temperos'];
  const ps = [
    prod({ id: 'p', nome: 'Pimenta', categoria: 'Temperos' }),
    prod({ id: 'a', nome: 'Amêndoa', categoria: 'Castanhas', venda: 12990 }),
    prod({ id: 'c', nome: 'Caju', categoria: 'Castanhas' }),
    prod({ id: 'x', nome: 'Avulso', categoria: '' }),
    prod({ id: 'k', nome: 'Kit', categoria: 'Temperos', unidade: 'un', venda: 1990, plu: 205 }),
  ];
  it('numera pela faixa da categoria, em ordem alfabética, sem mexer nos códigos que existem', () => {
    const r = atribuirPlus(ps, cats, 'categoria');
    const cod = Object.fromEntries(r.produtos.map((p) => [p.id, p.plu]));
    expect(cod).toEqual({ a: 101, c: 102, p: 201, x: 9901, k: 205 });
  });
  it('renumerar refaz tudo dentro de 1 a 9999', () => {
    const r = renumerar(ps, cats, 'categoria');
    expect(Object.fromEntries(r.map((p) => [p.id, p.plu]))).toEqual({ a: 101, c: 102, k: 201, p: 202, x: 9901 });
  });
  it('categoria cheia usa o próximo número livre', () => {
    const muitos = Array.from({ length: 101 }, (_, i) => prod({ id: 'm' + i, nome: 'M' + String(i).padStart(3, '0'), categoria: 'Castanhas' }));
    const r = atribuirPlus(muitos, cats, 'categoria').produtos.map((p) => p.plu as number);
    expect(new Set(r).size).toBe(101);
    expect(Math.max(...r)).toBeLessThanOrEqual(9999);
  });
  it('sequencial: 0001, 0002… em ordem alfabética', () => {
    const r = renumerar(ps, cats, 'sequencial');
    expect(Object.fromEntries(r.map((p) => [p.id, p.plu]))).toEqual({ a: 1, x: 2, c: 3, k: 4, p: 5 });
    const l = listaBalanca(r);
    expect(l.map((i) => i.codigo)).toEqual(['0001', '0002', '0003', '0004', '0005']);
    expect(l[0]).toEqual({ codigo: '0001', descricao: 'Amêndoa', preco: 12990, tipo: 'Peso' });
    expect(l[3].tipo).toBe('Unidade');
    expect(codigo4(9999)).toBe('9999');
  });
  it('tabela agrupa por categoria com preço do kg', () => {
    const t = tabelaBalanca(atribuirPlus(ps, cats, 'categoria').produtos, cats);
    expect(t.map((g) => g.categoria)).toEqual(['Castanhas', 'Temperos', 'Outros']);
    expect(t[0].itens[0]).toEqual({ codigo: 101, nome: 'Amêndoa', preco: 12990, porKg: true });
    expect(t[1].itens.map((i) => i.codigo)).toEqual([201, 205]);
    expect(t[1].itens[1].porKg).toBe(false);
  });
});

describe('ITENSMGV.TXT (Toledo MGV5, importado pelo UPX Thunder)', () => {
  const acafrao = prod({ id: 'a', nome: 'Açafrão em Pó Puro', plu: 1355, venda: 5250 });
  it('linha de 150 caracteres com cada campo na posição certa', () => {
    const l = linhaMgv5(acafrao, { ...BALANCA_PADRAO, validadeDias: 180 });
    expect(l).toHaveLength(150);
    expect(l.slice(0, 2)).toBe('01'); // setor
    expect(l[2]).toBe('0'); // por peso
    expect(l.slice(3, 9)).toBe('001355'); // código
    expect(l.slice(9, 15)).toBe('005250'); // R$ 52,50/kg
    expect(l.slice(15, 18)).toBe('180'); // validade
    expect(l.slice(18, 43)).toBe('ACAFRAO EM PO PURO       ');
    expect(l.slice(43, 68).trim()).toBe('');
    expect(l[84]).toBe('1'); // imprime validade
    expect(/^[\x20-\x7E]+$/.test(l)).toBe(true); // só ASCII
  });
  it('produto em grama vai com preço por kg; por unidade vai com tipo 1', () => {
    expect(linhaMgv5(prod({ id: 'g', nome: 'X', unidade: 'g', venda: 8, plu: 1 }), BALANCA_PADRAO).slice(9, 15)).toBe('008000');
    expect(linhaMgv5(prod({ id: 'u', nome: 'Y', unidade: 'pacote', venda: 1990, plu: 2 }), BALANCA_PADRAO).slice(2, 15)).toBe('1000002001990');
  });
  it('nome longo quebra em duas linhas de 25 entre palavras', () => {
    expect(duasLinhas('Amendoim Crocante Mostarda e Mel')).toEqual(['AMENDOIM CROCANTE', 'MOSTARDA E MEL']);
    expect(textoBalanca('Chá "Seca" Barriga®')).toBe('CHA SECA BARRIGA');
  });
  it('arquivo com CRLF e o que ficou de fora com o motivo', () => {
    const r = gerarItensMgv([acafrao, prod({ id: 'b', nome: 'B', plu: 1 }), prod({ id: 'c', nome: 'C' }), prod({ id: 'd', nome: 'D', venda: null, plu: 3 })], BALANCA_PADRAO);
    expect(r.incluidos).toBe(2);
    expect(r.texto.split('\r\n')).toHaveLength(3);
    expect(r.texto.indexOf('001355')).toBeGreaterThan(r.texto.indexOf('000001')); // em ordem de código
    expect(r.fora.map((f) => f.motivo)).toEqual(['sem código da balança', 'sem preço de venda']);
  });
});

describe('etiqueta da balança no PDV', () => {
  const p = prod({ id: 'b', nome: 'Bolo', plu: 101355 });
  it('lê o exemplo real da UPX: 2 101355 00984 2 = R$ 9,84', () => {
    expect(digitoEan13('210135500984')).toBe(2);
    const r = lerEtiquetaBalanca('2101355009842', BALANCA_PADRAO, [p]);
    expect(r).toEqual({ ok: true, produto: p, plu: 101355, valor: 984 });
  });
  it('outros formatos e erros', () => {
    const doze = '201355' + '000500';
    const cod = doze + digitoEan13(doze);
    expect(lerEtiquetaBalanca(cod, { ...BALANCA_PADRAO, etiqueta: 'codigo5-peso6' }, [prod({ id: 'x', nome: 'X', plu: 1355 })])).toMatchObject({ ok: true, plu: 1355, gramas: 500 });
    expect(lerEtiquetaBalanca('2101355009843', BALANCA_PADRAO, [p]).ok).toBe(false); // dígito errado
    expect(lerEtiquetaBalanca('7891234567895', BALANCA_PADRAO, [p]).ok).toBe(false); // não é de balança
    expect(lerEtiquetaBalanca('2999999009846', BALANCA_PADRAO, [p])).toMatchObject({ ok: false });
  });
});

describe('códigos e configuração da balança sobrevivem ao salvar', () => {
  it('backup .txt', () => {
    const cfg = defaultSettings();
    cfg.balanca = { modelo: 'thunder', numeracao: 'sequencial', etiqueta: 'codigo5-peso6', validadeDias: 90, setor: 2 };
    const r = lerBackup(criarBackup({ nome: 'L', categorias: [], produtos: [prod({ id: 'a', nome: 'A', plu: 7 }), prod({ id: 'b', nome: 'B', plu: 7 })] }, defaultStore(), cfg));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.balanca).toEqual(cfg.balanca);
      expect(r.lista.produtos.map((x) => x.plu)).toEqual([7, undefined]); // código repetido não passa
    }
  });
  it('Excel (aba oculta)', () => {
    const ps = [prod({ id: 'a', nome: 'A', plu: 7 })];
    expect(mergeExtras([{ ...ps[0], plu: undefined }], buildExtras(ps))[0].plu).toBe(7);
  });
  it('configuração estranha volta ao padrão', () => {
    expect(balancaDe({ etiqueta: 'xpto', validadeDias: -3, setor: 500 })).toEqual({ modelo: 'thunder', numeracao: 'sequencial', etiqueta: 'codigo6-valor5', validadeDias: 0, setor: 99 });
  });
});
