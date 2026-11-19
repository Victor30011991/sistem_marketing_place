import type { BotaoCartao, ListState, Product, StoreInfo, TipoBotao, Vitrine } from '../types';
import { newId } from './normalize';
import { counterBasis } from './units';
import { LOGO_COLORS } from './defaults';

export const VITRINE_PADRAO: Vitrine = {
  slogan: '',
  whatsapp: '',
  instagram: '',
  facebook: '',
  abertura: 'Olá, {loja}! Gostaria de fazer este pedido pelo cardápio:',
  fechamento: 'Aguardo a confirmação dos itens e o valor da entrega para fechar o pedido. Obrigado! 🌿',
  minGramas: 50,
  ocultos: [],
  ocultarSemEstoque: true,
};

const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d);

/** Lê a vitrine de uma loja de qualquer origem (Excel, backup, arquivo antigo) sem nunca lançar. */
export function vitrineDe(loja: Pick<StoreInfo, 'vitrine'> | null | undefined): Vitrine {
  const v = (loja?.vitrine ?? {}) as Partial<Record<keyof Vitrine, unknown>>;
  const min = typeof v.minGramas === 'number' && Number.isFinite(v.minGramas) && v.minGramas > 0 ? Math.min(Math.round(v.minGramas), 100000) : VITRINE_PADRAO.minGramas;
  return {
    slogan: str(v.slogan, ''),
    whatsapp: str(v.whatsapp, ''),
    instagram: str(v.instagram, ''),
    facebook: str(v.facebook, ''),
    abertura: str(v.abertura, VITRINE_PADRAO.abertura) || VITRINE_PADRAO.abertura,
    fechamento: str(v.fechamento, VITRINE_PADRAO.fechamento),
    minGramas: min,
    ocultos: Array.isArray(v.ocultos) ? v.ocultos.filter((x): x is string => typeof x === 'string') : [],
    ocultarSemEstoque: v.ocultarSemEstoque !== false,
    ...(Array.isArray(v.botoes) ? { botoes: lerBotoes(v.botoes) } : {}),
  };
}

/** Só dígitos, com 55 na frente quando o número vier sem o código do Brasil. Número curto demais = ''. */
export function normalizarWhatsapp(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length < 10) return '';
  if (d.length <= 11) return '55' + d;
  return d.length <= 15 ? d : '';
}

function soHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^(https?:\/\/)?(www\.|m\.)?(instagram|facebook|fb)\.(com|me)\/+/i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
    .trim();
}

/** "@temperei", "temperei" ou o endereço completo -> https://instagram.com/temperei. Vazio se não der. */
/** "facebook.com/..." ou "www.instagram.com/..." sem o https:// vira endereço completo (mantém ?id= e o resto). */
function comProtocolo(raw: string): string {
  const t = raw.trim();
  return /^(www\.|m\.)?(instagram|facebook|fb)\.(com|me)\//i.test(t) ? `https://${t}` : t;
}

export function normalizarInstagram(raw: string): string {
  const t = comProtocolo(raw);
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return /^https:\/\/([a-z0-9-]+\.)?instagram\.com\//i.test(t) ? t : '';
  const h = soHandle(t);
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? `https://instagram.com/${h}` : '';
}

/** Nome da página ou endereço completo -> https://facebook.com/... Vazio se não der. */
export function normalizarFacebook(raw: string): string {
  const t = comProtocolo(raw);
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return /^https:\/\/([a-z0-9-]+\.)?(facebook|fb)\.com\//i.test(t) ? t : '';
  const h = soHandle(t);
  return /^[A-Za-z0-9._-]{3,80}$/.test(h) ? `https://facebook.com/${h}` : '';
}

export type Origem = 'instagram' | 'facebook' | 'whatsapp';
export const ORIGENS: { id: Origem; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'whatsapp', label: 'WhatsApp' },
];

/** Endereço do cardápio publicado, a partir do endereço do sistema. ex.: .../temperei_sistem/ -> .../temperei_sistem/cardapio/ */
export function linkCardapio(baseDoSistema: string, origem?: Origem): string {
  const base = baseDoSistema.split('#')[0].split('?')[0].replace(/[^/]*$/, '');
  return `${base}cardapio/${origem ? `?o=${origem}` : ''}`;
}

export interface ItemCardapio {
  /** id do produto (para o pedido chegar certo no sistema) */
  i: string;
  n: string;
  /** preço por quilo, em centavos */
  pk: number;
}

