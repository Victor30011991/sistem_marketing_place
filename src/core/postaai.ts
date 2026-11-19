/**
 * Posta Aí: ideias de post para o Instagram a partir dos produtos, do estoque e das vendas.
 * Tudo roda no aparelho, sem custo. As ideias de receita/mix só aparecem quando a loja tem os temperos.
 */
import type { Product, Settings, StoreInfo, Venda } from '../types';
import { norm } from './normalize';
import { formatBRL } from './money';
import { promoAtiva } from './promo';
import { vencendo } from './validade';
import { estoque, ranking } from './relatorios';

export type TipoIdeia = 'receita' | 'mix' | 'sabia' | 'lista' | 'oferta' | 'novidade' | 'queridinho' | 'data' | 'loja';
export type FormatoIdeia = 'post' | 'carrossel' | 'story' | 'reel';

export interface Ideia {
  id: string;
  tipo: TipoIdeia;
  formato: FormatoIdeia;
  titulo: string;
  subtitulo: string;
  chamada: string;
  /** passos do mix/receita ou itens da lista (vira carrossel e lista em faixas) */
  itens: string[];
  preco?: string;
  legenda: string;
  hashtags: string[];
  /** cenas do Reel */
  roteiro?: string[];
  /** por que esta ideia apareceu agora */
  motivo?: string;
  /** estilo de arte sugerido */
  estilo: string;
  /** produto principal (para o preço e o "combina com") */
  produtoId?: string;
  prioridade: number;
}

export const TIPOS_IDEIA: Record<TipoIdeia, string> = {
  receita: 'Receita',
  mix: 'Mix',
  sabia: 'Você sabia?',
  lista: 'Lista',
  oferta: 'Oferta',
  novidade: 'Novidade',
  queridinho: 'Mais vendido',
  data: 'Data especial',
  loja: 'A loja',
};
export const FORMATOS_IDEIA: Record<FormatoIdeia, string> = { post: 'Post', carrossel: 'Carrossel', story: 'Story', reel: 'Reel' };

export interface Modelo {
  id: string;
  tipo: TipoIdeia;
  formato: FormatoIdeia;
  /** temperos necessários; alternativas separadas por | (ex.: 'curcuma|acafrao') */
  precisa?: string[];
  titulo: string;
  subtitulo: string;
  chamada?: string;
  itens?: string[];
  legenda: string;
  tags: string[];
  roteiro?: string[];
  estilo: string;
}

const CHAMADA = 'Peça pelo link da bio';

