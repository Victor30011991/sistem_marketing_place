import { describe, expect, it } from 'vitest';
import type { Product } from '../src/types';
import { modulosEan13 } from '../src/core/ean';
import { codigoEtiqueta, etiquetasDe, limitar, linhasNutricao, modelosPadrao, precoPacote, textoPeca } from '../src/core/etiquetas';
import { lerEtiquetaBalanca, BALANCA_PADRAO } from '../src/core/balanca';
import { criarBackup, lerBackup } from '../src/core/backup';
import { defaultSettings, defaultStore } from '../src/core/defaults';
import { buildExtras, mergeExtras } from '../src/core/extras';

const acafrao: Product = {
  id: 'a', nome: 'Açafrão', categoria: 'Temperos', unidade: 'kg', custo: 2191, custosAdicionais: 0, venda: 4400,
  propQtd: 100, propUnidade: 'g', observacoes: '', plu: 12,
};

describe('código de barras EAN-13', () => {
  it('tem 95 módulos com as guardas no lugar', () => {
    const m = modulosEan13('2101355009842')!;
    expect(m).toHaveLength(95);
    expect(m.slice(0, 3)).toBe('101');
    expect(m.slice(45, 50)).toBe('01010');
    expect(m.slice(-3)).toBe('101');
  });
  it('recusa dígito verificador errado', () => {
    expect(modulosEan13('2101355009841')).toBeNull();
  });
});

describe('etiqueta do pacote', () => {
  it('preço do pacote pelo preço do kg', () => {
    expect(precoPacote(acafrao, 100)).toBe(440);
    expect(precoPacote(acafrao, 250)).toBe(1100);
    expect(precoPacote(acafrao, null)).toBeNull();
  });
  it('o código da etiqueta é lido pelo PDV com o valor certo', () => {
    const cod = codigoEtiqueta(acafrao, 250)!;
    expect(cod).toBe('2000012011009');
    const r = lerEtiquetaBalanca(cod, BALANCA_PADRAO, [acafrao]);
    expect(r).toMatchObject({ ok: true, valor: 1100 });
  });
  it('formato por peso grava os gramas', () => {
    const r = lerEtiquetaBalanca(codigoEtiqueta(acafrao, 250, { ...BALANCA_PADRAO, etiqueta: 'codigo6-peso5' })!, { ...BALANCA_PADRAO, etiqueta: 'codigo6-peso5' }, [acafrao]);
    expect(r).toMatchObject({ ok: true, gramas: 250 });
  });
  it('sem código de balança, sem código de barras', () => {
    expect(codigoEtiqueta({ ...acafrao, plu: null }, 100)).toBeNull();
  });
  it('textos das peças', () => {
    const [pote] = modelosPadrao();
    const t = (tipo: string) => textoPeca(pote.pecas.find((p) => p.tipo === tipo)!, acafrao, defaultStore(), { pesoG: 250, validade: '2027-05-17', lote: '598' });
    expect(t('precoPacote')).toMatch(/11,00/);
    expect(t('peso')).toBe('Peso: 250 g');
    expect(t('validade')).toBe('Val.: 17/05/2027');
    expect(t('lote')).toBe('Lote: 598');
    expect(t('precoKg')).toMatch(/44,00\/kg/);
    expect(t('preco100g')).toMatch(/4,40 \/ 100 g/);
  });
  it('tabela nutricional calcula a porção', () => {
    const l = linhasNutricao({ porcao: 5, kcal: 300, carboidratos: 50, acucares: 0, proteinas: 10, gorduras: 4, saturadas: 1, fibras: 20, sodio: 30 });
    expect(l[0]).toEqual({ nome: 'Valor energético', cem: '300 kcal', porcao: '15 kcal' });
    expect(l[1].porcao).toBe('2,5 g');
  });
});

describe('modelos', () => {
  it('peça não sai da etiqueta', () => {
    const p = limitar({ ...modelosPadrao()[0].pecas[0], x: 48, y: -3, w: 20, h: 1 }, { largura: 50, altura: 30 });
    expect(p).toMatchObject({ x: 30, y: 0, w: 20, h: 2 });
  });
  it('com margem, a peça fica dentro da área de impressão; cor e margem voltam do backup', () => {
    const p = limitar({ ...modelosPadrao()[0].pecas[0], x: 0, y: 0, w: 60, h: 40 }, { largura: 50, altura: 30, margem: 2 });
    expect(p).toMatchObject({ x: 2, y: 2, w: 46, h: 26 });
    const [m] = etiquetasDe([{ ...modelosPadrao()[0], margem: 3, cor: 'cor', pecas: [{ ...modelosPadrao()[0].pecas[1], cor: 'primaria', x: 0 }] }])!;
    expect(m).toMatchObject({ margem: 3, cor: 'cor' });
    expect(m.pecas[0]).toMatchObject({ cor: 'primaria', x: 3 });
  });
  it('todo modelo tem todas as peças (as que faltam, desligadas)', () => {
    for (const m of modelosPadrao()) {
      const tipos = new Set(m.pecas.map((p) => p.tipo));
      expect(tipos.size).toBeGreaterThanOrEqual(12);
    }
  });
  it('modelos e dados do rótulo voltam do backup', () => {
    const etiquetas = modelosPadrao();
    const p = { ...acafrao, ingredientes: 'Cúrcuma moída.', nutricao: { porcao: 5, kcal: 300, carboidratos: 50, acucares: 0, proteinas: 10, gorduras: 4, saturadas: 1, fibras: 20, sodio: 30 } };
    const txt = criarBackup({ nome: 'L', categorias: ['Temperos'], produtos: [p] }, defaultStore(), { ...defaultSettings(), etiquetas });
    const r = lerBackup(txt);
    if (!r.ok) throw new Error('backup');
    expect(r.config.etiquetas).toEqual(etiquetas);
    expect(r.lista.produtos[0].ingredientes).toBe('Cúrcuma moída.');
    expect(r.lista.produtos[0].nutricao?.kcal).toBe(300);
    expect(etiquetasDe([{ nome: 'x', largura: 'a', pecas: [{ tipo: 'bomba' }] }])![0].largura).toBe(50);
  });
  it('dados do rótulo viajam no Excel', () => {
    const p = { ...acafrao, ingredientes: 'Cúrcuma.' };
    const [volta] = mergeExtras([{ ...acafrao }], buildExtras([p]));
    expect(volta.ingredientes).toBe('Cúrcuma.');
  });
});
