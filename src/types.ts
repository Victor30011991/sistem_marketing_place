/** Valores monetários são SEMPRE guardados em centavos inteiros. Percentuais em "pontos" (20 = 20%). */

export interface Product {
  id: string;
  nome: string;
  /** '' = sem categoria */
  categoria: string;
  /** unidade de referência do preço (kg, g, L, ml, un, pacote, caixa ou personalizada) */
  unidade: string;
  custo: number | null;
  custosAdicionais: number;
  venda: number | null;
  /** base do preço proporcional, ex.: 100 g. null = sem preço proporcional */
  propQtd: number | null;
  propUnidade: string | null;
  observacoes: string;
  /** quantidade em estoque, na unidade do produto (opcional; usada no custo médio e no inventário) */
  estoque?: number | null;
  /** conteúdo de cada embalagem (pacote, frasco…), ex.: 250 g. Permite o preço proporcional de unidades de contagem */
  conteudoQtd?: number | null;
  conteudoUnidade?: string | null;
  /** código do produto na balança (PLU), de 1 a 999999 */
  plu?: number | null;
}

export interface ListState {
  nome: string;
  produtos: Product[];
  categorias: string[];
}

export interface Colors {
  primaria: string;
  destaque: string;
  fundo: string;
}

export interface StoreInfo {
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  informacoes: string;
  /** data URL da logo enviada; null = logo padrão do projeto */
  logo: string | null;
  cores: Colors;
  /** cardápio público (opcional; arquivos antigos não têm) */
  vitrine?: Vitrine;
}

/** Configuração do cardápio que o cliente abre pelo link (Instagram, Facebook, WhatsApp). */
export interface Vitrine {
  /** frase curta abaixo do nome; vazio = usa "Informações adicionais" da loja */
  slogan: string;
  /** WhatsApp de vendas (qualquer formato; vazio = usa o telefone da loja) */
  whatsapp: string;
  /** @usuario ou endereço completo */
  instagram: string;
  facebook: string;
  /** texto que abre o pedido no WhatsApp. {loja} vira o nome da loja */
  abertura: string;
  /** texto que fecha o pedido */
  fechamento: string;
  /** menor quantidade que o cliente pode pedir, em gramas */
  minGramas: number;
  /** ids dos produtos que NÃO aparecem no cardápio */
  ocultos: string[];
  /** esconde sozinho o produto com estoque controlado que chegou a zero */
  ocultarSemEstoque: boolean;
}

export interface FixedCost {
  id: string;
  descricao: string;
  /** centavos por mês */
  valor: number;
}

export interface VariableCost {
  id: string;
  descricao: string;
  /** percentual: % do preço de venda · percentualCusto: % sobre o custo de compra · valor: R$ por unidade vendida */
  tipo: 'percentual' | 'percentualCusto' | 'valor';
  /** percentual/percentualCusto: pontos (3 = 3%) · valor: centavos por unidade vendida */
  valor: number;
  /** só para tipo 'valor': quando existe, valor = total ÷ qtd (valor pago por um lote de compra, em centavos, e a quantidade comprada) */
  lote?: { total: number; qtd: number };
}

export interface InstallmentFee {
  id: string;
  parcelas: number;
  taxa: number;
}

/** Um item da nota de compra de um lote. */
export interface LoteItem {
  id: string;
  /** nome como veio na nota */
  nome: string;
  /** produto do sistema que recebe este item; null = criar um produto novo */
  produtoId: string | null;
  /** categoria do produto novo */
  categoria: string;
  ncm: string;
  /** unidade em que a quantidade da nota foi informada (kg, g, un…) */
  unidade: string;
  qtd: number;
  /** valor do item na nota, em centavos, antes do desconto do item */
  valor: number;
  /** desconto do próprio item, em centavos */
  desconto: number;
}

