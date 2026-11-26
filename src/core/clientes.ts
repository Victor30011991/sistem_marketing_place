/** Clientes: cadastro, busca, histórico de compras e quem sumiu. */
import { cupomDoTexto } from './cupons';
import type { Cliente, OrcamentoSalvo, Pedido, Product, SituacaoPedido, Venda, VendaPausada } from '../types';
import { diaLocal } from './vendas';
import { newId, norm } from './normalize';

export function novoCliente(d: Partial<Cliente> = {}): Cliente {
  return { id: newId(), nome: (d.nome ?? '').trim(), telefone: (d.telefone ?? '').trim(), endereco: (d.endereco ?? '').trim(), obs: d.obs ?? '', criado: new Date().toISOString() };
}

/** Os 8 últimos dígitos bastam para reconhecer o mesmo número escrito de jeitos diferentes. */
const fimFone = (t: string) => t.replace(/\D/g, '').slice(-8);

/** Acha o cliente pelo telefone; sem telefone, pelo nome exato (sem acento e maiúsculas). */
export function acharCliente(lista: Cliente[], d: { nome?: string; telefone?: string }): Cliente | null {
  const f = fimFone(d.telefone ?? '');
  if (f.length === 8) {
    const c = lista.find((x) => fimFone(x.telefone) === f);
    if (c) return c;
  }
  const n = norm(d.nome ?? '');
  return n ? lista.find((x) => norm(x.nome) === n) ?? null : null;
}

/**
 * Liga um nome/telefone a um cliente: acha o que já existe ou cria um novo (só se tiver telefone, para não encher
 * o cadastro de nomes soltos). Devolve a lista nova e o id.
 */
export function ligarCliente(lista: Cliente[], d: { nome: string; telefone?: string; endereco?: string }): { lista: Cliente[]; id: string | null } {
  const achou = acharCliente(lista, d);
  if (achou) {
    // completa o que faltava, sem apagar nada
    const atual = { ...achou, telefone: achou.telefone || (d.telefone ?? '').trim(), endereco: achou.endereco || (d.endereco ?? '').trim() };
    return { lista: lista.map((x) => (x.id === achou.id ? atual : x)), id: achou.id };
  }
  if (!d.nome.trim() || fimFone(d.telefone ?? '').length < 8) return { lista, id: null };
  const c = novoCliente(d);
  return { lista: [...lista, c], id: c.id };
}

export interface Historico {
  compras: number;
  total: number;
  ticket: number;
  /** AAAA-MM-DD */
  ultima: string | null;
  diasSemComprar: number | null;
  favoritos: { nome: string; total: number }[];
  vendas: Venda[];
  orcamentos: OrcamentoSalvo[];
}

export const ehDele = (c: Cliente, v: { clienteId?: string; cliente: string }) => v.clienteId === c.id || (!v.clienteId && !!c.nome && norm(v.cliente) === norm(c.nome));

export function historico(c: Cliente, vendas: Venda[], orcamentos: OrcamentoSalvo[] = [], hoje = new Date()): Historico {
  const minhas = vendas.filter((v) => !v.cancelada && ehDele(c, v)).sort((a, b) => b.quando.localeCompare(a.quando));
  const total = minhas.reduce((a, v) => a + v.total, 0);
  const fav = new Map<string, { nome: string; total: number }>();
  for (const v of minhas) for (const i of v.itens) {
    const x = fav.get(i.produtoId) ?? { nome: i.nome, total: 0 };
    x.total += i.total;
    fav.set(i.produtoId, x);
  }
  const ultima = minhas[0] ? diaLocal(minhas[0].quando) : null;
  const dias = ultima ? Math.round((new Date(diaLocal(hoje) + 'T12:00').getTime() - new Date(ultima + 'T12:00').getTime()) / 86400000) : null;
  return {
    compras: minhas.length,
    total,
    ticket: minhas.length ? Math.round(total / minhas.length) : 0,
    ultima,
    diasSemComprar: dias,
    favoritos: [...fav.values()].sort((a, b) => b.total - a.total).slice(0, 3),
    vendas: minhas,
    orcamentos: orcamentos.filter((o) => o.clienteId === c.id || (!o.clienteId && norm(o.cliente.nome) === norm(c.nome) && !!c.nome)),
  };
}

