import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Empty, Field, Indicadores, MoneyInput, Notice, PageHeader } from '../ui/ui';
import { Icon } from '../ui/icons';
import { diaLocal, fecharVenda, itemVenda, lerPedidoWhatsapp, qtdNoProduto, resumoVendas, unidadeDeVenda } from '../core/vendas';
import { balancaDe, lerEtiquetaBalanca } from '../core/balanca';
import { paymentById, paymentOptions } from '../core/pricing';
import { formatBRL, parseNumberBR } from '../core/money';
import { norm, newId } from '../core/normalize';
import { formatCounterQty } from '../core/units';
import type { Product, Venda } from '../types';

interface Linha {
  key: string;
  produtoId: string;
  qtd: number;
  unidade: string;
  /** valor impresso na etiqueta da balança (manda sobre o cálculo) */
  total?: number;
}
interface Rascunho {
  linhas: Linha[];
  desconto: { tipo: 'valor' | 'pct'; valor: number | null };
  pagamento: string;
  cliente: string;
}
const vazio = (): Rascunho => ({ linhas: [], desconto: { tipo: 'valor', valor: null }, pagamento: 'pix', cliente: '' });
let rascunho: Rascunho | null = null;

const n3 = (n: number) => String(Number(n.toFixed(3))).replace('.', ',');
const qtdTexto = (qtd: number, un: string) => (un === 'g' || un === 'ml' ? formatCounterQty(qtd, un) : `${n3(qtd)} ${un}`);
const atalhos = (un: string) => (un === 'g' || un === 'ml' ? [100, 250, 500, 1000] : [1, 2, 3, 5]);

