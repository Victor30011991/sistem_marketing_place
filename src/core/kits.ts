/**
 * Kits, combos e ofertas montados pela loja para o carrossel do cardápio.
 * O preço do kit é da loja; o sistema mostra quanto sairia separado, quanto o cliente economiza
 * e quanto a loja lucra (o custo nunca vai para o site).
 */
import type { KitCardapio, Product, TipoKit } from '../types';
import { comPromo } from './promo';
import { convertQty, contentOf, counterBasis } from './units';
import { formatBRL } from './money';
import { newId, norm } from './normalize';

export const TIPOS_KIT: { id: TipoKit; nome: string }[] = [
  { id: 'combo', nome: 'Combo' },
  { id: 'kit', nome: 'Kit' },
  { id: 'oferta', nome: 'Oferta' },
  { id: 'novidade', nome: 'Novidade' },
];

const corOk = (v: unknown) => typeof v === 'string' && (/^#[0-9a-f]{6}$/i.test(v) || v === 'principal' || v === 'destaque');
const fotoOk = (v: unknown) => typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length <= 90000;

/** Lê os kits de qualquer origem sem nunca lançar. */
export function kitsDe(v: unknown): KitCardapio[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 40).flatMap((x): KitCardapio[] => {
    if (!x || typeof x !== 'object') return [];
    const o = x as Record<string, unknown>;
    const nome = typeof o.nome === 'string' ? o.nome.trim().slice(0, 60) : '';
    if (!nome) return [];
    const itens = (Array.isArray(o.itens) ? o.itens : []).slice(0, 12).flatMap((i) => {
      if (!i || typeof i !== 'object') return [];
      const r = i as Record<string, unknown>;
      const g = typeof r.gramas === 'number' && Number.isFinite(r.gramas) ? Math.round(r.gramas) : 0;
      return typeof r.produtoId === 'string' && r.produtoId && g > 0 && g <= 100000 ? [{ produtoId: r.produtoId, gramas: g }] : [];
    });
    const preco = typeof o.preco === 'number' && Number.isFinite(o.preco) && o.preco > 0 ? Math.round(o.preco) : 0;
    const tipo = TIPOS_KIT.some((t) => t.id === o.tipo) ? (o.tipo as TipoKit) : 'kit';
    return [
      {
        id: typeof o.id === 'string' && o.id ? o.id.slice(0, 40) : newId(),
        nome,
        tipo,
        itens,
        preco,
        descricao: typeof o.descricao === 'string' ? o.descricao.slice(0, 200) : '',
        chamada: typeof o.chamada === 'string' ? o.chamada.slice(0, 80) : '',
        ...(fotoOk(o.foto) ? { foto: o.foto as string } : {}),
        ...(corOk(o.cor) ? { cor: o.cor as string } : {}),
        carrossel: o.carrossel !== false,
        ativo: o.ativo !== false,
        ...(typeof o.ate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.ate) ? { ate: o.ate } : {}),
      },
    ];
  });
}

export function novoKit(): KitCardapio {
  return { id: newId(), nome: 'Kit novo', tipo: 'combo', itens: [], preco: 0, descricao: '', chamada: '', carrossel: true, ativo: true };
}

/** Preço por quilo (centavos) de hoje, com promoção; null = não vende por grama. */
export function precoQuilo(p: Product, hoje?: string): number | null {
  const b = counterBasis(comPromo(p, hoje));
  if (!b || b.base !== 'g') return null;
  return Math.round(b.perBase.times(1000).toNumber());
}
/** Mesmo arredondamento do cardápio (lib.js): centavos por g gramas. */
export const precoItem = (g: number, pk: number) => Math.floor((g * pk + 500) / 1000);

/** Custo de 1 grama (custo + custos adicionais), em centavos; null sem custo ou sem unidade de peso. */
export function custoGrama(p: Product): number | null {
  if (p.custo == null) return null;
  const total = p.custo + (p.custosAdicionais || 0);
  const direto = convertQty(1, 'g', p.unidade);
  if (direto) return direto.times(total).toNumber();
  const c = contentOf(p);
  if (!c) return null;
  const porConteudo = convertQty(1, 'g', c.unidade);
  return porConteudo ? porConteudo.div(c.qtd).times(total).toNumber() : null;
}

export interface ContaKit {
  /** itens que existem e vendem por grama */
  partes: { produto: Product; gramas: number; separado: number; custo: number | null }[];
  /** ids de itens que sumiram ou não vendem por grama */
  faltando: string[];
  separado: number;
  /** quanto o cliente economiza (centavos; 0 se o kit não sai mais barato) */
  economia: number;
  economiaPct: number;
  /** custo dos itens; null se algum item não tem custo */
  custo: number | null;
  lucro: number | null;
  margem: number | null;
}

