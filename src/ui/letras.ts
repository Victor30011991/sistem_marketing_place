import { cssLetra, letraDe } from '../core/letras';

/**
 * Baixa as letras escolhidas só quando são usadas (cada uma vira um arquivo à parte no build).
 * As letras base já vêm com as telas de arte.
 */
const CARREGAR: Record<string, () => Promise<unknown>> = {
  'dm-serif-display': () => import('@fontsource/dm-serif-display/latin-400.css'),
  'gloock': () => import('@fontsource/gloock/latin-400.css'),
  'abril-fatface': () => import('@fontsource/abril-fatface/latin-400.css'),
  'rozha-one': () => import('@fontsource/rozha-one/latin-400.css'),
  'italiana': () => import('@fontsource/italiana/latin-400.css'),
  'cormorant-garamond': () => import('@fontsource/cormorant-garamond/latin-500.css'),
  'bodoni-moda': () => import('@fontsource/bodoni-moda/latin-600.css'),
  'young-serif': () => import('@fontsource/young-serif/latin-400.css'),
  'yeseva-one': () => import('@fontsource/yeseva-one/latin-400.css'),
  'prata': () => import('@fontsource/prata/latin-400.css'),
  'gilda-display': () => import('@fontsource/gilda-display/latin-400.css'),
  'instrument-serif': () => import('@fontsource/instrument-serif/latin-400.css'),
  'marcellus': () => import('@fontsource/marcellus/latin-400.css'),
  'cinzel': () => import('@fontsource/cinzel/latin-600.css'),
  'great-vibes': () => import('@fontsource/great-vibes/latin-400.css'),
  'parisienne': () => import('@fontsource/parisienne/latin-400.css'),
  'sacramento': () => import('@fontsource/sacramento/latin-400.css'),
  'kaushan-script': () => import('@fontsource/kaushan-script/latin-400.css'),
  'satisfy': () => import('@fontsource/satisfy/latin-400.css'),
  'homemade-apple': () => import('@fontsource/homemade-apple/latin-400.css'),
  'anton': () => import('@fontsource/anton/latin-400.css'),
  'alfa-slab-one': () => import('@fontsource/alfa-slab-one/latin-400.css'),
  'montserrat': () => import('@fontsource/montserrat/latin-700.css'),
  'josefin-sans': () => import('@fontsource/josefin-sans/latin-600.css'),
  'poppins': () => import('@fontsource/poppins/latin-600.css'),
  'raleway': () => import('@fontsource/raleway/latin-600.css'),
};

const prontas = new Map<string, Promise<void>>();

/** Garante que as letras estão prontas para desenhar (canvas) ou imprimir. Ids desconhecidos são ignorados. */
export function carregarLetras(ids: Iterable<string | undefined>): Promise<void> {
  const tarefas: Promise<void>[] = [];
  for (const id of ids) {
    const x = letraDe(id);
    if (!x) continue;
    if (!prontas.has(x.id)) {
      const p = (CARREGAR[x.id]?.() ?? Promise.resolve())
        .then(() => (typeof document !== 'undefined' ? document.fonts.load(`${x.peso} 40px ${cssLetra(x)}`, 'Áéçã') : undefined))
        .then(() => undefined)
        .catch(() => undefined);
      prontas.set(x.id, p);
    }
    tarefas.push(prontas.get(x.id)!);
  }
  return Promise.all(tarefas).then(() => undefined);
}
