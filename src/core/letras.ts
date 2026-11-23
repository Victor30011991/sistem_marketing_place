/**
 * Biblioteca de letras gratuitas (licença livre SIL OFL: podem ir no rótulo, no Instagram e na gráfica).
 * Cada letra só é baixada quando alguém escolhe ela (src/ui/letras.ts). A lista mostra os nomes por uma
 * imagem pequena (public/letras.webp), na ordem desta lista, gerada por scripts/gerar-letras.mjs.
 */
export type GrupoLetra = 'serifada' | 'cursiva' | 'forte';

export interface Letra {
  id: string;
  nome: string;
  grupo: GrupoLetra;
  /** font-family do CSS */
  familia: string;
  peso: number;
  /** pacote @fontsource (estático) ou @fontsource-variable */
  pacote: string;
  variavel?: boolean;
  /** já vinha no sistema (carregada sempre nas telas de arte) */
  base?: boolean;
}

const l = (id: string, nome: string, grupo: GrupoLetra, peso: number, extra: Partial<Letra> = {}): Letra => ({
  id,
  nome,
  grupo,
  familia: nome,
  peso,
  pacote: `@fontsource/${id}`,
  ...extra,
});

export const LETRAS: Letra[] = [
  // serifadas modernas
  l('dm-serif-display', 'DM Serif Display', 'serifada', 400),
  l('gloock', 'Gloock', 'serifada', 400),
  l('abril-fatface', 'Abril Fatface', 'serifada', 400),
  l('rozha-one', 'Rozha One', 'serifada', 400),
  l('italiana', 'Italiana', 'serifada', 400),
  l('cormorant-garamond', 'Cormorant Garamond', 'serifada', 500),
  l('bodoni-moda', 'Bodoni Moda', 'serifada', 600),
  l('young-serif', 'Young Serif', 'serifada', 400),
  l('yeseva-one', 'Yeseva One', 'serifada', 400),
  l('prata', 'Prata', 'serifada', 400),
  l('gilda-display', 'Gilda Display', 'serifada', 400),
  l('instrument-serif', 'Instrument Serif', 'serifada', 400),
  l('marcellus', 'Marcellus', 'serifada', 400),
  l('cinzel', 'Cinzel', 'serifada', 600),
  l('elegante', 'Playfair Display', 'serifada', 700, { familia: 'Playfair Display Variable', pacote: '@fontsource-variable/playfair-display', variavel: true, base: true }),
  l('gorda', 'Fraunces', 'serifada', 800, { familia: 'Fraunces Variable', pacote: '@fontsource-variable/fraunces', variavel: true, base: true }),
  // cursivas e manuscritas
  l('great-vibes', 'Great Vibes', 'cursiva', 400),
  l('parisienne', 'Parisienne', 'cursiva', 400),
  l('sacramento', 'Sacramento', 'cursiva', 400),
  l('kaushan-script', 'Kaushan Script', 'cursiva', 400),
  l('satisfy', 'Satisfy', 'cursiva', 400),
  l('homemade-apple', 'Homemade Apple', 'cursiva', 400),
  l('manuscrita', 'Caveat', 'cursiva', 700, { familia: 'Caveat Variable', pacote: '@fontsource-variable/caveat', variavel: true, base: true }),
  l('script', 'Dancing Script', 'cursiva', 700, { familia: 'Dancing Script Variable', pacote: '@fontsource-variable/dancing-script', variavel: true, base: true }),
  // fortes e simples
  l('anton', 'Anton', 'forte', 400),
  l('alfa-slab-one', 'Alfa Slab One', 'forte', 400),
  l('montserrat', 'Montserrat', 'forte', 700),
  l('josefin-sans', 'Josefin Sans', 'forte', 600),
  l('poppins', 'Poppins', 'forte', 600),
  l('raleway', 'Raleway', 'forte', 600),
  l('forte', 'Bebas Neue', 'forte', 400, { familia: 'Bebas Neue', pacote: '@fontsource/bebas-neue', base: true }),
  l('simples', 'DM Sans', 'forte', 600, { familia: 'DM Sans Variable', pacote: '@fontsource-variable/dm-sans', variavel: true, base: true }),
];

export const GRUPOS_LETRA: { id: GrupoLetra; rotulo: string }[] = [
  { id: 'serifada', rotulo: 'Serifadas modernas' },
  { id: 'cursiva', rotulo: 'Cursivas e manuscritas' },
  { id: 'forte', rotulo: 'Fortes e simples' },
];

/** Nomes antigos das Etiquetas → letra da biblioteca. */
const APELIDOS: Record<string, string> = { sans: 'simples', serif: 'gorda' };

export function letraDe(id: string | undefined): Letra | undefined {
  if (!id) return undefined;
  const k = APELIDOS[id] ?? id;
  return LETRAS.find((x) => x.id === k);
}

/** Fonte para o CSS com reserva parecida (serifada, cursiva ou sem serifa). */
export function cssLetra(x: Letra): string {
  const reserva = x.grupo === 'serifada' ? 'Georgia, serif' : x.grupo === 'cursiva' ? 'cursive' : 'Arial, sans-serif';
  return `"${x.familia}", ${reserva}`;
}

/** Posição do nome da letra na imagem da lista (linha de 40 px na escala 1). */
export const ALTURA_LINHA_LETRA = 40;
export const indiceLetra = (id: string) => LETRAS.findIndex((x) => x.id === id);
