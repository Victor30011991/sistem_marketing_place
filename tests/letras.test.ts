import { describe, expect, it } from 'vitest';
import { LETRAS, cssLetra, letraDe, indiceLetra } from '../src/core/letras';
import { familiaCss } from '../src/core/estilosArte';
import { cssFamilia } from '../src/core/etiquetas';
import { readFileSync, existsSync } from 'node:fs';

describe('biblioteca de letras', () => {
  it('32 letras, ids únicos, todas com arquivo de letra instalado', () => {
    expect(LETRAS).toHaveLength(32);
    expect(new Set(LETRAS.map((x) => x.id)).size).toBe(32);
    for (const x of LETRAS) {
      const base = x.pacote.split('/')[1];
      const arq = x.variavel ? `${base}-latin-wght-normal.woff2` : `${base}-latin-${x.peso}-normal.woff2`;
      expect(existsSync(`node_modules/${x.pacote}/files/${arq}`), arq).toBe(true);
    }
  });
  it('as letras novas têm carregador e a imagem da lista existe', () => {
    const ui = readFileSync('src/ui/letras.ts', 'utf8');
    for (const x of LETRAS.filter((l) => !l.base)) expect(ui).toContain(`'${x.id}': () => import('@fontsource/${x.id}/latin-${x.peso}.css')`);
    expect(existsSync('public/letras.webp')).toBe(true);
  });
  it('nomes antigos continuam valendo', () => {
    expect(letraDe('sans')?.nome).toBe('DM Sans');
    expect(letraDe('serif')?.nome).toBe('Fraunces');
    expect(cssFamilia(undefined)).toContain('DM Sans');
    expect(familiaCss('manuscrita').css).toContain('Caveat');
    expect(familiaCss('gloock')).toEqual({ css: cssLetra(letraDe('gloock')!), peso: 400 });
    expect(familiaCss('nao-existe').css).toContain('DM Sans');
    expect(indiceLetra('dm-serif-display')).toBe(0);
  });
});
