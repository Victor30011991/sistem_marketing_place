import type { BotaoCartao, EntregaCardapio, HorarioDia, ListState, Product, StoreInfo, TipoBotao, Vitrine, Venda, Lote } from '../types';
import { norm } from './normalize';
import { MODELOS_IDEIA } from './postaai';
import { entradaDe } from './entrada';
import { comPromo } from './promo';
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

export const ENTREGA_PADRAO: EntregaCardapio = { ativa: true, taxa: 'combinar', valor: 0, retirada: true };
export const PAGAMENTOS_PADRAO = { pix: true, cartao: true, dinheiro: true };
export const PESOS_PADRAO = [50, 100, 250, 500];
export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const HORARIOS_PADRAO: HorarioDia[] = DIAS.map((_, i) => ({ aberto: i !== 0, abre: '08:00', fecha: i === 6 ? '13:00' : '18:00' }));

const hora = (v: unknown, d: string) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : d);
function entregaDe(v: unknown): EntregaCardapio | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const e = v as Record<string, unknown>;
  const valor = typeof e.valor === 'number' && Number.isFinite(e.valor) && e.valor > 0 ? Math.min(Math.round(e.valor), 100000) : 0;
  return { ativa: e.ativa !== false, taxa: e.taxa === 'fixa' ? 'fixa' : 'combinar', valor, retirada: e.retirada !== false };
}
function horariosDe(v: unknown): HorarioDia[] | undefined {
  if (!Array.isArray(v) || v.length !== 7) return undefined;
  return v.map((d, i) => {
    const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
    return { aberto: o.aberto !== false, abre: hora(o.abre, HORARIOS_PADRAO[i].abre), fecha: hora(o.fecha, HORARIOS_PADRAO[i].fecha) };
  });
}
function pesosDe(v: unknown): number[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const p = [...new Set(v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= 100000).map(Math.round))].sort((a, b) => a - b).slice(0, 6);
  return p.length ? p : undefined;
}

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
    ...(v.destaques === false ? { destaques: false } : {}),
    ...(Array.isArray(v.botoes) ? { botoes: lerBotoes(v.botoes) } : {}),
    ...(entregaDe(v.entrega) ? { entrega: entregaDe(v.entrega) } : {}),
    ...(v.pagamentos && typeof v.pagamentos === 'object'
      ? { pagamentos: { pix: (v.pagamentos as Record<string, unknown>).pix !== false, cartao: (v.pagamentos as Record<string, unknown>).cartao !== false, dinheiro: (v.pagamentos as Record<string, unknown>).dinheiro !== false } }
      : {}),
    ...(horariosDe(v.horarios) ? { horarios: horariosDe(v.horarios) } : {}),
    ...(pesosDe(v.pesos) ? { pesos: pesosDe(v.pesos) } : {}),
    ...(v.mixes === false ? { mixes: false } : {}),
    ...(entradaDe(v.entrada) ? { entrada: entradaDe(v.entrada) } : {}),
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
  /** preço por quilo, em centavos (o de hoje: com a promoção, se houver) */
  pk: number;
  /** preço por quilo antes da promoção */
  pa?: number;
  /** selo da promoção, ex.: "Oferta da semana" */
  s?: string;
  /** foto pequena (data URL) */
  f?: string;
  /** modo de usar / combina com */
  u?: string;
  /** ingredientes */
  ig?: string;
  /** glúten: c = contém, n = não contém */
  gl?: 'c' | 'n';
  /** alérgicos */
  al?: string;
  /** está entre os mais vendidos */
  mv?: 1;
  /** quem levou também levou (ids) */
  j?: string[];
}

export interface MixCardapio {
  n: string;
  d: string;
  /** ids dos produtos */
  i: string[];
  /** gramas de cada um */
  g: number;
}

/** Dados extras para os destaques do cardápio (opcionais). */
export interface ExtrasCardapio {
  vendas?: Venda[];
  lotes?: Lote[];
  /** dados do Pix (do orçamento) para o cliente pagar pelo cardápio */
  pix?: { chave: string; nome: string; cidade: string } | null;
}

