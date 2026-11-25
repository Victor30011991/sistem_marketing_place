/**
 * Cupons do catálogo: a loja cadastra, o cliente digita no pedido e o desconto vai na mensagem,
 * no pedido da nuvem (escrito nas observações) e na venda do PDV.
 */
import type { CupomCardapio } from '../types';
import { newId } from './normalize';
import { formatBRL } from './money';

export const CUPONS_MAX = 30;

/** "primeira 10" → "PRIMEIRA10": só letras e números, até 20. */
export function limparCodigo(c: string): string {
  return c
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
}

export function novoCupom(): CupomCardapio {
  return { id: newId(), codigo: '', tipo: 'pct', valor: 10, minimo: 0, ativo: true };
}

export function cuponsDe(raw: unknown): CupomCardapio[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, CUPONS_MAX).flatMap((x): CupomCardapio[] => {
    if (!x || typeof x !== 'object') return [];
    const o = x as Record<string, unknown>;
    const tipo = o.tipo === 'valor' ? 'valor' : 'pct';
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
    const valor = tipo === 'pct' ? Math.min(90, n(o.valor)) : n(o.valor);
    const c: CupomCardapio = {
      id: typeof o.id === 'string' && o.id ? o.id : newId(),
      codigo: limparCodigo(typeof o.codigo === 'string' ? o.codigo : ''),
      tipo,
      valor,
      minimo: n(o.minimo),
      ativo: o.ativo !== false,
    };
    if (typeof o.ate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.ate)) c.ate = o.ate;
    if (typeof o.nota === 'string' && o.nota.trim()) c.nota = o.nota.trim().slice(0, 80);
    return [c];
  });
}

/** Dia local AAAA-MM-DD. */
export function hojeISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function cupomValendo(c: CupomCardapio, hoje = hojeISO()): boolean {
  return c.ativo && !!c.codigo && c.valor > 0 && (!c.ate || c.ate >= hoje);
}

/** Para o catálogo público: c = código, t = p (%) ou v (centavos), v = valor, m = mínimo, a = até. */
export interface CupomPublicado {
  c: string;
  t: 'p' | 'v';
  v: number;
  m: number;
  a?: string;
}

export function cuponsParaCardapio(cupons: CupomCardapio[], hoje = hojeISO()): CupomPublicado[] {
  const vistos = new Set<string>();
  return cupons
    .filter((c) => cupomValendo(c, hoje))
    .filter((c) => !vistos.has(c.codigo) && vistos.add(c.codigo))
    .map((c) => ({ c: c.codigo, t: c.tipo === 'pct' ? 'p' : 'v', v: c.valor, m: c.minimo, ...(c.ate ? { a: c.ate } : {}) }));
}

/** Mesma conta do catálogo (lib.js avaliarCupom). */
export function avaliarCupom(cupons: CupomPublicado[], codigo: string, sub: number, hoje = hojeISO()): { ok: true; codigo: string; desconto: number } | { ok: false; erro: string } {
  const cod = limparCodigo(codigo);
  if (!cod) return { ok: false, erro: 'Digite o cupom.' };
  const c = cupons.find((x) => x.c === cod);
  if (!c) return { ok: false, erro: 'Esse cupom não existe. Confira as letras.' };
  if (c.a && c.a < hoje) return { ok: false, erro: 'Esse cupom já venceu.' };
  if (c.m > 0 && sub < c.m) return { ok: false, erro: `Esse cupom vale para pedidos a partir de ${formatBRL(c.m)}.` };
  const desconto = Math.min(sub, c.t === 'p' ? Math.round((sub * c.v) / 100) : c.v);
  return { ok: true, codigo: cod, desconto };
}

export function textoCupom(c: CupomCardapio): string {
  const quanto = c.tipo === 'pct' ? `${c.valor}% de desconto` : `${formatBRL(c.valor)} de desconto`;
  const min = c.minimo > 0 ? ` em pedidos a partir de ${formatBRL(c.minimo)}` : '';
  const ate = c.ate ? ` até ${c.ate.split('-').reverse().slice(0, 2).join('/')}` : '';
  return `${quanto}${min}${ate}`;
}

/** O catálogo escreve "Cupom PRIMEIRA10 (− R$ 5,00)" nas observações do pedido. */
export function cupomDoTexto(obs: string): { cupom: string; desconto: number } | null {
  const m = /Cupom ([A-Z0-9]{1,20}) \(− R\$\s?([\d.]+,\d{2})\)/.exec(obs);
  if (!m) return null;
  const centavos = Math.round(Number(m[2].replace(/\./g, '').replace(',', '.')) * 100);
  return Number.isFinite(centavos) && centavos > 0 ? { cupom: m[1], desconto: centavos } : null;
}

/** Final da mensagem de saudade com o cupom e o link do catálogo ("volte e ganhe"). */
export function conviteCupom(c: CupomCardapio | null, link: string): string {
  const partes: string[] = [];
  if (c) partes.push(`Para matar a saudade: use o cupom *${c.codigo}* no pedido e ganhe ${textoCupom(c)}.`);
  if (link) partes.push(`Nosso catálogo: ${link}`);
  return partes.length ? '\n\n' + partes.join('\n') : '';
}
