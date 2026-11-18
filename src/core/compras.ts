import type { ListaCompras, Product } from '../types';

export interface LinhaCompra {
  produto: Product;
  qtd: number;
  unidade: string;
}

export const listaVazia = (): ListaCompras => ({ fornecedor: '', telefone: '', obs: '', itens: [] });

/** Itens da lista com o produto (os que foram excluídos do sistema somem), em ordem alfabética. */
export function linhasCompra(l: ListaCompras, produtos: Product[]): LinhaCompra[] {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  return l.itens
    .flatMap((i) => {
      const p = porId.get(i.produtoId);
      return p && i.qtd > 0 ? [{ produto: p, qtd: i.qtd, unidade: i.unidade }] : [];
    })
    .sort((a, b) => a.produto.nome.localeCompare(b.produto.nome, 'pt-BR'));
}

const n3 = (n: number) => String(Number(n.toFixed(3))).replace('.', ',');

/** Texto para mandar ao fornecedor pelo WhatsApp. Nunca leva custos nem preços da loja. */
export function textoCotacao(l: ListaCompras, linhas: LinhaCompra[], nomeLoja: string): string {
  const ola = l.fornecedor.trim() ? `Olá, ${l.fornecedor.trim()}!` : 'Olá!';
  const partes = [`${ola} Gostaria de uma cotação destes itens:`, ''];
  for (const x of linhas) partes.push(`• ${x.produto.nome} — ${n3(x.qtd)} ${x.unidade}`);
  partes.push('');
  if (l.obs.trim()) partes.push(l.obs.trim(), '');
  partes.push('Por favor, me envie o preço de cada item, o prazo de entrega e o valor do frete. Obrigado!');
  if (nomeLoja.trim()) partes.push(nomeLoja.trim());
  return partes.join('\n');
}