/** Fotos no cardápio público até este tamanho somado (o documento da nuvem aceita 1 MB). */
export const LIMITE_FOTOS = 600_000;

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
    entrega?: EntregaCardapio;
    pag?: { pix: boolean; cartao: boolean; dinheiro: boolean };
    /** domingo = 0: [abre, fecha] ou null quando fechado */
    horarios?: ([string, string] | null)[];
    pesos?: number[];
    /** chave já formatada, nome e cidade (o cliente monta o copia e cola com o valor) */
    pix?: { k: string; n: string; c: string };
    endereco?: string;
  };
  categorias: { nome: string; itens: ItemCardapio[] }[];
  mixes?: MixCardapio[];
}

export type MotivoFora = 'oculto' | 'sem-estoque' | 'sem-preco' | 'nao-peso';

export interface ResultadoCardapio {
  arquivo: CardapioArquivo;
  /** produtos que ficaram de fora e por quê (os ocultos por você não contam como problema) */
  fora: { produto: Product; motivo: MotivoFora }[];
  total: number;
  /** produtos com foto que ficaram sem ela no cardápio (passou do limite de tamanho) */
  semFoto: number;
}

/** Preço por quilo em centavos de um produto vendido por peso; null = não dá para vender por grama. */
export function precoPorQuilo(p: Product): number | null {
  const b = counterBasis(p);
  if (!b) return null;
  if (b.base !== 'g') return null;
  return Math.round(b.perBase.times(1000).toNumber());
}

