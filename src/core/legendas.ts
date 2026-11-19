/**
 * Legendas do Posta Aí: a pessoa conta o que vai postar ("frango assado com a nossa páprica")
 * e o sistema monta legendas em formatos que costumam engajar (gancho, pergunta, salvar, humor, lista…),
 * com hashtags variadas. Roda no aparelho, sem custo. Nunca promete efeito no corpo.
 */
import type { Product, StoreInfo } from '../types';
import { norm } from './normalize';
import { formatBRL } from './money';

export type Tema = 'receita' | 'produto' | 'dica' | 'bastidores' | 'novidade' | 'oferta' | 'cliente' | 'kit' | 'loja';
export const TEMAS: { id: Tema; rotulo: string; dica: string }[] = [
  { id: 'receita', rotulo: 'Receita / prato pronto', dica: 'comida feita com os temperos' },
  { id: 'produto', rotulo: 'Produto', dica: 'foto do pote, do pacote ou do tempero' },
  { id: 'dica', rotulo: 'Dica', dica: 'como usar, guardar, diferenças' },
  { id: 'bastidores', rotulo: 'Bastidores', dica: 'pesando, embalando, rotina da loja' },
  { id: 'novidade', rotulo: 'Novidade', dica: 'chegou produto novo' },
  { id: 'oferta', rotulo: 'Oferta', dica: 'preço especial, promoção' },
  { id: 'kit', rotulo: 'Kit / presente', dica: 'kits, cestas, datas' },
  { id: 'cliente', rotulo: 'Cliente', dica: 'depoimento, foto de cliente' },
  { id: 'loja', rotulo: 'A loja', dica: 'fachada, prateleiras, atendimento' },
];

interface Prato {
  id: string;
  chaves: string[];
  nome: string;
  emoji: string;
  tags: string[];
}
const PRATOS: Prato[] = [
  { id: 'frango', chaves: ['frango', 'galinha', 'coxa', 'sobrecoxa', 'asinha'], nome: 'frango', emoji: '🍗', tags: ['#frangoassado', '#receitadefrango', '#frango'] },
  { id: 'carne', chaves: ['carne', 'bife', 'picanha', 'costela', 'file', 'patinho', 'alcatra'], nome: 'carne', emoji: '🥩', tags: ['#carne', '#carnenapanela', '#receitadecarne'] },
  { id: 'churrasco', chaves: ['churrasco', 'churras', 'grelha', 'brasa'], nome: 'churrasco', emoji: '🔥', tags: ['#churrasco', '#churrasqueiro', '#churrascobrasileiro'] },
  { id: 'peixe', chaves: ['peixe', 'tilapia', 'salmao', 'camarao', 'frutos do mar', 'bacalhau'], nome: 'peixe', emoji: '🐟', tags: ['#peixe', '#peixeassado', '#frutosdomar'] },
  { id: 'arroz', chaves: ['arroz', 'risoto'], nome: 'arroz', emoji: '🍚', tags: ['#arroz', '#arrozsoltinho', '#comidacaseira'] },
  { id: 'feijao', chaves: ['feijao', 'feijoada', 'baiao'], nome: 'feijão', emoji: '🫘', tags: ['#feijao', '#feijaocaseiro', '#comidadevo'] },
  { id: 'batata', chaves: ['batata', 'fritas', 'rustica'], nome: 'batata', emoji: '🥔', tags: ['#batatarustica', '#batata', '#airfryer'] },
  { id: 'pipoca', chaves: ['pipoca'], nome: 'pipoca', emoji: '🍿', tags: ['#pipoca', '#pipocagourmet', '#sessaodecinema'] },
  { id: 'ovo', chaves: [' ovo', 'omelete', 'tapioca', 'cafe da manha'], nome: 'café da manhã', emoji: '🍳', tags: ['#cafedamanha', '#ovomexido', '#breakfast'] },
  { id: 'massa', chaves: ['macarrao', 'massa', 'lasanha', 'espaguete', 'nhoque'], nome: 'macarrão', emoji: '🍝', tags: ['#massas', '#macarrao', '#massacaseira'] },
  { id: 'molho', chaves: ['molho'], nome: 'molho', emoji: '🍅', tags: ['#molhocaseiro', '#molhodetomate'] },
  { id: 'salada', chaves: ['salada', 'legume', 'verdura'], nome: 'salada', emoji: '🥗', tags: ['#salada', '#comidadeverdade', '#legumes'] },
  { id: 'sopa', chaves: ['sopa', 'caldo', 'canja'], nome: 'caldo', emoji: '🍲', tags: ['#sopa', '#caldo', '#comfortfood'] },
  { id: 'cha', chaves: [' cha ', 'chazinho', 'infusao'], nome: 'chá', emoji: '☕', tags: ['#cha', '#chadatarde', '#momentodecha'] },
  { id: 'bolo', chaves: ['bolo', 'sobremesa', 'mingau', 'canjica', 'docinho'], nome: 'doce', emoji: '🍰', tags: ['#bolocaseiro', '#doces', '#sobremesa'] },
  { id: 'pizza', chaves: ['pizza'], nome: 'pizza', emoji: '🍕', tags: ['#pizza', '#pizzacaseira'] },
  { id: 'petisco', chaves: ['petisco', 'tira-gosto', 'tira gosto', 'aperitivo', 'castanha'], nome: 'petisco', emoji: '🥜', tags: ['#petiscos', '#tiragosto', '#happyhour'] },
];

