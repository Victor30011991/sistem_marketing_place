/**
 * Rótulos prontos (solapa, pote redondo, envolvente, pacote em pé, traseira) e a conferência do rótulo
 * de alimento embalado. Medidas em mm. Os modelos usam as cores da loja: mudando as cores em "Minha loja",
 * os rótulos acompanham.
 */
import type { ModeloEtiqueta, PecaEtiqueta, Product, StoreInfo, TipoPeca } from '../types';
import { newId } from './normalize';
import { PECAS, PECAS_MULTIPLAS, areaDe, porPeso } from './etiquetas';

type Extra = Partial<PecaEtiqueta>;
const pc = (tipo: TipoPeca, x: number, y: number, w: number, h: number, fonte: number, extra: Extra = {}): PecaEtiqueta => ({
  id: newId(),
  tipo,
  ativo: true,
  x,
  y,
  w,
  h,
  fonte,
  negrito: false,
  alinhar: 'esq',
  ...extra,
});

function completo(m: Omit<ModeloEtiqueta, 'id'>): ModeloEtiqueta {
  const tem = new Set(m.pecas.map((p) => p.tipo));
  const a = areaDe(m);
  const faltam = PECAS.filter((t) => !PECAS_MULTIPLAS.includes(t.tipo) && !tem.has(t.tipo)).map((t) => pc(t.tipo, (m.margem ?? 0) + 1, (m.margem ?? 0) + 1, Math.min(30, a.largura - 4), Math.min(6, a.altura - 4), 7, { ativo: false }));
  return { ...m, id: newId(), pecas: [...m.pecas, ...faltam] };
}

const TITULO: Extra = { familia: 'manuscrita', cor: 'primaria', alinhar: 'centro', negrito: true };
const SUB: Extra = { familia: 'forte', cor: 'destaque', alinhar: 'centro', maiusculas: true };

export interface RotuloPronto {
  id: string;
  nome: string;
  descricao: string;
  criar: () => ModeloEtiqueta;
}