/** Biblioteca de ideias. Sem promessas de saúde: só sabor, praticidade e receita. */
export const MODELOS_IDEIA: Modelo[] = [
  {
    id: 'mix-frango',
    tipo: 'mix',
    formato: 'carrossel',
    precisa: ['paprica', 'alho', 'cebola', 'oregano'],
    titulo: 'Mix para frango assado',
    subtitulo: '4 temperos · 1 assadeira',
    itens: ['1 colher de páprica defumada', '1 colher de alho em pó', '½ colher de cebola em pó', '1 colher de orégano', 'Azeite e sal a gosto'],
    legenda: 'Frango assado sem graça nunca mais! 🍗\nMisture os temperos com azeite e sal, espalhe no frango e leve ao forno por uns 50 minutos.\nSalve para fazer no domingo e marque quem vai cozinhar 👇',
    tags: ['#frangoassado', '#receitafacil'],
    estilo: 'pote',
  },
  {
    id: 'mix-churrasco',
    tipo: 'mix',
    formato: 'carrossel',
    precisa: ['pimenta', 'alho', 'paprica', 'chimichurri|oregano'],
    titulo: 'Tempero de churrasco da casa',
    subtitulo: 'para carne, frango e linguiça',
    itens: ['2 colheres de páprica', '1 colher de alho em pó', '1 colher de chimichurri', '½ colher de pimenta-do-reino', 'Sal grosso na hora de assar'],
    legenda: 'Fim de semana pede churrasco 🔥\nEsse mix vai bem em carne, frango e linguiça. Passe na carne uns 30 minutos antes e sal grosso só na hora.\nQuem vai ser o churrasqueiro? Marca aqui 👇',
    tags: ['#churrasco', '#churrascobrasileiro'],
    estilo: 'letreiro',
  },
  {
    id: 'mix-peixe',
    tipo: 'mix',
    formato: 'carrossel',
    precisa: ['lemon|limao', 'alho', 'salsa|cheiro|ervas'],
    titulo: 'Peixe temperadinho',
    subtitulo: 'leve e cheio de sabor',
    itens: ['1 colher de lemon pepper', '1 colher de alho em pó', '1 colher de salsa desidratada', 'Suco de ½ limão', 'Fio de azeite'],
    legenda: 'Peixe no forno ou na frigideira com esse mix fica outra coisa 🐟\nTempere, espere 15 minutinhos e pronto.\nSalva pra não esquecer!',
    tags: ['#peixe', '#receitafacil'],
    estilo: 'rabiscos',
  },
  {
    id: 'mix-batata',
    tipo: 'mix',
    formato: 'reel',
    precisa: ['paprica', 'alho', 'alecrim|ervas|oregano'],
    titulo: 'Batata rústica crocante',
    subtitulo: 'no forno ou na air fryer',
    itens: ['Batatas em gomos', '1 colher de páprica', '1 colher de alho em pó', '1 colher de alecrim', 'Azeite e sal'],
    legenda: 'Batata rústica que faz sucesso em qualquer mesa 🥔\nMisture tudo, 200 °C por uns 30 minutos (vire na metade).\nVocê faz no forno ou na air fryer? Conta aqui 👇',
    tags: ['#batatarustica', '#airfryer'],
    roteiro: ['Batatas cortadas em gomos na tábua (2 s)', 'Temperos caindo sobre as batatas, close (3 s)', 'Mão misturando na tigela (2 s)', 'Indo para a air fryer/forno (2 s)', 'Batata dourada saindo, barulho de crocante (3 s)', 'Pote da Temperei ao lado do prato + texto "Peça pelo link da bio" (2 s)'],
    estilo: 'rabiscos',
  },
  {
    id: 'mix-pipoca',
    tipo: 'mix',
    formato: 'reel',
    precisa: ['paprica|lemon|ervas|parmesao'],
    titulo: 'Pipoca de cinema em casa',
    subtitulo: '3 jeitos de temperar',
    itens: ['Páprica defumada + sal', 'Lemon pepper', 'Ervas finas + manteiga'],
    legenda: 'Sessão de filme pede pipoca diferente 🍿\nQual dos 3 você faria hoje? 1, 2 ou 3?',
    tags: ['#pipoca', '#sessaodecinema'],
    roteiro: ['Milho estourando na panela (3 s)', 'Pipoca dividida em 3 potes (2 s)', 'Um tempero em cada pote, close (3 s)', 'Mão pegando pipoca + filme na TV ao fundo (3 s)', 'Texto: "Qual você faria? 1, 2 ou 3?" (2 s)'],
    estilo: 'letreiro',
  },
  {
    id: 'mix-feijao',
    tipo: 'mix',
    formato: 'carrossel',
    precisa: ['louro', 'cominho', 'alho'],
    titulo: 'Feijão caprichado',
    subtitulo: 'o segredo está nos temperos',
    itens: ['2 folhas de louro no cozimento', '½ colher de cominho', '1 colher de alho', 'Cebola refogada', 'Cheiro-verde no final'],
    legenda: 'Feijão de vó tem segredo, e a gente conta 🫘\nLouro no cozimento, cominho e alho no refogado. Simples e sem erro.\nComo é o feijão aí na sua casa?',
    tags: ['#feijao', '#comidacaseira'],
    estilo: 'pote',
  },
  {
    id: 'receita-arroz-amarelo',
    tipo: 'receita',
    formato: 'reel',
    precisa: ['curcuma|acafrao'],
    titulo: 'Arroz amarelinho',
    subtitulo: 'receita com cúrcuma',
    itens: ['Refogue alho e cebola', 'Junte o arroz e 1 colher (chá) de cúrcuma', 'Água quente e sal', 'Fogo baixo até secar'],
    legenda: 'O arroz do dia a dia ganha cor e sabor com uma colherzinha de cúrcuma 💛\nSalva e faz hoje!',
    tags: ['#arroz', '#curcuma'],
    roteiro: ['Alho e cebola refogando (2 s)', 'Cúrcuma caindo na panela, close (2 s)', 'Arroz mudando de cor ao mexer (3 s)', 'Água entrando, tampa fechando (2 s)', 'Arroz amarelinho servido + pote da loja (3 s)'],
    estilo: 'rabiscos',
  },
  {
    id: 'receita-molho',
    tipo: 'receita',
    formato: 'carrossel',
    precisa: ['oregano', 'manjericao|ervas', 'alho'],
    titulo: 'Molho de tomate caseiro',
    subtitulo: 'em 20 minutos',
    itens: ['Refogue alho no azeite', 'Tomates picados ou pelados', '1 colher de orégano', '1 colher de manjericão', 'Sal e uma pitada de açúcar'],
    legenda: 'Molho de tomate caseiro é mais fácil do que parece 🍅\nGuarda na geladeira e usa a semana toda.\nQuem aí faz macarrão no domingo?',
    tags: ['#molhodetomate', '#massacaseira'],
    estilo: 'card',
  },
  {
    id: 'receita-cha-canela',
    tipo: 'receita',
    formato: 'post',
    precisa: ['canela', 'cravo'],
    titulo: 'Chá de canela com cravo',
    subtitulo: 'para o fim de tarde',
    itens: ['500 ml de água', '1 pau de canela', '4 cravos', 'Ferva 5 minutos e abafe'],
    legenda: 'Fim de tarde com cheirinho de canela pela casa ☕\nFerva a água com a canela e o cravo por 5 minutos e deixe abafado mais 5.\nVocê toma com ou sem mel?',
    tags: ['#cha', '#canela'],
    estilo: 'card',
  },
  {
    id: 'receita-ovos',
    tipo: 'receita',
    formato: 'reel',
    precisa: ['paprica|cebolinha|ervas|pimenta'],
    titulo: 'Ovo mexido de hotel',
    subtitulo: 'o tempero faz a diferença',
    itens: ['Ovos batidos com uma pitada de sal', 'Fogo baixo e manteiga', 'Mexa devagar', 'Finalize com páprica e cebolinha'],
    legenda: 'Café da manhã de hotel em casa 🍳\nFogo baixo, paciência e uma pitada de páprica no final.\nMarca quem faz o melhor ovo mexido da casa!',
    tags: ['#cafedamanha', '#ovomexido'],
    roteiro: ['Ovos quebrando na tigela (2 s)', 'Manteiga derretendo na frigideira (2 s)', 'Mexendo devagar, cremoso (3 s)', 'Páprica e cebolinha caindo por cima, close (2 s)', 'Prato pronto com pão + pote da loja (3 s)'],
    estilo: 'rabiscos',
  },
  {
    id: 'sabia-paprica',
    tipo: 'sabia',
    formato: 'carrossel',
    precisa: ['paprica'],
    titulo: 'Páprica doce ou defumada?',
    subtitulo: 'a diferença e onde usar',
    itens: ['Doce: suave, dá cor. Vai bem em molhos, ovos e saladas.', 'Defumada: sabor de churrasco. Ótima em carnes, feijão e batata.', 'Picante: para quem gosta de ardidinho.'],
    legenda: 'Muita gente confunde, mas cada páprica tem seu lugar 🌶️\nArrasta pro lado e descobre qual combina com a sua receita.\nQual é a sua preferida?',
    tags: ['#paprica', '#dicasdecozinha'],
    estilo: 'sabia',
  },
  {
    id: 'sabia-curcuma',
    tipo: 'sabia',
    formato: 'carrossel',
    precisa: ['curcuma|acafrao'],
    titulo: 'Cúrcuma e açafrão são a mesma coisa?',
    subtitulo: 'quase ninguém sabe',
    itens: ['O "açafrão-da-terra" que usamos no dia a dia é a cúrcuma.', 'O açafrão verdadeiro vem de uma flor e é bem mais caro.', 'Na cozinha: cor e sabor suave no arroz, frango e caldos.'],
    legenda: 'Você sabia? O açafrão do arroz amarelinho é a cúrcuma! 💛\nArrasta e conta: você sabia disso?',
    tags: ['#curcuma', '#voceSabia'],
    estilo: 'sabia',
  },
  {
    id: 'sabia-guardar',
    tipo: 'sabia',
    formato: 'carrossel',
    titulo: 'Como guardar seus temperos',
    subtitulo: 'para durarem mais',
    itens: ['Pote bem fechado', 'Longe do fogão e do sol', 'Colher sempre seca', 'Etiqueta com a data'],
    legenda: 'Tempero bem guardado dura muito mais e não perde o aroma 🫙\nSalva essas dicas e confere aí na sua cozinha!',
    tags: ['#dicasdecozinha', '#organizacao'],
    estilo: 'sabia',
  },
  {
    id: 'sabia-ervas',
    tipo: 'sabia',
    formato: 'post',
    precisa: ['oregano|salsa|manjericao|alecrim|ervas'],
    titulo: 'Erva seca rende 3× mais',
    subtitulo: '1 colher de seca = 3 de fresca',
    itens: ['Seca: coloque no começo do preparo', 'Fresca: no final, para não perder o aroma'],
    legenda: 'Dica de ouro: a erva seca é mais concentrada que a fresca 🌿\n1 colher de seca equivale a 3 de fresca. Salva essa!',
    tags: ['#ervas', '#dicasdecozinha'],
    estilo: 'sabia',
  },
  {
    id: 'sabia-pimenta',
    tipo: 'sabia',
    formato: 'post',
    precisa: ['pimenta do reino|pimenta-do-reino|pimenta preta'],
    titulo: 'Pimenta-do-reino moída na hora',
    subtitulo: 'muda tudo',
    itens: ['O aroma está no óleo do grão', 'Moída na hora, ele aparece inteiro'],
    legenda: 'Já experimentou moer a pimenta-do-reino na hora? O perfume é outro 🖤\nConta aqui se você já faz assim!',
    tags: ['#pimentadoreino', '#dicasdecozinha'],
    estilo: 'card',
  },
  {
    id: 'lista-basico',
    tipo: 'lista',
    formato: 'carrossel',
    precisa: ['curcuma|acafrao', 'paprica', 'chimichurri', 'curry', 'lemon'],
    titulo: '5 temperos para sair do básico',
    subtitulo: 'e onde usar cada um',
    itens: ['Açafrão: arroz, caldos e frango', 'Páprica: batata, carnes e molhos', 'Chimichurri: carnes e feijão', 'Curry: arroz, frango e legumes', 'Lemon pepper: peixes, saladas e massas'],
    legenda: 'Cansou do sal e alho de sempre? Esses 5 mudam o jogo ✨\nQual você ainda não experimentou?',
    tags: ['#temperos', '#dicasdecozinha'],
    estilo: 'lista',
  },
  {
    id: 'lista-carne',
    tipo: 'lista',
    formato: 'carrossel',
    precisa: ['chimichurri', 'pimenta', 'alho', 'paprica'],
    titulo: '4 temperos para carne',
    subtitulo: 'que não podem faltar',
    itens: ['Chimichurri', 'Pimenta-do-reino', 'Alho', 'Páprica defumada'],
    legenda: 'Carne no ponto pede tempero certo 🥩\nSalva essa lista para a próxima compra!',
    tags: ['#churrasco', '#carne'],
    estilo: 'lista',
  },
  {
    id: 'loja-bastidores',
    tipo: 'loja',
    formato: 'reel',
    titulo: 'Pesado e embalado aqui',
    subtitulo: 'bastidores da loja',
    legenda: 'Cada pacotinho sai daqui com cuidado: pesado, embalado e etiquetado na hora 🤎\nVem conhecer a loja!',
    tags: ['#bastidores', '#pequenonegocio'],
    roteiro: ['Pote grande abrindo (2 s)', 'Tempero na balança, mostrando o peso (3 s)', 'Fechando o pacote (2 s)', 'Colando o rótulo bonito (2 s)', 'Pacote pronto na prateleira + fachada (3 s)'],
    estilo: 'rabiscos',
  },
  {
    id: 'loja-apresentacao',
    tipo: 'loja',
    formato: 'post',
    titulo: 'Prazer, somos a {loja}',
    subtitulo: 'temperos selecionados a dedo',
    legenda: 'Muito prazer! A {loja} nasceu para levar mais sabor para a sua cozinha 🌿\nTemperos selecionados, produtos naturais e atendimento de quem ama cozinhar.\nVem nos visitar{em_cidade}!',
    tags: ['#lojadetemperos', '#produtosnaturais'],
    estilo: 'card',
  },
  {
    id: 'loja-clientes',
    tipo: 'loja',
    formato: 'post',
    titulo: '"O que nossos clientes dizem"',
    subtitulo: 'use uma frase real de um cliente',
    legenda: 'Nada deixa a gente mais feliz do que receita aprovada 🥰\nObrigado pela confiança! Marque a gente quando usar nossos temperos.',
    tags: ['#clientesatisfeito', '#pequenonegocio'],
    estilo: 'sabia',
  },
];