/** Onde cada tempero costuma ir (quando o produto não tem "modo de usar" preenchido). */
const USOS: [string, string[]][] = [
  ['paprica', ['batata', 'frango', 'molhos', 'ovos']],
  ['curcuma|acafrao', ['arroz', 'caldos', 'frango', 'legumes']],
  ['cominho', ['feijão', 'carne moída', 'grão-de-bico', 'molhos']],
  ['oregano', ['pizza', 'molho de tomate', 'carnes', 'saladas']],
  ['canela', ['bolos', 'chás', 'mingau', 'frutas assadas']],
  ['cravo', ['chás', 'doces', 'carnes de panela']],
  ['chimichurri', ['carnes', 'pão de alho', 'feijão', 'legumes']],
  ['lemon', ['peixes', 'saladas', 'frango', 'massas']],
  ['curry', ['arroz', 'frango', 'legumes', 'molhos']],
  ['alho', ['arroz', 'feijão', 'carnes', 'legumes']],
  ['cebola', ['carnes', 'molhos', 'sopas', 'patês']],
  ['pimenta', ['carnes', 'molhos', 'ovos', 'petiscos']],
  ['gengibre', ['chás', 'peixes', 'frango', 'sucos']],
  ['louro', ['feijão', 'carnes de panela', 'caldos']],
  ['noz-moscada|noz moscada', ['purê', 'molho branco', 'quiches']],
  ['ervas|manjericao|alecrim|tomilho|salsa', ['massas', 'batatas', 'frango', 'pães']],
  ['sal', ['churrasco', 'saladas', 'finalizar pratos']],
  ['castanha|amendoim|nozes', ['lanches', 'saladas', 'granola', 'doces']],
];

const PALAVRAS_TEMA: [Tema, string[]][] = [
  ['oferta', ['promo', 'oferta', 'desconto', 'barato', 'preco especial', '% off', ' off ', 'queima']],
  ['novidade', ['chegou', 'novidade', 'novo', 'nova', 'lancamento', 'reposicao', 'voltou']],
  ['kit', ['kit', 'presente', 'cesta', 'lembrancinha', 'caixinha']],
  ['cliente', ['cliente', 'depoimento', 'avaliacao', 'feedback', 'elogio']],
  ['bastidores', ['embalando', 'pesando', 'bastidor', 'rotina', 'separando', 'etiquetando', 'montando']],
  ['loja', ['fachada', 'loja', 'prateleira', 'vitrine', 'balcao']],
  ['dica', ['dica', 'como usar', 'como guardar', 'diferenca', 'sabia', 'aprenda']],
];

export interface Pedido {
  tema: Tema;
  produtos: Product[];
  pratos: Prato[];
}

const ehAtivo = (p: Product) => (p.venda ?? 0) > 0;
/** Entende o que vai ser postado a partir do texto livre. */
export function entender(texto: string, produtos: Product[]): Pedido {
  const t = ` ${norm(texto)} `;
  const achados = produtos
    .filter(ehAtivo)
    .filter((p) => {
      const n = norm(p.nome);
      const primeira = n.split(/\s+/)[0];
      return t.includes(n) || (primeira.length >= 4 && t.includes(primeira));
    })
    .sort((a, b) => b.nome.length - a.nome.length)
    .slice(0, 3);
  const pratos = PRATOS.filter((x) => x.chaves.some((k) => t.includes(k))).slice(0, 2);
  const porPalavra = PALAVRAS_TEMA.find(([tm, ks]) => (tm !== 'loja' || (!pratos.length && !achados.length)) && ks.some((k) => t.includes(k)))?.[0];
  const tema = porPalavra ?? (pratos.length ? 'receita' : achados.length ? 'produto' : 'loja');
  return { tema, produtos: achados, pratos };
}

