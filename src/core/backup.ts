import type { FixedCost, InstallmentFee, ListaCompras, ListState, Lote, LoteItem, Product, Settings, StoreInfo, VariableCost, Venda, VendaItem } from '../types';
import { defaultSettings, defaultStore } from './defaults';
import { newId, newKey } from './normalize';
import { paymentOptions } from './pricing';
import { vitrineDe } from './vitrine';
import { balancaDe } from './balanca';

/**
 * Backup em texto (.txt): cabeçalho legível + os dados em JSON.
 * É só um arquivo no computador da pessoa: não usa servidor, banco nem navegador para guardar.
 */
export const BACKUP_MARK = 'temperei-backup';
export const BACKUP_VERSAO = 1;
const SEPARADOR = '-----DADOS (não edite daqui para baixo)-----';

export interface BackupLido {
  lista: ListState;
  loja: StoreInfo;
  config: Settings;
  geradoEm: string | null;
  /** produtos do arquivo que foram ignorados por estarem incompletos */
  ignorados: number;
}

export type ResultadoBackup = ({ ok: true } & BackupLido) | { ok: false; motivo: string };

export function criarBackup(lista: ListState, loja: StoreInfo, config: Settings, quando: Date = new Date()): string {
  const n = lista.produtos.length;
  const cab = [
    'BACKUP DO SISTEMA DE PRECIFICAÇÃO',
    `Lista: ${lista.nome}`,
    `Gerado em: ${quando.toLocaleString('pt-BR')}`,
    `Produtos: ${n} · Categorias: ${lista.categorias.length}`,
    '',
    'Este arquivo guarda produtos, categorias, dados da loja, custos, taxas e margens.',
    'Para voltar a este ponto: no sistema, abra "Salvar em Excel" e use "Restaurar backup".',
    SEPARADOR,
  ];
  const dados = { app: BACKUP_MARK, versao: BACKUP_VERSAO, geradoEm: quando.toISOString(), lista, loja, config };
  return cab.join('\n') + '\n' + JSON.stringify(dados, null, 1) + '\n';
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const numOr = (v: unknown, d: number): number => num(v) ?? d;
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);

function lerProduto(v: unknown): Product | null {
  if (!isObj(v)) return null;
  const nome = str(v.nome).trim();
  if (!nome) return null;
  const p: Product = {
    id: str(v.id) || newId(),
    nome,
    categoria: str(v.categoria),
    unidade: str(v.unidade) || 'un',
    custo: num(v.custo),
    custosAdicionais: numOr(v.custosAdicionais, 0),
    venda: num(v.venda),
    propQtd: num(v.propQtd),
    propUnidade: typeof v.propUnidade === 'string' ? v.propUnidade : null,
    observacoes: str(v.observacoes),
  };
  if (v.estoque !== undefined) p.estoque = num(v.estoque);
  if (v.conteudoQtd !== undefined) p.conteudoQtd = num(v.conteudoQtd);
  if (v.conteudoUnidade !== undefined) p.conteudoUnidade = typeof v.conteudoUnidade === 'string' ? v.conteudoUnidade : null;
  if (typeof v.plu === 'number' && Number.isInteger(v.plu) && v.plu > 0 && v.plu <= 999999) p.plu = v.plu;
  return p;
}

function lerVariavel(c: Record<string, unknown>): VariableCost {
  const v: VariableCost = { id: str(c.id) || newKey(), descricao: str(c.descricao), tipo: c.tipo as VariableCost['tipo'], valor: c.valor as number };
  if (c.tipo === 'valor' && isObj(c.lote) && num(c.lote.total) != null && num(c.lote.qtd) != null && (c.lote.qtd as number) > 0) {
    v.lote = { total: c.lote.total as number, qtd: c.lote.qtd as number };
  }
  return v;
}

const cent = (v: unknown): number => {
  const n = num(v);
  return n != null && n >= 0 ? Math.round(n) : 0;
};

