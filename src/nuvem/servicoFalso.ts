/**
 * Nuvem de mentira, só para testes automáticos (build com VITE_NUVEM_FALSA=1).
 * Guarda os "documentos" no localStorage e avisa as outras abas, simulando dois aparelhos.
 * No build normal este arquivo nem entra no site.
 */
import type { Pedido, Product, Registro, StoreInfo, Venda } from '../types';
import { pedidoDe } from '../core/clientes';
import { COLECOES, DEL, INC, type ItemColecao, type Op, type Raiz } from './modelo';
import type { Parte } from './servico';

const DB = 'falso.db';
const USU = 'falso.usuario';
type Docs = Record<string, Record<string, unknown>>;

const ler = (): Docs => JSON.parse(localStorage.getItem(DB) ?? '{}');
const ouvintes = new Set<() => void>();
window.addEventListener('storage', (e) => e.key === DB && ouvintes.forEach((f) => f()));
const avisar = () => setTimeout(() => ouvintes.forEach((f) => f()), 30);

let aoUsuario: ((u: { email: string; verificado: boolean } | null) => void) | null = null;
const usuario = () => {
  const e = localStorage.getItem(USU);
  return e ? { email: e, verificado: true } : null;
};

export function aoMudarUsuario(cb: (u: { email: string; verificado: boolean } | null) => void) {
  aoUsuario = cb;
  setTimeout(() => cb(usuario()), 10);
  return () => {
    aoUsuario = null;
  };
}
export async function entrar() {
  localStorage.setItem(USU, (window as unknown as { emailFalso?: string }).emailFalso ?? 'j.victor.baros.live@gmail.com');
  aoUsuario?.(usuario());
}
export async function sair() {
  localStorage.removeItem(USU);
  aoUsuario?.(null);
}

export function ouvir(inicio: string, cb: (p: Parte, servidor: boolean) => void) {
  const emitir = () => {
    const d = ler();
    const col = (c: string) => Object.entries(d).filter(([k]) => k.startsWith(`lojas/temperei/${c}/`)).map(([k, v]) => [k.split('/').at(-1)!, v] as const);
    cb({ parte: 'raiz', valor: (d['lojas/temperei'] as unknown as Raiz) ?? null }, true);
    cb({ parte: 'loja', valor: (d['lojas/temperei/meta/loja'] as unknown as StoreInfo) ?? null }, true);
    cb({ parte: 'produtos', valor: new Map(col('produtos').map(([id, v]) => [id, { ...(v as unknown as Product), id }])) }, true);
    cb({ parte: 'dias', valor: new Map(col('vendasDia').filter(([id, v]) => id >= inicio && v.v && Object.keys(v.v).length).map(([id, v]) => [id, v.v as Record<string, Venda>])) }, true);
    for (const c of COLECOES) cb({ parte: c, valor: new Map(col(c).map(([id, v]) => [id, { ...v, id } as ItemColecao])) }, true);
  };
  ouvintes.add(emitir);
  setTimeout(emitir, 20);
  return () => {
    ouvintes.delete(emitir);
  };
}

function resolver(atual: unknown, v: unknown): unknown {
  if (v && typeof v === 'object' && INC in v) return (typeof atual === 'number' ? atual : 0) + (v as Record<string, number>)[INC];
  if (v && typeof v === 'object' && DEL in v) return undefined;
  return v;
}

export async function gravar(ops: Op[]) {
  // como o servidor de verdade: uma gravação de cada vez, mesmo com várias abas
  await navigator.locks.request('falso.db', async () => aplicarNoBanco(ops));
  avisar();
}

function aplicarNoBanco(ops: Op[]) {
  const d = ler();
  for (const op of ops) {
    const k = op.caminho.join('/');
    if (op.apagar) delete d[k];
    else if (!op.campos) d[k] = JSON.parse(JSON.stringify(op.dados));
    else {
      const doc = (d[k] ??= {});
      for (const campo of op.campos) {
        let alvo: Record<string, unknown> = doc;
        let fonte: unknown = op.dados;
        for (const p of campo.slice(0, -1)) {
          alvo = (alvo[p] ??= {}) as Record<string, unknown>;
          fonte = (fonte as Record<string, unknown>)[p];
        }
        const ult = campo.at(-1)!;
        const val = resolver(alvo[ult], (fonte as Record<string, unknown>)[ult]);
        if (val === undefined) delete alvo[ult];
        else alvo[ult] = JSON.parse(JSON.stringify(val));
      }
    }
  }
  localStorage.setItem(DB, JSON.stringify(d));
}

export async function publicarCardapio(json: string) {
  localStorage.setItem('falso.cardapio', json);
}

// pedidos: guardados em falso.pedidos (id -> dados), como a coleção pública
const lerPedidos = (): Record<string, unknown> => JSON.parse(localStorage.getItem('falso.pedidos') ?? '{}');
export function ouvirPedidos(desde: string, cb: (lista: Pedido[]) => void) {
  const emitir = () => cb(Object.entries(lerPedidos()).flatMap(([id, v]) => {
    const p = pedidoDe(id, v);
    return p && p.criado >= desde ? [p] : [];
  }));
  const ao = (e: StorageEvent) => e.key === 'falso.pedidos' && emitir();
  window.addEventListener('storage', ao);
  setTimeout(emitir, 20);
  return () => window.removeEventListener('storage', ao);
}
export async function mudarPedido(id: string, patch: Partial<Pedido>) {
  const t = lerPedidos();
  t[id] = { ...(t[id] as object), ...patch };
  localStorage.setItem('falso.pedidos', JSON.stringify(t));
  window.dispatchEvent(new StorageEvent('storage', { key: 'falso.pedidos' }));
}

export async function registrar(regs: Registro[]) {
  const l: Registro[] = JSON.parse(localStorage.getItem('falso.historico') ?? '[]');
  localStorage.setItem('falso.historico', JSON.stringify([...l, ...regs]));
}
export async function lerHistorico(max = 300): Promise<Registro[]> {
  const l: Registro[] = JSON.parse(localStorage.getItem('falso.historico') ?? '[]');
  return l.sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, max);
}

type Copia = { id: string; quando: string; produtos: number; tamanho: number; gz: string };
const lerCopias = (): Copia[] => JSON.parse(localStorage.getItem('falso.copias') ?? '[]');
export async function salvarCopia(c: Copia) {
  localStorage.setItem('falso.copias', JSON.stringify([...lerCopias().filter((x) => x.id !== c.id), c]));
}
export async function listarCopias() {
  return lerCopias()
    .sort((a, b) => b.quando.localeCompare(a.quando))
    .map(({ gz: _g, ...i }) => i);
}
export async function lerCopia(id: string) {
  return lerCopias().find((c) => c.id === id)?.gz ?? null;
}
export async function apagarCopia(id: string) {
  localStorage.setItem('falso.copias', JSON.stringify(lerCopias().filter((c) => c.id !== id)));
}