export default function Pdv() {
  useDocumentTitle('Vendas (PDV)');
  const { state, act } = useApp();
  const { toast, confirm } = useFeedback();
  const { lista, config } = state;
  const [r, setR] = useState<Rascunho>(() => rascunho ?? vazio());
  const atualizar = (fn: (x: Rascunho) => Rascunho) =>
    setR((x) => {
      const n = fn(x);
      rascunho = n;
      return n;
    });
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Product | null>(null);
  const [qtdTxt, setQtdTxt] = useState('');
  const [colar, setColar] = useState<string | null>(null);
  const [dia, setDia] = useState(diaLocal(new Date()));
  const qtdRef = useRef<HTMLInputElement>(null);

  const porId = useMemo(() => new Map(lista.produtos.map((p) => [p.id, p])), [lista.produtos]);
  const vendaveis = useMemo(() => lista.produtos.filter((p) => p.venda != null && p.venda > 0).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [lista.produtos]);
  const achados = useMemo(() => {
    const q = norm(busca);
    return (q ? vendaveis.filter((p) => norm(p.nome).includes(q) || norm(p.categoria).includes(q)) : vendaveis).slice(0, 12);
  }, [busca, vendaveis]);

  const itens = r.linhas.flatMap((l) => {
    const p = porId.get(l.produtoId);
    const calc = p ? itemVenda(p, l.qtd, l.unidade) : null;
    const it = calc && l.total != null ? { ...calc, total: l.total } : calc;
    return p && it ? [{ l, p, it }] : [];
  });
  const [etiqueta, setEtiqueta] = useState('');
  function lerEtiqueta() {
    const r2 = lerEtiquetaBalanca(etiqueta, balancaDe(config.balanca), lista.produtos);
    setEtiqueta('');
    if (!r2.ok) return toast(r2.motivo, 'erro');
    const p = r2.produto;
    const un = unidadeDeVenda(p);
    if (r2.gramas != null) {
      if (un !== 'g') return toast(`${p.nome} não é vendido por peso no sistema.`, 'erro');
      atualizar((x) => ({ ...x, linhas: [...x.linhas, { key: newId(), produtoId: p.id, qtd: r2.gramas!, unidade: 'g' }] }));
    } else {
      const precoBase = un === 'g' ? (p.venda ?? 0) / 1000 : p.venda ?? 0;
      if (!precoBase) return toast(`${p.nome} está sem preço no sistema.`, 'erro');
      const qtd = un === 'g' ? Math.round(r2.valor! / precoBase) : Math.max(1, Math.round(r2.valor! / precoBase));
      atualizar((x) => ({ ...x, linhas: [...x.linhas, { key: newId(), produtoId: p.id, qtd, unidade: un, total: r2.valor }] }));
    }
    toast(`${p.nome} adicionado pela etiqueta da balança.`);
  }
  const fech = fecharVenda(itens.map((x) => x.it), r.desconto, config, r.pagamento);
  const pag = paymentById(config, r.pagamento);

  function escolher(p: Product) {
    setSel(p);
    setQtdTxt('');
    setTimeout(() => qtdRef.current?.focus(), 0);
  }
  const qtdSel = parseNumberBR(qtdTxt);
  const previaSel = sel && qtdSel ? itemVenda(sel, qtdSel) : null;

  function adicionar(p: Product, qtd: number, unidade = unidadeDeVenda(p)) {
    atualizar((x) => {
      const igual = x.linhas.find((l) => l.produtoId === p.id && l.unidade === unidade);
      if (igual) return { ...x, linhas: x.linhas.map((l) => (l === igual ? { ...l, qtd: Math.round((l.qtd + qtd) * 1000) / 1000 } : l)) };
      return { ...x, linhas: [...x.linhas, { key: newId(), produtoId: p.id, qtd, unidade }] };
    });
  }
  function confirmarSel() {
    if (!sel || !previaSel) return;
    adicionar(sel, qtdSel!);
    setSel(null);
    setBusca('');
    setQtdTxt('');
  }

  function lerColado() {
    if (!colar) return;
    const ped = lerPedidoWhatsapp(colar, lista.produtos);
    if (ped.itens.length === 0) return toast('Não achei itens do cardápio neste texto. Cole a mensagem inteira do pedido.', 'erro');
    ped.itens.forEach((i) => adicionar(porId.get(i.produtoId)!, i.qtd, i.unidade));
    if (ped.cliente && !r.cliente) atualizar((x) => ({ ...x, cliente: ped.cliente }));
    setColar(null);
    toast(ped.naoAchados.length ? `${ped.itens.length} item(ns) adicionados. Não achei: ${ped.naoAchados.join(', ')}.` : `${ped.itens.length} item(ns) do pedido adicionados.`, ped.naoAchados.length ? 'erro' : 'ok');
  }

  function registrar() {
    if (itens.length === 0) return toast('Adicione ao menos um produto.', 'erro');
    const venda: Venda = {
      id: newId(),
      quando: new Date().toISOString(),
      itens: itens.map((x) => x.it),
      desconto: fech.desconto,
      total: fech.total,
      pagamento: pag.id,
      pagamentoLabel: pag.label,
      taxa: fech.taxa,
      cliente: r.cliente.trim(),
    };
    act.registrarVenda(venda);
    rascunho = null;
    setR({ ...vazio(), pagamento: r.pagamento });
    setDia(diaLocal(new Date()));
    toast(`Venda registrada: ${formatBRL(venda.total)}. Lembre de salvar o Excel ou o backup no fim do dia.`);
  }

  async function cancelar(v: Venda) {
    const ok = await confirm({ titulo: 'Cancelar esta venda?', mensagem: `A venda de ${formatBRL(v.total)} sai dos totais e os produtos voltam para o estoque.`, confirmar: 'Cancelar venda', perigo: true });
    if (ok) act.cancelarVenda(v.id);
  }

  const doDia = (config.vendas ?? []).filter((v) => diaLocal(v.quando) === dia);
  const res = resumoVendas(doDia);

  return (
    <div className="page">
      <PageHeader titulo="Vendas (PDV)" subtitulo="Registre o que saiu no balcão ou chegou pelo WhatsApp. O estoque baixa sozinho e o dia fecha com o total por forma de pagamento." />

      {vendaveis.length === 0 && (
        <Notice tone="info">
          Nenhum produto com preço de venda ainda. Defina os preços em <Link to="/produtos">Produtos</Link> ou <Link to="/precificacao">Precificação</Link>.
        </Notice>
      )}

      <div className="pdv-grid">
        <section className="card pdv-busca">
          <div className="card-head">
            <h2>Produtos</h2>
            <Button variant="ghost" icon="file" onClick={() => setColar((c) => (c == null ? '' : null))} aria-expanded={colar != null}>
              Colar pedido do WhatsApp
            </Button>
          </div>
          {colar != null && (
            <div className="lote-colar">
              <label htmlFor="pdv-colar">Mensagem do pedido (do cardápio)</label>
              <textarea id="pdv-colar" rows={6} value={colar} onChange={(e) => setColar(e.target.value)} placeholder="Cole aqui a mensagem que o cliente mandou pelo cardápio." />
              <div className="row-gap">
                <Button icon="check" onClick={lerColado} disabled={!colar.trim()}>
                  Adicionar itens do pedido
                </Button>
              </div>
            </div>
          )}
          <label className="pdv-etiqueta">
            <span>
              <strong>Etiqueta da balança</strong> <small className="muted">· passe o leitor aqui</small>
            </span>
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="Código de barras da etiqueta"
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && etiqueta.trim() && lerEtiqueta()}
            />
          </label>
          <label className="sr-only" htmlFor="pdv-busca">
            Buscar produto
          </label>
          <input id="pdv-busca" type="search" placeholder="Buscar produto ou categoria" value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off" />
          <ul className="pdv-lista">
            {achados.map((p) => (
              <li key={p.id}>
                <button type="button" className={`pdv-prod ${sel?.id === p.id ? 'on' : ''}`} onClick={() => escolher(p)}>
                  <span>
                    <strong>{p.nome}</strong>
                    <small>{p.estoque != null ? `Estoque: ${n3(p.estoque)} ${p.unidade}` : p.categoria || 'Sem categoria'}</small>
                  </span>
                  <span className="pdv-preco">
                    {formatBRL(p.venda)} / {p.unidade}
                  </span>
                </button>
                {sel?.id === p.id && (
                  <div className="pdv-qtd">
                    <div className="row-gap">
                      <label htmlFor="pdv-q">Quantidade ({unidadeDeVenda(p)})</label>
                      <input
                        id="pdv-q"
                        ref={qtdRef}
                        inputMode="decimal"
                        value={qtdTxt}
                        onChange={(e) => setQtdTxt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && confirmarSel()}
                        autoComplete="off"
                      />
                    </div>
                    <div className="chips-add">
                      {atalhos(unidadeDeVenda(p)).map((a) => (
                        <button key={a} type="button" className="mini" onClick={() => setQtdTxt(String(a))}>
                          {qtdTexto(a, unidadeDeVenda(p))}
                        </button>
                      ))}
                    </div>
                    <div className="row-gap pdv-qtd-fim">
                      <strong>{previaSel ? formatBRL(previaSel.total) : '—'}</strong>
                      <Button icon="plus" onClick={confirmarSel} disabled={!previaSel}>
                        Adicionar
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
            {achados.length === 0 && vendaveis.length > 0 && <li className="muted small">Nenhum produto com esse nome.</li>}
          </ul>
        </section>

        <section className="card pdv-venda">
          <h2>Venda atual</h2>
          {itens.length === 0 ? (
            <p className="muted">Escolha os produtos ao lado. Para pedido do cardápio, use “Colar pedido do WhatsApp”.</p>
          ) : (
            <ul className="pdv-itens">
              {itens.map(({ l, p, it }) => {
                const q = qtdNoProduto(p, l.qtd, l.unidade);
                const falta = p.estoque != null && q != null && q.toNumber() > p.estoque;
                return (
                  <li key={l.key}>
                    <span>
                      <strong>{p.nome}</strong>
                      <small>
                        {qtdTexto(l.qtd, l.unidade)}
                        {falta && <em className="pdv-falta"> · estoque tem só {n3(p.estoque!)} {p.unidade}</em>}
                      </small>
                    </span>
                    <strong>{formatBRL(it.total)}</strong>
                    <button type="button" className="icon-btn danger" aria-label={`Tirar ${p.nome} da venda`} onClick={() => atualizar((x) => ({ ...x, linhas: x.linhas.filter((y) => y.key !== l.key) }))}>
                      <Icon name="trash" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="form-grid">
            <Field label="Forma de pagamento">
              {(id) => (
                <select id={id} value={r.pagamento} onChange={(e) => atualizar((x) => ({ ...x, pagamento: e.target.value }))}>
                  {paymentOptions(config).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Cliente (opcional)">{(id) => <input id={id} value={r.cliente} onChange={(e) => atualizar((x) => ({ ...x, cliente: e.target.value }))} />}</Field>
            <Field label="Desconto" className="span-2">
              {(id) => (
                <div className="row-gap">
                  <select aria-label="Tipo de desconto" value={r.desconto.tipo} onChange={(e) => atualizar((x) => ({ ...x, desconto: { tipo: e.target.value as 'valor' | 'pct', valor: null } }))} style={{ maxWidth: 90 }}>
                    <option value="valor">R$</option>
                    <option value="pct">%</option>
                  </select>
                  {r.desconto.tipo === 'valor' ? (
                    <MoneyInput id={id} value={r.desconto.valor} onChange={(v) => atualizar((x) => ({ ...x, desconto: { tipo: 'valor', valor: v } }))} />
                  ) : (
                    <input
                      id={id}
                      inputMode="decimal"
                      placeholder="0"
                      value={r.desconto.valor ?? ''}
                      onChange={(e) => {
                        const v = parseNumberBR(e.target.value);
                        atualizar((x) => ({ ...x, desconto: { tipo: 'pct', valor: v != null && v >= 0 ? v : null } }));
                      }}
                    />
                  )}
                </div>
              )}
            </Field>
          </div>
          <dl className="lote-resumo pdv-totais">
            <div><dt>Subtotal</dt><dd>{formatBRL(fech.subtotal)}</dd></div>
            {fech.desconto > 0 && <div><dt>Desconto</dt><dd>− {formatBRL(fech.desconto)}</dd></div>}
            <div className="total"><dt>Total</dt><dd>{formatBRL(fech.total)}</dd></div>
            {fech.taxa > 0 && <div><dt>Taxa da maquininha ({String(pag.taxa).replace('.', ',')}%)</dt><dd>− {formatBRL(fech.taxa)}</dd></div>}
            {fech.taxa > 0 && <div><dt>Você recebe</dt><dd>{formatBRL(fech.liquido)}</dd></div>}
          </dl>
          <Button icon="check" onClick={registrar} disabled={itens.length === 0} className="pdv-registrar">
            Registrar venda
          </Button>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Vendas do dia</h2>
          <label className="row-gap">
            <span className="muted small">Dia</span>
            <input type="date" value={dia} onChange={(e) => setDia(e.target.value || diaLocal(new Date()))} style={{ maxWidth: 170 }} />
          </label>
        </div>
        {doDia.length === 0 ? (
          <Empty icon="cart" titulo="Nenhuma venda neste dia">
            As vendas registradas aparecem aqui, com o fechamento do caixa.
          </Empty>
        ) : (
          <>
            <Indicadores
              itens={[
                { rotulo: 'Faturado', valor: formatBRL(res.total), nota: `${res.vendas} venda(s)${res.canceladas ? ` · ${res.canceladas} cancelada(s)` : ''}` },
                { rotulo: 'Ticket médio', valor: formatBRL(res.ticketMedio), nota: 'Total ÷ número de vendas' },
                { rotulo: 'Descontos dados', valor: formatBRL(res.descontos), nota: `${String(res.descontoPct).replace('.', ',')}% do preço de tabela`, tom: res.descontoPct > 10 ? 'warn' : 'neutro' },
                { rotulo: 'Lucro bruto estimado', valor: formatBRL(res.lucroBruto), nota: 'Total − custo dos produtos − taxas (sem despesas fixas)', tom: res.lucroBruto > 0 ? 'ok' : 'warn' },
              ]}
            />
            <div className="pdv-fecha">
              <div>
                <h3>Fechamento por forma de pagamento</h3>
                <ul className="pdv-pag">
                  {res.porPagamento.map((p) => (
                    <li key={p.label}>
                      <span>
                        {p.label} <small className="muted">· {p.vendas}</small>
                      </span>
                      <strong>{formatBRL(p.total)}</strong>
                    </li>
                  ))}
                  {res.taxas > 0 && (
                    <li className="muted">
                      <span>Taxas das maquininhas</span>
                      <span>− {formatBRL(res.taxas)}</span>
                    </li>
                  )}
                </ul>
              </div>
              <div>
                <h3>Mais vendidos</h3>
                <ol className="pdv-pag">
                  {res.maisVendidos.map((p) => (
                    <li key={p.nome}>
                      <span>{p.nome}</span>
                      <strong>{formatBRL(p.total)}</strong>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Itens</th>
                    <th>Pagamento</th>
                    <th className="num">Total</th>
                    <th className="c-actions">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {doDia.map((v) => (
                    <tr key={v.id} className={v.cancelada ? 'pdv-cancelada' : ''}>
                      <td className="nowrap">{new Date(v.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        {v.cliente && <strong>{v.cliente}: </strong>}
                        {v.itens.map((i) => `${i.nome} (${qtdTexto(i.qtd, i.unidade)})`).join(', ')}
                        {v.cancelada && <span className="chip chip-bad lote-chip">cancelada</span>}
                      </td>
                      <td className="nowrap">{v.pagamentoLabel}</td>
                      <td className="num strong">{formatBRL(v.total)}</td>
                      <td className="c-actions">
                        {!v.cancelada && (
                          <button type="button" className="icon-btn danger" aria-label={`Cancelar venda de ${formatBRL(v.total)}`} title="Cancelar venda" onClick={() => cancelar(v)}>
                            <Icon name="x" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
