/** Etiquetas da impressora térmica: modelos, peças e o que cada peça mostra. */
import type { ConfigBalanca, InfoNutricional, ModeloEtiqueta, PecaEtiqueta, Product, StoreInfo, TipoPeca } from '../types';
import { BALANCA_PADRAO, precoBalanca } from './balanca';
import { ean13 } from './ean';
import { formatBRL } from './money';
import { familyOf } from './units';
import { newId } from './normalize';

export const PECAS: { tipo: TipoPeca; rotulo: string; dica: string }[] = [
  { tipo: 'logo', rotulo: 'Logo', dica: 'A logo da loja (colorida só na impressão colorida)' },
  { tipo: 'loja', rotulo: 'Nome da loja', dica: '' },
  { tipo: 'nome', rotulo: 'Nome do produto', dica: '' },
  { tipo: 'precoKg', rotulo: 'Preço por kg', dica: 'Ou por unidade, nos produtos vendidos por unidade' },
  { tipo: 'preco100g', rotulo: 'Preço por 100 g', dica: '' },
  { tipo: 'precoPacote', rotulo: 'Preço do pacote', dica: 'Preço do peso escolhido na hora de imprimir' },
  { tipo: 'peso', rotulo: 'Peso', dica: 'Peso do pacote, escolhido na hora de imprimir' },
  { tipo: 'codigo', rotulo: 'Código de barras', dica: 'O PDV lê e já lança o produto com o valor certo' },
  { tipo: 'validade', rotulo: 'Validade', dica: '' },
  { tipo: 'lote', rotulo: 'Lote', dica: '' },
  { tipo: 'ingredientes', rotulo: 'Ingredientes', dica: 'Preencha nos dados do rótulo do produto' },
  { tipo: 'nutricao', rotulo: 'Tabela nutricional', dica: 'Preencha nos dados do rótulo do produto' },
  { tipo: 'texto', rotulo: 'Texto livre', dica: 'Ex.: “Produto natural”, @instagram' },
];

export const TAMANHOS: { rotulo: string; largura: number; altura: number }[] = [
  { rotulo: '40 × 25 mm', largura: 40, altura: 25 },
  { rotulo: '40 × 30 mm', largura: 40, altura: 30 },
  { rotulo: '50 × 30 mm', largura: 50, altura: 30 },
  { rotulo: '58 × 40 mm', largura: 58, altura: 40 },
  { rotulo: '60 × 40 mm', largura: 60, altura: 40 },
  { rotulo: '60 × 80 mm', largura: 60, altura: 80 },
  { rotulo: '80 × 50 mm', largura: 80, altura: 50 },
  { rotulo: '100 × 50 mm', largura: 100, altura: 50 },
  { rotulo: '100 × 150 mm', largura: 100, altura: 150 },
];

export const MOLDURAS: { id: ModeloEtiqueta['moldura']; rotulo: string }[] = [
  { id: 'nenhuma', rotulo: 'Sem moldura' },
  { id: 'simples', rotulo: 'Linha simples' },
  { id: 'dupla', rotulo: 'Linha dupla' },
  { id: 'arredondada', rotulo: 'Cantos arredondados' },
];

