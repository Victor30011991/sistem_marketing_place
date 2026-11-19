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
  /** texto de ingredientes para o rótulo */
  ingredientes?: string;
  /** informação nutricional por 100 g (opcional; só para o rótulo) */
  nutricao?: InfoNutricional | null;
  /** foto pequena para o cardápio (data URL, ~120 px) */
  foto?: string;
  /** rótulo: glúten (obrigatório no rótulo de alimento embalado) */
  gluten?: 'contem' | 'nao-contem';
  /** rótulo: texto depois de "ALÉRGICOS:", ex.: "PODE CONTER AMENDOIM" */
  alergenicos?: string;
  /** rótulo: modo de usar */
  modoUso?: string;
  /** especiaria pura, sem mistura: dispensada da tabela nutricional */
  especiariaPura?: boolean;
  /** promoção: preço na unidade do produto, até quando (AAAA-MM-DD, vazio = sem fim) e o selo */
  promo?: { preco: number; ate: string; selo: string } | null;
}

/** Valores por 100 g; a porção é calculada na hora de imprimir. */
export interface InfoNutricional {
  /** porção em gramas */
  porcao: number;
  kcal: number;
  carboidratos: number;
  acucares: number;
  proteinas: number;
  gorduras: number;
  saturadas: number;
  fibras: number;
  /** miligramas */
  sodio: number;
}

export type TipoPeca =
  | 'logo'
  | 'loja'
  | 'nome'
  | 'precoKg'
  | 'preco100g'
  | 'precoPacote'
  | 'peso'
  | 'codigo'
  | 'validade'
  | 'lote'
  | 'ingredientes'
  | 'nutricao'
  | 'texto'
  | 'imagem'
  | 'selos'
  | 'forma'
  | 'pesoLiquido'
  | 'fabricante'
  | 'conservacao'
  | 'gluten'
  | 'fabricacao'
  | 'modoUso';

/** Uma peça da etiqueta. Posição e tamanho em milímetros, a partir do canto de cima à esquerda. */
export interface PecaEtiqueta {
  id: string;
  tipo: TipoPeca;
  ativo: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  /** tamanho da letra em pontos */
  fonte: number;
  negrito: boolean;
  alinhar: 'esq' | 'centro' | 'dir';
  /** só para o texto livre */
  texto?: string;
  /** cor do texto quando a etiqueta é colorida (padrão: preto) */
  cor?: 'preto' | 'primaria' | 'destaque' | 'branco' | 'livre';
  /** cor própria (#rrggbb) quando cor = 'livre' */
  corLivre?: string;
  /** família da letra */
  familia?: 'sans' | 'serif' | 'elegante' | 'manuscrita' | 'forte';
  /** fundo da peça (#rrggbb); na peça "forma" é a cor da forma */
  fundo?: string;
  /** cantos arredondados, em mm (forma redonda: 999) */
  raio?: number;
  maiusculas?: boolean;
  /** solapa: em qual lado da dobra fica */
  lado?: 'frente' | 'verso';
  /** peça "imagem": a imagem (data URL) */
  imagem?: string;
  /** peça "selos": quais selos */
  selos?: string[];
}

export interface ModeloEtiqueta {
  id: string;
  nome: string;
  /** milímetros */
  largura: number;
  altura: number;
  moldura: 'nenhuma' | 'simples' | 'dupla' | 'arredondada';
  pecas: PecaEtiqueta[];
  /** margem que a impressora não alcança, em mm (as peças ficam dentro dela) */
  margem?: number;
  /** pb = preto e branco (térmica); cor = colorida (impressora de tinta/laser) */
  cor?: 'pb' | 'cor';
  /** formato do recorte */
  forma?: 'retangulo' | 'arredondado' | 'redondo' | 'oval';
  /** cor de fundo da etiqueta inteira (#rrggbb) */
  fundo?: string;
  /** solapa de saquinho: metade de cima é o verso (sai de cabeça para baixo), dobra no meio */
  solapa?: boolean;
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
  /** mostra "Mais vendidos" e "Chegou agora" no topo do cardápio (padrão: sim) */
  destaques?: boolean;
  /** botões do cartão, na ordem em que aparecem (sem isto: Cardápio, Instagram, Facebook e WhatsApp) */
  botoes?: BotaoCartao[];
  /** entrega e retirada (sem isto: entrega com taxa a combinar e retirada na loja) */
  entrega?: EntregaCardapio;
  /** formas de pagamento que aparecem para o cliente (sem isto: todas) */
  pagamentos?: { pix: boolean; cartao: boolean; dinheiro: boolean };
  /** horário de cada dia, domingo = 0 (sem isto: não mostra aberto/fechado) */
  horarios?: HorarioDia[];
  /** atalhos de peso nos produtos, em gramas (sem isto: 50, 100, 250 e 500) */
  pesos?: number[];
  /** mostra os mixes prontos no cardápio (padrão: sim) */
  mixes?: boolean;
}

