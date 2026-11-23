import { LETRAS, cssLetra, letraDe } from './letras';
/** Estilos de arte do Posta Aí: camadas em frações da arte (0–1), cores pelos papéis da loja. */
import type { CamadaArte, CorArte, EstiloArte, FonteSalva, StoreInfo } from '../types';
import { newId } from './normalize';

export const FORMATOS_ARTE = {
  feed: { rotulo: 'Feed (4:5)', w: 1080, h: 1350 },
  story: { rotulo: 'Story e Reel (9:16)', w: 1080, h: 1920 },
} as const;
export type FormatoArte = keyof typeof FORMATOS_ARTE;

/** Todas as letras da biblioteca (src/core/letras.ts), no formato das artes. */
export const FAMILIAS_ARTE: { id: string; rotulo: string; css: string; peso: number; base?: boolean }[] = LETRAS.map((x) => ({ id: x.id, rotulo: x.nome, css: cssLetra(x), peso: x.peso, base: x.base }));

export function familiaCss(id: string | undefined, fontes: FonteSalva[] = []): { css: string; peso: number } {
  if (id?.startsWith('f:')) {
    const f = fontes.find((x) => `f:${x.id}` === id);
    if (f) return { css: `"${nomeFonte(f)}", sans-serif`, peso: 400 };
  }
  const f = letraDe(id) ?? letraDe('simples')!;
  return { css: cssLetra(f), peso: f.peso };
}
/** Nome interno da letra salva (evita conflito com as do sistema). */
export const nomeFonte = (f: FonteSalva) => `PA ${f.id}`;

export const CORES_ARTE: { id: CorArte; rotulo: string }[] = [
  { id: 'primaria', rotulo: 'Cor principal' },
  { id: 'destaque', rotulo: 'Cor de destaque' },
  { id: 'creme', rotulo: 'Fundo claro' },
  { id: 'escuro', rotulo: 'Escuro' },
  { id: 'branco', rotulo: 'Branco' },
];

/** 4 combinações: normal, trocando principal↔destaque, claro↔escuro, e as duas trocas. */
export const VARIACOES = ['Original', 'Trocar cores', 'Noite', 'Noite trocada'];
export function corArte(c: CorArte | undefined, loja: StoreInfo, variacao = 0): string {
  const troca = variacao === 1 || variacao === 3;
  const noite = variacao >= 2;
  const p = loja.cores.primaria, d = loja.cores.destaque;
  const claro = loja.cores.fundo, escuro = '#2B1D17';
  switch (c) {
    case 'primaria': return troca ? d : p;
    case 'destaque': return troca ? p : d;
    case 'creme': return noite ? escuro : claro;
    case 'escuro': return noite ? claro : escuro;
    case 'branco': return '#FFFFFF';
    default: return claro;
  }
}

