import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Suspense, useEffect, useState } from 'react';
import { useApp } from '../state/store';
import { Icon } from '../ui/icons';
import { logoSrc } from '../ui/logo';
import { useSaveBackup, useSaveExcel } from '../export/useSave';
import { NuvemBox } from '../nuvem/NuvemBox';
import { useNuvem } from '../nuvem/NuvemProvider';
import { usePedidos } from '../nuvem/PedidosProvider';
import { saldo } from '../core/contas';
import { diaLocal } from '../core/vendas';

interface ItemNav {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}
/** Menu em grupos: o que se usa no balcão primeiro. */
const GRUPOS: { titulo: string; itens: ItemNav[] }[] = [
  { titulo: '', itens: [{ to: '/', label: 'Início', icon: 'home', end: true }] },
  {
    titulo: 'Vender',
    itens: [
      { to: '/vendas', label: 'Vendas (PDV)', icon: 'cart' },
      { to: '/pedidos', label: 'Pedidos', icon: 'list' },
      { to: '/orcamento', label: 'Orçamento', icon: 'file' },
      { to: '/clientes', label: 'Clientes', icon: 'user' },
      { to: '/contas', label: 'Contas e fiado', icon: 'calc' },
    ],
  },
  {
    titulo: 'Estoque',
    itens: [
      { to: '/produtos', label: 'Produtos', icon: 'box' },
      { to: '/lotes', label: 'Lotes de compra', icon: 'truck' },
      { to: '/compras', label: 'Lista de compras', icon: 'list' },
      { to: '/etiquetas', label: 'Etiquetas', icon: 'label' },
      { to: '/balanca', label: 'Balança', icon: 'scale' },
      { to: '/categorias', label: 'Categorias', icon: 'tag' },
    ],
  },
  {
    titulo: 'Loja',
    itens: [
      { to: '/loja', label: 'Minha loja', icon: 'store' },
      { to: '/pagina', label: 'Página da loja', icon: 'menu' },
      { to: '/precificacao', label: 'Precificação', icon: 'calc' },
    ],
  },
  {
    titulo: 'Números e arquivos',
    itens: [
      { to: '/relatorios', label: 'Relatórios', icon: 'chart' },
      { to: '/pdf', label: 'Gerar PDF', icon: 'pdf' },
      { to: '/importar', label: 'Importar arquivo', icon: 'upload' },
      { to: '/excel', label: 'Salvar em Excel', icon: 'sheet' },
    ],
  },
];
/** Barra de baixo no celular: o essencial a um toque. */
const BARRA: ItemNav[] = [
  { to: '/', label: 'Início', icon: 'home', end: true },
  { to: '/vendas', label: 'PDV', icon: 'cart' },
  { to: '/pedidos', label: 'Pedidos', icon: 'list' },
  { to: '/produtos', label: 'Produtos', icon: 'box' },
];

export default function Layout() {
  const { state } = useApp();
  const save = useSaveExcel();
  const backup = useSaveBackup();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
    setMenu(false);
  }, [pathname]);
  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [menu]);
  const total = state.lista.produtos.length;
  const naNuvem = useNuvem().fase === 'conectado';
  const { novos } = usePedidos();
  const hoje = diaLocal(new Date());
  const vencidas = (state.config.contas ?? []).filter((c) => c.tipo === 'pagar' && saldo(c) > 0 && c.vencimento <= hoje).length;

  const selo = (to: string) =>
    to === '/produtos' && total > 0 ? (
      <em className="nav-count">{total}</em>
    ) : to === '/pedidos' && novos > 0 ? (
      <em className="nav-count nav-alerta">{novos}</em>
    ) : to === '/contas' && vencidas > 0 ? (
      <em className="nav-count nav-alerta" title="Contas a pagar vencidas ou vencendo hoje">
        {vencidas}
      </em>
    ) : null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo">
            <img src={logoSrc(state.loja)} alt="" />
          </span>
          <span className="brand-text">
            <strong>{state.loja.nomeFantasia || 'Minha loja'}</strong>
            <small>Sistema da loja</small>
          </span>
        </div>
        <nav className={`nav ${menu ? 'aberto' : ''}`} aria-label="Principal" id="menu-principal">
          {GRUPOS.map((g) => (
            <div key={g.titulo || 'inicio'} className="nav-grupo">
              {g.titulo && <span className="nav-titulo">{g.titulo}</span>}
              {g.itens.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Icon name={n.icon} />
                  <span>{n.label}</span>
                  {selo(n.to)}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="savebox">
          <span className="savebox-name" title={state.lista.nome}>
            {state.lista.nome}
          </span>
          <NuvemBox />
          <button type="button" className={`btn ${naNuvem ? 'btn-ghost-light' : 'btn-light'}`} onClick={save} disabled={total === 0 && !state.sujo}>
            <Icon name="save" /> Salvar em Excel
          </button>
          <button type="button" className="btn btn-ghost-light" onClick={backup} disabled={total === 0 && !state.sujo} title="Baixa um arquivo .txt com tudo o que está no sistema agora">
            <Icon name="download" /> Backup (.txt)
          </button>
        </div>
      </aside>
      <main className="main" id="conteudo">
        <Suspense fallback={<div className="page" aria-busy="true"><p className="muted">Abrindo…</p></div>}>
          <Outlet />
        </Suspense>
      </main>
      <nav className="barra-baixo" aria-label="Atalhos">
        {BARRA.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `barra-item ${isActive && !menu ? 'active' : ''}`}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
            {selo(n.to)}
          </NavLink>
        ))}
        <button type="button" className={`barra-item ${menu ? 'active' : ''}`} aria-expanded={menu} aria-controls="menu-principal" onClick={() => setMenu((m) => !m)}>
          <Icon name={menu ? 'x' : 'menu'} />
          <span>{menu ? 'Fechar' : 'Menu'}</span>
          {!menu && vencidas > 0 && <em className="nav-count nav-alerta">{vencidas}</em>}
        </button>
      </nav>
      {menu && <div className="menu-fundo" onClick={() => setMenu(false)} aria-hidden="true" />}
    </div>
  );
}