export interface EntregaCardapio {
  /** faz entrega */
  ativa: boolean;
  /** taxa a combinar pelo WhatsApp ou fixa */
  taxa: 'combinar' | 'fixa';
  /** valor da taxa fixa, em centavos */
  valor: number;
  /** cliente pode retirar na loja */
  retirada: boolean;
}

export interface HorarioDia {
  aberto: boolean;
  /** "08:00" */
  abre: string;
  fecha: string;
}

export type TipoBotao = 'cardapio' | 'whatsapp' | 'instagram' | 'facebook' | 'maps' | 'ifood' | 'site' | 'telefone';

/** Um botão do cartão de visita (estilo "link na bio"). */
export interface BotaoCartao {
  id: string;
  tipo: TipoBotao;
  /** texto do botão, ex.: "Peça pelo WhatsApp" */
  rotulo: string;
  /** link, número ou endereço (WhatsApp, Instagram e Facebook vazios usam os da loja) */
  valor: string;
  ativo: boolean;
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
  /** validade da mercadoria deste item, AAAA-MM-DD (opcional) */
  validade?: string;
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
  /** desconto dado só neste item, em centavos (já descontado do total) */
  desconto?: number;
}

/** Uma parte do pagamento de uma venda (ex.: R$ 50 no Pix + R$ 30 no débito). */
export interface PagamentoVenda {
  /** dinheiro, pix, debito, credito_vista ou parcelado:… */
  forma: string;
  label: string;
  /** valor que ficou com a loja nesta forma (o troco já foi tirado do dinheiro), em centavos */
  valor: number;
  /** taxa da maquininha desta parte, em centavos */
  taxa: number;
}

