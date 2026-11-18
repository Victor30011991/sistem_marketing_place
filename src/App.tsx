import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './pages/Layout';
import Home from './pages/Home';
import Loja from './pages/Loja';
import Produtos from './pages/Produtos';
import Categorias from './pages/Categorias';
import Precificacao from './pages/Precificacao';
import Importar from './pages/Importar';
import Exportar from './pages/Exportar';
import Orcamento from './pages/Orcamento';
import Vitrine from './pages/Vitrine';
import Lotes from './pages/Lotes';
import Pdv from './pages/Pdv';
import Compras from './pages/Compras';
import Balanca from './pages/Balanca';

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