/** Enfeites desenhados à mão (caminhos SVG numa caixa 100 × 100, traço sem preenchimento). */
export const ENFEITES: { id: string; rotulo: string; d: string; cheio?: boolean }[] = [
  { id: 'seta', rotulo: 'Seta', d: 'M10 80 C 30 30, 60 20, 85 30 M70 18 L86 30 L72 44' },
  { id: 'seta-baixo', rotulo: 'Seta para baixo', d: 'M30 8 C 70 20, 70 55, 50 88 M36 76 L50 90 L64 78' },
  { id: 'sublinhado', rotulo: 'Sublinhado', d: 'M5 60 C 20 45, 30 70, 45 55 S 70 45, 95 55' },
  { id: 'circulo', rotulo: 'Círculo rabiscado', d: 'M50 8 C 85 8, 95 40, 90 60 C 82 88, 30 95, 12 70 C -2 48, 15 15, 55 12 C 70 12, 80 18, 84 24' },
  { id: 'brilho', rotulo: 'Brilho', d: 'M50 10 C 54 40, 60 46, 90 50 C 60 54, 54 60, 50 90 C 46 60, 40 54, 10 50 C 40 46, 46 40, 50 10 Z', cheio: true },
  { id: 'brilhos', rotulo: 'Brilhinhos', d: 'M30 20 L30 40 M20 30 L40 30 M70 55 L70 85 M55 70 L85 70 M75 15 L75 25 M70 20 L80 20' },
  { id: 'coracao', rotulo: 'Coração', d: 'M50 85 C 20 62, 8 45, 15 28 C 22 12, 45 14, 50 32 C 55 14, 78 12, 85 28 C 92 45, 80 62, 50 85 Z' },
  { id: 'estrela', rotulo: 'Estrela', d: 'M50 8 L61 38 L93 39 L67 58 L77 90 L50 71 L23 90 L33 58 L7 39 L39 38 Z' },
  { id: 'folha', rotulo: 'Folhinha', d: 'M15 85 C 20 40, 50 15, 88 12 C 85 50, 60 80, 15 85 Z M15 85 C 40 60, 55 45, 75 28' },
  { id: 'raminho', rotulo: 'Raminho', d: 'M50 95 L50 10 M50 30 C 35 25, 28 15, 30 8 C 42 10, 50 20, 50 30 M50 30 C 65 25, 72 15, 70 8 C 58 10, 50 20, 50 30 M50 55 C 33 50, 24 38, 26 30 C 40 32, 50 44, 50 55 M50 55 C 67 50, 76 38, 74 30 C 60 32, 50 44, 50 55 M50 80 C 33 75, 24 63, 26 55 C 40 57, 50 69, 50 80 M50 80 C 67 75, 76 63, 74 55 C 60 57, 50 69, 50 80' },
  { id: 'pimenta', rotulo: 'Pimenta', d: 'M30 30 C 20 50, 30 80, 75 90 C 60 70, 55 45, 45 30 C 42 25, 34 24, 30 30 Z M38 26 C 38 15, 45 8, 55 10' },
  { id: 'vapor', rotulo: 'Fumacinha', d: 'M30 90 C 20 75, 40 65, 30 50 S 40 25, 30 10 M55 90 C 45 75, 65 65, 55 50 S 65 25, 55 10 M80 90 C 70 75, 90 65, 80 50 S 90 25, 80 10' },
  { id: 'aspas', rotulo: 'Aspas', d: 'M20 55 C 20 35, 30 25, 42 22 M20 55 A 10 10 0 1 0 22 54 M58 55 C 58 35, 68 25, 80 22 M58 55 A 10 10 0 1 0 60 54' },
];

const c = (tipo: CamadaArte['tipo'], x: number, y: number, w: number, h: number, extra: Partial<CamadaArte> = {}): CamadaArte => ({ id: `${tipo}-${x}-${y}`, tipo, x, y, w, h, ...extra });