/** Mensagem curta para chamar de volta quem não compra há um tempo. */
export function mensagemSaudade(c: Cliente, loja: string, favorito?: string): string {
  const primeiro = c.nome.trim().split(/\s+/)[0] || '';
  return `Oi${primeiro ? `, ${primeiro}` : ''}! Aqui é da ${loja} 🌿 Faz um tempinho que você não passa por aqui.${favorito ? ` Seu ${favorito} já está acabando?` : ''} Chegaram novidades fresquinhas, quer que eu separe algo para você?`;
}

export function clientesDe(raw: unknown): Cliente[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  return raw.flatMap((x) => {
    if (!x || typeof x !== 'object') return [];
    const o = x as Record<string, unknown>;
    if (!s(o.nome).trim()) return [];
    const c: Cliente = { id: s(o.id) || newId(), nome: s(o.nome), telefone: s(o.telefone), endereco: s(o.endereco), obs: s(o.obs), criado: s(o.criado) };
    if (/^\d{2}-\d{2}$/.test(s(o.aniversario))) c.aniversario = s(o.aniversario);
    if (Array.isArray(o.resgates)) c.resgates = o.resgates.filter((r): r is string => typeof r === 'string').slice(-200);
    return [c];
  });
}

// ---------------------------------------------------------------- pedidos do catálogo

export const SITUACOES_PEDIDO: { id: SituacaoPedido; rotulo: string; acao?: string }[] = [
  { id: 'novo', rotulo: 'Novos', acao: 'Começar a separar' },
  { id: 'separando', rotulo: 'Separando', acao: 'Marcar como pronto' },
  { id: 'pronto', rotulo: 'Prontos' },
  { id: 'entregue', rotulo: 'Entregues' },
  { id: 'cancelado', rotulo: 'Cancelados' },
];

/** Lê um pedido vindo da nuvem (escrito pela página pública: confira tudo). */
export function pedidoDe(id: string, raw: unknown): Pedido | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  const itens = (Array.isArray(o.itens) ? o.itens : []).slice(0, 80).flatMap((x) => {
    if (!x || typeof x !== 'object') return [];
    const i = x as Record<string, unknown>;
    return s(i.n, 120) && n(i.g) > 0 ? [{ ...(s(i.i, 64) ? { i: s(i.i, 64) } : {}), n: s(i.n, 120), g: n(i.g), t: Math.round(n(i.t)), ...(s(i.u, 40) ? { u: s(i.u, 40) } : {}) }] : [];
  });
  if (!itens.length) return null;
  const sit = SITUACOES_PEDIDO.some((x) => x.id === o.situacao) ? (o.situacao as SituacaoPedido) : 'novo';
  const soma = itens.reduce((a, i) => a + i.t, 0);
  const cup = cupomDoTexto(s(o.obs, 500));
  const desconto = cup ? Math.min(cup.desconto, soma) : 0;
  return {
    id,
    criado: s(o.criado, 40),
    nome: s(o.nome, 80),
    telefone: s(o.telefone, 30),
    endereco: s(o.endereco, 300),
    obs: s(o.obs, 500),
    itens,
    total: soma - desconto,
    origem: s(o.origem, 20),
    situacao: sit,
    ...(cup && desconto ? { cupom: cup.cupom, desconto } : {}),
    ...(s(o.vendaPausada, 64) ? { vendaPausada: s(o.vendaPausada, 64) } : {}),
  };
}

/** Pedido → venda pausada no PDV, com os mesmos valores. Itens que não existem mais ficam de fora. */
export function pedidoParaPdv(p: Pedido, produtos: Product[], clienteId: string | null): { venda: VendaPausada; faltando: string[] } {
  const faltando: string[] = [];
  const linhas = p.itens.flatMap((i) => {
    const prod = (i.i && produtos.find((x) => x.id === i.i)) || produtos.find((x) => norm(x.nome) === norm(i.n));
    if (!prod) {
      faltando.push(i.n);
      return [];
    }
    return [{ produtoId: prod.id, qtd: i.g, unidade: i.u ? prod.unidade : 'g', total: i.t }];
  });
  return {
    venda: { id: newId(), quando: new Date().toISOString(), cliente: `${p.nome || 'Cliente'} (pedido)`, ...(clienteId ? { clienteId } : {}), linhas, ...(p.desconto ? { desconto: p.desconto } : {}) },
    faltando,
  };
}