/** Uma compra de mercadoria (uma nota). Frete, juros e extras são repartidos entre os itens. */
export interface Lote {
  id: string;
  /** AAAA-MM-DD */
  data: string;
  fornecedor: string;
  numero: string;
  /** centavos */
  frete: number;
  juros: number;
  /** imposto de entrada e outras despesas */
  outras: number;
  /** desconto da nota que NÃO está nos itens */
  desconto: number;
  rateio: 'peso' | 'valor';
  /** como o custo do produto é atualizado: custo médio com o estoque atual ou custo da última compra */
  custo: 'medio' | 'ultimo';
  itens: LoteItem[];
  /** como o preço de venda dos produtos da nota é definido (opcional; lotes antigos não têm) */
  preco?: RegraPreco;
  /** ISO; só existe depois de aplicado ao estoque e aos custos */
  aplicadoEm?: string;
}

/** Regra de preço de venda aplicada aos produtos de um lote. */
export interface RegraPreco {
  /** manter: não mexe no preço · multiplicador: custo real × fator, arredondado · sugerido: preço pela margem do sistema */
  modo: 'manter' | 'multiplicador' | 'sugerido';
  /** ex.: 2 = custo × 2 */
  fator: number;
  /** arredondamento em centavos: 1 (nenhum), 10, 50 ou 100 */
  passo: number;
}

/** Um item vendido no PDV. Os valores ficam gravados como estavam na hora da venda. */
export interface VendaItem {
  produtoId: string;
  nome: string;
  /** quantidade vendida, na `unidade` (g para produtos por quilo) */
  qtd: number;
  unidade: string;
  /** valor cobrado pelo item, em centavos (antes do desconto da venda) */
  total: number;
  /** custo do que saiu do estoque, em centavos (null = produto sem custo) */
  custo: number | null;
}

export interface Venda {
  id: string;
  /** ISO */
  quando: string;
  itens: VendaItem[];
  /** desconto da venda em centavos */
  desconto: number;
  /** valor final cobrado */
  total: number;
  /** id da forma de pagamento (pix, debito, credito_vista, parcelado:…) */
  pagamento: string;
  pagamentoLabel: string;
  /** taxa da maquininha em centavos */
  taxa: number;
  cliente: string;
  /** ISO; venda cancelada devolve o estoque e sai dos totais */
  cancelada?: string;
}

/** Lista de compras para pedir cotação ao fornecedor. */
export interface ListaCompras {
  fornecedor: string;
  telefone: string;
  obs: string;
  itens: { produtoId: string; qtd: number; unidade: string }[];
}

/** Integração com a balança etiquetadora (Toledo MGV / UPX Thunder). */
export interface ConfigBalanca {
  /** como o código de barras da etiqueta da balança foi configurado */
  etiqueta: 'codigo6-valor5' | 'codigo5-valor6' | 'codigo6-peso5' | 'codigo5-peso6';
  /** validade impressa na etiqueta, em dias (0 = não imprime) */
  validadeDias: number;
  /** setor/departamento da balança */
  setor: number;
}

export interface Settings {
  balanca?: ConfigBalanca;
  /** vendas registradas no PDV (opcional) */
  vendas?: Venda[];
  /** lista de compras em montagem (opcional) */
  compras?: ListaCompras;
  /** histórico de lotes aplicados (opcional; arquivos antigos não têm) */
  lotes?: Lote[];
  custosFixos: FixedCost[];
  custosVariaveis: VariableCost[];
  /** perdas e desperdícios, % sobre o custo de aquisição */
  perdaPct: number;
  taxas: { debito: number; creditoVista: number; parcelado: InstallmentFee[] };
  /** forma de pagamento usada para o preço de tabela */
  pagamentoBase: string;
  margem: { modo: 'margem' | 'markup'; valor: number };
  rateio: {
    metodo: 'faturamento' | 'quantidade';
    /** centavos por mês */
    faturamentoPrevisto: number;
    quantidadePrevista: number;
  };
}

export type FieldKey =
  | 'id'
  | 'nome'
  | 'categoria'
  | 'unidade'
  | 'custo'
  | 'venda'
  | 'custosAdicionais'
  | 'base'
  | 'observacoes';

export type ColumnTarget = FieldKey | 'ignorar';

export interface ImportRecord {
  adicionados: string[];
  atualizados: Product[]; // estado ANTERIOR dos produtos atualizados
  categoriasAdicionadas: string[];
  quando: number;
  resumo: string;
}