/** Datas que vendem. `quando` devolve a data (AAAA-MM-DD) no ano pedido. */
export const DATAS: { id: string; nome: string; quando: (ano: number) => string; titulo: string; legenda: string; tags: string[] }[] = [
  { id: 'carnaval', nome: 'Carnaval', quando: (a) => somaDias(pascoa(a), -47), titulo: 'Bloquinho de petiscos', legenda: 'Carnaval em casa também pede petisco bem temperado 🎉\nPipoca, batata e frango: a gente tem o tempero de cada um.', tags: ['#carnaval'] },
  { id: 'pascoa', nome: 'Páscoa', quando: (a) => pascoa(a), titulo: 'Almoço de Páscoa', legenda: 'Peixe, bacalhau ou cordeiro? Para o almoço de Páscoa, tempero bom é metade da receita 🐟\nVem montar seu kit!', tags: ['#pascoa'] },
  { id: 'maes', nome: 'Dia das Mães', quando: (a) => nDomingo(a, 5, 2), titulo: 'Presente com sabor', legenda: 'Para a mãe que ama cozinhar: um kit de temperos é presente que ela usa todo dia 💐\nMontamos do jeitinho que você quiser.', tags: ['#diadasmaes', '#presente'] },
  { id: 'junina', nome: 'São João', quando: (a) => `${a}-06-24`, titulo: 'Arraiá de sabores', legenda: 'Canjica, pamonha, quentão: o São João tem cheiro de canela e cravo 🌽\nVem garantir os seus!', tags: ['#saojoao', '#festajunina'] },
  { id: 'pais', nome: 'Dia dos Pais', quando: (a) => nDomingo(a, 8, 2), titulo: 'Kit churrasco do pai', legenda: 'O pai é o rei da churrasqueira? Presenteie com um kit de temperos para churrasco 🔥', tags: ['#diadospais', '#churrasco'] },
  { id: 'cliente', nome: 'Dia do Cliente', quando: (a) => `${a}-09-15`, titulo: 'Obrigado por temperar com a gente', legenda: 'Hoje é Dia do Cliente e quem ganha o mimo é você 🤎\nPasse na loja e pergunte pela surpresa!', tags: ['#diadocliente'] },
  { id: 'blackfriday', nome: 'Black Friday', quando: (a) => somaDias(nDia(a, 11, 4, 4), 1), titulo: 'Black Friday temperada', legenda: 'Black Friday chegou na {loja}! 🖤\nOfertas especiais por tempo limitado. Corre!', tags: ['#blackfriday', '#ofertas'] },
  { id: 'natal', nome: 'Natal', quando: (a) => `${a}-12-25`, titulo: 'Ceia de Natal com sabor', legenda: 'A ceia de Natal pede tempero especial: peru, chester, farofa e arroz 🎄\nE kit de temperos é um presente lindo!', tags: ['#natal', '#ceiadenatal'] },
  { id: 'anonovo', nome: 'Ano Novo', quando: (a) => `${a}-12-31`, titulo: 'Ano novo, sabores novos', legenda: 'Que o próximo ano venha cheio de sabor! ✨\nObrigado por fazer parte da nossa história.', tags: ['#anonovo'] },
];

