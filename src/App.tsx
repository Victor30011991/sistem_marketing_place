import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './pages/Layout';
import Home from './pages/Home';
const Loja = lazy(() => import('./pages/Loja'));
const Produtos = lazy(() => import('./pages/Produtos'));
const Categorias = lazy(() => import('./pages/Categorias'));
const Precificacao = lazy(() => import('./pages/Precificacao'));
const Importar = lazy(() => import('./pages/Importar'));
const Exportar = lazy(() => import('./pages/Exportar'));
const Orcamento = lazy(() => import('./pages/Orcamento'));
const Vitrine = lazy(() => import('./pages/Vitrine'));
const Lotes = lazy(() => import('./pages/Lotes'));
const Pdv = lazy(() => import('./pages/Pdv'));
const Compras = lazy(() => import('./pages/Compras'));
const Balanca = lazy(() => import('./pages/Balanca'));
const Etiquetas = lazy(() => import('./pages/Etiquetas'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Pedidos = lazy(() => import('./pages/Pedidos'));
const Contas = lazy(() => import('./pages/Contas'));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="loja" element={<Loja />} />
        <Route path="pagina" element={<Vitrine />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="lotes" element={<Lotes />} />
        <Route path="vendas" element={<Pdv />} />
        <Route path="compras" element={<Compras />} />
        <Route path="balanca" element={<Balanca />} />
        <Route path="etiquetas" element={<Etiquetas />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="pedidos" element={<Pedidos />} />
        <Route path="contas" element={<Contas />} />
        <Route path="categorias" element={<Categorias />} />
        <Route path="precificacao" element={<Precificacao />} />
        <Route path="orcamento" element={<Orcamento />} />
        <Route path="importar" element={<Importar />} />
        <Route path="pdf" element={<Exportar aba="pdf" />} />
        <Route path="excel" element={<Exportar aba="excel" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