const peca = (tipo: TipoPeca, x: number, y: number, w: number, h: number, fonte: number, extra: Partial<PecaEtiqueta> = {}): PecaEtiqueta => ({
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

/** Todas as peças que faltam num modelo entram desligadas, num canto, para poderem ser ligadas depois. */
function completar(m: ModeloEtiqueta): ModeloEtiqueta {
  const tem = new Set(m.pecas.map((p) => p.tipo));
  const faltam = PECAS.filter((t) => t.tipo !== 'texto' && !tem.has(t.tipo)).map((t) =>
    peca(t.tipo, 1, 1, Math.min(m.largura - 2, t.tipo === 'nutricao' ? 40 : 30), Math.min(m.altura - 2, t.tipo === 'nutricao' ? 30 : t.tipo === 'codigo' ? 12 : 6), 8, { ativo: false }),
  );
  return { ...m, pecas: [...m.pecas, ...faltam] };
}

export function modelosPadrao(): ModeloEtiqueta[] {
  return [
    completar({
      id: newId(),
      nome: 'Pote (50 × 30)',
      largura: 50,
      altura: 30,
      moldura: 'nenhuma',
      pecas: [
        peca('logo', 1.5, 1.5, 11, 11, 8),
        peca('nome', 14, 1.5, 34.5, 8, 9, { negrito: true }),
        peca('precoPacote', 14, 9.5, 34.5, 5.5, 12, { negrito: true }),
        peca('peso', 14, 15, 16, 4, 6),
        peca('validade', 30, 15, 18.5, 4, 6, { alinhar: 'dir' }),
        peca('codigo', 3, 19.5, 44, 9.5, 8, { alinhar: 'centro' }),
      ],
    }),
    completar({
      id: newId(),
      nome: 'Prateleira (100 × 50)',
      largura: 100,
      altura: 50,
      moldura: 'arredondada',
      pecas: [
        peca('logo', 4, 4, 18, 18, 8),
        peca('loja', 25, 5, 71, 6, 10),
        peca('nome', 25, 11, 71, 14, 22, { negrito: true }),
        peca('precoKg', 4, 27, 60, 14, 24, { negrito: true }),
        peca('preco100g', 66, 30, 30, 9, 12, { alinhar: 'dir' }),
        peca('texto', 4, 42.5, 92, 5, 9, { alinhar: 'centro', texto: 'Produto natural · peça a quantidade que quiser' }),
      ],
    }),
  ];
}

export function novoModelo(largura = 50, altura = 30, nome = `Etiqueta ${largura} × ${altura}`): ModeloEtiqueta {
  return completar({
    id: newId(),
    nome,
    largura,
    altura,
    moldura: 'nenhuma',
    pecas: [peca('nome', 2, 2, largura - 4, Math.min(8, altura / 3), 10, { negrito: true }), peca('precoKg', 2, 2 + Math.min(8, altura / 3), largura - 4, Math.min(8, altura / 3), 12, { negrito: true })],
  });
}

export function novoTexto(m: ModeloEtiqueta): PecaEtiqueta {
  return peca('texto', 2, 2, Math.min(40, m.largura - 4), 5, 8, { texto: 'Seu texto' });
}

/** Mantém a peça dentro da área de impressão (etiqueta menos a margem) e com tamanho mínimo. */
export function limitar(p: PecaEtiqueta, m: Pick<ModeloEtiqueta, 'largura' | 'altura' | 'margem'>): PecaEtiqueta {
  const r = (n: number) => Math.round(n * 2) / 2;
  const mg = Math.min(Math.max(m.margem ?? 0, 0), Math.min(m.largura, m.altura) / 4);
  const W = m.largura - 2 * mg;
  const H = m.altura - 2 * mg;
  const w = Math.min(Math.max(r(p.w), 3), W);
  const h = Math.min(Math.max(r(p.h), 2), H);
  return { ...p, w, h, x: Math.min(Math.max(r(p.x), mg), mg + W - w), y: Math.min(Math.max(r(p.y), mg), mg + H - h) };
}

export const CORES_PECA: { id: NonNullable<PecaEtiqueta['cor']>; rotulo: string }[] = [
  { id: 'preto', rotulo: 'Preto' },
  { id: 'primaria', rotulo: 'Cor principal da loja' },
  { id: 'destaque', rotulo: 'Cor de destaque da loja' },
];

/** Lê modelos vindos de backup/nuvem, descartando o que não faz sentido. */
export function etiquetasDe(raw: unknown): ModeloEtiqueta[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const tipos = new Set(PECAS.map((p) => p.tipo));
  const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return raw.flatMap((m) => {
    if (!m || typeof m !== 'object') return [];
    const o = m as Record<string, unknown>;
    const largura = Math.min(Math.max(n(o.largura, 50), 15), 300);
    const altura = Math.min(Math.max(n(o.altura, 30), 10), 300);
    const pecas = (Array.isArray(o.pecas) ? o.pecas : []).flatMap((x) => {
      if (!x || typeof x !== 'object') return [];
      const q = x as Record<string, unknown>;
      if (!tipos.has(q.tipo as TipoPeca)) return [];
      const p: PecaEtiqueta = {
        id: typeof q.id === 'string' && q.id ? q.id : newId(),
        tipo: q.tipo as TipoPeca,
        ativo: q.ativo !== false,
        x: n(q.x, 0),
        y: n(q.y, 0),
        w: n(q.w, 20),
        h: n(q.h, 5),
        fonte: Math.min(Math.max(n(q.fonte, 8), 4), 72),
        negrito: q.negrito === true,
        alinhar: q.alinhar === 'centro' || q.alinhar === 'dir' ? q.alinhar : 'esq',
      };
      if (p.tipo === 'texto') p.texto = typeof q.texto === 'string' ? q.texto : '';
      if (q.cor === 'primaria' || q.cor === 'destaque') p.cor = q.cor;
      return [limitar(p, { largura, altura, margem: n(o.margem, 0) })];
    });
    const moldura = MOLDURAS.some((x) => x.id === o.moldura) ? (o.moldura as ModeloEtiqueta['moldura']) : 'nenhuma';
    const extra: Partial<ModeloEtiqueta> = {};
    if (n(o.margem, 0) > 0) extra.margem = Math.min(n(o.margem, 0), 20);
    if (o.cor === 'cor') extra.cor = 'cor';
    return [completar({ id: typeof o.id === 'string' && o.id ? o.id : newId(), nome: typeof o.nome === 'string' && o.nome.trim() ? o.nome : 'Etiqueta', largura, altura, moldura, pecas, ...extra })];
  });
}

export const NUTRI_VAZIA: InfoNutricional = { porcao: 5, kcal: 0, carboidratos: 0, acucares: 0, proteinas: 0, gorduras: 0, saturadas: 0, fibras: 0, sodio: 0 };

export function nutricaoDe(raw: unknown): InfoNutricional | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out = { ...NUTRI_VAZIA };
  for (const k of Object.keys(NUTRI_VAZIA) as (keyof InfoNutricional)[]) if (typeof o[k] === 'number' && Number.isFinite(o[k]) && (o[k] as number) >= 0) out[k] = o[k] as number;
  return out.porcao > 0 ? out : null;
}

const fmtNum = (n: number, casas = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: 0 });