// ----------------------------------------------------------------------- sorteio com semente

function sorteador(semente: number) {
  let a = semente >>> 0 || 1;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const um = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)];
  const embaralhar = <T,>(xs: T[]): T[] => {
    const c = [...xs];
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    return c;
  };
  return { um, embaralhar };
}

// ----------------------------------------------------------------------- textos

interface Ctx {
  p: string; // produto em minúsculas ("páprica defumada") ou "nossos temperos"
  P: string; // com maiúscula
  temP: boolean;
  prato: string;
  temPrato: boolean;
  emoji: string;
  usos: string[];
  loja: string;
  cidade: string;
  preco: string;
  tema: Tema;
}

const minus = (s: string) => (/^[A-ZÀ-Ú][a-zà-ú]/.test(s) ? s[0].toLocaleLowerCase('pt-BR') + s.slice(1) : s);
const maius = (s: string) => s && s[0].toLocaleUpperCase('pt-BR') + s.slice(1);
const juntar = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);

function usosDe(p: Product | undefined): string[] {
  if (!p) return [];
  const mu = p.modoUso?.trim();
  if (mu && mu.length < 90) {
    const partes = mu.replace(/\.$/, '').split(/,| e /).map((x) => x.trim().toLowerCase()).filter((x) => x && x.length < 30);
    if (partes.length >= 2) return partes.slice(0, 4);
  }
  const n = norm(p.nome);
  return USOS.find(([k]) => k.split('|').some((x) => n.includes(x)))?.[1] ?? [];
}

export type Angulo = 'curiosidade' | 'pergunta' | 'salvar' | 'humor' | 'lista' | 'local' | 'comentario' | 'direto';
export const ANGULOS: Record<Angulo, string> = {
  curiosidade: 'Curiosidade',
  pergunta: 'Pergunta para comentarem',
  salvar: 'Para salvar',
  humor: 'Bem-humorado',
  lista: 'Lista rápida',
  local: 'Pertinho de você',
  comentario: 'Comente e receba',
  direto: 'Direto ao ponto',
};

type Gancho = { a: Angulo; t: string; se?: (c: Ctx) => boolean };
const GANCHOS: Gancho[] = [
  { a: 'curiosidade', t: 'O segredo do {prato} que todo mundo pergunta 🤫', se: (c) => c.temPrato },
  { a: 'curiosidade', t: 'Pouca gente sabe disso sobre {p} 👀', se: (c) => c.temP },
  { a: 'curiosidade', t: 'O tempero que muda o seu {prato} 👀', se: (c) => c.temPrato },
  { a: 'curiosidade', t: 'Por que o {prato} de restaurante é mais gostoso? 🤔', se: (c) => c.temPrato },
  { a: 'curiosidade', t: 'Esse pacotinho salva qualquer almoço 😏', se: (c) => c.temP },
  { a: 'pergunta', t: '{P} no {prato}: sim ou não? 👇', se: (c) => c.temP && c.temPrato },
  { a: 'pergunta', t: 'Você é time {p} ou time sal e alho? 😅', se: (c) => c.temP },
  { a: 'pergunta', t: 'Qual tempero não pode faltar na sua cozinha? 👇' },
  { a: 'pergunta', t: 'Nota de 0 a 10 para esse {prato}? 👇', se: (c) => c.temPrato },
  { a: 'salvar', t: 'Salva pra não esquecer 📌' },
  { a: 'salvar', t: 'Guarda esse post para o próximo {prato} 📌', se: (c) => c.temPrato },
  { a: 'salvar', t: 'Anota aí que essa é boa ✍️' },
  { a: 'humor', t: 'POV: a visita pediu a receita do seu {prato} 😎', se: (c) => c.temPrato },
  { a: 'humor', t: 'Quando o {prato} sai tão bom que até você se surpreende 😂', se: (c) => c.temPrato },
  { a: 'humor', t: 'Eu: só uma pitadinha. Também eu: 🧂🧂🧂' },
  { a: 'humor', t: 'Comida sem tempero? Aqui não 🙅‍♀️' },
  { a: 'humor', t: 'Sinais de que você ama cozinhar: tem mais tempero que roupa 😂' },
  { a: 'lista', t: '{n} jeitos de usar {p} que você ainda não tentou ⬇️', se: (c) => c.temP && c.usos.length >= 3 },
  { a: 'lista', t: 'Tudo o que você precisa para um {prato} perfeito ⬇️', se: (c) => c.temPrato },
  { a: 'local', t: '{cidade}, vocês já conhecem a {loja}? 📍', se: (c) => !!c.cidade },
  { a: 'local', t: 'Pra quem é de {cidade} e ama cozinhar 📍', se: (c) => !!c.cidade },
  { a: 'comentario', t: 'Comenta “EU QUERO” que a gente te manda a receita 💬', se: (c) => c.tema === 'receita' },
  { a: 'comentario', t: 'Comenta “QUERO” que a gente te conta como usar 💬', se: (c) => c.temP },
  { a: 'direto', t: '{P} {emoji}', se: (c) => c.temP },
  { a: 'direto', t: 'Chegou fresquinho na {loja} 📦', se: (c) => c.tema === 'novidade' },
  { a: 'direto', t: '{P} com preço especial 🔥', se: (c) => c.tema === 'oferta' && c.temP },
  { a: 'direto', t: 'Presente que todo mundo usa 🎁', se: (c) => c.tema === 'kit' },
  { a: 'direto', t: 'Por trás de cada pacotinho 🤎', se: (c) => c.tema === 'bastidores' },
  { a: 'direto', t: 'Obrigado pelo carinho 🥹', se: (c) => c.tema === 'cliente' },
];

