import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../state/store';
import { ligarCliente, pedidoParaPdv } from '../core/clientes';
import type { Pedido, SituacaoPedido } from '../types';
import { useNuvem } from './NuvemProvider';

interface Ctx {
  pedidos: Pedido[];
  /** pedidos novos ainda não abertos */
  novos: number;
  ativo: boolean;
  mudar: (id: string, situacao: SituacaoPedido) => void;
  /** põe o pedido no PDV como venda pausada; devolve os itens que não existem mais */
  paraPdv: (p: Pedido) => string[];
}
const PedCtx = createContext<Ctx | null>(null);

/** Um bip curto quando chega pedido (só depois que a pessoa já mexeu na página, regra dos navegadores). */
function bip() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    [0, 0.18].forEach((t) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.15);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + t);
      o.stop(ac.currentTime + t + 0.16);
    });
    setTimeout(() => ac.close(), 600);
  } catch {
    /* sem som: tudo bem */
  }
}

const desde = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
};

export function PedidosProvider({ children }: { children: ReactNode }) {
  const { fase, servico } = useNuvem();
  const { state, act } = useApp();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const conhecidos = useRef<Set<string> | null>(null);
  const ativo = fase === 'conectado' && !!servico;

  useEffect(() => {
    if (!ativo) {
      setPedidos([]);
      conhecidos.current = null;
      return;
    }
    return servico!.ouvirPedidos(
      desde(),
      (lista) => {
        const ord = [...lista].sort((a, b) => b.criado.localeCompare(a.criado));
        const ids = new Set(ord.filter((p) => p.situacao === 'novo').map((p) => p.id));
        if (conhecidos.current && [...ids].some((id) => !conhecidos.current!.has(id))) bip();
        conhecidos.current = new Set([...(conhecidos.current ?? []), ...ids]);
        setPedidos(ord);
      },
      () => setPedidos([]),
    );
  }, [ativo, servico]);

  const novos = pedidos.filter((p) => p.situacao === 'novo').length;
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, '');
    document.title = novos ? `(${novos}) ${base}` : base;
  }, [novos]);

  const mudar = useCallback((id: string, situacao: SituacaoPedido) => {
    setPedidos((l) => l.map((p) => (p.id === id ? { ...p, situacao } : p)));
    void servico?.mudarPedido(id, { situacao });
  }, [servico]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const paraPdv = useCallback(
    (p: Pedido) => {
      const s = stateRef.current;
      const lig = ligarCliente(s.config.clientes ?? [], { nome: p.nome, telefone: p.telefone, endereco: p.endereco });
      const { venda, faltando } = pedidoParaPdv(p, s.lista.produtos, lig.id);
      act.config((c) => ({ ...c, clientes: lig.lista, vendasPausadas: [...(c.vendasPausadas ?? []), venda] }));
      setPedidos((l) => l.map((x) => (x.id === p.id ? { ...x, situacao: 'entregue', vendaPausada: venda.id } : x)));
      void servico?.mudarPedido(p.id, { situacao: 'entregue', vendaPausada: venda.id });
      return faltando;
    },
    [act, servico],
  );

  const value = useMemo(() => ({ pedidos, novos, ativo, mudar, paraPdv }), [pedidos, novos, ativo, mudar, paraPdv]);
  return <PedCtx.Provider value={value}>{children}</PedCtx.Provider>;
}

export function usePedidos() {
  const c = useContext(PedCtx);
  if (!c) throw new Error('usePedidos fora do PedidosProvider');
  return c;
}