export const ROTULOS_PRONTOS: RotuloPronto[] = [
  {
    id: 'solapa',
    nome: 'Solapa de saquinho 10 × 8 cm',
    descricao: 'Cartão dobrado que grampeia no topo do pacote. Frente bonita, verso com as informações. Sai aberto, com a dobra marcada.',
    criar: () =>
      completo({
        nome: 'Solapa 10 × 8',
        largura: 100,
        altura: 80,
        solapa: true,
        cor: 'cor',
        margem: 2,
        moldura: 'nenhuma',
        fundo: 'fundo',
        pecas: [
          // frente (cada lado tem 100 × 40; a dobra fica no topo)
          pc('forma', 0, 30, 100, 10, 8, { lado: 'frente', fundo: 'primaria' }),
          pc('logo', 4, 6, 20, 20, 8, { lado: 'frente', raio: 999 }),
          pc('nome', 26, 7, 70, 14, 28, { ...TITULO, lado: 'frente' }),
          pc('texto', 26, 21, 70, 6, 11, { ...SUB, lado: 'frente', texto: 'Tempero natural' }),
          pc('selos', 3, 31, 62, 8, 5.5, { lado: 'frente', cor: 'branco', selos: ['artesanal', 'selecao'] }),
          pc('pesoLiquido', 62, 31, 34, 8, 10, { lado: 'frente', cor: 'branco', negrito: true, alinhar: 'dir' }),
          // verso
          pc('ingredientes', 4, 4, 56, 10, 6.5, { lado: 'verso' }),
          pc('gluten', 4, 14, 56, 6, 6.5, { lado: 'verso', negrito: true }),
          pc('modoUso', 4, 20, 56, 6, 6, { lado: 'verso' }),
          pc('conservacao', 4, 26, 56, 5, 5.5, { lado: 'verso' }),
          pc('nutricao', 62, 4, 34, 27, 4.6, { lado: 'verso' }),
          pc('fabricacao', 4, 31, 28, 3.5, 5.5, { lado: 'verso' }),
          pc('validade', 33, 31, 28, 3.5, 5.5, { lado: 'verso', negrito: true }),
          pc('lote', 62, 31, 34, 3.5, 5.5, { lado: 'verso' }),
          pc('fabricante', 4, 34.5, 92, 4, 4.6, { lado: 'verso' }),
        ],
      }),
  },
  {
    id: 'redondo',
    nome: 'Pote redondo 6 cm',
    descricao: 'Rótulo circular para a tampa ou a frente do pote. Nome em destaque e o peso numa faixa.',
    criar: () =>
      completo({
        nome: 'Pote redondo 6 cm',
        largura: 60,
        altura: 60,
        forma: 'redondo',
        cor: 'cor',
        margem: 3,
        moldura: 'dupla',
        fundo: 'fundo',
        pecas: [
          pc('logo', 22, 5, 16, 16, 8, { raio: 999 }),
          pc('nome', 6, 21, 48, 13, 24, TITULO),
          pc('texto', 10, 34, 40, 5, 8, { ...SUB, texto: 'Tempero natural' }),
          pc('forma', 9, 41, 42, 8, 8, { fundo: 'primaria', raio: 4 }),
          pc('pesoLiquido', 9, 41, 42, 8, 9, { cor: 'branco', negrito: true, alinhar: 'centro' }),
          pc('validade', 14, 50, 32, 4, 5.5, { alinhar: 'centro' }),
        ],
      }),
  },
  {
    id: 'envolvente',
    nome: 'Envolvente de pote 20 × 5 cm',
    descricao: 'Dá a volta no pote: informações à esquerda, frente no meio, tabela à direita.',
    criar: () =>
      completo({
        nome: 'Envolvente 20 × 5',
        largura: 200,
        altura: 50,
        cor: 'cor',
        margem: 2,
        moldura: 'nenhuma',
        fundo: 'fundo',
        pecas: [
          pc('ingredientes', 4, 4, 58, 12, 6.5),
          pc('gluten', 4, 16, 58, 6, 6.5, { negrito: true }),
          pc('conservacao', 4, 22, 58, 6, 5.5),
          pc('fabricacao', 4, 29, 28, 4, 5.5),
          pc('validade', 33, 29, 29, 4, 5.5, { negrito: true }),
          pc('lote', 4, 33, 58, 4, 5.5),
          pc('fabricante', 4, 38, 58, 9, 4.8),
          pc('forma', 66, 0, 68, 50, 8, { fundo: 'primaria' }),
          pc('logo', 88, 3, 24, 16, 8),
          pc('nome', 68, 18, 64, 14, 26, { ...TITULO, cor: 'branco' }),
          pc('texto', 70, 32, 60, 5, 9, { ...SUB, cor: 'branco', texto: 'Tempero natural' }),
          pc('pesoLiquido', 70, 39, 60, 7, 10, { cor: 'branco', negrito: true, alinhar: 'centro' }),
          pc('nutricao', 138, 3, 40, 44, 4.8),
          pc('modoUso', 180, 4, 18, 26, 5),
          pc('selos', 180, 31, 18, 16, 4.6, { selos: ['artesanal'] }),
        ],
      }),
  },
  {
    id: 'standup',
    nome: 'Frente de pacote em pé 8 × 12 cm',
    descricao: 'Frente vertical para pacote stand-up ou caixinha, com faixa, selos e peso.',
    criar: () =>
      completo({
        nome: 'Pacote em pé 8 × 12',
        largura: 80,
        altura: 120,
        forma: 'arredondado',
        cor: 'cor',
        margem: 2,
        moldura: 'nenhuma',
        fundo: 'fundo',
        pecas: [
          pc('forma', 0, 0, 80, 34, 8, { fundo: 'primaria' }),
          pc('loja', 6, 5, 68, 6, 9, { ...SUB, cor: 'branco' }),
          pc('logo', 25, 14, 30, 30, 8, { raio: 999 }),
          pc('nome', 4, 47, 72, 20, 34, TITULO),
          pc('texto', 8, 67, 64, 6, 11, { ...SUB, texto: 'Tempero natural' }),
          pc('selos', 6, 77, 68, 14, 6, { selos: ['artesanal', 'selecao', 'fresco'] }),
          pc('forma', 14, 100, 52, 12, 8, { fundo: 'primaria', raio: 6 }),
          pc('pesoLiquido', 14, 100, 52, 12, 12, { cor: 'branco', negrito: true, alinhar: 'centro' }),
        ],
      }),
  },
  {
    id: 'traseira',
    nome: 'Traseira de pote 6 × 4 cm',
    descricao: 'Etiqueta de informações para o fundo ou as costas do pote (complementa o redondo).',
    criar: () =>
      completo({
        nome: 'Traseira 6 × 4',
        largura: 60,
        altura: 40,
        cor: 'cor',
        margem: 1.5,
        moldura: 'nenhuma',
        fundo: 'branco',
        pecas: [
          pc('ingredientes', 2, 2, 30, 12, 5.5),
          pc('gluten', 2, 14, 30, 5, 5.5, { negrito: true }),
          pc('conservacao', 2, 19, 30, 6, 4.8),
          pc('validade', 2, 25, 30, 3.5, 5, { negrito: true }),
          pc('lote', 2, 28.5, 30, 3.5, 5),
          pc('fabricante', 2, 32, 56, 6, 4.6),
          pc('nutricao', 33, 2, 25, 29, 4.5),
        ],
      }),
  },
];

