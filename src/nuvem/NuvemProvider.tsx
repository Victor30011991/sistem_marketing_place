import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../state/store';
import { montarCardapio } from '../core/vitrine';
import { registrosDe } from '../core/historico';
import { criarBackup } from '../core/backup';
import { compactar } from '../core/compactar';
import { Button, Modal } from '../ui/ui';
import { COLECOES, dividir, igual, inicioJanela, juntar, nuvemVazia, planejarEscritas, type Nuvem } from './modelo';
import type { Parte } from './servico';

type Servico = typeof import('./servico');

/** Quem pode entrar. A mesma lista está nas regras do Firestore (é lá que vale de verdade). */
export const EQUIPE = ['j.victor.baros.live@gmail.com', 'samara778@gmail.com'];
/** Nome curto de quem está usando, para gravar em vendas, caixa e histórico. */
export const NOMES: Record<string, string> = { 'j.victor.baros.live@gmail.com': 'Victor', 'samara778@gmail.com': 'Samara' };
export const nomeDe = (email: string) => NOMES[email] ?? (email ? email.split('@')[0] : '');
const MARCA = 'temperei.nuvem';

export type Fase = 'desligado' | 'carregando' | 'sincronizando' | 'escolher' | 'conectado' | 'negado' | 'erro';

interface NuvemCtx {
  fase: Fase;
  email: string;
  online: boolean;
  /** gravações esperando a confirmação da internet */
  enviando: boolean;
  erro: string;
  /** ligação com o Firebase (null até alguém entrar) */
  servico: Servico | null;
  entrar: () => void;
  sair: () => void;
  tentarDeNovo: () => void;
}

const Ctx = createContext<NuvemCtx | null>(null);

const lerMarca = () => {
  try {
    return localStorage.getItem(MARCA) === '1';
  } catch {
    return false;
  }
};
const marcar = (v: boolean) => {
  try {
    if (v) localStorage.setItem(MARCA, '1');
    else localStorage.removeItem(MARCA);
  } catch {
    /* navegador sem armazenamento: só não entra sozinho da próxima vez */
  }
};

type Recebido = Record<string, boolean>;
const plural = (n: number) => `${n} produto${n === 1 ? '' : 's'}`;
const nadaRecebido = (): Recebido => Object.fromEntries(['raiz', 'loja', 'produtos', 'dias', ...COLECOES].map((k) => [k, false]));