export interface CardapioArquivo {
  v: 1;
  gerado: string;
  loja: {
    nome: string;
    slogan: string;
    logo: string | null;
    cores: { p: string; d: string; f: string };
    whatsapp: string;
    instagram: string;
    facebook: string;
    min: number;
    abertura: string;
    fechamento: string;
    /** botões do cartão, na ordem: t = tipo, r = texto, u = link */
    botoes: { t: TipoBotao; r: string; u: string }[];
  };
  categorias: { nome: string; itens: ItemCardapio[] }[];
}

export type MotivoFora = 'oculto' | 'sem-estoque' | 'sem-preco' | 'nao-peso';

export interface ResultadoCardapio {
  arquivo: CardapioArquivo;
  /** produtos que ficaram de fora e por quê (os ocultos por você não contam como problema) */
  fora: { produto: Product; motivo: MotivoFora }[];
  total: number;
}

/** Preço por quilo em centavos de um produto vendido por peso; null = não dá para vender por grama. */
export function precoPorQuilo(p: Product): number | null {
  const b = counterBasis(p);
  if (!b) return null;
  if (b.base !== 'g') return null;
  return Math.round(b.perBase.times(1000).toNumber());
}

/** Monta o arquivo que vai para o site. Só nome, categoria e preço: custos, margens e estoque nunca entram. */
export function montarCardapio(lista: ListState, loja: StoreInfo, logo: string | null, quando: Date = new Date()): ResultadoCardapio {
  const v = vitrineDe(loja);
  const ocultos = new Set(v.ocultos);
  const fora: ResultadoCardapio['fora'] = [];
  const porCat = new Map<string, ItemCardapio[]>();
  for (const p of lista.produtos) {
    if (ocultos.has(p.id)) {
      fora.push({ produto: p, motivo: 'oculto' });
      continue;
    }
    if (v.ocultarSemEstoque && p.estoque != null && p.estoque <= 0) {
      fora.push({ produto: p, motivo: 'sem-estoque' });
      continue;
    }
    if (p.venda == null || p.venda <= 0) {
      fora.push({ produto: p, motivo: 'sem-preco' });
      continue;
    }
    const pk = precoPorQuilo(p);
    if (pk == null || pk <= 0) {
      fora.push({ produto: p, motivo: 'nao-peso' });
      continue;
    }
    const cat = p.categoria.trim() || 'Outros';
    if (!porCat.has(cat)) porCat.set(cat, []);
    porCat.get(cat)!.push({ i: p.id, n: p.nome.trim(), pk });
  }
  const ordem = [...lista.categorias.filter((c) => porCat.has(c)), ...[...porCat.keys()].filter((c) => !lista.categorias.includes(c) && c !== 'Outros'), ...(porCat.has('Outros') ? ['Outros'] : [])];
  const unicas = [...new Set(ordem)];
  const categorias = unicas.map((nome) => ({ nome, itens: porCat.get(nome)!.sort((a, b) => a.n.localeCompare(b.n, 'pt-BR')) }));
  const cores = loja.cores ?? LOGO_COLORS;
  return {
    arquivo: {
      v: 1,
      gerado: quando.toISOString(),
      loja: {
        nome: loja.nomeFantasia || 'Loja',
        slogan: v.slogan.trim() || loja.informacoes.trim(),
        logo,
        cores: { p: cores.primaria, d: cores.destaque, f: cores.fundo },
        whatsapp: normalizarWhatsapp(v.whatsapp) || normalizarWhatsapp(loja.telefone),
        instagram: normalizarInstagram(v.instagram),
        facebook: normalizarFacebook(v.facebook),
        min: v.minGramas,
        abertura: v.abertura,
        fechamento: v.fechamento,
        botoes: (v.botoes ?? botoesPadrao())
          .filter((b) => b.ativo)
          .map((b) => ({ t: b.tipo, r: b.rotulo.trim() || TIPOS_BOTAO.find((x) => x.tipo === b.tipo)!.rotulo, u: linkBotao(b, v, loja) }))
          .filter((b) => b.u),
      },
      categorias,
    },
    fora,
    total: categorias.reduce((n, c) => n + c.itens.length, 0),
  };
}

// ---------- botões do cartão (link na bio) ----------