function lerLote(raw: unknown): Lote | null {
  if (!isObj(raw) || !Array.isArray(raw.itens)) return null;
  const itens: LoteItem[] = raw.itens.flatMap((i) => {
    if (!isObj(i)) return [];
    const nome = str(i.nome).trim();
    const produtoId = typeof i.produtoId === 'string' && i.produtoId ? i.produtoId : null;
    if (!nome && !produtoId) return [];
    return [{
      id: str(i.id) || newKey(),
      nome,
      produtoId,
      categoria: str(i.categoria),
      ncm: str(i.ncm),
      unidade: str(i.unidade) || 'kg',
      qtd: Math.max(0, numOr(i.qtd, 0)),
      valor: cent(i.valor),
      desconto: cent(i.desconto),
    }];
  });
  const l: Lote = {
    id: str(raw.id) || newKey(),
    data: str(raw.data),
    fornecedor: str(raw.fornecedor),
    numero: str(raw.numero),
    frete: cent(raw.frete),
    juros: cent(raw.juros),
    outras: cent(raw.outras),
    desconto: cent(raw.desconto),
    rateio: raw.rateio === 'valor' ? 'valor' : 'peso',
    custo: raw.custo === 'ultimo' ? 'ultimo' : 'medio',
    itens,
  };
  if (typeof raw.aplicadoEm === 'string') l.aplicadoEm = raw.aplicadoEm;
  return l;
}

function lerVenda(raw: unknown): Venda | null {
  if (!isObj(raw) || !Array.isArray(raw.itens) || typeof raw.quando !== 'string') return null;
  const itens: VendaItem[] = raw.itens.flatMap((i) =>
    isObj(i) && typeof i.produtoId === 'string' && num(i.qtd) != null && num(i.total) != null
      ? [{ produtoId: i.produtoId, nome: str(i.nome), qtd: i.qtd as number, unidade: str(i.unidade) || 'un', total: i.total as number, custo: num(i.custo) }]
      : [],
  );
  if (itens.length === 0) return null;
  const v: Venda = {
    id: str(raw.id) || newKey(),
    quando: raw.quando,
    itens,
    desconto: cent(raw.desconto),
    total: cent(raw.total),
    pagamento: str(raw.pagamento) || 'pix',
    pagamentoLabel: str(raw.pagamentoLabel) || 'Dinheiro ou Pix',
    taxa: cent(raw.taxa),
    cliente: str(raw.cliente),
  };
  if (typeof raw.cancelada === 'string') v.cancelada = raw.cancelada;
  return v;
}

function lerCompras(raw: unknown): ListaCompras | null {
  if (!isObj(raw)) return null;
  const itens = (Array.isArray(raw.itens) ? raw.itens : []).flatMap((i) =>
    isObj(i) && typeof i.produtoId === 'string' && num(i.qtd) != null && (i.qtd as number) > 0 ? [{ produtoId: i.produtoId, qtd: i.qtd as number, unidade: str(i.unidade) || 'kg' }] : [],
  );
  return { fornecedor: str(raw.fornecedor), telefone: str(raw.telefone), obs: str(raw.obs), itens };
}

function lerConfig(raw: unknown): Settings {
  const d = defaultSettings();
  if (!isObj(raw)) return d;
  const fixos: FixedCost[] = (Array.isArray(raw.custosFixos) ? raw.custosFixos : []).flatMap((c) =>
    isObj(c) && num(c.valor) != null ? [{ id: str(c.id) || newKey(), descricao: str(c.descricao), valor: c.valor as number }] : [],
  );
  const variaveis: VariableCost[] = (Array.isArray(raw.custosVariaveis) ? raw.custosVariaveis : []).flatMap((c) =>
    isObj(c) && num(c.valor) != null && (c.tipo === 'percentual' || c.tipo === 'valor' || c.tipo === 'percentualCusto')
      ? [lerVariavel(c)]
      : [],
  );
  const t = isObj(raw.taxas) ? raw.taxas : {};
  const parcelado: InstallmentFee[] = Array.isArray(t.parcelado)
    ? t.parcelado.flatMap((p) => (isObj(p) && num(p.parcelas) != null && num(p.taxa) != null ? [{ id: str(p.id) || newKey(), parcelas: p.parcelas as number, taxa: p.taxa as number }] : []))
    : d.taxas.parcelado;
  const m = isObj(raw.margem) ? raw.margem : {};
  const r = isObj(raw.rateio) ? raw.rateio : {};
  const cfg: Settings = {
    custosFixos: fixos,
    custosVariaveis: variaveis,
    perdaPct: numOr(raw.perdaPct, 0),
    taxas: { debito: numOr(t.debito, 0), creditoVista: numOr(t.creditoVista, 0), parcelado },
    pagamentoBase: str(raw.pagamentoBase) || 'credito_vista',
    margem: { modo: m.modo === 'markup' ? 'markup' : 'margem', valor: numOr(m.valor, d.margem.valor) },
    rateio: {
      metodo: r.metodo === 'quantidade' ? 'quantidade' : 'faturamento',
      faturamentoPrevisto: numOr(r.faturamentoPrevisto, 0),
      quantidadePrevista: numOr(r.quantidadePrevista, 0),
    },
  };
  if (Array.isArray(raw.lotes)) cfg.lotes = raw.lotes.flatMap((l) => {
    const x = lerLote(l);
    return x ? [x] : [];
  });
  if (Array.isArray(raw.vendas)) cfg.vendas = raw.vendas.flatMap((v) => {
    const x = lerVenda(v);
    return x ? [x] : [];
  });
  if (isObj(raw.balanca)) cfg.balanca = balancaDe(raw.balanca);
  const compras = lerCompras(raw.compras);
  if (compras) cfg.compras = compras;
  // forma de pagamento que não existe mais (ex.: parcela removida) volta para o crédito à vista
  if (!paymentOptions(cfg).some((p) => p.id === cfg.pagamentoBase)) cfg.pagamentoBase = 'credito_vista';
  return cfg;
}

