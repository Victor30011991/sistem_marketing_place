import { describe, expect, it } from 'vitest';
import type { Product } from '../src/types';
import { ROTULOS_PRONTOS, alturaMinimaPeso, conferirRotulo } from '../src/core/rotulos';
import { areaDe, limitar, textoPeca, etiquetasDe } from '../src/core/etiquetas';
import { criarBackup, lerBackup } from '../src/core/backup';
import { defaultSettings, defaultStore } from '../src/core/defaults';
import { buildExtras, mergeExtras } from '../src/core/extras';

const p: Product = {
  id: 'a', nome: 'Chimichurri', categoria: 'Temperos', unidade: 'kg', custo: 2000, custosAdicionais: 0, venda: 6000,
  propQtd: 100, propUnidade: 'g', observacoes: '', plu: 12,
  ingredientes: 'Salsa, alho, orégano, pimenta.', gluten: 'nao-contem', alergenicos: 'Pode conter mostarda.', modoUso: 'Hidrate com azeite.',
};
const loja = { ...defaultStore(), razaoSocial: 'Temperei LTDA', cnpj: '00.000.000/0001-00', endereco: 'Rua A, 1' };

describe('rótulos prontos', () => {
  it('todas as peças ficam dentro da área (meia altura na solapa)', () => {
    for (const r of ROTULOS_PRONTOS) {
      const m = r.criar();
      const a = areaDe(m);
      for (const x of m.pecas.filter((x) => x.ativo)) {
        expect(x.x + x.w, `${r.id} ${x.tipo}`).toBeLessThanOrEqual(a.largura + 0.01);
        expect(x.y + x.h, `${r.id} ${x.tipo}`).toBeLessThanOrEqual(a.altura + 0.01);
      }
      expect(etiquetasDe([m])![0].pecas.length).toBe(m.pecas.length);
    }
  });
  it('solapa limita a peça à metade', () => {
    const m = ROTULOS_PRONTOS.find((r) => r.id === 'solapa')!.criar();
    expect(areaDe(m).altura).toBe(40);
    expect(limitar({ ...m.pecas[0], y: 60, h: 10 }, m).y).toBeLessThanOrEqual(30);
  });
  it('textos legais', () => {
    const m = ROTULOS_PRONTOS[0].criar();
    const t = (tipo: string) => textoPeca({ ...m.pecas.find((x) => x.tipo === tipo)!, texto: '' }, p, loja, { pesoG: 50, validade: '', lote: '', fabricacao: '2026-11-19' });
    expect(t('pesoLiquido')).toMatch(/Peso líquido 50 g/);
    expect(t('gluten')).toMatch(/NÃO CONTÉM GLÚTEN/);
    expect(t('gluten')).toMatch(/ALÉRGICOS: PODE CONTER MOSTARDA/);
    expect(t('fabricante')).toMatch(/Temperei LTDA.*INDÚSTRIA BRASILEIRA/s);
    expect(t('fabricacao')).toBe('Fab.: 19/11/2026');
  });
});

describe('conferência do rótulo', () => {
  it('altura mínima do peso líquido', () => {
    expect([alturaMinimaPeso(50), alturaMinimaPeso(150), alturaMinimaPeso(500), alturaMinimaPeso(2000)]).toEqual([2, 3, 4, 6]);
  });
  it('modelo pronto com dados completos passa (mistura com tabela)', () => {
    const m = ROTULOS_PRONTOS[0].criar();
    const nutricao = { porcao: 5, kcal: 300, carboidratos: 50, acucares: 0, proteinas: 10, gorduras: 4, saturadas: 1, fibras: 20, sodio: 30 };
    const falta = conferirRotulo(m, { ...p, nutricao }, loja, 50).filter((x) => !x.ok).map((x) => x.item);
    expect(falta).toEqual([]);
  });
  it('aponta o que falta e dispensa tabela de especiaria pura', () => {
    const m = ROTULOS_PRONTOS[0].criar();
    const r = conferirRotulo(m, { ...p, gluten: undefined, nutricao: undefined }, defaultStore(), 50);
    expect(r.find((x) => x.item.includes('GLÚTEN'))!.ok).toBe(false);
    expect(r.find((x) => x.item.includes('Tabela'))!.ok).toBe(false);
    expect(conferirRotulo(m, { ...p, especiariaPura: true }, loja, 50).find((x) => x.item.includes('Tabela'))!.ok).toBe(true);
  });
});

describe('dados do rótulo', () => {
  it('voltam do backup e do Excel', () => {
    const txt = criarBackup({ nome: 'L', categorias: ['Temperos'], produtos: [{ ...p, especiariaPura: true }] }, defaultStore(), defaultSettings());
    const r = lerBackup(txt);
    if (!r.ok) throw new Error('backup');
    expect(r.lista.produtos[0]).toMatchObject({ gluten: 'nao-contem', alergenicos: 'Pode conter mostarda.', modoUso: 'Hidrate com azeite.', especiariaPura: true });
    const base = { ...p, gluten: undefined, alergenicos: undefined, modoUso: undefined };
    const [volta] = mergeExtras([base], buildExtras([{ ...p, especiariaPura: true }]));
    expect(volta).toMatchObject({ gluten: 'nao-contem', modoUso: 'Hidrate com azeite.', especiariaPura: true });
  });
});
