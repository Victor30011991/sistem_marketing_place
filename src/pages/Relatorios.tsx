import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Empty, Field, Indicadores, MoneyInput, Notice, PageHeader, Tabs } from '../ui/ui';
import { Barras } from '../components/Barras';
import { formatBRL } from '../core/money';
import { compras, estoque, noPeriodo, painel, periodoAnterior, periodoDe, ranking, resultado, variacao, type Atalho, type LinhaRanking, type Periodo } from '../core/relatorios';

type Aba = 'painel' | 'vendas' | 'resultado' | 'estoque' | 'compras';
const ATALHOS: { id: Atalho; rotulo: string }[] = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: '7d', rotulo: '7 dias' },
  { id: '30d', rotulo: '30 dias' },
  { id: 'mes', rotulo: 'Este mês' },
  { id: 'mesPassado', rotulo: 'Mês passado' },
  { id: 'ano', rotulo: 'Este ano' },
];
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const br = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
const brLongo = (iso: string) => iso.split('-').reverse().join('/');
const num = (n: number, casas = 3) => n.toLocaleString('pt-BR', { maximumFractionDigits: casas });
const reais = (c: number) => (Math.abs(c) >= 100000 ? `R$ ${num(Math.round(c / 100), 0)}` : formatBRL(c));

function Variacao({ agora, antes, inverter = false }: { agora: number; antes: number; inverter?: boolean }) {
  const v = variacao(agora, antes);
  if (v == null) return <>sem comparação</>;
  const bom = inverter ? v < 0 : v > 0;
  return (
    <span className={v === 0 ? '' : bom ? 'rel-sobe' : 'rel-desce'}>
      {v > 0 ? '▲' : v < 0 ? '▼' : '='} {String(Math.abs(v)).replace('.', ',')}%
    </span>
  );
}

