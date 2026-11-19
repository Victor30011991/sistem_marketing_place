/** Página de entrada da loja (link da bio): abertura, capítulos de tempero, como pedir, destaques e a loja. */
import type { CapituloEntrada, ConfigEntrada, ImagemSalva, StoreInfo } from '../types';

export const CAPITULOS_PADRAO: CapituloEntrada[] = [
  {
    nome: 'Páprica',
    sub: 'cor de brasa, cheiro de churrasco',
    texto: 'Doce, defumada ou picante: cada uma tem seu lugar. A defumada dá aquele sabor de fogo de chão sem acender a churrasqueira.',
    sabia: 'A páprica é feita de pimentões secos e moídos. A defumada passa dias secando na fumaça de lenha.',
    combina: ['Frango', 'Batata', 'Feijão', 'Molhos'],
    tom: '#B03818',
  },
  {
    nome: 'Cúrcuma',
    sub: 'o sol do arroz amarelinho',
    texto: 'Uma colher de chá muda a cor e o sabor do arroz, do caldo e do frango. É o "açafrão" que a gente usa no dia a dia.',
    sabia: 'O açafrão verdadeiro vem de uma flor e é bem mais caro. O da cozinha brasileira é a cúrcuma, uma raiz.',
    combina: ['Arroz', 'Caldos', 'Frango', 'Legumes'],
    tom: '#E3A21A',
  },
  {
    nome: 'Ervas',
    sub: 'o perfume do fim da receita',
    texto: 'Orégano, alecrim, manjericão e chimichurri. Secas, rendem mais: uma colher de erva seca vale por três de fresca.',
    sabia: 'Erva seca entra no começo do preparo; a fresca, só no final, para não perder o aroma.',
    combina: ['Massas', 'Pizza', 'Carnes', 'Pães'],
    tom: '#64703A',
  },
];

export const ENTRADA_PADRAO: ConfigEntrada = {
  frase: 'Do nosso pote para a sua panela.',
  texto: 'Temperos selecionados e produtos naturais, pesados na hora. Peça pelo celular e retire ou receba em casa.',
  escuro: '#2B1D17',
  capitulos: CAPITULOS_PADRAO,
  fotos: [],
};

/** Paletas prontas: mudam as cores da loja (cardápio e entrada) de uma vez. */
export const PALETAS: { nome: string; primaria: string; destaque: string; fundo: string; escuro: string }[] = [
  { nome: 'Terracota', primaria: '#B03818', destaque: '#64703A', fundo: '#EFDFC6', escuro: '#2B1D17' },
  { nome: 'Sálvia', primaria: '#4F7A63', destaque: '#B5793A', fundo: '#EEF0E6', escuro: '#1E2A24' },
  { nome: 'Açafrão', primaria: '#C8811A', destaque: '#7A2E1D', fundo: '#FAEFD9', escuro: '#2A1B10' },
  { nome: 'Noite', primaria: '#9C3D5A', destaque: '#C9A24A', fundo: '#F3E9E4', escuro: '#141016' },
];

export const MAX_CAPITULOS = 5;
export const MAX_FOTOS_LOJA = 4;
/** Fotos na página de entrada até este tamanho somado (o documento público aceita 1 MB). */
export const LIMITE_FOTOS_ENTRADA = 850_000;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const txt = (v: unknown, d: string, max: number) => (typeof v === 'string' ? v.slice(0, max) : d);
const hex = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : d);

export function capituloDe(v: unknown, i = 0): CapituloEntrada | null {
  if (!isObj(v)) return null;
  const base = CAPITULOS_PADRAO[i % CAPITULOS_PADRAO.length];
  const c: CapituloEntrada = {
    nome: txt(v.nome, '', 40).trim() || 'Tempero',
    sub: txt(v.sub, '', 80),
    texto: txt(v.texto, '', 400),
    sabia: txt(v.sabia, '', 300),
    combina: Array.isArray(v.combina) ? v.combina.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim().slice(0, 30)).slice(0, 6) : [],
    tom: hex(v.tom, base.tom),
  };
  if (typeof v.foto === 'string' && v.foto) c.foto = v.foto.slice(0, 64);
  return c;
}

/** Lê a configuração da entrada de qualquer origem sem nunca lançar. */
export function entradaDe(v: unknown): ConfigEntrada | undefined {
  if (!isObj(v)) return undefined;
  const caps = Array.isArray(v.capitulos) ? v.capitulos.map((c, i) => capituloDe(c, i)).filter((c): c is CapituloEntrada => !!c).slice(0, MAX_CAPITULOS) : ENTRADA_PADRAO.capitulos;
  return {
    frase: txt(v.frase, ENTRADA_PADRAO.frase, 90),
    texto: txt(v.texto, ENTRADA_PADRAO.texto, 300),
    escuro: hex(v.escuro, ENTRADA_PADRAO.escuro),
    capitulos: caps,
    fotos: Array.isArray(v.fotos) ? v.fotos.filter((x): x is string => typeof x === 'string' && !!x).slice(0, MAX_FOTOS_LOJA) : [],
  };
}

export function imagensDe(raw: unknown): ImagemSalva[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.flatMap((f) =>
    isObj(f) && typeof f.id === 'string' && typeof f.dados === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(f.dados)
      ? [{ id: f.id, nome: typeof f.nome === 'string' ? f.nome.slice(0, 60) : '', dados: f.dados }]
      : [],
  );
}

export interface EntradaArquivo {
  v: 1;
  frase: string;
  texto: string;
  escuro: string;
  capitulos: { n: string; s: string; t: string; sb: string; c: string[]; tom: string; f?: string }[];
  fotos: string[];
}

/** O que vai para a página pública de entrada. Fotos acima do limite ficam de fora (as primeiras têm prioridade). */
export function montarEntrada(loja: Pick<StoreInfo, 'vitrine'>, imagens: ImagemSalva[] = []): { arquivo: EntradaArquivo; semFoto: number } {
  const e = entradaDe(loja.vitrine?.entrada) ?? ENTRADA_PADRAO;
  const porId = new Map(imagens.map((i) => [i.id, i.dados]));
  let usado = 0;
  let semFoto = 0;
  const pega = (id: string | undefined) => {
    const d = id ? porId.get(id) : undefined;
    if (!d) return undefined;
    if (usado + d.length > LIMITE_FOTOS_ENTRADA) {
      semFoto++;
      return undefined;
    }
    usado += d.length;
    return d;
  };
  const fotos = e.fotos.map(pega).filter((x): x is string => !!x);
  const capitulos = e.capitulos.map((c) => {
    const f = pega(c.foto);
    return { n: c.nome, s: c.sub, t: c.texto, sb: c.sabia, c: c.combina, tom: c.tom, ...(f ? { f } : {}) };
  });
  return { arquivo: { v: 1, frase: e.frase, texto: e.texto, escuro: e.escuro, capitulos, fotos }, semFoto };
}

/** Endereço da página de entrada, ao lado do cardápio. */
export function linkEntrada(baseDoSistema: string, origem?: string): string {
  const base = baseDoSistema.split('#')[0].split('?')[0].replace(/[^/]*$/, '');
  return `${base}loja/${origem ? `?o=${origem}` : ''}`;
}

/** Ids de imagens que ninguém usa mais (para apagar da nuvem). */
export function imagensSoltas(e: ConfigEntrada | undefined, imagens: ImagemSalva[]): string[] {
  const usadas = new Set([...(e?.fotos ?? []), ...(e?.capitulos ?? []).map((c) => c.foto).filter(Boolean)]);
  return imagens.filter((i) => !usadas.has(i.id)).map((i) => i.id);
}
