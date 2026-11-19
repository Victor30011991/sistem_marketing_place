import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useApp } from '../state/store';
import { Icon } from '../ui/icons';
import { logoSrc } from '../ui/logo';
import { useSaveBackup, useSaveExcel } from '../export/useSave';
import { NuvemBox } from '../nuvem/NuvemBox';
import { useNuvem } from '../nuvem/NuvemProvider';

const NAV = [
  { to: '/', label: 'Início', icon: 'home', end: true },
  { to: '/loja', label: 'Minha loja', icon: 'store' },
  { to: '/pagina', label: 'Página da loja', icon: 'menu' },
  { to: '/produtos', label: 'Produtos', icon: 'box' },
  { to: '/vendas', label: 'Vendas (PDV)', icon: 'cart' },
  { to: '/lotes', label: 'Lotes de compra', icon: 'truck' },
  { to: '/compras', label: 'Lista de compras', icon: 'list' },
  { to: '/balanca', label: 'Balança', icon: 'scale' },
  { to: '/etiquetas', label: 'Etiquetas', icon: 'label' },
  { to: '/categorias', label: 'Categorias', icon: 'tag' },
  { to: '/precificacao', label: 'Precificação', icon: 'calc' },
  { to: '/orcamento', label: 'Orçamento', icon: 'file' },
  { to: '/importar', label: 'Importar arquivo', icon: 'upload' },
  { to: '/pdf', label: 'Gerar PDF', icon: 'pdf' },
  { to: '/excel', label: 'Salvar em Excel', icon: 'sheet' },
];

export default function Layout() {
  const { state } = useApp();
  const save = useSaveExcel();
  const backup = useSaveBackup();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const total = state.lista.produtos.length;
  const naNuvem = useNuvem().fase === 'conectado';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo">
            <img src={logoSrc(state.loja)} alt="" />
          </span>
          <span className="brand-text">
            <strong>{state.loja.nomeFantasia || 'Minha loja'}</strong>
            <small>Precificação</small>
          </span>
        </div>
        <nav className="nav" aria-label="Principal">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.to === '/produtos' && total > 0 && <em className="nav-count">{total}</em>}
            </NavLink>
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
        <Outlet />
      </main>
    </div>
  );
}