function lerLoja(raw: unknown): StoreInfo {
  const d = defaultStore();
  if (!isObj(raw)) return d;
  const c = isObj(raw.cores) ? raw.cores : {};
  const cor = (v: unknown, def: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : def);
  return {
    nomeFantasia: str(raw.nomeFantasia, d.nomeFantasia),
    razaoSocial: str(raw.razaoSocial),
    cnpj: str(raw.cnpj),
    endereco: str(raw.endereco),
    telefone: str(raw.telefone),
    informacoes: str(raw.informacoes),
    logo: typeof raw.logo === 'string' && raw.logo.startsWith('data:image/') ? raw.logo : null,
    cores: { primaria: cor(c.primaria, d.cores.primaria), destaque: cor(c.destaque, d.cores.destaque), fundo: cor(c.fundo, d.cores.fundo) },
    ...(isObj(raw.vitrine) ? { vitrine: vitrineDe({ vitrine: raw.vitrine as unknown as StoreInfo['vitrine'] }) } : {}),
  };
}

/** Lê e valida o texto de um backup. Nunca lança: devolve o motivo em português quando não serve. */
export function lerBackup(texto: string): ResultadoBackup {
  const corte = texto.indexOf(SEPARADOR);
  const json = (corte >= 0 ? texto.slice(corte + SEPARADOR.length) : texto).trim();
  let dados: unknown;
  try {
    dados = JSON.parse(json);
  } catch {
    return { ok: false, motivo: 'Este arquivo não parece ser um backup deste sistema, ou foi editado e ficou incompleto.' };
  }
  if (!isObj(dados) || dados.app !== BACKUP_MARK) return { ok: false, motivo: 'Este arquivo não é um backup deste sistema.' };
  if (typeof dados.versao !== 'number' || dados.versao > BACKUP_VERSAO) return { ok: false, motivo: 'Este backup foi feito por uma versão mais nova do sistema e não pode ser aberto aqui.' };
  const l = dados.lista;
  if (!isObj(l) || !Array.isArray(l.produtos)) return { ok: false, motivo: 'O backup está sem a lista de produtos.' };

  const produtos: Product[] = [];
  let ignorados = 0;
  const ids = new Set<string>();
  for (const bruto of l.produtos) {
    const p = lerProduto(bruto);
    if (!p) {
      ignorados++;
      continue;
    }
    if (ids.has(p.id)) p.id = newId(); // id repetido: mantém os dois produtos
    ids.add(p.id);
    if (p.plu && produtos.some((x) => x.plu === p.plu)) delete p.plu; // código de balança repetido
    produtos.push(p);
  }
  const cats = (Array.isArray(l.categorias) ? l.categorias : []).filter((c): c is string => typeof c === 'string' && c.trim() !== '');
  for (const p of produtos) if (p.categoria && !cats.includes(p.categoria)) cats.push(p.categoria);

  return {
    ok: true,
    lista: { nome: str(l.nome) || 'Minha lista de preços', produtos, categorias: [...new Set(cats)] },
    loja: lerLoja(dados.loja),
    config: lerConfig(dados.config),
    geradoEm: typeof dados.geradoEm === 'string' ? dados.geradoEm : null,
    ignorados,
  };
}