/** Venda deixada de lado no PDV para atender outro cliente e retomar depois. */
export interface VendaPausada {
  id: string;
  quando: string;
  cliente: string;
  clienteId?: string;
  linhas: { produtoId: string; qtd: number; unidade: string; total?: number; desconto?: string }[];
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
  /** cliente cadastrado (opcional) */
  clienteId?: string;
  /** quem registrou a venda */
  por?: string;
  /** formas de pagamento usadas (vendas antigas não têm: valem `pagamento` e `total`) */
  pagamentos?: PagamentoVenda[];
  /** troco devolvido em dinheiro, em centavos */
  troco?: number;
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

/** Um item do orçamento, com o preço guardado como estava na hora (o cliente recebeu esse valor). */
export interface ItemOrcamento {
  produtoId: string;
  nome: string;
  qtd: number;
  unidade: string;
  /** preço de venda na unidade do produto, em centavos */
  preco: number;
  unidadePreco: string;
  /** valor do item, em centavos */
  total: number;
}

export type SituacaoOrcamento = 'rascunho' | 'enviado' | 'aprovado' | 'perdido' | 'vendido';

export interface OrcamentoSalvo {
  id: string;
  numero: number;
  /** ISO */
  criado: string;
  atualizado: string;
  cliente: { nome: string; telefone: string; endereco: string };
  itens: ItemOrcamento[];
  desconto: { tipo: 'valor' | 'pct'; valor: number | null };
  /** 1 = sem parcelamento */
  parcelas: number;
  /** AAAA-MM-DD */
  validade: string;
  obs: string;
  situacao: SituacaoOrcamento;
  clienteId?: string;
}

export interface ConfigOrcamento {
  validadeDias: number;
  /** formas de pagamento escritas para o cliente, ex.: "Pix, dinheiro ou cartão" */
  formas: string;
  pixTipo: 'cpf' | 'cnpj' | 'celular' | 'email' | 'aleatoria';
  pixChave: string;
  /** nome de quem recebe, como aparece no banco */
  pixNome: string;
  pixCidade: string;
  /** mostra o aviso para oferecer parcelamento acima deste valor, em centavos (0 = nunca) */
  parcelarAcima: number;
  /** frase final, ex.: Responda "QUERO" para confirmar */
  mensagem: string;
  cupom: 58 | 80;
}

/** Cliente cadastrado (o histórico vem das vendas e orçamentos ligados a ele). */
export interface Cliente {
  id: string;
  nome: string;
  /** WhatsApp/telefone como foi digitado */
  telefone: string;
  endereco: string;
  obs: string;
  /** ISO */
  criado: string;
}

export type SituacaoPedido = 'novo' | 'separando' | 'pronto' | 'entregue' | 'cancelado';

/** Pedido feito pelo cliente no cardápio (fica na nuvem, fora do Excel). */
export interface Pedido {
  id: string;
  /** ISO */
  criado: string;
  nome: string;
  telefone: string;
  endereco: string;
  obs: string;
  /** i = id do produto (cardápios antigos não têm), n = nome, g = gramas, t = valor em centavos */
  itens: { i?: string; n: string; g: number; t: number }[];
  total: number;
  origem: string;
  situacao: SituacaoPedido;
  /** venda pausada criada a partir do pedido */
  vendaPausada?: string;
}

export interface MovimentoCaixa {
  id: string;
  /** ISO */
  quando: string;
  tipo: 'sangria' | 'reforco';
  valor: number;
  motivo: string;
  por: string;
}

/** Caixa de um dia: troco inicial, sangrias e reforços, e a conferência no fechamento. */
export interface Caixa {
  id: string;
  /** AAAA-MM-DD */
  dia: string;
  abertoEm: string;
  abertoPor: string;
  trocoInicial: number;
  movimentos: MovimentoCaixa[];
  fechadoEm?: string;
  fechadoPor?: string;
  /** dinheiro previsto na gaveta no fechamento */
  previsto?: number;
  /** dinheiro contado no fechamento */
  contado?: number;
  obs?: string;
}

/** Uma alteração registrada (quem mudou o quê). */
export interface Registro {
  id: string;
  quando: string;
  por: string;
  acao: string;
  detalhe: string;
}

export interface PagamentoConta {
  id: string;
  /** ISO */
  quando: string;
  valor: number;
  /** dinheiro, pix, cartão… */
  forma: string;
  por: string;
}

/** Conta a receber (fiado) ou a pagar (fornecedor, aluguel…). */
export interface Conta {
  id: string;
  tipo: 'receber' | 'pagar';
  descricao: string;
  /** centavos */
  valor: number;
  /** AAAA-MM-DD */
  vencimento: string;
  criado: string;
  /** receber: de quem */
  clienteId?: string;
  /** receber: venda que gerou o fiado */
  vendaId?: string;
  /** pagar: para quem (fornecedor, imobiliária…) */
  favorecido?: string;
  /** pagar: gera a do mês seguinte quando esta for paga */
  mensal?: boolean;
  pagamentos: PagamentoConta[];
  cancelada?: boolean;
}

/** Posta Aí: estilos de arte para o Instagram. Posições e tamanhos são frações (0–1) da arte. */
export type CorArte = 'primaria' | 'destaque' | 'creme' | 'escuro' | 'branco';
export type FamiliaArte = string; // 'manuscrita' | 'script' | 'elegante' | 'gorda' | 'forte' | 'simples' | 'f:<id da letra salva>'
export type CampoArte = 'titulo' | 'subtitulo' | 'chamada' | 'preco' | 'livre';
export interface CamadaArte {
  id: string;
  tipo: 'foto' | 'texto' | 'forma' | 'logo' | 'enfeite' | 'lista';
  x: number;
  y: number;
  w: number;
  h: number;
  cor?: CorArte;
  opacidade?: number;
  /** graus */
  girar?: number;
  // texto
  campo?: CampoArte;
  texto?: string;
  familia?: FamiliaArte;
  /** altura da letra como fração da largura da arte */
  tamanho?: number;
  alinhar?: 'esquerda' | 'centro' | 'direita';
  maiusculas?: boolean;
  sombra?: boolean;
  // foto
  mascara?: 'retangulo' | 'pote' | 'circulo' | 'arco' | 'arredondado';
  /** 0–0,7: escurece a foto para o texto aparecer */
  escurecer?: number;
  // forma
  raio?: number;
  // enfeite
  enfeite?: string;
  /** lista: cor das faixas */
  faixa?: CorArte;
}
export interface EstiloArte {
  id: string;
  nome: string;
  fundo: CorArte;
  camadas: CamadaArte[];
}
export interface FonteSalva {
  id: string;
  nome: string;
  /** data:font/... base64 */
  dados: string;
}
export interface ConfigPostaAi {
  estilos?: EstiloArte[];
  /** ideia → data em que foi postada */
  postados?: Record<string, string>;
  /** cidade para as hashtags e legendas */
  cidade?: string;
}

export interface Settings {
  balanca?: ConfigBalanca;
  /** Posta Aí: estilos salvos, ideias já postadas */
  postaAi?: ConfigPostaAi;
  /** letras adicionadas para as artes (na nuvem fica uma por documento) */
  fontes?: FonteSalva[];
  /** contas a receber (fiado) e a pagar (na nuvem ficam uma por documento) */
  contas?: Conta[];
  /** dias para pagar o fiado (padrão 30) */
  prazoFiado?: number;
  /** ISO da última cópia automática guardada na nuvem */
  ultimaCopia?: string;
  /** ISO do último backup .txt baixado */
  ultimoDownload?: string;
  /** caixas por dia (na nuvem ficam um por documento) */
  caixas?: Caixa[];
  /** clientes cadastrados (na nuvem ficam um por documento) */
  clientes?: Cliente[];
  /** orçamentos salvos (na nuvem ficam um por documento) */
  orcamentos?: OrcamentoSalvo[];
  orcamentoCfg?: ConfigOrcamento;
  /** retirada mensal dos donos, em centavos (opcional; usada no resultado do mês) */
  proLabore?: number;
  /** modelos de etiqueta da impressora térmica */
  etiquetas?: ModeloEtiqueta[];
  /** vendas pausadas no PDV, para retomar depois */
  vendasPausadas?: VendaPausada[];
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
