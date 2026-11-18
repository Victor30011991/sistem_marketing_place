import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Empty, Field, PageHeader, downloadBlob } from '../ui/ui';
import { linhasCompra, listaVazia, textoCotacao } from '../core/compras';
import { parseNumberBR } from '../core/money';
import { norm, slug } from '../core/normalize';
import { logoDataUrl } from '../ui/logo';
import type { ListaCompras, Product } from '../types';

const n3 = (n: number) => String(Number(n.toFixed(3))).replace('.', ',');
type Filtro = 'todos' | 'acabou' | 'lista';

function QtdCompra({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [txt, setTxt] = useState(value ? n3(value) : '');
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      className="num-in"
      value={txt}
      onChange={(e) => {
        setTxt(e.target.value);
        const n = parseNumberBR(e.target.value);
        onChange(n != null && n > 0 ? n : 0);
      }}
    />
  );
}

export default function Compras() {
  useDocumentTitle('Lista de compras');
  const { state, act } = useApp();
  const { toast, confirm } = useFeedback();
  const { lista, config, loja } = state;
  const l: ListaCompras = config.compras ?? listaVazia();
  const set = (patch: Partial<ListaCompras>) => act.compras({ ...l, ...patch });
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [gerando, setGerando] = useState(false);

  const naLista = new Map(l.itens.map((i) => [i.produtoId, i]));
  const acabou = (p: Product) => p.estoque != null && p.estoque <= 0;
  const visiveis = useMemo(() => {
    const q = norm(busca);
    return lista.produtos
      .filter((p) => (!q || norm(p.nome).includes(q) || norm(p.categoria).includes(q)) && (filtro === 'todos' || (filtro === 'acabou' ? acabou(p) : naLista.has(p.id))))
      .sort((a, b) => (a.estoque ?? Infinity) - (b.estoque ?? Infinity) || a.nome.localeCompare(b.nome, 'pt-BR'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista.produtos, busca, filtro, l.itens]);
  const linhas = linhasCompra(l, lista.produtos);
  const nAcabou = lista.produtos.filter(acabou).length;

  function marcar(p: Product, on: boolean) {
    set({ itens: on ? [...l.itens.filter((i) => i.produtoId !== p.id), { produtoId: p.id, qtd: 1, unidade: p.unidade }] : l.itens.filter((i) => i.produtoId !== p.id) });
  }
  const mudarQtd = (id: string, qtd: number) => set({ itens: l.itens.map((i) => (i.produtoId === id ? { ...i, qtd } : i)) });
  function marcarAcabados() {
    const novos = lista.produtos.filter((p) => acabou(p) && !naLista.has(p.id)).map((p) => ({ produtoId: p.id, qtd: 1, unidade: p.unidade }));
    set({ itens: [...l.itens, ...novos] });
    toast(novos.length ? `${novos.length} produto(s) que acabaram foram para a lista com 1 ${novos.length === 1 ? 'unidade' : 'unidade cada'}. Ajuste as quantidades.` : 'Os produtos que acabaram já estão na lista.');
  }

  async function pdf() {
    if (!linhas.length) return toast('Marque pelo menos um produto.', 'erro');
    setGerando(true);
    try {
      const { buildCotacaoPdf } = await import('../export/cotacaoPdf');
      const buf = await buildCotacaoPdf({ fornecedor: l.fornecedor.trim(), telefone: l.telefone.trim(), obs: l.obs.trim(), linhas: linhas.map((x) => ({ nome: x.produto.nome, qtd: `${n3(x.qtd)} ${x.unidade}` })) }, loja, await logoDataUrl(loja));
      downloadBlob(buf, `cotacao-${slug(l.fornecedor) || 'fornecedor'}.pdf`, 'application/pdf');
      toast('PDF da cotação gerado. Ele não mostra nenhum custo seu.');
    } catch {
      toast('Não foi possível gerar o PDF. Tente de novo.', 'erro');
    } finally {
      setGerando(false);
    }
  }
  async function copiar() {
    if (!linhas.length) return toast('Marque pelo menos um produto.', 'erro');
    try {
      await navigator.clipboard.writeText(textoCotacao(l, linhas, loja.nomeFantasia));
      toast('Texto copiado. Cole na conversa com o fornecedor.');
    } catch {
      toast('Não foi possível copiar. Use o PDF.', 'erro');
    }
  }
  async function limpar() {
    if (await confirm({ titulo: 'Limpar a lista de compras?', mensagem: 'Os produtos marcados e as quantidades saem da lista. O fornecedor e as observações ficam.', confirmar: 'Limpar lista', perigo: true })) set({ itens: [] });
  }

  return (
    <div className="page">
      <PageHeader titulo="Lista de compras" subtitulo="Veja o estoque, marque o que precisa comprar e mande ao fornecedor um pedido de cotação em PDF ou pelo WhatsApp. Nenhum custo seu aparece no pedido." />

      <div className="compras-grid">
        <section className="card">
          <div className="card-head">
            <h2>Produtos e estoque</h2>
            {nAcabou > 0 && (
              <Button variant="secondary" onClick={marcarAcabados}>
                Adicionar os que acabaram ({nAcabou})
              </Button>
            )}
          </div>
          <div className="row-gap wrap compras-filtros">
            <label className="sr-only" htmlFor="compras-busca">
              Buscar produto
            </label>
            <input id="compras-busca" type="search" placeholder="Buscar produto ou categoria" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <div className="tabs" role="tablist" aria-label="Filtrar">
              {(
                [
                  ['todos', 'Todos'],
                  ['acabou', `Acabou (${nAcabou})`],
                  ['lista', `Na lista (${linhas.length})`],
                ] as [Filtro, string][]
              ).map(([id, rot]) => (
                <button key={id} type="button" role="tab" aria-selected={filtro === id} className={`tab ${filtro === id ? 'on' : ''}`} onClick={() => setFiltro(id)}>
                  {rot}
                </button>
              ))}
            </div>
          </div>
          {lista.produtos.length === 0 ? (
            <Empty titulo="Nenhum produto cadastrado">Cadastre produtos ou lance um lote de compra.</Empty>
          ) : (
            <div className="table-scroll">
              <table className="table compras-table">
                <thead>
                  <tr>
                    <th className="c-check">
                      <span className="sr-only">Comprar</span>
                    </th>
                    <th>Produto</th>
                    <th className="num">Estoque</th>
                    <th className="num">Comprar</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((p) => {
                    const it = naLista.get(p.id);
                    return (
                      <tr key={p.id} className={it ? 'selected' : ''}>
                        <td className="c-check">
                          <input type="checkbox" aria-label={`Comprar ${p.nome}`} checked={!!it} onChange={(e) => marcar(p, e.target.checked)} />
                        </td>
                        <td className="strong">
                          {p.nome}
                          {p.categoria && <small className="muted compras-cat">{p.categoria}</small>}
                        </td>
                        <td className={`num nowrap ${acabou(p) ? 'lote-sobe' : 'muted'}`}>{p.estoque == null ? '—' : acabou(p) ? `acabou (${n3(p.estoque)})` : `${n3(p.estoque)} ${p.unidade}`}</td>
                        <td className="num">
                          {it ? (
                            <span className="compras-qtd">
                              <QtdCompra key={p.id} label={`Quantidade de ${p.nome} para comprar`} value={it.qtd} onChange={(v) => mudarQtd(p.id, v)} />
                              <span className="muted">{it.unidade}</span>
                            </span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted small">O estoque vem dos <Link to="/lotes">lotes de compra</Link> (entrada) e das <Link to="/vendas">vendas</Link> (saída). “—” = estoque não controlado.</p>
        </section>

        <section className="card compras-pedido">
          <h2>Pedido de cotação</h2>
          <Field label="Fornecedor">{(id) => <input id={id} value={l.fornecedor} onChange={(e) => set({ fornecedor: e.target.value })} placeholder="Ex.: Reis Distribuidora" />}</Field>
          <Field label="Telefone do fornecedor (opcional)">{(id) => <input id={id} value={l.telefone} onChange={(e) => set({ telefone: e.target.value })} inputMode="tel" />}</Field>
          <Field label="Observações (opcional)">{(id) => <textarea id={id} rows={2} value={l.obs} onChange={(e) => set({ obs: e.target.value })} placeholder="Ex.: entrega até sexta" />}</Field>
          {linhas.length === 0 ? (
            <p className="muted">Marque ao lado os produtos que precisa comprar.</p>
          ) : (
            <ul className="pdv-itens">
              {linhas.map((x) => (
                <li key={x.produto.id}>
                  <span>
                    <strong>{x.produto.nome}</strong>
                  </span>
                  <span className="nowrap">
                    {n3(x.qtd)} {x.unidade}
                  </span>
                  <span />
                </li>
              ))}
            </ul>
          )}
          <div className="compras-acoes">
            <Button icon="pdf" onClick={pdf} disabled={!linhas.length || gerando}>
              {gerando ? 'Gerando…' : 'Gerar PDF da cotação'}
            </Button>
            <Button variant="secondary" icon="copy" onClick={copiar} disabled={!linhas.length}>
              Copiar texto para WhatsApp
            </Button>
            {linhas.length > 0 && (
              <Button variant="ghost" icon="trash" onClick={limpar}>
                Limpar lista
              </Button>
            )}
          </div>
          <p className="muted small">A lista fica salva no Excel e no backup. Quando a mercadoria chegar, lance a nota em Lotes de compra.</p>
        </section>
      </div>
    </div>
  );
}