export const TIPOS_BOTAO: { tipo: TipoBotao; nome: string; rotulo: string; campo: string; dica: string }[] = [
  { tipo: 'cardapio', nome: 'Cardápio', rotulo: 'Cardápio', campo: '', dica: 'Abre o cardápio de pedidos.' },
  { tipo: 'whatsapp', nome: 'WhatsApp', rotulo: 'WhatsApp', campo: 'Número com DDD', dica: 'Vazio = usa o WhatsApp de vendas.' },
  { tipo: 'instagram', nome: 'Instagram', rotulo: 'Instagram', campo: '@usuario ou endereço', dica: 'Vazio = usa o Instagram da loja.' },
  { tipo: 'facebook', nome: 'Facebook', rotulo: 'Facebook', campo: 'Nome da página ou endereço', dica: 'Vazio = usa o Facebook da loja.' },
  { tipo: 'maps', nome: 'Como chegar (Google Maps)', rotulo: 'Como chegar', campo: 'Endereço da loja ou link do Maps', dica: 'Pode ser o endereço escrito.' },
  { tipo: 'ifood', nome: 'iFood', rotulo: 'Peça no iFood', campo: 'Link da loja no iFood', dica: 'Endereço que começa com ifood.com.br.' },
  { tipo: 'site', nome: 'Site ou outro link', rotulo: 'Nosso site', campo: 'Endereço (https://…)', dica: 'Qualquer site: catálogo, Linktree, Shopee…' },
  { tipo: 'telefone', nome: 'Ligar', rotulo: 'Ligar para a loja', campo: 'Telefone com DDD', dica: 'Abre a ligação no celular.' },
];

const TIPOS = new Set(TIPOS_BOTAO.map((t) => t.tipo));

export function botoesPadrao(): BotaoCartao[] {
  return (['cardapio', 'instagram', 'facebook', 'whatsapp'] as TipoBotao[]).map((tipo) => novoBotao(tipo));
}

export function novoBotao(tipo: TipoBotao): BotaoCartao {
  return { id: newId(), tipo, rotulo: TIPOS_BOTAO.find((t) => t.tipo === tipo)!.rotulo, valor: '', ativo: true };
}

function lerBotoes(raw: unknown[]): BotaoCartao[] {
  return raw.flatMap((b) => {
    if (!b || typeof b !== 'object') return [];
    const x = b as Record<string, unknown>;
    if (!TIPOS.has(x.tipo as TipoBotao)) return [];
    return [{ id: typeof x.id === 'string' && x.id ? x.id : newId(), tipo: x.tipo as TipoBotao, rotulo: str(x.rotulo, ''), valor: str(x.valor, ''), ativo: x.ativo !== false }];
  });
}

/** Só endereços http(s); "site.com.br/x" ganha https://. Qualquer outro esquema (javascript:, data:…) é recusado. */
function urlSegura(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const comProt = /^https?:\/\//i.test(t) ? t : /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(t) ? `https://${t}` : '';
  if (!comProt) return '';
  try {
    const u = new URL(comProt);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}

/** Link final de um botão. '' = falta informação ou está inválido (o botão não aparece). */
export function linkBotao(b: BotaoCartao, v: Vitrine, loja: Pick<StoreInfo, 'telefone' | 'nomeFantasia'>): string {
  switch (b.tipo) {
    case 'cardapio':
      return '#cardapio';
    case 'whatsapp': {
      const n = normalizarWhatsapp(b.valor) || normalizarWhatsapp(v.whatsapp) || normalizarWhatsapp(loja.telefone);
      return n ? `https://wa.me/${n}?text=${encodeURIComponent(`Olá, ${loja.nomeFantasia || 'tudo bem'}! Vim pelo cartão da loja.`)}` : '';
    }
    case 'instagram':
      return normalizarInstagram(b.valor) || normalizarInstagram(v.instagram);
    case 'facebook':
      return normalizarFacebook(b.valor) || normalizarFacebook(v.facebook);
    case 'maps': {
      const t = b.valor.trim();
      if (!t) return '';
      const u = urlSegura(t);
      if (u && /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)/i.test(u)) return u;
      // algo com "esquema:" (https:, javascript:…) que não é do Maps não vira busca de endereço
      return /^[a-z][a-z0-9+.-]*:/i.test(t) ? '' : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}`;
    }
    case 'ifood': {
      const u = urlSegura(b.valor);
      return /^https:\/\/(www\.)?ifood\.com\.br\//i.test(u) ? u : '';
    }
    case 'site':
      return urlSegura(b.valor);
    case 'telefone': {
      const n = normalizarWhatsapp(b.valor);
      return n ? `tel:+${n}` : '';
    }
  }
}