const CORPO: Record<Tema, string[]> = {
  receita: [
    'Hoje o {prato} ganhou {p} e o resultado foi esse {emoji}\nTempere antes de ir para o fogo, deixe pegar gosto uns minutinhos e pronto.',
    'Receita simples, sabor de restaurante: {prato} com {p} {emoji}\nO segredo é temperar com antecedência e não economizar no carinho.',
    'Esse {prato} {emoji} levou {p} e mais nada de complicado.\nÀs vezes é só o tempero certo que faltava.',
    'Almoço resolvido em poucos passos: {prato} {emoji} + {p} + um fio de azeite.\nO cheiro na cozinha já diz tudo.',
    'Quem prova pergunta o que tem nesse {prato} {emoji}\nA resposta é simples: {p}, pesado na hora aqui na loja.',
  ],
  produto: [
    '{P} {emoji} é daqueles temperos que salvam qualquer refeição.\nVai muito bem em {usos}.',
    'Cheiroso, fresquinho e pesado na hora: {p} {emoji}\nExperimenta em {usos}.',
    'Se você ainda não tem {p} em casa, tá perdendo 😋\nCombina com {usos}.',
    'Cor, aroma e sabor num pacotinho só: {p} {emoji}\nUse em {usos} e depois conta pra gente.',
  ],
  dica: [
    'Dica rápida: {p} rende mais quando entra no começo do preparo, junto do refogado. Assim o sabor se espalha por todo o prato.',
    'Pra durar mais, guarde {p} em pote bem fechado, longe do fogão e do sol, e use sempre colher seca.',
    'Erva seca é mais concentrada que a fresca: 1 colher de seca vale por 3 de fresca. Ajusta aí na sua receita!',
    'Tempero moído perde o aroma com o tempo. Compre em pequenas quantidades e sempre fresquinho: é por isso que pesamos na hora 😉',
  ],
  bastidores: [
    'Aqui cada pacotinho é pesado, embalado e etiquetado na hora, com o cuidado de quem também ama cozinhar 🤎',
    'Um pouquinho da nossa rotina: separando, pesando e embalando os temperos que vão para a sua mesa.',
    'Você vê o pacotinho pronto, mas antes ele passa por aqui: escolha, pesagem, embalagem e etiqueta, um por um ✨',
    'Dia de reposição na loja! Prateleira cheia e cheirinho de tempero no ar 🌿',
  ],
  novidade: [
    'Chegou {p} fresquinho aqui na {loja}! 📦\nCorre que costuma acabar rápido.',
    'Reposição feita ✅ {P} está de volta e cheirosíssimo.',
    'Novidade na prateleira: {p} {emoji}\nVai bem em {usos}. Vem conhecer!',
    'Quem estava esperando {p}? Chegou! 📦\nPasse na loja ou peça pelo link da bio.',
  ],
  oferta: [
    '{P} por {preco} 🔥\nAproveite para experimentar em {usos}. Só enquanto durar o estoque!',
    'Semana de {p} com preço especial: {preco} ✨\nGaranta o seu antes que acabe.',
    'Oferta da semana 🔥 {P} por {preco}.\nÉ a hora de abastecer a cozinha.',
    'Preço bom e tempero fresquinho: {p} saindo por {preco} 🛒',
  ],
  kit: [
    'Kit de temperos montado do seu jeito: é presente bonito, útil e que todo mundo usa 🎁\nA gente monta com laço e cartão.',
    'Procurando presente? Um kit de temperos agrada quem cozinha todo dia e quem está começando 🎁',
    'Kit pronto para presentear 🎁 Você escolhe os temperos, a gente embala com carinho.',
    'Presente útil existe sim: kit de temperos que vai direto para a cozinha e é lembrado a cada refeição 🎁',
  ],
  cliente: [
    'Receber o carinho de vocês não tem preço 🥹\nObrigado por confiar na {loja} e levar nossos temperos para a sua cozinha.',
    'Receita aprovada é a nossa maior alegria 🤎\nMande a foto do seu prato que a gente reposta!',
    'Olha o que chegou pra gente 🥹 Ver nossos temperos na mesa de vocês é o melhor presente.',
    'Cliente feliz, loja feliz 🤎 Obrigado por escolher a {loja}!',
  ],
  loja: [
    'Vem conhecer a {loja}{em_cidade}! Temperos selecionados, produtos naturais e atendimento de quem ama cozinhar 🌿',
    'Prateleiras cheias de cor e cheiro bom 🌿\nVem escolher seus temperos com calma e tirar dúvidas com a gente.',
    'Aqui você compra só a quantidade que precisa, sempre fresquinho e pesado na hora 🌿',
    'Já passou pela {loja}? Vem sentir o cheirinho de tempero e levar uma dica de receita junto 🌿',
  ],
};