// ---------------------------------------------------------------- conferência do rótulo

export interface ItemConferencia {
  ok: boolean;
  item: string;
  dica: string;
}

/** Altura mínima dos números do peso líquido (Portaria Inmetro 249/2021): ≤50 g 2 mm; até 200 g 3 mm; até 1 kg 4 mm; acima 6 mm. */
export function alturaMinimaPeso(g: number): number {
  return g <= 50 ? 2 : g <= 200 ? 3 : g <= 1000 ? 4 : 6;
}
/** Altura aproximada dos números (mm) para um tamanho de letra em pontos. */
export const alturaNumero = (pt: number) => pt * 0.3528 * 0.72;

/**
 * Confere o que costuma ser exigido no rótulo de alimento embalado (RDC 727/2022, RDC 429/2020, Lei 10.674/2003,
 * Portaria Inmetro 249/2021). É um lembrete, não substitui a orientação da vigilância sanitária.
 */
export function conferirRotulo(m: ModeloEtiqueta, p: Product | null, loja: StoreInfo, pesoG: number | null): ItemConferencia[] {
  const ativa = (t: TipoPeca) => m.pecas.find((x) => x.tipo === t && x.ativo);
  const out: ItemConferencia[] = [];
  const add = (ok: boolean, item: string, dica: string) => out.push({ ok, item, dica });
  add(!!ativa('nome'), 'Nome do produto (denominação)', 'Na frente, em destaque.');
  const peso = ativa('pesoLiquido');
  const g = p && !porPeso(p) ? null : pesoG;
  const minimo = g ? alturaMinimaPeso(g) : 2;
  add(!!peso && (!g || alturaNumero(peso.fonte) >= minimo), 'Peso líquido na frente', peso ? `Números com pelo menos ${minimo} mm de altura (letra de ${Math.ceil(minimo / 0.254)} pt ou mais).` : 'Ligue a peça “Peso líquido”.');
  add(!!ativa('ingredientes') && (!p || !!p.ingredientes?.trim()), 'Lista de ingredientes', 'Do que tem mais para o que tem menos. Preencha nos dados do rótulo.');
  add(!!ativa('gluten') && (!p || !!p.gluten), '“CONTÉM” ou “NÃO CONTÉM GLÚTEN”', 'Obrigatório (Lei 10.674/2003). Escolha nos dados do rótulo; alérgicos também ficam ali.');
  add(!!ativa('validade'), 'Validade', 'Dia e mês (ou mês e ano, para validade longa).');
  add(!!ativa('lote'), 'Lote', 'Preencha o lote na hora de imprimir (ex.: a data da embalagem).');
  const fab = ativa('fabricante');
  add(!!fab && (!!fab.texto?.trim() || (!!loja.razaoSocial.trim() && !!loja.cnpj.trim() && !!loja.endereco.trim())), 'Quem fez: razão social, CNPJ e endereço', 'Preencha em “Minha loja”. Inclui “INDÚSTRIA BRASILEIRA”.');
  add(!!ativa('conservacao'), 'Como conservar', 'Ex.: local seco e fresco, ao abrigo da luz.');
  const nut = ativa('nutricao');
  if (p?.especiariaPura) add(true, 'Tabela nutricional', 'Especiaria pura: dispensada (RDC 429/2020, anexo I).');
  else add(!!nut && (!p || !!p.nutricao), 'Tabela nutricional', 'Misturas e temperos prontos precisam (porção de 5 g). Só especiaria pura é dispensada.');
  const pequenas = m.pecas.filter((x) => x.ativo && !['logo', 'imagem', 'forma', 'codigo'].includes(x.tipo) && x.fonte < 4.5);
  add(!pequenas.length, 'Letras com pelo menos 1 mm', pequenas.length ? `Aumente: ${pequenas.map((x) => PECAS.find((t) => t.tipo === x.tipo)?.rotulo).join(', ')} (mínimo 4,5 pt).` : 'Tudo legível.');
  return out;
}