export function contaKit(k: KitCardapio, produtos: Product[], hoje?: string): ContaKit {
  const partes: ContaKit['partes'] = [];
  const faltando: string[] = [];
  for (const it of k.itens) {
    const p = produtos.find((x) => x.id === it.produtoId);
    const pk = p ? precoQuilo(p, hoje) : null;
    if (!p || pk == null) {
      faltando.push(it.produtoId);
      continue;
    }
    const cg = custoGrama(p);
    partes.push({ produto: p, gramas: it.gramas, separado: precoItem(it.gramas, pk), custo: cg == null ? null : Math.round(cg * it.gramas) });
  }
  const separado = partes.reduce((a, x) => a + x.separado, 0);
  const economia = k.preco > 0 && separado > k.preco ? separado - k.preco : 0;
  const custo = partes.length && partes.every((x) => x.custo != null) ? partes.reduce((a, x) => a + (x.custo as number), 0) : null;
  const lucro = custo != null && k.preco > 0 ? k.preco - custo : null;
  return {
    partes,
    faltando,
    separado,
    economia,
    economiaPct: separado > 0 ? Math.round((economia / separado) * 100) : 0,
    custo,
    lucro,
    margem: lucro != null && k.preco > 0 ? Math.round((lucro / k.preco) * 100) : null,
  };
}

// ---------- chamadas sugeridas (modelos de frase, sem IA e sem custo) ----------

export interface Chamada {
  jeito: string;
  titulo: string;
  linha: string;
}

const TEMAS: { re: RegExp; momento: string[]; segredo: string }[] = [
  { re: /churrasc|carne|grelha|chimichurri|defumad|barbecue|bbq/, momento: ['O churrasco de domingo começa aqui', 'A carne fica outra com isto', 'Fogo aceso, tempero pronto'], segredo: 'O segredo do churrasqueiro' },
  { re: /\bchas?\b|camomila|hortela|erva doce|cidreira|calm|relax|ansiedade/, momento: ['Seu momento de pausa, num kit só', 'Para desacelerar no fim do dia', 'Uma xícara para cada humor'], segredo: 'O ritual do chá' },
  { re: /cafe da manha|fit|granola|chia|linhaca|aveia|psyllium|farinha|saudav/, momento: ['Café da manhã mais nutritivo', 'Comece o dia do jeito certo', 'Mais fibra no seu dia'], segredo: 'O segredo de um café da manhã que sustenta' },
  { re: /frango|peixe|lemon|limao|salada/, momento: ['Almoço leve e cheio de sabor', 'Frango e peixe nunca mais sem graça', 'Tempero fresco para o dia a dia'], segredo: 'O toque que faltava no seu almoço' },
  { re: /argila|skin|pele|beleza|mascara/, momento: ['Um spa em casa', 'Cuidado natural para a pele', 'Seu momento de autocuidado'], segredo: 'O segredo da pele bem cuidada' },
  { re: /natal|presente|festa|ceia/, momento: ['Um presente com sabor', 'Para a ceia ficar inesquecível', 'Presente bonito, útil e cheiroso'], segredo: 'O presente que todo mundo usa' },
];