export const ESTILOS_PRONTOS: EstiloArte[] = [
  {
    id: 'pote',
    nome: 'Pote recortado',
    fundo: 'creme',
    camadas: [
      c('logo', 0.42, 0.025, 0.16, 0.11),
      c('foto', 0.1, 0.15, 0.8, 0.8, { mascara: 'pote', escurecer: 0.25 }),
      c('texto', 0.12, 0.47, 0.76, 0.06, { campo: 'subtitulo', familia: 'forte', tamanho: 0.055, cor: 'branco', maiusculas: true, sombra: true }),
      c('texto', 0.12, 0.53, 0.76, 0.22, { campo: 'titulo', familia: 'manuscrita', tamanho: 0.13, cor: 'branco', sombra: true }),
    ],
  },
  {
    id: 'card',
    nome: 'Card do produto',
    fundo: 'primaria',
    camadas: [
      c('forma', 0.06, 0.045, 0.88, 0.91, { cor: 'creme', raio: 0.01 }),
      c('texto', 0.1, 0.065, 0.5, 0.04, { campo: 'preco', familia: 'simples', tamanho: 0.03, cor: 'escuro', alinhar: 'esquerda' }),
      c('foto', 0.1, 0.11, 0.8, 0.6, { mascara: 'retangulo' }),
      c('texto', 0.1, 0.74, 0.5, 0.13, { campo: 'titulo', familia: 'gorda', tamanho: 0.07, cor: 'primaria', alinhar: 'esquerda', maiusculas: true }),
      c('texto', 0.1, 0.87, 0.5, 0.05, { campo: 'subtitulo', familia: 'elegante', tamanho: 0.035, cor: 'primaria', alinhar: 'esquerda' }),
      c('texto', 0.62, 0.75, 0.28, 0.17, { campo: 'chamada', familia: 'simples', tamanho: 0.028, cor: 'escuro', alinhar: 'direita' }),
    ],
  },
  {
    id: 'lista',
    nome: 'Lista em faixas',
    fundo: 'destaque',
    camadas: [
      c('texto', 0.05, 0.035, 0.9, 0.08, { campo: 'titulo', familia: 'forte', tamanho: 0.085, cor: 'creme', maiusculas: true }),
      c('texto', 0.05, 0.115, 0.9, 0.04, { campo: 'subtitulo', familia: 'simples', tamanho: 0.032, cor: 'creme' }),
      c('foto', 0, 0.17, 1, 0.69, { mascara: 'retangulo', escurecer: 0.35 }),
      c('lista', 0, 0.17, 1, 0.69, { familia: 'simples', tamanho: 0.04, cor: 'branco', faixa: 'escuro' }),
      c('texto', 0.05, 0.885, 0.9, 0.08, { campo: 'chamada', familia: 'manuscrita', tamanho: 0.065, cor: 'creme' }),
    ],
  },
  {
    id: 'letreiro',
    nome: 'Letreiro grande',
    fundo: 'destaque',
    camadas: [
      c('texto', 0, 0.2, 1, 0.62, { campo: 'titulo', familia: 'forte', tamanho: 0.24, cor: 'creme', maiusculas: true, opacidade: 0.28 }),
      c('logo', 0.43, 0.03, 0.14, 0.1),
      c('texto', 0.08, 0.14, 0.84, 0.1, { campo: 'subtitulo', familia: 'forte', tamanho: 0.075, cor: 'creme', maiusculas: true }),
      c('foto', 0.14, 0.27, 0.72, 0.55, { mascara: 'circulo' }),
      c('texto', 0.08, 0.84, 0.84, 0.1, { campo: 'titulo', familia: 'manuscrita', tamanho: 0.085, cor: 'creme' }),
      c('texto', 0.08, 0.935, 0.84, 0.04, { campo: 'chamada', familia: 'simples', tamanho: 0.03, cor: 'creme' }),
    ],
  },
  {
    id: 'rabiscos',
    nome: 'Rabiscos',
    fundo: 'escuro',
    camadas: [
      c('foto', 0, 0, 1, 1, { mascara: 'retangulo', escurecer: 0.3 }),
      c('texto', 0.08, 0.06, 0.84, 0.2, { campo: 'titulo', familia: 'manuscrita', tamanho: 0.12, cor: 'branco', sombra: true }),
      c('enfeite', 0.3, 0.24, 0.4, 0.06, { enfeite: 'sublinhado', cor: 'branco' }),
      c('texto', 0.08, 0.3, 0.84, 0.05, { campo: 'subtitulo', familia: 'simples', tamanho: 0.035, cor: 'branco', sombra: true }),
      c('enfeite', 0.78, 0.36, 0.14, 0.1, { enfeite: 'brilhos', cor: 'branco' }),
      c('enfeite', 0.08, 0.66, 0.16, 0.12, { enfeite: 'seta', cor: 'branco', girar: -20 }),
      c('enfeite', 0.8, 0.7, 0.1, 0.08, { enfeite: 'coracao', cor: 'branco' }),
      c('texto', 0.08, 0.86, 0.66, 0.08, { campo: 'chamada', familia: 'manuscrita', tamanho: 0.06, cor: 'branco', sombra: true, alinhar: 'esquerda' }),
      c('logo', 0.8, 0.85, 0.13, 0.1),
    ],
  },
  {
    id: 'sabia',
    nome: 'Você sabia? (sem foto)',
    fundo: 'creme',
    camadas: [
      c('forma', 0.06, 0.05, 0.88, 0.9, { cor: 'primaria', raio: 0.04, opacidade: 0.08 }),
      c('texto', 0.1, 0.1, 0.8, 0.06, { texto: 'Você sabia?', campo: 'livre', familia: 'forte', tamanho: 0.06, cor: 'destaque', maiusculas: true }),
      c('texto', 0.1, 0.2, 0.8, 0.36, { campo: 'titulo', familia: 'gorda', tamanho: 0.1, cor: 'escuro' }),
      c('enfeite', 0.38, 0.57, 0.24, 0.05, { enfeite: 'sublinhado', cor: 'primaria' }),
      c('texto', 0.12, 0.64, 0.76, 0.1, { campo: 'subtitulo', familia: 'simples', tamanho: 0.042, cor: 'escuro' }),
      c('enfeite', 0.08, 0.76, 0.14, 0.14, { enfeite: 'raminho', cor: 'destaque', girar: -15 }),
      c('texto', 0.25, 0.83, 0.5, 0.05, { texto: 'Arraste para o lado ➜', campo: 'livre', familia: 'manuscrita', tamanho: 0.05, cor: 'primaria' }),
      c('logo', 0.8, 0.82, 0.12, 0.09),
    ],
  },
  {
    id: 'oferta',
    nome: 'Oferta',
    fundo: 'primaria',
    camadas: [
      c('foto', 0.08, 0.06, 0.84, 0.56, { mascara: 'arredondado' }),
      c('forma', 0.62, 0.5, 0.3, 0.2, { cor: 'creme', raio: 1, girar: -8 }),
      c('texto', 0.63, 0.545, 0.28, 0.11, { campo: 'preco', familia: 'forte', tamanho: 0.05, cor: 'primaria', girar: -8 }),
      c('texto', 0.08, 0.66, 0.6, 0.06, { campo: 'subtitulo', familia: 'forte', tamanho: 0.05, cor: 'creme', maiusculas: true, alinhar: 'esquerda' }),
      c('texto', 0.08, 0.72, 0.84, 0.14, { campo: 'titulo', familia: 'gorda', tamanho: 0.09, cor: 'branco', alinhar: 'esquerda' }),
      c('texto', 0.08, 0.89, 0.6, 0.06, { campo: 'chamada', familia: 'manuscrita', tamanho: 0.06, cor: 'creme', alinhar: 'esquerda' }),
      c('logo', 0.8, 0.87, 0.12, 0.09),
    ],
  },
];