export default function Relatorios() {
  useDocumentTitle('Relatórios');
  const { state, act } = useApp();
  const { toast } = useFeedback();
  const { lista, config } = state;
  const vendas = config.vendas ?? [];
  const [aba, setAba] = useState<Aba>('painel');
  const [atalho, setAtalho] = useState<Atalho | null>('mes');
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDe('mes'));
  const ant = periodoAnterior(periodo);
  const escolher = (a: Atalho) => {
    setAtalho(a);
    setPeriodo(periodoDe(a));
  };
  const [ordem, setOrdem] = useState<'total' | 'lucro' | 'qtd'>('total');

  const pn = useMemo(() => painel(vendas, periodo), [vendas, periodo]);
  const rk = useMemo(() => ranking(noPeriodo(vendas, periodo), lista.produtos), [vendas, periodo, lista.produtos]);
  const res = useMemo(() => resultado(vendas, config, periodo), [vendas, config, periodo]);
  const est = useMemo(() => estoque(lista.produtos, vendas), [lista.produtos, vendas]);
  const cp = useMemo(() => compras(config.lotes ?? [], lista.produtos, config, periodo), [config, lista.produtos, periodo]);

  const r = pn.resumo;
  const semVendas = r.vendas === 0;
  const comparacao = `vs. ${br(ant.de)}–${br(ant.ate)}`;

  function paraLista(ids: string[]) {
    const atual = config.compras ?? { fornecedor: '', telefone: '', obs: '', itens: [] };
    const novos = ids
      .filter((id) => !atual.itens.some((i) => i.produtoId === id))
      .map((id) => {
        const l = est.linhas.find((x) => x.produto.id === id)!;
        return { produtoId: id, qtd: Math.max(1, Math.ceil(l.vendido30 || 1)), unidade: l.produto.unidade };
      });
    if (!novos.length) return toast('Esses produtos já estão na lista de compras.');
    act.compras({ ...atual, itens: [...atual.itens, ...novos] });
    toast(`${novos.length} produto(s) na lista de compras, com a quantidade de 1 mês de vendas.`);
  }

  const produtosOrdenados = [...rk.produtos].sort((a, b) => (ordem === 'lucro' ? b.lucro - a.lucro : ordem === 'qtd' ? b.qtd - a.qtd : b.total - a.total));

  return (
    <div className="page">
      <PageHeader titulo="Relatórios" subtitulo="Como a loja está: vendas, lucro, estoque e compras, no período que você escolher." />

      <section className="card rel-periodo" aria-label="Período">
        <div className="rel-atalhos">
          {ATALHOS.map((a) => (
            <button key={a.id} type="button" className={`chip-btn ${atalho === a.id ? 'on' : ''}`} aria-pressed={atalho === a.id} onClick={() => escolher(a.id)}>
              {a.rotulo}
            </button>
          ))}
        </div>
        <div className="rel-datas">
          <Field label="De">{(id) => <input id={id} type="date" value={periodo.de} max={periodo.ate} onChange={(e) => e.target.value && (setAtalho(null), setPeriodo({ ...periodo, de: e.target.value }))} />}</Field>
          <Field label="Até">{(id) => <input id={id} type="date" value={periodo.ate} min={periodo.de} onChange={(e) => e.target.value && (setAtalho(null), setPeriodo({ ...periodo, ate: e.target.value }))} />}</Field>
        </div>
      </section>

      <Tabs
        value={aba}
        onChange={setAba}
        itens={[
          { id: 'painel', label: 'Painel' },
          { id: 'vendas', label: 'Vendas' },
          { id: 'resultado', label: 'Resultado' },
          { id: 'estoque', label: 'Estoque' },
          { id: 'compras', label: 'Compras' },
        ]}
      />

      {aba === 'painel' && (
        <>
          <Indicadores
            itens={[
              { rotulo: 'Faturado', valor: formatBRL(r.total), nota: <><Variacao agora={r.total} antes={pn.anterior.total} /> {comparacao}</> },
              { rotulo: 'Vendas', valor: r.vendas, nota: <><Variacao agora={r.vendas} antes={pn.anterior.vendas} /> {comparacao}</> },
              { rotulo: 'Ticket médio', valor: formatBRL(r.ticketMedio), nota: <><Variacao agora={r.ticketMedio} antes={pn.anterior.ticketMedio} /> {comparacao}</> },
              { rotulo: 'Lucro bruto', valor: formatBRL(r.lucroBruto), nota: 'Vendas − custo dos produtos − taxas', tom: r.lucroBruto > 0 ? 'ok' : r.vendas ? 'warn' : 'neutro' },
            ]}
          />
          {semVendas ? (
            <Empty icon="cart" titulo="Nenhuma venda neste período">As vendas feitas no PDV aparecem aqui. Escolha outro período ou registre vendas.</Empty>
          ) : (
            <section className="card rel-graficos">
              {pn.porDia.length > 1 && (
                <Barras
                  titulo="Faturado por dia"
                  formatar={reais}
                  dados={pn.porDia.map((d, i) => ({
                    rotulo: d.dia,
                    eixo: pn.porDia.length <= 10 || i % Math.ceil(pn.porDia.length / 8) === 0 ? br(d.dia) : '',
                    valor: d.total,
                    dica: `${brLongo(d.dia)}: ${formatBRL(d.total)} em ${d.vendas} venda(s)`,
                  }))}
                />
              )}
              <div className="rel-dois">
                <Barras titulo="Média por dia da semana" formatar={reais} dados={pn.porSemana.map((s) => ({ rotulo: SEMANA[s.dia], eixo: SEMANA[s.dia], valor: s.media, dica: `${SEMANA[s.dia]}: média de ${formatBRL(s.media)} por dia` }))} />
                <Barras
                  titulo="Faturado por horário"
                  formatar={reais}
                  dados={pn.porHora.slice(7, 22).map((h) => ({ rotulo: `${h.hora}h`, eixo: h.hora % 2 ? '' : `${h.hora}h`, valor: h.total, dica: `${h.hora}h às ${h.hora + 1}h: ${formatBRL(h.total)} em ${h.vendas} venda(s)` }))}
                />
              </div>
              <p className="muted small">Toque ou passe o mouse numa barra para ver o valor.</p>
            </section>
          )}
        </>
      )}

      {aba === 'vendas' &&
        (semVendas ? (
          <Empty icon="cart" titulo="Nenhuma venda neste período" />
        ) : (
          <>
            <section className="card">
              <div className="card-head">
                <h2>Produtos</h2>
                <label className="row-gap">
                  <span className="muted small">Ordenar por</span>
                  <select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)}>
                    <option value="total">Faturado</option>
                    <option value="lucro">Lucro</option>
                    <option value="qtd">Quantidade</option>
                  </select>
                </label>
              </div>
              <TabelaRanking linhas={produtosOrdenados} comCategoria />
            </section>
            <section className="card">
              <h2>Categorias</h2>
              <TabelaRanking linhas={rk.categorias} />
            </section>
            <section className="card rel-dois">
              <div>
                <h2>Formas de pagamento</h2>
                <ul className="pdv-pag">
                  {r.porPagamento.map((p) => (
                    <li key={p.label}>
                      <span>
                        {p.label} <small className="muted">· {p.vendas}</small>
                      </span>
                      <strong>{formatBRL(p.total)}</strong>
                    </li>
                  ))}
                  <li className="muted">
                    <span>Taxas das maquininhas</span>
                    <span>− {formatBRL(r.taxas)}</span>
                  </li>
                </ul>
              </div>
              <div>
                <h2>Descontos e cancelamentos</h2>
                <ul className="pdv-pag">
                  <li>
                    <span>Descontos dados</span>
                    <strong>{formatBRL(r.descontos)}</strong>
                  </li>
                  <li>
                    <span>% do preço de tabela</span>
                    <strong>{String(r.descontoPct).replace('.', ',')}%</strong>
                  </li>
                  <li>
                    <span>Vendas canceladas</span>
                    <strong>{r.canceladas}</strong>
                  </li>
                </ul>
              </div>
            </section>
          </>
        ))}

      {aba === 'resultado' && (
        <>
          {config.custosFixos.length === 0 && (
            <Notice tone="warn">
              Nenhuma despesa fixa cadastrada (aluguel, luz, internet…). Sem elas o lucro fica maior do que é. Cadastre em <Link to="/precificacao">Precificação</Link>.
            </Notice>
          )}
          <section className="card">
            <h2>Resultado {res.fracaoMes === 1 ? 'do mês' : 'do período'}</h2>
            <p className="muted small">
              {brLongo(periodo.de)} a {brLongo(periodo.ate)}.{' '}
              {res.fracaoMes === 1 ? 'Despesas fixas e pró-labore entram com o valor do mês inteiro.' : `Despesas fixas e pró-labore entram proporcionais a ${num(res.fracaoMes * 30, 0)} dias.`}
            </p>
            <dl className="rel-dre">
              <div>
                <dt>Vendas</dt>
                <dd>{formatBRL(res.faturamento)}</dd>
              </div>
              <div className="menos">
                <dt>Custo dos produtos vendidos</dt>
                <dd>− {formatBRL(res.custoMercadoria)}</dd>
              </div>
              <div className="menos">
                <dt>Taxas das maquininhas</dt>
                <dd>− {formatBRL(res.taxas)}</dd>
              </div>
              <div className="menos">
                <dt>Impostos, embalagens e outros variáveis</dt>
                <dd>− {formatBRL(res.variaveis)}</dd>
              </div>
              <div className="sub">
                <dt>
                  Sobra das vendas <small>{res.faturamento ? `${num((res.contribuicao / res.faturamento) * 100, 1)}% de cada venda` : ''}</small>
                </dt>
                <dd>{formatBRL(res.contribuicao)}</dd>
              </div>
              <div className="menos">
                <dt>Despesas fixas</dt>
                <dd>− {formatBRL(res.despesasFixas)}</dd>
              </div>
              <div className={`sub ${res.lucro < 0 ? 'neg' : 'pos'}`}>
                <dt>
                  Lucro da loja <small>{res.margemLiquida != null ? `${String(res.margemLiquida).replace('.', ',')}% das vendas` : ''}</small>
                </dt>
                <dd>{formatBRL(res.lucro)}</dd>
              </div>
              <div className="menos">
                <dt>Pró-labore (retirada de vocês)</dt>
                <dd>− {formatBRL(res.proLabore)}</dd>
              </div>
              <div className={`total ${res.lucroFinal < 0 ? 'neg' : 'pos'}`}>
                <dt>O que sobra</dt>
                <dd>{formatBRL(res.lucroFinal)}</dd>
              </div>
            </dl>
            <div className="rel-prolabore">
              <Field label="Pró-labore por mês" hint="Quanto vocês retiram da loja por mês. Fica guardado.">
                {(id) => <MoneyInput id={id} value={config.proLabore ?? null} onChange={(v) => act.config((c) => ({ ...c, proLabore: v ?? 0 }))} />}
              </Field>
            </div>
          </section>
          <section className="card">
            <h2>Ponto de equilíbrio</h2>
            {res.pontoEquilibrio == null ? (
              <p className="muted">Precisa de vendas com custo cadastrado no período para calcular.</p>
            ) : (
              <>
                <p>
                  Para pagar as despesas fixas e o pró-labore {res.fracaoMes === 1 ? 'do mês' : 'do período'}, a loja precisa vender <strong>{formatBRL(res.pontoEquilibrio)}</strong>.{' '}
                  {res.falta ? (
                    <>
                      Faltam <strong>{formatBRL(res.falta)}</strong>.
                    </>
                  ) : (
                    <strong className="rel-sobe">Meta atingida!</strong>
                  )}
                </p>
                <div className="rel-meta">
                  <meter min={0} max={res.pontoEquilibrio} value={Math.min(res.faturamento, res.pontoEquilibrio)} aria-label="Vendas até o ponto de equilíbrio" />
                  <span>{num(Math.min(100, (res.faturamento / res.pontoEquilibrio) * 100), 0)}%</span>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {aba === 'estoque' && (
        <>
          <Indicadores
            itens={[
              { rotulo: 'Dinheiro em estoque', valor: formatBRL(est.valorTotal), nota: est.semCusto ? `${est.semCusto} produto(s) sem custo ficaram de fora` : 'Estoque × custo de cada produto' },
              { rotulo: 'Acabando', valor: est.acabando.length, nota: 'Zerados ou para menos de 14 dias', tom: est.acabando.length ? 'warn' : 'neutro' },
              { rotulo: 'Parados', valor: est.parados.length, nota: 'Com estoque e sem venda há 30 dias' },
              { rotulo: 'Com estoque controlado', valor: est.linhas.length, nota: `de ${lista.produtos.length} produtos` },
            ]}
          />
          {est.linhas.length === 0 ? (
            <Empty icon="box" titulo="Nenhum produto com estoque">Informe o estoque nos produtos (ou aplique um lote de compra) para ver este relatório.</Empty>
          ) : (
            <>
              <section className="card">
                <div className="card-head">
                  <h2>Acabando</h2>
                  {est.acabando.length > 0 && (
                    <Button variant="secondary" icon="list" onClick={() => paraLista(est.acabando.map((l) => l.produto.id))}>
                      Pôr todos na lista de compras
                    </Button>
                  )}
                </div>
                {est.acabando.length === 0 ? (
                  <p className="muted">Nenhum produto acabando no ritmo atual.</p>
                ) : (
                  <div className="table-scroll">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th className="num">Estoque</th>
                          <th className="num">Vendido em 30 dias</th>
                          <th className="num">Dura</th>
                        </tr>
                      </thead>
                      <tbody>
                        {est.acabando.map((l) => (
                          <tr key={l.produto.id}>
                            <td>{l.produto.nome}</td>
                            <td className="num">
                              {num(Math.max(0, l.produto.estoque ?? 0))} {l.produto.unidade}
                            </td>
                            <td className="num">
                              {num(l.vendido30)} {l.produto.unidade}
                            </td>
                            <td className="num">{(l.produto.estoque ?? 0) <= 0 ? <strong className="rel-desce">acabou</strong> : l.diasRestantes != null ? `${l.diasRestantes} dia(s)` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <section className="card">
                <h2>Parados</h2>
                <p className="muted small">Dinheiro que está na prateleira sem girar. Bons candidatos para promoção.</p>
                {est.parados.length === 0 ? (
                  <p className="muted">Todo produto com estoque vendeu nos últimos 30 dias.</p>
                ) : (
                  <div className="table-scroll">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th className="num">Estoque</th>
                          <th className="num">Valor parado</th>
                          <th className="num">Última venda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {est.parados.map((l) => (
                          <tr key={l.produto.id}>
                            <td>{l.produto.nome}</td>
                            <td className="num">
                              {num(l.produto.estoque ?? 0)} {l.produto.unidade}
                            </td>
                            <td className="num">{formatBRL(l.valor)}</td>
                            <td className="num">{l.semVenderHa == null ? 'nunca' : `há ${l.semVenderHa} dias`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

      {aba === 'compras' && (
        <>
          <Indicadores
            itens={[
              { rotulo: 'Gasto em compras', valor: formatBRL(cp.total), nota: `${cp.lotes} lote(s) aplicados no período` },
              { rotulo: 'Fornecedores', valor: cp.porFornecedor.length, nota: 'No período' },
              { rotulo: 'Custos que subiram', valor: cp.precos.filter((p) => (p.variacao ?? 0) > 0).length, nota: 'Na última compra, todo o histórico', tom: cp.precos.some((p) => (p.variacao ?? 0) > 0) ? 'warn' : 'neutro' },
              { rotulo: 'Abaixo do preço sugerido', valor: cp.margemBaixa.length, nota: 'Com os custos de hoje', tom: cp.margemBaixa.length ? 'warn' : 'neutro' },
            ]}
          />
          <section className="card">
            <h2>Por fornecedor</h2>
            {cp.porFornecedor.length === 0 ? (
              <p className="muted">
                Nenhum lote aplicado neste período. As compras entram em <Link to="/lotes">Lotes de compra</Link>.
              </p>
            ) : (
              <ul className="pdv-pag">
                {cp.porFornecedor.map((f) => (
                  <li key={f.nome}>
                    <span>
                      {f.nome} <small className="muted">· {f.lotes} lote(s)</small>
                    </span>
                    <strong>{formatBRL(f.total)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <h2>Custo de compra: última × anterior</h2>
            <p className="muted small">Custo real (com frete e extras) por kg ou unidade, nas duas últimas compras de cada produto.</p>
            {cp.precos.length === 0 ? (
              <p className="muted">Aparece quando o mesmo produto for comprado em pelo menos dois lotes.</p>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th className="num">Antes</th>
                      <th className="num">Agora</th>
                      <th className="num">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cp.precos.map((p) => (
                      <tr key={p.nome}>
                        <td>
                          {p.nome} <small className="muted">· {brLongo(p.data)}</small>
                        </td>
                        <td className="num">
                          {formatBRL(p.antes)}/{p.unidade}
                        </td>
                        <td className="num">
                          {formatBRL(p.agora)}/{p.unidade}
                        </td>
                        <td className="num">
                          <Variacao agora={p.agora} antes={p.antes} inverter />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="card">
            <h2>Vendendo abaixo do preço sugerido</h2>
            <p className="muted small">
              O preço sugerido usa o custo de hoje, as despesas, taxas e a margem cadastradas em <Link to="/precificacao">Precificação</Link>.
            </p>
            {cp.margemBaixa.length === 0 ? (
              <p className="muted">Nenhum produto abaixo do preço sugerido.</p>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th className="num">Preço atual</th>
                      <th className="num">Sugerido</th>
                      <th className="num">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cp.margemBaixa.map((m) => (
                      <tr key={m.produto.id}>
                        <td>{m.produto.nome}</td>
                        <td className="num">
                          {formatBRL(m.venda)}/{m.produto.unidade}
                        </td>
                        <td className="num">
                          {formatBRL(m.sugerido)}/{m.produto.unidade}
                        </td>
                        <td className="num rel-desce">− {formatBRL(m.sugerido - m.venda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function TabelaRanking({ linhas, comCategoria = false }: { linhas: LinhaRanking[]; comCategoria?: boolean }) {
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>{comCategoria ? 'Produto' : 'Categoria'}</th>
            <th className="num">Quantidade</th>
            <th className="num">Faturado</th>
            <th className="num">Lucro</th>
            <th className="num">Margem</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave}>
              <td>
                {l.nome}
                {comCategoria && <small className="muted"> · {l.categoria}</small>}
              </td>
              <td className="num">{l.qtd ? `${num(l.qtd)} ${l.unidade}` : '—'}</td>
              <td className="num">{formatBRL(l.total)}</td>
              <td className="num">{formatBRL(l.lucro)}</td>
              <td className="num">{l.margem != null ? `${String(l.margem).replace('.', ',')}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
