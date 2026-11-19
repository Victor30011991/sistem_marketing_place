import { describe, expect, it } from 'vitest';
import { ENTRADA_PADRAO, LIMITE_FOTOS_ENTRADA, entradaDe, imagensSoltas, linkEntrada, montarEntrada } from '../src/core/entrada';
import { vitrineDe } from '../src/core/vitrine';
import { criarBackup, lerBackup } from '../src/core/backup';
import { defaultSettings, defaultStore } from '../src/core/defaults';

const foto = (n: number) => 'data:image/jpeg;base64,' + 'A'.repeat(n);

describe('página de entrada', () => {
  it('sem configuração usa o padrão com 3 capítulos', () => {
    const { arquivo } = montarEntrada(defaultStore());
    expect(arquivo.frase).toBe(ENTRADA_PADRAO.frase);
    expect(arquivo.capitulos.map((c) => c.n)).toEqual(['Páprica', 'Cúrcuma', 'Ervas']);
  });
  it('limpa o que vem errado', () => {
    const e = entradaDe({ frase: 9, escuro: 'azul', capitulos: [{ nome: '', tom: '#123' }, 'x', { nome: 'Canela', combina: ['a', 2, ' b '] }], fotos: ['f1', 3] })!;
    expect(e.frase).toBe(ENTRADA_PADRAO.frase);
    expect(e.escuro).toBe('#2B1D17');
    expect(e.capitulos).toHaveLength(2);
    expect(e.capitulos[0].nome).toBe('Tempero');
    expect(e.capitulos[1].combina).toEqual(['a', 'b']);
    expect(e.fotos).toEqual(['f1']);
  });
  it('fotos entram até o limite, na ordem', () => {
    const imagens = [{ id: 'a', nome: '', dados: foto(500_000) }, { id: 'b', nome: '', dados: foto(500_000) }, { id: 'c', nome: '', dados: foto(100_000) }];
    const loja = { ...defaultStore(), vitrine: { ...vitrineDe(defaultStore()), entrada: { ...ENTRADA_PADRAO, fotos: ['a', 'b'], capitulos: [{ ...ENTRADA_PADRAO.capitulos[0], foto: 'c' }] } } };
    const { arquivo, semFoto } = montarEntrada(loja, imagens);
    expect(arquivo.fotos).toHaveLength(1);
    expect(semFoto).toBe(1);
    expect(arquivo.capitulos[0].f).toBeDefined();
    expect(JSON.stringify(arquivo).length).toBeLessThan(LIMITE_FOTOS_ENTRADA + 20_000);
    expect(imagensSoltas(loja.vitrine.entrada, [...imagens, { id: 'z', nome: '', dados: foto(1) }])).toEqual(['z']);
  });
  it('link ao lado do cardápio', () => {
    expect(linkEntrada('https://x.github.io/sistema/#/pagina')).toBe('https://x.github.io/sistema/loja/');
    expect(linkEntrada('https://x.github.io/sistema/index.html', 'instagram')).toBe('https://x.github.io/sistema/loja/?o=instagram');
  });
  it('configuração e fotos voltam do backup', () => {
    const loja = { ...defaultStore(), vitrine: { ...vitrineDe(defaultStore()), entrada: { ...ENTRADA_PADRAO, frase: 'Oi', fotos: ['a'] } } };
    const cfg = { ...defaultSettings(), imagens: [{ id: 'a', nome: 'fachada', dados: foto(10) }] };
    const r = lerBackup(criarBackup({ nome: 'L', categorias: [], produtos: [] }, loja, cfg));
    if (!r.ok) throw new Error('backup');
    expect(r.loja.vitrine?.entrada?.frase).toBe('Oi');
    expect(r.config.imagens).toEqual(cfg.imagens);
  });
});