/** Slide do carrossel (um passo/item por slide) e o slide final. */
export const ESTILO_SLIDE: EstiloArte = {
  id: 'slide',
  nome: 'Slide',
  fundo: 'creme',
  camadas: [
    c('texto', 0.08, 0.08, 0.84, 0.2, { campo: 'preco', familia: 'forte', tamanho: 0.2, cor: 'primaria', alinhar: 'esquerda' }),
    c('texto', 0.08, 0.32, 0.84, 0.4, { campo: 'titulo', familia: 'gorda', tamanho: 0.085, cor: 'escuro', alinhar: 'esquerda' }),
    c('enfeite', 0.08, 0.72, 0.3, 0.05, { enfeite: 'sublinhado', cor: 'destaque' }),
    c('texto', 0.08, 0.88, 0.6, 0.05, { campo: 'subtitulo', familia: 'simples', tamanho: 0.03, cor: 'escuro', alinhar: 'esquerda' }),
    c('logo', 0.8, 0.85, 0.12, 0.09),
  ],
};
export const ESTILO_FINAL: EstiloArte = {
  id: 'final',
  nome: 'Final',
  fundo: 'primaria',
  camadas: [
    c('logo', 0.35, 0.18, 0.3, 0.24),
    c('texto', 0.08, 0.48, 0.84, 0.16, { campo: 'titulo', familia: 'manuscrita', tamanho: 0.11, cor: 'creme' }),
    c('texto', 0.08, 0.66, 0.84, 0.08, { campo: 'subtitulo', familia: 'simples', tamanho: 0.04, cor: 'creme' }),
    c('enfeite', 0.44, 0.76, 0.12, 0.1, { enfeite: 'seta-baixo', cor: 'creme' }),
  ],
};

export function novaCamada(tipo: CamadaArte['tipo'], extra: Partial<CamadaArte> = {}): CamadaArte {
  const base: Record<CamadaArte['tipo'], Partial<CamadaArte>> = {
    texto: { x: 0.15, y: 0.4, w: 0.7, h: 0.12, campo: 'livre', texto: 'Seu texto', familia: 'manuscrita', tamanho: 0.08, cor: 'branco', sombra: true },
    enfeite: { x: 0.4, y: 0.4, w: 0.2, h: 0.15, enfeite: 'brilho', cor: 'branco' },
    forma: { x: 0.1, y: 0.8, w: 0.8, h: 0.12, cor: 'primaria', raio: 0.03 },
    foto: { x: 0.1, y: 0.1, w: 0.8, h: 0.6, mascara: 'retangulo' },
    logo: { x: 0.42, y: 0.04, w: 0.16, h: 0.12 },
    lista: { x: 0.05, y: 0.2, w: 0.9, h: 0.6, familia: 'simples', tamanho: 0.04, cor: 'branco', faixa: 'escuro' },
    selo: { x: 0.64, y: 0.6, w: 0.3, h: 0.24, campo: 'preco', familia: 'forte', tamanho: 0.05, cor: 'destaque', formaSelo: 'estrela', girar: -8 },
  };
  return { id: newId(), tipo, x: 0, y: 0, w: 0.5, h: 0.2, ...base[tipo], ...extra } as CamadaArte;
}