const CTAS: { t: string; a?: Angulo[] }[] = [
  { t: 'Salva esse post e manda pra quem cozinha na sua casa 📌', a: ['salvar', 'lista', 'curiosidade'] },
  { t: 'Marca aqui quem precisa ver isso 👇' },
  { t: 'Compartilha com aquela pessoa que vive pedindo dica de tempero 💬' },
  { t: 'Conta aqui nos comentários 👇', a: ['pergunta', 'humor'] },
  { t: 'Responde nos comentários que a gente te ajuda 💬', a: ['comentario', 'pergunta'] },
  { t: 'Passa na loja ou pede pelo link da bio 🛒', a: ['direto', 'local'] },
];

const TAGS_TEMA: Record<Tema, string[]> = {
  receita: ['#receitafacil', '#receitascaseiras', '#comidacaseira', '#cozinhapratica', '#receitadodia', '#comidaboa'],
  produto: ['#temperos', '#especiarias', '#temperonatural', '#cozinhando', '#temperosnaturais'],
  dica: ['#dicasdecozinha', '#dicadodia', '#cozinhafacil', '#temperos'],
  bastidores: ['#pequenonegocio', '#bastidores', '#empreendedorismo', '#lojadetemperos', '#feitocomamor'],
  novidade: ['#novidade', '#chegou', '#lancamento', '#temperos'],
  oferta: ['#promocao', '#oferta', '#precobom', '#aproveite'],
  kit: ['#presente', '#kitpresente', '#presentecriativo', '#kitdetemperos'],
  cliente: ['#clientesatisfeito', '#gratidao', '#clientefeliz', '#receitaaprovada'],
  loja: ['#lojadetemperos', '#produtosnaturais', '#comprelocal', '#lojafisica'],
};

const slug = (s: string) => norm(s).replace(/[^a-z0-9]/g, '');
const preencher = (t: string, c: Ctx) =>
  t
    .replace(/\{prato\}/g, c.prato)
    .replace(/\{P\}/g, c.P)
    .replace(/\{p\}/g, c.p)
    .replace(/\{emoji\}/g, c.emoji)
    .replace(/\{usos\}/g, juntar(c.usos.slice(0, 3)) || 'suas receitas do dia a dia')
    .replace(/\{n\}/g, String(Math.min(4, c.usos.length)))
    .replace(/\{loja\}/g, c.loja)
    .replace(/\{cidade\}/g, c.cidade)
    .replace(/\{em_cidade\}/g, c.cidade ? ` em ${c.cidade}` : '')
    .replace(/\{preco\}/g, c.preco || 'preço especial');