// ----------------------------------------------------------------------- datas

const dia = (d: Date) => d.toISOString().slice(0, 10);
const utc = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};
export function somaDias(iso: string, n: number): string {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return dia(d);
}
export const diasEntre = (de: string, ate: string) => Math.round((utc(ate).getTime() - utc(de).getTime()) / 86400000);

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(a: number): string {
  const b = a % 19, c = Math.floor(a / 100), d = a % 100;
  const e = Math.floor(c / 4), f = c % 4, g = Math.floor((c + 8) / 25), h = Math.floor((c - g + 1) / 3);
  const i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4;
  const m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451);
  const mes = Math.floor((i + m - 7 * n + 114) / 31), dd = ((i + m - 7 * n + 114) % 31) + 1;
  return `${a}-${String(mes).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}
/** n-ésimo dia da semana (0 = domingo) do mês. */
export function nDia(a: number, mes: number, semana: number, n: number): string {
  const d = new Date(Date.UTC(a, mes - 1, 1));
  const primeiro = 1 + ((semana - d.getUTCDay() + 7) % 7);
  return dia(new Date(Date.UTC(a, mes - 1, primeiro + 7 * (n - 1))));
}
const nDomingo = (a: number, mes: number, n: number) => nDia(a, mes, 0, n);

/** Datas especiais que chegam nos próximos `antes` dias. */
export function proximasDatas(hoje: string, antes = 21): { id: string; nome: string; data: string; faltam: number }[] {
  const ano = Number(hoje.slice(0, 4));
  const out: { id: string; nome: string; data: string; faltam: number }[] = [];
  for (const d of DATAS) {
    for (const a of [ano, ano + 1]) {
      const data = d.quando(a);
      const faltam = diasEntre(hoje, data);
      if (faltam >= 0 && faltam <= antes) out.push({ id: d.id, nome: d.nome, data, faltam });
    }
  }
  return out.sort((a, b) => a.faltam - b.faltam);
}

// ----------------------------------------------------------------------- textos

/** Frases que prometem efeito no corpo: proibidas em propaganda de alimento. */
const ARRISCADAS: { termo: RegExp; dica: string }[] = [
  { termo: /emagrec|seca(r)? barriga|perder peso|perda de peso|queima(r)? gordura|termogenic|barriga chapada|dieta milagr/, dica: 'promessa de emagrecer' },
  { termo: /\bdetox\b|desintox/, dica: '"detox"' },
  { termo: /\bcura(r|m)?\b|\btrata(r|mento)?\b|\bremedio\b|medicinal|\bprevine(m)?\b|\bprevenir\b/, dica: 'efeito de remédio' },
  { termo: /imunidade|imunologic|anti-?inflamat|antioxidante/, dica: 'efeito no corpo' },
  { termo: /diabet|pressao alta|colesterol|glicemia|ansiedade|insonia/, dica: 'doença ou sintoma' },
  { termo: /sem conservante|sem corante|sem quimica|100% saudavel/, dica: 'alegação que a vigilância não aceita sem comprovação' },
];

export function frasesArriscadas(texto: string): string[] {
  const t = norm(texto);
  const achou = ARRISCADAS.filter((a) => a.termo.test(t)).map((a) => a.dica);
  return [...new Set(achou)];
}

const slug = (s: string) => norm(s).replace(/[^a-z0-9]/g, '');

export function hashtagsDe(ideia: Pick<Ideia, 'hashtags'>, loja: StoreInfo, cidade: string): string[] {
  const base = [`#${slug(loja.nomeFantasia) || 'temperos'}`, ...(cidade.trim() ? [`#${slug(cidade)}`] : []), ...ideia.hashtags, '#temperosnaturais'];
  const vistos = new Set<string>();
  return base.filter((h) => h.length > 1 && !vistos.has(h.toLowerCase()) && vistos.add(h.toLowerCase())).slice(0, 5);
}

