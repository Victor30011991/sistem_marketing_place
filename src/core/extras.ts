import type { InfoNutricional, Product } from '../types';
import { norm } from './normalize';

/** Dados opcionais do produto que não têm coluna própria na planilha: viajam na aba oculta de configurações do Excel. */
export interface ProductExtra {
  estoque?: number | null;
  conteudoQtd?: number | null;
  conteudoUnidade?: string | null;
  plu?: number | null;
  ingredientes?: string;
  nutricao?: InfoNutricional | null;
  foto?: string;
  promo?: Product['promo'];
  gluten?: Product['gluten'];
  alergenicos?: string;
  modoUso?: string;
  especiariaPura?: boolean;
}

export type ExtrasMap = Record<string, ProductExtra>;

/** Mesma identidade usada na importação: nome + categoria + unidade (o ID muda quando o produto é reimportado). */
export const extraKey = (p: Pick<Product, 'nome' | 'categoria' | 'unidade'>) => `${norm(p.nome)}|${norm(p.categoria)}|${p.unidade}`;

const chaveId = (p: Pick<Product, 'id'>) => `id:${p.id}`;

export function buildExtras(produtos: Product[]): ExtrasMap {
  const out: ExtrasMap = {};
  for (const p of produtos) {
    const e: ProductExtra = {};
    if (p.estoque != null) e.estoque = p.estoque;
    if (p.plu) e.plu = p.plu;
    if (p.ingredientes?.trim()) e.ingredientes = p.ingredientes;
    if (p.nutricao) e.nutricao = p.nutricao;
    if (p.foto) e.foto = p.foto;
    if (p.promo) e.promo = p.promo;
    if (p.gluten) e.gluten = p.gluten;
    if (p.alergenicos?.trim()) e.alergenicos = p.alergenicos;
    if (p.modoUso?.trim()) e.modoUso = p.modoUso;
    if (p.especiariaPura) e.especiariaPura = true;
    if (p.conteudoQtd && p.conteudoUnidade) {
      e.conteudoQtd = p.conteudoQtd;
      e.conteudoUnidade = p.conteudoUnidade;
    }
    if (Object.keys(e).length) {
      out[chaveId(p)] = e; // identidade certa (o ID é mantido ao abrir o Excel)
      out[extraKey(p)] = e; // reserva para quando o ID se perde (ex.: coluna ID apagada no Excel)
    }
  }
  return out;
}

/** Devolve os produtos com estoque/conteúdo restaurados. Produtos sem registro ficam intactos. */
export function mergeExtras(produtos: Product[], extras: ExtrasMap | undefined | null): Product[] {
  if (!extras) return produtos;
  return produtos.map((p) => {
    const e = extras[chaveId(p)] ?? extras[extraKey(p)];
    return e ? { ...p, ...e } : p;
  });
}
