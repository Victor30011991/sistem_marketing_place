import { describe, expect, it } from 'vitest';
import type { Product } from '../src/types';
import { frasesArriscadas, gerarIdeias, hashtagsDe, nDia, pascoa, proximasDatas, somaDias, MODELOS_IDEIA, DATAS } from '../src/core/postaai';
import { ESTILOS_PRONTOS, corArte, estilosDe } from '../src/core/estilosArte';
import { criarBackup, lerBackup } from '../src/core/backup';
import { defaultSettings, defaultStore } from '../src/core/defaults';

const prod = (id: string, nome: string, extra: Partial<Product> = {}): Product => ({
  id, nome, categoria: 'Temperos', unidade: 'kg', custo: 2000, custosAdicionais: 0, venda: 5000, propQtd: 100, propUnidade: 'g', observacoes: '', ...extra,
});
const produtos = [prod('a', 'Páprica defumada'), prod('b', 'Alho em pó'), prod('c', 'Cebola desidratada'), prod('d', 'Orégano'), prod('e', 'Cúrcuma'), prod('f', 'Pimenta calabresa')];

describe('ideias', () => {
  const ideias = gerarIdeias({ produtos, loja: defaultStore(), config: defaultSettings(), hoje: '2026-11-19' });
  it('só sugere receita quando a loja tem os temperos', () => {
    const ids = ideias.map((i) => i.id);
    expect(ids).toContain('mix-frango');
    expect(ids).toContain('receita-arroz-amarelo');
    expect(ids).not.toContain('receita-cha-canela');
    expect(ids).not.toContain('sabia-pimenta'); // calabresa não é pimenta-do-reino
    expect(ideias.find((i) => i.id === 'mix-frango')!.motivo).toBe('Você tem os 4 na loja');
  });
  it('data especial próxima vem primeiro', () => {
    expect(ideias[0].id).toBe('data-blackfriday-2026');
    expect(ideias[0].motivo).toBe('Black Friday em 8 dias');
  });
  it('produto em promoção vira ideia de oferta com preço por 100 g', () => {
    const r = gerarIdeias({ produtos: [prod('x', 'Chimichurri', { promo: { preco: 4000, ate: '2026-12-31', selo: 'Oferta' } })], loja: defaultStore(), config: defaultSettings(), hoje: '2026-11-19' });
    const o = r.find((i) => i.id === 'promo-x')!;
    expect(o.preco).toMatch(/4,00 \/ 100 g/);
  });
  it('ideia postada vai para o fim', () => {
    const r = gerarIdeias({ produtos, loja: defaultStore(), config: { ...defaultSettings(), postaAi: { postados: { 'data-blackfriday-2026': '2026-11-19' } } }, hoje: '2026-11-19' });
    expect(r[r.length - 1].id).toBe('data-blackfriday-2026');
  });
  it('a biblioteca não promete efeito no corpo', () => {
    for (const m of MODELOS_IDEIA) expect(frasesArriscadas(`${m.titulo} ${m.subtitulo} ${m.legenda} ${(m.itens ?? []).join(' ')}`), m.id).toEqual([]);
    for (const d of DATAS) expect(frasesArriscadas(`${d.titulo} ${d.legenda}`), d.id).toEqual([]);
  });
});

describe('textos', () => {
  it('avisa frases arriscadas', () => {
    expect(frasesArriscadas('Mix seca barriga DETOX que cura')).toEqual(['promessa de emagrecer', '"detox"', 'efeito de remédio']);
    expect(frasesArriscadas('Frango assado temperadinho')).toEqual([]);
    expect(frasesArriscadas('Sem conservantes')).toHaveLength(1);
  });
  it('hashtags: loja, cidade e no máximo 5', () => {
    expect(hashtagsDe({ hashtags: ['#a', '#b', '#c'] }, defaultStore(), 'Parnaíba')).toEqual(['#temperei', '#parnaiba', '#a', '#b', '#c']);
  });
});

describe('datas', () => {
  it('Páscoa, Dia das Mães, Black Friday', () => {
    expect(pascoa(2026)).toBe('2026-04-05');
    expect(pascoa(2027)).toBe('2027-03-28');
    expect(nDia(2026, 5, 0, 2)).toBe('2026-05-10');
    expect(somaDias(nDia(2026, 11, 4, 4), 1)).toBe('2026-11-27');
    expect(proximasDatas('2026-12-20').map((d) => d.id)).toEqual(['natal', 'anonovo']);
  });
});

describe('estilos', () => {
  it('prontos ficam dentro da arte e voltam iguais da validação', () => {
    for (const e of ESTILOS_PRONTOS) {
      for (const c of e.camadas) {
        expect(c.x + c.w, `${e.id} ${c.id}`).toBeLessThanOrEqual(1.001);
        expect(c.y + c.h, `${e.id} ${c.id}`).toBeLessThanOrEqual(1.001);
      }
      expect(estilosDe([e])![0]).toEqual(e);
    }
    expect(estilosDe([{ nome: 'x', camadas: [{ tipo: 'bomba' }, { tipo: 'texto', x: 9 }] }])![0].camadas).toHaveLength(1);
  });
  it('variações de cor trocam principal e destaque, claro e escuro', () => {
    const l = defaultStore();
    expect(corArte('primaria', l, 1)).toBe(l.cores.destaque);
    expect(corArte('creme', l, 2)).toBe('#2B1D17');
  });
  it('estilos, postados, cidade e letras voltam do backup', () => {
    const cfg = { ...defaultSettings(), postaAi: { estilos: [{ ...ESTILOS_PRONTOS[0], id: 'meu', nome: 'Natal' }], postados: { x: '2026-11-19' }, cidade: 'Parnaíba' }, fontes: [{ id: 'f1', nome: 'Minha', dados: 'data:font/woff2;base64,AAAA' }] };
    const r = lerBackup(criarBackup({ nome: 'L', categorias: [], produtos: [] }, defaultStore(), cfg));
    if (!r.ok) throw new Error('backup');
    expect(r.config.postaAi).toEqual(cfg.postaAi);
    expect(r.config.fontes).toEqual(cfg.fontes);
  });
});
