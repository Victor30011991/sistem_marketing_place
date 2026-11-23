import '../components/pacote.css';
import { useEffect, useMemo, useState } from 'react';
import { useNuvem } from '../nuvem/NuvemProvider';
import { pagoNoPeriodo, saldo } from '../core/contas';
import { vencendo } from '../core/validade';
import type { Registro } from '../types';
import { Link } from 'react-router-dom';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Empty, Field, Indicadores, MoneyInput, Notice, PageHeader, Tabs } from '../ui/ui';
import { Barras } from '../components/Barras';
import { formatBRL } from '../core/money';
import { CENARIO_PADRAO, potencialEstoque, type Cenario } from '../core/potencial';
import { paymentOptions } from '../core/pricing';
import CodigosBalanca from '../components/CodigosBalanca';
import { compras, curvaABC, estoque, noPeriodo, painel, periodoAnterior, periodoDe, ranking, resultado, variacao, type Atalho, type ClasseABC, type LinhaRanking, type Periodo } from '../core/relatorios';

type Aba = 'painel' | 'vendas' | 'resultado' | 'estoque' | 'potencial' | 'compras' | 'alteracoes' | 'codigos';
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
  const [cen, setCen] = useState<Cenario>(CENARIO_PADRAO);
  const pot = useMemo(() => potencialEstoque(lista.produtos, vendas, config, cen), [lista.produtos, vendas, config, cen]);
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

  const venc = vencendo(config.lotes ?? [], lista.produtos, periodoDe('hoje').ate, 60);
  const pagoContas = pagoNoPeriodo(config.contas ?? [], periodo.de, periodo.ate);
  const aReceber = (config.contas ?? []).filter((c) => c.tipo === 'receber').reduce((a, c) => a + saldo(c), 0);
  const porVendedor = useMemo(() => {
    const m = new Map<string, { nome: string; vendas: number; total: number }>();
    for (const v of noPeriodo(vendas, periodo)) {
      if (v.cancelada) continue;
      const k = v.por || 'Sem nome';
      const x = m.get(k) ?? { nome: k, vendas: 0, total: 0 };
      x.vendas++;
      x.total += v.total;
      m.set(k, x);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [vendas, periodo]);
  const abc = useMemo(() => curvaABC(rk.produtos), [rk.produtos]);
  const produtosOrdenados = [...rk.produtos].sort((a, b) => (ordem === 'lucro' ? b.lucro - a.lucro : ordem === 'qtd' ? b.qtd - a.qtd : b.total - a.total));

  return (
    <div className="page">
      <PageHeader titulo="Relatórios" subtitulo="Como a loja está: vendas, lucro, estoque e compras, no período que você escolher." />

      {aba !== 'codigos' && (
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
      )}

      <Tabs
        value={aba}
        onChange={setAba}
        itens={[
          { id: 'painel', label: 'Painel' },
          { id: 'vendas', label: 'Vendas' },
          { id: 'resultado', label: 'Resultado' },
          { id: 'estoque', label: 'Estoque' },
          { id: 'potencial', label: 'Potencial do estoque' },
          { id: 'compras', label: 'Compras' },
          { id: 'alteracoes', label: 'Alterações' },
          { id: 'codigos', label: 'Códigos da balança' },
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
              <ResumoABC abc={abc} />
              <TabelaRanking linhas={produtosOrdenados} comCategoria abc={abc.classe} />
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
              {porVendedor.length > 1 || (porVendedor[0] && porVendedor[0].nome !== 'Sem nome') ? (
                <div>
                  <h2>Quem vendeu</h2>
                  <ul className="pdv-pag">
                    {porVendedor.map((x) => (
                      <li key={x.nome}>
                        <span>
                          {x.nome} <small className="muted">· {x.vendas}</small>
                        </span>
                        <strong>{formatBRL(x.total)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
                <dt>
                  Despesas fixas <small>cadastradas em Precificação</small>
                </dt>
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
            {pagoContas > 0 && (
              <p className="muted small">
                Contas a pagar quitadas no período (Contas e fiado): <strong>{formatBRL(pagoContas)}</strong>. Compare com as despesas fixas cadastradas para ver se elas estão em dia.
              </p>
            )}
            {aReceber > 0 && <p className="muted small">Ainda a receber de fiado (todas as datas): <strong>{formatBRL(aReceber)}</strong>.</p>}
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

      {aba === 'codigos' && <CodigosBalanca />}

      {aba === 'potencial' && (
        <>
          <section className="card">
            <h2>Se vender o estoque de hoje</h2>
            <p className="muted small">
              Quanto rende o que está na prateleira, pelo preço de hoje. Não depende do período escolhido acima. O tempo para vender e a mistura de pagamentos vêm das vendas dos últimos dias; é uma estimativa.
            </p>
            <div className="pot-cenario">
              <label className="pot-range">
                <span>
                  Quanto do estoque vende <strong>{cen.vende}%</strong>
                </span>
                <input type="range" min={50} max={100} step={5} value={cen.vende} onChange={(e) => setCen({ ...cen, vende: Number(e.target.value) })} />
              </label>
              <label className="pot-range">
                <span>
                  Desconto médio <strong>{cen.desconto}%</strong>
                </span>
                <input type="range" min={0} max={30} step={5} value={cen.desconto} onChange={(e) => setCen({ ...cen, desconto: Number(e.target.value) })} />
              </label>
              <Field label="Como os clientes pagam">
                {(id) => (
                  <select id={id} value={cen.forma} onChange={(e) => setCen({ ...cen, forma: e.target.value })}>
                    <option value="mix">Como hoje (mistura das vendas)</option>
                    {paymentOptions(config).map((f) => (
                      <option key={f.id} value={f.id}>
                        Tudo em {f.label.toLowerCase()} ({String(f.taxa).replace('.', ',')}%)
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              {(cen.vende !== 100 || cen.desconto !== 0 || cen.forma !== 'mix') && (
                <Button variant="ghost" icon="undo" onClick={() => setCen(CENARIO_PADRAO)}>
                  Voltar ao cenário completo
                </Button>
              )}
            </div>
          </section>

          {pot.linhas.length === 0 ? (
            <Empty icon="box" titulo="Nenhum produto com estoque, custo e preço">
              Preencha o estoque atual e o custo dos produtos em <Link to="/produtos">Produtos</Link> (ou aplique uma nota em Lotes de compra) para ver o potencial.
            </Empty>
          ) : (
            <>
              <Indicadores
                itens={[
                  { rotulo: 'Investimento', valor: reais(pot.investimento), nota: 'Custo do estoque que está na prateleira' },
                  { rotulo: 'Faturamento possível', valor: reais(pot.faturamento), nota: cen.vende === 100 ? 'Vendendo tudo pelo preço de hoje' : `Vendendo ${cen.vende}% do estoque` },
                  { rotulo: 'Lucro bruto', valor: reais(pot.lucroBruto), nota: pot.margemBruta != null ? `${String(pot.margemBruta).replace('.', ',')}% do faturamento` : undefined, tom: pot.lucroBruto > 0 ? 'ok' : 'warn' },
                  { rotulo: 'Lucro líquido', valor: reais(pot.lucroLiquido), nota: pot.margemLiquida != null ? `${String(pot.margemLiquida).replace('.', ',')}% do faturamento` : undefined, tom: pot.lucroLiquido > 0 ? 'ok' : 'warn' },
                  { rotulo: 'Retorno', valor: pot.retorno != null ? `${num(pot.retorno * 100, 0)}%` : '—', nota: pot.retorno != null ? `Cada R$ 1,00 investido rende ${formatBRL(Math.round(pot.retorno * 100))} de lucro líquido` : undefined },
                  { rotulo: 'Tempo para vender', valor: pot.dias != null ? `${pot.dias} dias` : '—', nota: pot.dias != null ? 'No ritmo das vendas dos últimos 30 dias' : 'Sem vendas recentes destes produtos' },
                ]}
              />
              <section className="card">
                <h2>De onde vem o lucro</h2>
                <dl className="rel-dre">
                  <div>
                    <dt>Faturamento possível</dt>
                    <dd>{formatBRL(pot.faturamento)}</dd>
                  </div>
                  <div className="menos">
                    <dt>Custo dos produtos</dt>
                    <dd>− {formatBRL(pot.custoVendido)}</dd>
                  </div>
                  <div className="sub">
                    <dt>Lucro bruto</dt>
                    <dd>{formatBRL(pot.lucroBruto)}</dd>
                  </div>
                  <div className="menos">
                    <dt>
                      Taxas das maquininhas <small>{String(pot.taxaPct).replace('.', ',')}% {cen.forma === 'mix' ? 'em média nas vendas recentes' : 'da forma escolhida'}</small>
                    </dt>
                    <dd>− {formatBRL(pot.taxas)}</dd>
                  </div>
                  <div className="menos">
                    <dt>
                      Impostos, embalagens e outros variáveis <small>cadastrados em Precificação</small>
                    </dt>
                    <dd>− {formatBRL(pot.variaveis)}</dd>
                  </div>
                  <div className="menos">
                    <dt>
                      Despesas fixas <small>{pot.dias != null ? `proporcionais a ${pot.dias} dias para vender` : '1 mês (sem ritmo de vendas)'}</small>
                    </dt>
                    <dd>− {formatBRL(pot.despesasFixas)}</dd>
                  </div>
                  <div className={`sub ${pot.lucroLiquido < 0 ? 'neg' : 'pos'}`}>
                    <dt>Lucro líquido</dt>
                    <dd>{formatBRL(pot.lucroLiquido)}</dd>
                  </div>
                  <div className="menos">
                    <dt>Pró-labore (retirada de vocês) no mesmo tempo</dt>
                    <dd>− {formatBRL(pot.proLabore)}</dd>
                  </div>
                  <div className={`total ${pot.sobra < 0 ? 'neg' : 'pos'}`}>
                    <dt>O que sobra</dt>
                    <dd>{formatBRL(pot.sobra)}</dd>
                  </div>
                </dl>
              </section>
              <section className="card">
                <h2>Produto a produto</h2>
                <p className="muted small">Em ordem de retorno: quanto cada real investido no produto volta de lucro bruto. No fim da lista ficam os que prendem mais dinheiro.</p>
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th className="num">Estoque</th>
                        <th className="num">Investido</th>
                        <th className="num">Vende por</th>
                        <th className="num">Lucro bruto</th>
                        <th className="num">Retorno</th>
                        <th className="num">Tempo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pot.linhas.map((l) => (
                        <tr key={l.produto.id}>
                          <td className="strong">{l.produto.nome}</td>
                          <td className="num">
                            {num(l.produto.estoque ?? 0)} {l.produto.unidade}
                          </td>
                          <td className="num">{formatBRL(l.investimento)}</td>
                          <td className="num">{formatBRL(l.faturamento)}</td>
                          <td className="num">{formatBRL(l.lucroBruto)}</td>
                          <td className={`num ${l.retorno != null && l.retorno < 0.3 ? 'rel-desce' : ''}`}>{l.retorno != null ? `${num(l.retorno * 100, 0)}%` : '—'}</td>
                          <td className={`num ${l.dias == null || l.dias > 90 ? 'rel-desce' : ''}`}>{l.dias != null ? `${l.dias} dias` : 'sem vendas'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {(pot.faltam.length > 0 || pot.semEstoqueInformado > 0) && (
            <section className="card">
              <h2>Ficaram de fora da conta</h2>
              {pot.semEstoqueInformado > 0 && (
                <p className="muted small">
                  {pot.semEstoqueInformado} produto(s) com preço não têm o estoque atual preenchido. Preencha em <Link to="/produtos">Produtos</Link> para entrarem.
                </p>
              )}
              {pot.faltam.length > 0 && (
                <ul className="pot-faltam">
                  {pot.faltam.map((f) => (
                    <li key={f.produto.id}>
                      <strong>{f.produto.nome}</strong> <span className="muted">· {f.motivo}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
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
              {venc.length > 0 && (
                <section className="card">
                  <h2>Validade</h2>
                  <p className="muted small">Pela validade informada nos lotes de compra. Confira na prateleira: pode já ter vendido essa parte.</p>
                  <ul className="pdv-pag">
                    {venc.map((v) => (
                      <li key={v.nome + v.validade}>
                        <span>
                          {v.nome} <small className="muted">· {v.lote}</small>
                        </span>
                        <strong className={v.dias <= 7 ? 'rel-desce' : ''}>{v.dias < 0 ? `venceu ${brLongo(v.validade)}` : `${brLongo(v.validade)} · ${v.dias} dia(s)`}</strong>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
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

      {aba === 'alteracoes' && <Alteracoes />}

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

function Alteracoes() {
  const { fase, servico } = useNuvem();
  const [regs, setRegs] = useState<Registro[] | null>(null);
  const [quem, setQuem] = useState('');
  useEffect(() => {
    if (fase !== 'conectado' || !servico) return;
    let vivo = true;
    servico.lerHistorico(400).then((r) => vivo && setRegs(r)).catch(() => vivo && setRegs([]));
    return () => {
      vivo = false;
    };
  }, [fase, servico]);
  if (fase !== 'conectado') return <Empty icon="cloud" titulo="O histórico fica na nuvem">Entre na nuvem para ver quem mudou preços, custos, estoque e produtos.</Empty>;
  if (!regs) return <p className="muted">Carregando…</p>;
  if (!regs.length) return <Empty icon="list" titulo="Nenhuma alteração registrada ainda">A partir de agora, toda mudança de preço, custo, estoque à mão, produto novo ou excluído e venda cancelada aparece aqui, com quem fez.</Empty>;
  const nomes = [...new Set(regs.map((r) => r.por).filter(Boolean))];
  const lista = regs.filter((r) => !quem || r.por === quem);
  return (
    <section className="card">
      <div className="card-head">
        <h2>Últimas alterações</h2>
        {nomes.length > 1 && (
          <select aria-label="Filtrar por pessoa" value={quem} onChange={(e) => setQuem(e.target.value)}>
            <option value="">Todos</option>
            {nomes.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        )}
      </div>
      <ul className="hist">
        {lista.map((r) => (
          <li key={r.id}>
            <time>{new Date(r.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time>
            <span>
              <strong>{r.acao}</strong> · {r.detalhe}
            </span>
            <small className="muted">{r.por || '—'}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

const ABC_TEXTO: Record<ClasseABC, string> = { A: 'Os que mais dão lucro: nunca deixe faltar', B: 'Bons de giro: mantenha o estoque em dia', C: 'Dão pouco: compre menos ou ponha num kit' };

function ResumoABC({ abc }: { abc: ReturnType<typeof curvaABC> }) {
  const r = abc.resumo;
  if (!r.A.produtos) return null;
  const medida = abc.base === 'lucro' ? 'do lucro' : 'do faturado';
  return (
    <div className="abc-resumo" aria-label="Curva ABC">
      {(['A', 'B', 'C'] as const).map((k) => (
        <div key={k} className={`abc-caixa abc-${k}`}>
          <span className={`abc-letra abc-${k}`} aria-hidden="true">
            {k}
          </span>
          <div>
            <strong>
              {r[k].produtos} produto{r[k].produtos === 1 ? '' : 's'} · {String(r[k].parte).replace('.', ',')}% {medida}
            </strong>
            <small className="muted">{ABC_TEXTO[k]}</small>
          </div>
        </div>
      ))}
      {abc.base === 'total' && <p className="muted small">Sem custo cadastrado, a curva usa o faturado. Cadastre o custo nos lotes para ver pelo lucro.</p>}
    </div>
  );
}

function TabelaRanking({ linhas, comCategoria = false, abc }: { linhas: LinhaRanking[]; comCategoria?: boolean; abc?: Map<string, ClasseABC> }) {
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            {abc && (
              <th>
                <abbr title="Curva ABC: A dá mais lucro, C dá menos">ABC</abbr>
              </th>
            )}
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
              {abc && (
                <td>
                  <span className={`abc-letra abc-${abc.get(l.chave) ?? 'C'}`}>{abc.get(l.chave) ?? 'C'}</span>
                </td>
              )}
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