// ----------------------------------------------------------------------- validação (backup / nuvem)

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fr = (v: unknown, d: number, min = 0, max = 1) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const CORES: CorArte[] = ['primaria', 'destaque', 'creme', 'escuro', 'branco'];
const cor = (v: unknown): CorArte | undefined => (CORES.includes(v as CorArte) ? (v as CorArte) : undefined);
const TIPOS: CamadaArte['tipo'][] = ['foto', 'texto', 'forma', 'logo', 'enfeite', 'lista', 'selo'];
const MASCARAS = ['retangulo', 'pote', 'circulo', 'arco', 'arredondado'] as const;
const CAMPOS = ['titulo', 'subtitulo', 'chamada', 'preco', 'livre'] as const;

function camadaDe(v: unknown): CamadaArte | null {
  if (!isObj(v) || !TIPOS.includes(v.tipo as CamadaArte['tipo'])) return null;
  const k: CamadaArte = {
    id: typeof v.id === 'string' && v.id ? v.id : newId(),
    tipo: v.tipo as CamadaArte['tipo'],
    x: fr(v.x, 0, -0.5, 1.5),
    y: fr(v.y, 0, -0.5, 1.5),
    w: fr(v.w, 0.5, 0.01, 2),
    h: fr(v.h, 0.2, 0.01, 2),
  };
  const kc = cor(v.cor);
  if (kc) k.cor = kc;
  if (typeof v.opacidade === 'number') k.opacidade = fr(v.opacidade, 1);
  if (typeof v.girar === 'number') k.girar = fr(v.girar, 0, -180, 180);
  if (CAMPOS.includes(v.campo as (typeof CAMPOS)[number])) k.campo = v.campo as CamadaArte['campo'];
  if (typeof v.texto === 'string') k.texto = v.texto.slice(0, 300);
  if (typeof v.familia === 'string') k.familia = v.familia.slice(0, 40);
  if (typeof v.tamanho === 'number') k.tamanho = fr(v.tamanho, 0.06, 0.01, 0.4);
  if (v.alinhar === 'esquerda' || v.alinhar === 'direita' || v.alinhar === 'centro') k.alinhar = v.alinhar;
  if (v.maiusculas === true) k.maiusculas = true;
  if (v.sombra === true) k.sombra = true;
  if (v.contorno === true) k.contorno = true;
  const kft = cor(v.fundoTexto);
  if (kft) k.fundoTexto = kft;
  if (v.formaSelo === 'circulo' || v.formaSelo === 'estrela' || v.formaSelo === 'etiqueta') k.formaSelo = v.formaSelo;
  if (MASCARAS.includes(v.mascara as (typeof MASCARAS)[number])) k.mascara = v.mascara as CamadaArte['mascara'];
  if (typeof v.escurecer === 'number') k.escurecer = fr(v.escurecer, 0, 0, 0.8);
  if (typeof v.raio === 'number') k.raio = fr(v.raio, 0, 0, 1);
  if (typeof v.enfeite === 'string' && ENFEITES.some((e) => e.id === v.enfeite)) k.enfeite = v.enfeite;
  const kf = cor(v.faixa);
  if (kf) k.faixa = kf;
  return k;
}

export function estilosDe(raw: unknown): EstiloArte[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.flatMap((e) => {
    if (!isObj(e) || !Array.isArray(e.camadas)) return [];
    const camadas = e.camadas.map(camadaDe).filter((x): x is CamadaArte => !!x).slice(0, 40);
    return [{ id: typeof e.id === 'string' && e.id ? e.id : newId(), nome: typeof e.nome === 'string' && e.nome.trim() ? e.nome.slice(0, 60) : 'Meu estilo', fundo: cor(e.fundo) ?? 'creme', camadas }];
  });
}

export function fontesDe(raw: unknown): FonteSalva[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.flatMap((f) =>
    isObj(f) && typeof f.id === 'string' && typeof f.nome === 'string' && typeof f.dados === 'string' && f.dados.startsWith('data:') ? [{ id: f.id, nome: f.nome.slice(0, 60), dados: f.dados }] : [],
  );
}