/** Monta o arquivo que vai para o site. Só nome, categoria e preço: custos, margens e estoque nunca entram. */
export function montarCardapio(lista: ListState, loja: StoreInfo, logo: string | null, quando: Date = new Date(), extras: ExtrasCardapio = {}): ResultadoCardapio {
  const v = vitrineDe(loja);
  const ocultos = new Set(v.ocultos);
  const fora: ResultadoCardapio['fora'] = [];
  const porCat = new Map<string, ItemCardapio[]>();
  const hoje = `${quando.getFullYear()}-${String(quando.getMonth() + 1).padStart(2, '0')}-${String(quando.getDate()).padStart(2, '0')}`;
  let fotos = 0;
  let semFoto = 0;
  const porId = new Map<string, ItemCardapio>();
  for (const produto of lista.produtos) {
    const p = comPromo(produto, hoje);
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
    const item: ItemCardapio = { i: p.id, n: p.nome.trim(), pk };
    if (p.venda !== produto.venda) {
      const antes = precoPorQuilo(produto);
      if (antes && antes > pk) Object.assign(item, { pa: antes, s: produto.promo?.selo.trim() || 'Promoção' });
    }
    if (p.modoUso?.trim()) item.u = p.modoUso.trim().slice(0, 300);
    if (p.ingredientes?.trim()) item.ig = p.ingredientes.trim().slice(0, 300);
    if (p.gluten) item.gl = p.gluten === 'contem' ? 'c' : 'n';
    if (p.alergenicos?.trim()) item.al = p.alergenicos.trim().slice(0, 200);
    if (produto.foto) {
      if (fotos + produto.foto.length <= LIMITE_FOTOS) {
        item.f = produto.foto;
        fotos += produto.foto.length;
      } else semFoto++;
    }
    porCat.get(cat)!.push(item);
    porId.set(p.id, item);
  }
  const ordem = [...lista.categorias.filter((c) => porCat.has(c)), ...[...porCat.keys()].filter((c) => !lista.categorias.includes(c) && c !== 'Outros'), ...(porCat.has('Outros') ? ['Outros'] : [])];
  const unicas = [...new Set(ordem)];
  const categorias = unicas.map((nome) => ({ nome, itens: porCat.get(nome)!.sort((a, b) => a.n.localeCompare(b.n, 'pt-BR')) }));
  // destaques no topo: ofertas, mais vendidos (30 dias) e o que chegou nos últimos 15 dias
  if (v.destaques !== false) {
    const dia = (iso: string, d: number) => {
      const x = new Date(quando);
      x.setDate(x.getDate() + d);
      return x.toISOString().slice(0, 10) <= iso.slice(0, 10);
    };
    const ofertas = [...porId.values()].filter((i) => i.pa);
    const vendido = new Map<string, number>();
    for (const vd of extras.vendas ?? []) if (!vd.cancelada && dia(vd.quando, -30)) for (const it of vd.itens) vendido.set(it.produtoId, (vendido.get(it.produtoId) ?? 0) + it.total);
    const mais = [...vendido.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => porId.get(id)).filter((x): x is ItemCardapio => !!x).slice(0, 6);
    for (const m of mais) m.mv = 1;
    const chegou = new Set<string>();
    for (const l of extras.lotes ?? []) if (l.aplicadoEm && dia(l.aplicadoEm, -15)) for (const it of l.itens) if (it.produtoId) chegou.add(it.produtoId);
    const novos = [...chegou].map((id) => porId.get(id)).filter((x): x is ItemCardapio => !!x).slice(0, 8);
    const topo = [
      { nome: 'Ofertas', itens: ofertas },
      { nome: 'Mais vendidos', itens: mais },
      { nome: 'Chegou agora', itens: novos },
    ].filter((c) => c.itens.length && !porCat.has(c.nome));
    categorias.unshift(...topo);
  }
  // quem levou também levou: produtos que mais saíram juntos nos últimos 120 dias
  const juntos = new Map<string, Map<string, number>>();
  const limite = new Date(quando);
  limite.setDate(limite.getDate() - 120);
  for (const vd of extras.vendas ?? []) {
    if (vd.cancelada || new Date(vd.quando) < limite) continue;
    const ids = [...new Set(vd.itens.map((x) => x.produtoId).filter((id): id is string => !!id && porId.has(id)))];
    for (const a of ids) for (const b of ids) if (a !== b) {
      if (!juntos.has(a)) juntos.set(a, new Map());
      juntos.get(a)!.set(b, (juntos.get(a)!.get(b) ?? 0) + 1);
    }
  }
  for (const [id, m] of juntos) porId.get(id)!.j = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([x]) => x);

  // mixes prontos: receitas da biblioteca do Posta Aí em que a loja tem todos os temperos
  const mixes: MixCardapio[] = [];
  if (v.mixes !== false) {
    const nomes = lista.produtos.filter((p) => porId.has(p.id)).map((p) => ({ id: p.id, n: norm(p.nome) }));
    const pesoMix = Math.max(v.minGramas, 50);
    for (const m of MODELOS_IDEIA) {
      if ((m.tipo !== 'mix' && m.tipo !== 'receita') || !m.precisa || m.precisa.length < 2) continue;
      const ids = m.precisa.map((k) => nomes.find((x) => k.split('|').some((a) => x.n.startsWith(a)))?.id);
      if (ids.some((x) => !x)) continue;
      const unicos = [...new Set(ids as string[])];
      if (unicos.length < 2) continue;
      mixes.push({ n: m.titulo, d: m.subtitulo, i: unicos, g: pesoMix });
      if (mixes.length >= 4) break;
    }
  }

  const cores = loja.cores ?? LOGO_COLORS;
  const hs = v.horarios;
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
        entrega: v.entrega ?? ENTREGA_PADRAO,
        pag: v.pagamentos ?? PAGAMENTOS_PADRAO,
        ...(hs ? { horarios: hs.map((d) => (d.aberto ? ([d.abre, d.fecha] as [string, string]) : null)) } : {}),
        pesos: v.pesos ?? PESOS_PADRAO,
        ...(extras.pix ? { pix: { k: extras.pix.chave, n: extras.pix.nome, c: extras.pix.cidade } } : {}),
        ...(loja.endereco?.trim() ? { endereco: loja.endereco.trim().slice(0, 200) } : {}),
      },
      categorias,
      ...(mixes.length ? { mixes } : {}),
    },
    fora,
    total: porId.size,
    semFoto,
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