export interface Sugestao {
  angulo: Angulo;
  gancho: string;
  /** gancho sem emojis, para o título da arte */
  textoArte: string;
  /** subtítulo para a arte (o produto, ou o nome da loja) */
  subtituloArte: string;
  legenda: string;
  hashtags: string[];
}

export interface DadosLegenda {
  texto: string;
  tema?: Tema;
  produtos: Product[];
  loja: StoreInfo;
  cidade: string;
  insta?: string;
  semente: number;
  quantas?: number;
}

const precoDe = (p: Product | undefined) => {
  if (!p) return '';
  const v = (p.promo?.preco ?? p.venda) ?? 0;
  return ['kg', 'g'].includes(String(p.unidade).toLowerCase()) ? `${formatBRL(Math.round(v / 10))} / 100 g` : formatBRL(v);
};

export const semEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();

/** Sugestões de legenda variadas (cada uma num formato diferente). */
export function sugerirLegendas(d: DadosLegenda): Sugestao[] {
  const ped = entender(d.texto, d.produtos);
  const tema = d.tema ?? ped.tema;
  const p0 = ped.produtos[0];
  const prato = ped.pratos[0];
  const nomeP = p0 ? (ped.produtos.length > 1 ? juntar(ped.produtos.map((x) => minus(x.nome))) : minus(p0.nome)) : 'nossos temperos';
  const c: Ctx = {
    p: nomeP,
    P: maius(nomeP),
    temP: !!p0,
    prato: prato?.nome ?? 'prato',
    temPrato: !!prato,
    emoji: prato?.emoji ?? '🌿',
    usos: usosDe(p0),
    loja: d.loja.nomeFantasia || 'nossa loja',
    cidade: d.cidade.trim(),
    preco: precoDe(p0),
    tema,
  };
  const s = sorteador(d.semente);
  const validos = GANCHOS.filter((g) => !g.se || g.se(c));
  // um gancho por formato, formatos em ordem sorteada (o "direto" e o "local" entram quando fazem sentido)
  const porAngulo = new Map<Angulo, Gancho[]>();
  for (const g of validos) porAngulo.set(g.a, [...(porAngulo.get(g.a) ?? []), g]);
  const angulos = s.embaralhar([...porAngulo.keys()]);
  const quantas = Math.min(d.quantas ?? 4, angulos.length);
  const corpos = s.embaralhar(CORPO[tema]);
  const marca = `#${slug(c.loja) || 'temperos'}`;
  const local = c.cidade ? [`#${slug(c.cidade)}`] : [];
  const deProduto = ped.produtos.map((x) => `#${slug(x.nome.split(/\s+/)[0])}`).filter((x) => x.length > 3);
  const dePrato = ped.pratos.flatMap((x) => x.tags);

  return angulos.slice(0, quantas).map((a, i) => {
    const g = s.um(porAngulo.get(a)!);
    const gancho = preencher(g.t, c);
    let corpo = preencher(corpos[i % corpos.length], c);
    if (a === 'lista' && c.usos.length >= 3 && g.t.includes('{n}')) corpo = c.usos.slice(0, 4).map((u, k) => `${['1️⃣', '2️⃣', '3️⃣', '4️⃣'][k]} ${maius(u)}`).join('\n');
    if (a === 'lista' && g.t.includes('{prato}')) corpo = `${maius(c.p)} na medida certa, tempo de descanso para pegar gosto e fogo no ponto. Simples assim ${c.emoji}`;
    const ctas = CTAS.filter((x) => !x.a || x.a.includes(a));
    const cta = a === 'comentario' ? 'A gente responde todo mundo 💬' : s.um(ctas).t;
    const extra = s.embaralhar([...dePrato, ...deProduto]).slice(0, 2);
    const tagsTema = s.embaralhar(TAGS_TEMA[tema]);
    const hashtags = [...new Set([marca, ...local, ...extra, ...tagsTema])].slice(0, 5);
    const fim = [d.insta ? `📲 Pedidos pelo link da bio · ${d.insta}` : '📲 Pedidos pelo link da bio', c.cidade ? `📍 ${c.cidade}` : ''].filter(Boolean).join('\n');
    return { angulo: a, gancho, textoArte: semEmoji(gancho), subtituloArte: c.temP ? c.P : c.loja, legenda: [gancho, corpo, cta, fim, hashtags.join(' ')].join('\n\n'), hashtags };
  });
}