export function NuvemProvider({ children }: { children: ReactNode }) {
  const { state, act } = useApp();
  const [fase, setFase] = useState<Fase>(() => (lerMarca() ? 'carregando' : 'desligado'));
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [pendentes, setPendentes] = useState(0);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  const svc = useRef<Servico | null>(null);
  const [servico, setServico] = useState<Servico | null>(null);
  const base = useRef<Nuvem>(nuvemVazia());
  const recebido = useRef<Recebido>(nadaRecebido());
  const raizDoServidor = useRef(false);
  const pararOuvir = useRef<(() => void) | null>(null);
  const pararLogin = useRef<(() => void) | null>(null);
  const ultimoCardapio = useRef('');
  const stateRef = useRef(state);
  stateRef.current = state;
  const faseRef = useRef(fase);
  const emailRef = useRef('');
  emailRef.current = email;

  const ir = useCallback((f: Fase) => {
    faseRef.current = f;
    setFase(f);
  }, []);

  const falhar = useCallback(
    (e: unknown) => {
      const code = (e as { code?: string }).code ?? '';
      setErro(
        code === 'permission-denied'
          ? 'A nuvem recusou o acesso. Confira se as regras de segurança foram coladas no Firebase.'
          : 'Não foi possível falar com a nuvem. Os dados continuam neste aparelho.',
      );
      ir('erro');
    },
    [ir],
  );

  /** Envia o que mudou neste aparelho desde a última vez. */
  const enviar = useCallback(() => {
    const s = svc.current;
    if (!s) return;
    const atual = dividir(stateRef.current);
    const ops = planejarEscritas(base.current, atual);
    if (!ops.length) return;
    const regs = registrosDe(base.current, atual, nomeDe(emailRef.current));
    if (regs.length) s.registrar(regs).catch(() => undefined);
    base.current = atual;
    setPendentes((n) => n + 1);
    s.gravar(ops)
      .catch(falhar)
      .finally(() => setPendentes((n) => n - 1));
    // o aparelho guarda a fila mesmo se a página fechar: já pode considerar salvo
    act.salvo();
  }, [act, falhar]);

  /** Mostra na tela o que está na nuvem. */
  const aplicar = useCallback(() => {
    const atual = stateRef.current;
    if (igual(dividir(atual), base.current)) return;
    const novo = juntar(base.current, atual);
    // a tela só redesenha depois; até lá, outras respostas da nuvem já precisam enxergar o estado novo
    stateRef.current = { ...atual, ...novo, sujo: false, intacto: false };
    act.nuvem(novo);
  }, [act]);

  const receber = useCallback(
    (p: Parte, servidor: boolean) => {
      // antes de trocar a tela pelo que chegou, manda o que ainda estava esperando para subir
      if (faseRef.current === 'conectado') enviar();
      base.current = (COLECOES as readonly string[]).includes(p.parte) ? { ...base.current, col: { ...base.current.col, [p.parte]: p.valor } } : { ...base.current, [p.parte]: p.valor };
      recebido.current[p.parte] = true;
      if (p.parte === 'raiz' && servidor) raizDoServidor.current = true;

      if (faseRef.current === 'conectado') return aplicar();
      if (faseRef.current !== 'sincronizando') return;
      if (!Object.values(recebido.current).every(Boolean)) return;
      if (base.current.raiz) {
        if (stateRef.current.intacto) {
          ir('conectado');
          aplicar();
        } else ir('escolher');
      } else if (raizDoServidor.current) {
        // nuvem vazia (primeira vez): sobe tudo o que está neste aparelho
        ir('conectado');
        enviar();
      }
    },
    [aplicar, enviar, ir],
  );

  const ouvir = useCallback(() => {
    pararOuvir.current?.();
    base.current = nuvemVazia();
    recebido.current = nadaRecebido();
    raizDoServidor.current = false;
    ultimoCardapio.current = '';
    setErro('');
    ir('sincronizando');
    pararOuvir.current = svc.current!.ouvir(inicioJanela(), receber, falhar);
  }, [falhar, ir, receber]);

  const iniciar = useCallback(async () => {
    if (pararLogin.current) return svc.current!;
    // VITE_NUVEM_FALSA só existe nos testes automáticos; no site, sempre o Firebase de verdade
    const s = (svc.current ??= import.meta.env.VITE_NUVEM_FALSA ? ((await import('./servicoFalso')) as unknown as Servico) : await import('./servico'));
    setServico(s);
    if (pararLogin.current) return s;
    pararLogin.current = s.aoMudarUsuario((u) => {
      pararOuvir.current?.();
      pararOuvir.current = null;
      if (!u) {
        if (faseRef.current !== 'negado') ir('desligado');
        return;
      }
      setEmail(u.email);
      if (!u.verificado || !EQUIPE.includes(u.email)) {
        ir('negado');
        marcar(false);
        void s.sair();
        return;
      }
      marcar(true);
      ouvir();
    });
    return s;
  }, [ir, ouvir]);

  // quem já entrou antes volta conectado sozinho
  useEffect(() => {
    if (lerMarca()) iniciar().catch(falhar);
    return () => {
      pararLogin.current?.();
      pararLogin.current = null;
      pararOuvir.current?.();
      pararOuvir.current = null;
    };
  }, [iniciar, falhar]);

  // alterações feitas aqui sobem sozinhas, um instante depois
  useEffect(() => {
    if (fase !== 'conectado') return;
    const t = setTimeout(enviar, 700);
    return () => clearTimeout(t);
  }, [state.lista, state.loja, state.config, fase, enviar]);

  // ao fechar ou trocar de aba, envia na hora
  useEffect(() => {
    const h = () => faseRef.current === 'conectado' && enviar();
    const vis = () => document.visibilityState === 'hidden' && h();
    window.addEventListener('pagehide', h);
    document.addEventListener('visibilitychange', vis);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('pagehide', h);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [enviar]);

  // uma vez por semana, guarda uma cópia compactada de tudo na própria nuvem (as 8 mais novas)
  useEffect(() => {
    if (fase !== 'conectado') return;
    const t = setTimeout(async () => {
      const s = svc.current;
      const st = stateRef.current;
      const ultima = st.config.ultimaCopia ? Date.parse(st.config.ultimaCopia) : 0;
      if (!s || !st.lista.produtos.length || Date.now() - ultima < 7 * 86400000) return;
      try {
        const texto = criarBackup(st.lista, st.loja, st.config);
        const gz = await compactar(texto);
        if (!gz || gz.length > 900_000) return;
        const quando = new Date().toISOString();
        await s.salvarCopia({ id: quando.slice(0, 10), quando, produtos: st.lista.produtos.length, tamanho: gz.length, gz });
        act.config((c) => ({ ...c, ultimaCopia: quando }));
        const todas = await s.listarCopias();
        await Promise.all(todas.slice(8).map((c) => s.apagarCopia(c.id)));
      } catch {
        /* tenta de novo na próxima abertura */
      }
    }, 8000);
    return () => clearTimeout(t);
  }, [fase, act]);

  // o cardápio do cliente se atualiza sozinho (só nome, categoria e preço)
  useEffect(() => {
    if (fase !== 'conectado') return;
    const t = setTimeout(() => {
      const { arquivo } = montarCardapio(state.lista, state.loja, state.loja.logo);
      const chave = JSON.stringify({ ...arquivo, gerado: '' });
      if (chave === ultimoCardapio.current) return;
      ultimoCardapio.current = chave;
      svc.current?.publicarCardapio(JSON.stringify(arquivo)).catch((e) => {
        ultimoCardapio.current = '';
        falhar(e);
      });
    }, 2500);
    return () => clearTimeout(t);
  }, [state.lista, state.loja, fase, falhar]);

  const entrar = useCallback(() => {
    setErro('');
    ir('carregando');
    iniciar()
      .then((s) => s.entrar())
      .catch(() => {
        setErro('Não foi possível entrar. Confira a internet e tente de novo.');
        ir('desligado');
      })
      .finally(() => {
        if (faseRef.current === 'carregando') ir('desligado');
      });
  }, [iniciar, ir]);

  const sair = useCallback(() => {
    enviar();
    pararOuvir.current?.();
    pararOuvir.current = null;
    marcar(false);
    ir('desligado');
    void svc.current?.sair();
  }, [enviar, ir]);

  const tentarDeNovo = useCallback(() => {
    if (svc.current && email) ouvir();
    else entrar();
  }, [email, entrar, ouvir]);

  const escolher = (origem: 'nuvem' | 'aparelho') => {
    ir('conectado');
    if (origem === 'nuvem') aplicar();
    else enviar();
  };

  const value = useMemo<NuvemCtx>(
    () => ({ fase, email, online, enviando: pendentes > 0, erro, servico, entrar, sair, tentarDeNovo }),
    [fase, email, online, pendentes, erro, servico, entrar, sair, tentarDeNovo],
  );

  const nuvemTem = base.current.produtos.size;
  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal
        open={fase === 'escolher'}
        title="Qual lista vale?"
        onClose={() => escolher('nuvem')}
        footer={
          <>
            <Button variant="secondary" onClick={() => escolher('aparelho')}>
              Usar a deste aparelho
            </Button>
            <Button onClick={() => escolher('nuvem')}>Usar a da nuvem</Button>
          </>
        }
      >
        <p>
          A nuvem já tem dados ({plural(nuvemTem)}) e esta tela também ({plural(state.lista.produtos.length)}).
        </p>
        <p>
          <strong>Usar a da nuvem</strong> troca o que está nesta tela pelo que vocês já têm guardado. É o mais comum.
        </p>
        <p className="muted">
          <strong>Usar a deste aparelho</strong> substitui o que está na nuvem pelo que está aqui (produtos que não estão aqui são apagados de lá). Use só se esta tela for a versão mais nova.
        </p>
      </Modal>
    </Ctx.Provider>
  );
}

/** Nome de quem está usando (vazio fora da nuvem). */
export function useQuem(): string {
  const n = useNuvem();
  return n.fase === 'conectado' ? nomeDe(n.email) : '';
}

export function useNuvem() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNuvem fora do NuvemProvider');
  return c;
}