/** Linhas da tabela: nome, valor em 100 g e na porção. */
export function linhasNutricao(n: InfoNutricional): { nome: string; cem: string; porcao: string }[] {
  const f = n.porcao / 100;
  const linha = (nome: string, v: number, un: string, casas = 1) => ({ nome, cem: `${fmtNum(v, casas)} ${un}`, porcao: `${fmtNum(v * f, casas)} ${un}` });
  return [
    linha('Valor energético', n.kcal, 'kcal', 0),
    linha('Carboidratos', n.carboidratos, 'g'),
    linha('Açúcares totais', n.acucares, 'g'),
    linha('Proteínas', n.proteinas, 'g'),
    linha('Gorduras totais', n.gorduras, 'g'),
    linha('Gorduras saturadas', n.saturadas, 'g'),
    linha('Fibras alimentares', n.fibras, 'g'),
    linha('Sódio', n.sodio, 'mg', 0),
  ];
}

/** O que muda a cada impressão (não fica no modelo). */
export interface DadosImpressao {
  /** peso do pacote em gramas (produtos por peso) */
  pesoG: number | null;
  /** AAAA-MM-DD */
  validade: string;
  lote: string;
}

export const porPeso = (p: Product) => familyOf(p.unidade) === 'massa';

/** Valor do pacote em centavos: preço do kg × peso (por peso) ou o preço do produto (por unidade). */
export function precoPacote(p: Product, pesoG: number | null): number | null {
  if (p.venda == null) return null;
  if (!porPeso(p)) return p.venda;
  const kg = precoBalanca(p);
  return kg != null && pesoG ? Math.round((kg * pesoG) / 1000) : null;
}

/**
 * Código de barras no mesmo formato da etiqueta da balança (2 + código + valor ou peso),
 * para o PDV ler e lançar sozinho. Precisa do código de balança do produto.
 */
export function codigoEtiqueta(p: Product, pesoG: number | null, cfg: ConfigBalanca = BALANCA_PADRAO): string | null {
  if (!p.plu) return null;
  const tamCod = cfg.etiqueta.startsWith('codigo6') ? 6 : 5;
  const tamNum = 11 - tamCod;
  const valorMode = cfg.etiqueta.includes('valor');
  const num = valorMode ? precoPacote(p, pesoG) : porPeso(p) ? pesoG : null;
  if (num == null || num <= 0 || String(Math.round(num)).length > tamNum || String(p.plu).length > tamCod) return null;
  return ean13('2' + String(p.plu).padStart(tamCod, '0') + String(Math.round(num)).padStart(tamNum, '0'));
}

const dataBR = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '');

export function formatPeso(g: number): string {
  return g >= 1000 ? `${fmtNum(g / 1000, 3)} kg` : `${fmtNum(g, 0)} g`;
}

/** Texto de cada peça para um produto. Vazio = a peça não aparece. */
export function textoPeca(peca: PecaEtiqueta, p: Product | null, loja: StoreInfo, d: DadosImpressao): string {
  switch (peca.tipo) {
    case 'loja':
      return loja.nomeFantasia;
    case 'nome':
      return p?.nome ?? 'Nome do produto';
    case 'precoKg': {
      if (!p) return 'R$ 44,00/kg';
      const v = precoBalanca(p);
      return v == null ? '' : `${formatBRL(v)}/${porPeso(p) ? 'kg' : p.unidade}`;
    }
    case 'preco100g': {
      if (!p) return 'R$ 4,40 / 100 g';
      const v = precoBalanca(p);
      return v == null || !porPeso(p) ? '' : `${formatBRL(Math.round(v / 10))} / 100 g`;
    }
    case 'precoPacote': {
      if (!p) return 'R$ 4,40';
      const v = precoPacote(p, d.pesoG);
      return v == null ? '' : formatBRL(v);
    }
    case 'peso':
      return p && !porPeso(p) ? '' : d.pesoG ? `Peso: ${formatPeso(d.pesoG)}` : '';
    case 'validade':
      return dataBR(d.validade) ? `Val.: ${dataBR(d.validade)}` : '';
    case 'lote':
      return d.lote.trim() ? `Lote: ${d.lote.trim()}` : '';
    case 'ingredientes':
      return p?.ingredientes?.trim() ? `Ingredientes: ${p.ingredientes.trim()}` : p ? '' : 'Ingredientes: …';
    case 'texto':
      return peca.texto ?? '';
    default:
      return '';
  }
}

/** Data daqui a N dias, AAAA-MM-DD. */
export function daquiA(dias: number, hoje = new Date()): string {
  const d = new Date(hoje);
  d.setDate(d.getDate() + dias);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