/** Legenda completa, pronta para colar: texto + chamada + hashtags. */
export function legendaCompleta(ideia: Ideia, loja: StoreInfo, cidade: string, insta = ''): string {
  return [ideia.legenda, `${insta ? `📲 Pedidos pelo link da bio ${insta}` : '📲 Pedidos pelo link da bio'}`, hashtagsDe(ideia, loja, cidade).join(' ')].join('\n\n');
}

function preencher(t: string, loja: StoreInfo, cidade: string): string {
  return t.replace(/\{loja\}/g, loja.nomeFantasia || 'nossa loja').replace(/\{em_cidade\}/g, cidade.trim() ? ` em ${cidade.trim()}` : '');
}

// ----------------------------------------------------------------------- ideias

export interface DadosIdeias {
  produtos: Product[];
  loja: StoreInfo;
  config: Settings;
  hoje: string;
}

const temEstoque = (p: Product) => p.estoque == null || p.estoque > 0;

/** Produto da loja que corresponde a um tempero da receita ('curcuma|acafrao'). */
function achar(produtos: Product[], chave: string): Product | undefined {
  const alts = chave.split('|');
  return produtos.find((p) => temEstoque(p) && alts.some((a) => norm(p.nome).startsWith(a)));
}

const ehPeso = (p: Product) => ['kg', 'g'].includes(String(p.unidade).toLowerCase());
function precoTexto(p: Product, hoje: string): string {
  const v = (promoAtiva(p, hoje) && p.promo ? p.promo.preco : p.venda) ?? 0;
  return ehPeso(p) ? `${formatBRL(Math.round(v / 10))} / 100 g` : formatBRL(v);
}