function listaNomes(nomes: string[]): string {
  const n = nomes.map((x, i) => (i ? x.charAt(0).toLowerCase() + x.slice(1) : x));
  return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} e ${n[n.length - 1]}`;
}

/** Três jeitos de vender o mesmo kit. `variacao` troca as frases (botão "Outras"). */
export function sugerirChamadas(k: KitCardapio, c: ContaKit, variacao = 0): Chamada[] {
  const nomes = c.partes.map((p) => p.produto.nome.trim());
  const texto = norm(`${k.nome} ${k.descricao} ${nomes.join(' ')}`);
  const tema = TEMAS.find((t) => t.re.test(texto));
  const preco = k.preco > 0 ? formatBRL(k.preco) : formatBRL(c.separado);
  const mesmoPeso = c.partes.length > 1 && c.partes.every((p) => p.gramas === c.partes[0].gramas);
  const qtdTxt = mesmoPeso ? `${c.partes.length} itens, ${c.partes[0].gramas} g de cada` : `${c.partes.length} itens`;
  const v = Math.abs(Math.round(variacao));
  const economia: Chamada = c.economia > 0
    ? [
        { jeito: 'Pela economia', titulo: `Leve ${c.partes.length}, pague menos`, linha: `Economize ${formatBRL(c.economia)} levando o kit.` },
        { jeito: 'Pela economia', titulo: `${c.economiaPct}% mais barato no kit`, linha: `De ${formatBRL(c.separado)} por ${preco}.` },
        { jeito: 'Pela economia', titulo: 'Junto sai mais em conta', linha: `${qtdTxt} por ${preco}. Separado: ${formatBRL(c.separado)}.` },
      ][v % 3]
    : { jeito: 'Pelo preço', titulo: `Tudo por ${preco}`, linha: `${qtdTxt}, prontos para usar.` };
  const momentos = tema ? tema.momento : ['Pronto para a sua cozinha', 'Tudo o que a receita pede', 'Sabor de comida feita com carinho'];
  const momento: Chamada = { jeito: 'Pelo momento', titulo: momentos[v % momentos.length], linha: nomes.length ? `${listaNomes(nomes)}, pesados na hora.` : 'Monte o kit para ver a frase.' };
  const curiosidade: Chamada = { jeito: 'Pela curiosidade', titulo: tema ? tema.segredo : `O segredo do ${k.nome.trim().toLowerCase()}`, linha: `${qtdTxt}, por ${preco}.` };
  return [economia, momento, curiosidade];
}

/** Mensagem pronta para o status e o WhatsApp. */
export function mensagemKit(k: KitCardapio, c: ContaKit, chamada: Chamada | null, link: string): string {
  const nomes = c.partes.map((p) => `${p.produto.nome.trim()} (${p.gramas} g)`);
  const linhas = [`*${(chamada?.titulo || k.nome).trim()}*`, `${k.nome.trim()}: ${listaNomes(nomes)}.`];
  if (k.preco > 0 && c.economia > 0) linhas.push(`De ${formatBRL(c.separado)} por *${formatBRL(k.preco)}*.`);
  else if (k.preco > 0) linhas.push(`Por *${formatBRL(k.preco)}*.`);
  if (k.ate) {
    const [, m, d] = k.ate.split('-');
    linhas.push(`Válido até ${d}/${m}.`);
  }
  if (link) linhas.push('', `Peça pelo cardápio: ${link}`);
  return linhas.join('\n');
}

// ---------- o que vai para o site ----------

export interface KitPublicado {
  /** id */
  k: string;
  n: string;
  /** tipo */
  t: TipoKit;
  d?: string;
  /** chamada (frase do carrossel) */
  ch?: string;
  f?: string;
  /** cor: 'p', 'd' ou hex */
  c?: string;
  /** preço do kit (centavos) */
  p: number;
  /** quanto sairia separado (centavos) */
  s: number;
  /** itens: [id, gramas] */
  i: [string, number][];
  /** aparece no carrossel */
  r?: 1;
}

/** Só kits ligados, dentro da validade, com preço e com todos os itens no cardápio. */
export function kitsParaCardapio(kits: KitCardapio[], produtos: Product[], noCardapio: Set<string>, hoje: string): KitPublicado[] {
  const out: KitPublicado[] = [];
  for (const k of kits) {
    if (!k.ativo || k.preco <= 0 || k.itens.length < 1 || (k.ate && k.ate < hoje)) continue;
    if (k.itens.some((i) => !noCardapio.has(i.produtoId))) continue;
    const c = contaKit(k, produtos, hoje);
    if (c.faltando.length) continue;
    out.push({
      k: k.id,
      n: k.nome,
      t: k.tipo,
      ...(k.descricao.trim() ? { d: k.descricao.trim() } : {}),
      ...(k.chamada?.trim() ? { ch: k.chamada.trim() } : {}),
      ...(k.foto ? { f: k.foto } : {}),
      ...(k.cor ? { c: k.cor === 'principal' ? 'p' : k.cor === 'destaque' ? 'd' : k.cor } : {}),
      p: k.preco,
      s: c.separado,
      i: k.itens.map((x) => [x.produtoId, x.gramas] as [string, number]),
      ...(k.carrossel ? { r: 1 as const } : {}),
    });
  }
  return out;
}

/**
 * Divide o preço do kit entre os itens (proporcional ao preço separado), para o pedido e o PDV
 * darem baixa em cada produto e a soma bater com o preço do kit.
 */
export function ratearKit(precoKit: number, separados: number[]): number[] {
  const soma = separados.reduce((a, b) => a + b, 0);
  if (!separados.length) return [];
  if (soma <= 0) return separados.map((_, i) => (i === 0 ? precoKit : 0));
  const partes = separados.map((s) => Math.floor((s * precoKit) / soma));
  partes[partes.length - 1] += precoKit - partes.reduce((a, b) => a + b, 0);
  return partes;
}
