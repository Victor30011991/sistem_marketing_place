/** Promoções: o preço que vale hoje (PDV, orçamento, cardápio) é o da promoção enquanto ela estiver ativa. */
import type { Product } from '../types';

const hojeLocal = () => {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

export function promoAtiva(p: Pick<Product, 'promo' | 'venda'>, hoje = hojeLocal()): boolean {
  const pr = p.promo;
  return !!pr && pr.preco > 0 && (p.venda == null || pr.preco < p.venda) && (!pr.ate || pr.ate >= hoje);
}

/** O produto com o preço de hoje (a promoção, se estiver ativa). */
export function comPromo<T extends Pick<Product, 'promo' | 'venda'>>(p: T, hoje?: string): T {
  return promoAtiva(p, hoje) ? { ...p, venda: p.promo!.preco } : p;
}