export function gerarIdeias({ produtos, loja, config, hoje }: DadosIdeias): Ideia[] {
  const cidade = config.postaAi?.cidade ?? '';
  const postados = config.postaAi?.postados ?? {};
  const ativos = produtos.filter((p) => (p.venda ?? 0) > 0);
  const out: Ideia[] = [];
  const add = (i: Ideia) => out.push({ ...i, titulo: preencher(i.titulo, loja, cidade), legenda: preencher(i.legenda, loja, cidade) });

  // 1. ofertas ativas, lotes vencendo e produtos parados
  for (const p of ativos.filter((p) => promoAtiva(p, hoje)).slice(0, 3)) {
    add({
      id: `promo-${p.id}`,
      tipo: 'oferta',
      formato: 'story',
      titulo: p.nome,
      subtitulo: p.promo?.selo || 'Oferta especial',
      chamada: CHAMADA,
      itens: [],
      preco: precoTexto(p, hoje),
      legenda: `${p.nome} em oferta! 🔥\nPor ${precoTexto(p, hoje)}${p.promo?.ate ? ` até ${p.promo.ate.split('-').reverse().slice(0, 2).join('/')}` : ''}.\nCorre que é por tempo limitado!`,
      hashtags: ['#oferta', '#promocao'],
      motivo: 'Promoção ativa no cadastro',
      estilo: 'oferta',
      produtoId: p.id,
      prioridade: 90,
    });
  }
  for (const v of vencendo(config.lotes ?? [], ativos, hoje, 45).filter((v) => v.dias > 3 && v.produto).slice(0, 2)) {
    const p = v.produto!;
    add({
      id: `vence-${p.id}`,
      tipo: 'oferta',
      formato: 'story',
      titulo: p.nome,
      subtitulo: 'Preço especial esta semana',
      chamada: CHAMADA,
      itens: [],
      preco: precoTexto(p, hoje),
      legenda: `Semana de ${p.nome} com preço especial! ✨\nAproveite para experimentar em receitas novas.`,
      hashtags: ['#oferta'],
      motivo: `Lote vence em ${v.dias} dias: vale girar o estoque`,
      estilo: 'oferta',
      produtoId: p.id,
      prioridade: 85,
    });
  }
  const vendas: Venda[] = (config.vendas ?? []).filter((v) => !v.cancelada);
  const est = estoque(ativos, vendas, utc(hoje));
  for (const l of est.parados.filter((l) => temEstoque(l.produto)).slice(0, 1)) {
    const p = l.produto;
    add({
      id: `parado-${p.id}`,
      tipo: 'oferta',
      formato: 'post',
      titulo: p.nome,
      subtitulo: 'Você já experimentou?',
      chamada: CHAMADA,
      itens: [],
      preco: precoTexto(p, hoje),
      legenda: `Você já experimentou ${p.nome}? 👀\n${p.modoUso?.trim() || 'Pergunte pra gente como usar: damos a dica na hora.'}`,
      hashtags: ['#dicasdecozinha'],
      motivo: l.semVenderHa != null ? `Sem vender há ${l.semVenderHa} dias` : 'Ainda não vendeu',
      estilo: 'card',
      produtoId: p.id,
      prioridade: 70,
    });
  }

  // 2. mais vendido do mês e o que chegou
  const mes = vendas.filter((v) => diasEntre(v.quando.slice(0, 10), hoje) <= 30);
  const top = ranking(mes, ativos).produtos[0];
  const pTop = top && ativos.find((p) => p.id === top.chave || p.nome === top.nome);
  if (pTop) {
    add({
      id: `top-${pTop.id}-${hoje.slice(0, 7)}`,
      tipo: 'queridinho',
      formato: 'post',
      titulo: pTop.nome,
      subtitulo: 'O queridinho do mês',
      chamada: CHAMADA,
      itens: [],
      preco: precoTexto(pTop, hoje),
      legenda: `O queridinho dos nossos clientes este mês: ${pTop.nome} 🏆\n${pTop.modoUso?.trim() || 'Já provou? Conta pra gente onde você usa!'}`,
      hashtags: ['#maisvendido'],
      motivo: 'Mais vendido dos últimos 30 dias',
      estilo: 'card',
      produtoId: pTop.id,
      prioridade: 75,
    });
  }
  const recentes = (config.lotes ?? []).filter((l) => l.aplicadoEm && diasEntre(l.aplicadoEm.slice(0, 10), hoje) <= 10);
  const ids = new Set(recentes.flatMap((l) => l.itens.map((i) => i.produtoId)).filter(Boolean) as string[]);
  const chegou = ativos.filter((p) => ids.has(p.id));
  if (chegou.length) {
    const p = chegou[0];
    add({
      id: `chegou-${recentes[0].id}`,
      tipo: 'novidade',
      formato: chegou.length > 2 ? 'carrossel' : 'story',
      titulo: chegou.length > 1 ? 'Chegou fresquinho!' : p.nome,
      subtitulo: chegou.length > 1 ? `${chegou.length} produtos de volta na loja` : 'Chegou fresquinho!',
      chamada: CHAMADA,
      itens: chegou.slice(0, 6).map((x) => x.nome),
      preco: chegou.length === 1 ? precoTexto(p, hoje) : undefined,
      legenda: `Chegou mercadoria nova! 📦\n${chegou.slice(0, 6).map((x) => `• ${x.nome}`).join('\n')}\nCorre que sai rápido!`,
      hashtags: ['#novidade', '#chegou'],
      motivo: 'Lote aplicado nos últimos 10 dias',
      estilo: chegou.length > 2 ? 'lista' : 'oferta',
      produtoId: p.id,
      prioridade: 80,
    });
  }

  // 3. datas especiais
  for (const d of proximasDatas(hoje)) {
    const m = DATAS.find((x) => x.id === d.id)!;
    add({
      id: `data-${d.id}-${d.data.slice(0, 4)}`,
      tipo: 'data',
      formato: 'post',
      titulo: m.titulo,
      subtitulo: d.nome,
      chamada: CHAMADA,
      itens: [],
      legenda: m.legenda,
      hashtags: m.tags,
      motivo: d.faltam === 0 ? `${d.nome} é hoje!` : `${d.nome} em ${d.faltam} dia${d.faltam > 1 ? 's' : ''}`,
      estilo: 'letreiro',
      prioridade: 95 - d.faltam,
    });
  }

  // 4. biblioteca: receitas, mixes, listas, dicas
  for (const m of MODELOS_IDEIA) {
    const precisa = m.precisa ?? [];
    const achados = precisa.map((c) => achar(ativos, c));
    const tem = achados.filter(Boolean).length;
    if (precisa.length && tem < Math.ceil(precisa.length * 0.6)) continue;
    const principal = achados.find(Boolean);
    add({
      id: m.id,
      tipo: m.tipo,
      formato: m.formato,
      titulo: m.titulo,
      subtitulo: m.subtitulo,
      chamada: m.chamada ?? CHAMADA,
      itens: m.itens ?? [],
      preco: principal && m.tipo !== 'sabia' && m.tipo !== 'lista' ? precoTexto(principal, hoje) : undefined,
      legenda: m.legenda,
      hashtags: m.tags,
      roteiro: m.roteiro,
      motivo: precisa.length ? (tem === precisa.length ? `Você tem ${tem === 1 ? 'o tempero' : `os ${tem}`} na loja` : `Você tem ${tem} de ${precisa.length} na loja`) : undefined,
      estilo: m.estilo,
      produtoId: principal?.id,
      prioridade: 40 + (precisa.length ? (tem / precisa.length) * 20 : 5) + (m.formato === 'reel' ? 3 : 0),
    });
  }

  // já postadas vão para o fim
  return out.sort((a, b) => Number(!!postados[a.id]) - Number(!!postados[b.id]) || b.prioridade - a.prioridade);
}

export function ideiaLivre(): Ideia {
  return { id: 'livre', tipo: 'loja', formato: 'post', titulo: 'Seu título aqui', subtitulo: 'um subtítulo curto', chamada: CHAMADA, itens: [], legenda: '', hashtags: [], estilo: 'rabiscos', prioridade: 0 };
}

/** Ideias que mostram o modo de usar do produto ("Combina com…"). */
export function combinaCom(p: Product | undefined): string {
  return p?.modoUso?.trim() ?? '';
}
