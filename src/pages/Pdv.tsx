import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Empty, Indicadores, MoneyInput, Notice, PageHeader } from '../ui/ui';
import { Icon } from '../ui/icons';
import { comDesconto, descontoDoTexto, diaLocal, fecharPdv, formasPdv, itemVenda, lerPedidoWhatsapp, qtdNoProduto, resumoVendas, unidadeDeVenda } from '../core/vendas';
import { balancaDe, lerEtiquetaBalanca } from '../core/balanca';
import { formatBRL, parseNumberBR } from '../core/money';
import { norm, newId } from '../core/normalize';
import { formatCounterQty } from '../core/units';
import type { Product, Venda, VendaPausada } from '../types';

interface Linha {
  key: string;
  produtoId: string;
  qtd: number;
  unidade: string;
  /** valor impresso na etiqueta da balança (manda sobre o cálculo) */
  total?: number;
  /** desconto do item como digitado: "10%" ou "2,50" */
  desconto?: string;
}
interface Pago {
  key: string;
  forma: string;
  valor: number | null;
}
interface Rascunho {
  linhas: Linha[];
  desconto: { tipo: 'valor' | 'pct'; valor: number | null };
  pagos: Pago[];
  cliente: string;
}
const vazio = (): Rascunho => ({ linhas: [], desconto: { tipo: 'valor', valor: null }, pagos: [], cliente: '' });
let rascunho: Rascunho | null = null;

const n3 = (n: number) => String(Number(n.toFixed(3))).replace('.', ',');
const qtdTexto = (qtd: number, un: string) => (un === 'g' || un === 'ml' ? formatCounterQty(qtd, un) : `${n3(qtd)} ${un}`);
const atalhos = (un: string) => (un === 'g' || un === 'ml' ? [100, 250, 500, 1000] : [1, 2, 3, 5]);
const pareceEtiqueta = (t: string) => /^2\d{12}$/.test(t.replace(/\s/g, ''));

/** Campo de quantidade da linha: aceita vírgula; aplica ao sair do campo ou no Enter. */
function QtdLinha({ valor, unidade, rotulo, onChange }: { valor: number; unidade: string; rotulo: string; onChange: (n: number) => void }) {
  const [txt, setTxt] = useState(n3(valor));
  const [antes, setAntes] = useState(valor);
  if (antes !== valor) {
    setAntes(valor);
    setTxt(n3(valor));
  }
  const aplicar = () => {
    const n = parseNumberBR(txt);
    if (n != null && n > 0) onChange(n);
    else setTxt(n3(valor));
  };
  return (
    <span className="pdv-qtd-in">
      <input aria-label={rotulo} inputMode="decimal" value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={aplicar} onKeyDown={(e) => e.key === 'Enter' && aplicar()} />
      <small>{unidade}</small>
    </span>
  );
}

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
  const buscaRef = useRef<HTMLInputElement>(null);

  const porId = useMemo(() => new Map(lista.produtos.map((p) => [p.id, p])), [lista.produtos]);
  const vendaveis = useMemo(() => lista.produtos.filter((p) => p.venda != null && p.venda > 0).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [lista.produtos]);
  const achados = useMemo(() => {
    const q = norm(busca);
    if (!q || pareceEtiqueta(busca)) return [];
    return vendaveis.filter((p) => norm(p.nome).includes(q) || norm(p.categoria).includes(q) || String(p.plu ?? '') === busca.trim()).slice(0, 8);
  }, [busca, vendaveis]);

  // itens da venda com preço, desconto do item e estoque
  const itens = r.linhas.flatMap((l) => {
    const p = porId.get(l.produtoId);
    const calc = p ? itemVenda(p, l.qtd, l.unidade) : null;
    const base = calc && l.total != null ? { ...calc, total: l.total } : calc;
    const it = base ? comDesconto(base, descontoDoTexto(l.desconto, base.total)) : null;
    return p && it && base ? [{ l, p, it, tabela: base.total }] : [];
  });
  const fech = fecharPdv(itens.map((x) => x.it), r.desconto, r.pagos.map((pg) => ({ forma: pg.forma, valor: pg.valor ?? 0 })), config);
  const formas = formasPdv(config);
  const pausadas = config.vendasPausadas ?? [];

  const mudarLinha = (key: string, patch: Partial<Linha>) => atualizar((x) => ({ ...x, linhas: x.linhas.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const tirarLinha = (key: string) => atualizar((x) => ({ ...x, linhas: x.linhas.filter((l) => l.key !== key) }));

  function adicionar(p: Product, qtd: number, unidade = unidadeDeVenda(p), total?: number) {
    atualizar((x) => {
      const igual = total == null && x.linhas.find((l) => l.produtoId === p.id && l.unidade === unidade && l.total == null);
      if (igual) return { ...x, linhas: x.linhas.map((l) => (l === igual ? { ...l, qtd: Math.round((l.qtd + qtd) * 1000) / 1000 } : l)) };
      return { ...x, linhas: [...x.linhas, { key: newId(), produtoId: p.id, qtd, unidade, ...(total != null ? { total } : {}) }] };
    });
  }

  /** Código de barras da balança digitado ou lido no campo de busca. */
  function lerEtiqueta(codigo: string) {
    const r2 = lerEtiquetaBalanca(codigo, balancaDe(config.balanca), lista.produtos);
    setBusca('');
    if (!r2.ok) return toast(r2.motivo, 'erro');
    const p = r2.produto;
    const un = unidadeDeVenda(p);
    if (r2.gramas != null) {
      if (un !== 'g') return toast(`${p.nome} não é vendido por peso no sistema.`, 'erro');
      adicionar(p, r2.gramas, 'g');
    } else {
      const precoBase = un === 'g' ? (p.venda ?? 0) / 1000 : p.venda ?? 0;
      if (!precoBase) return toast(`${p.nome} está sem preço no sistema.`, 'erro');
      const qtd = un === 'g' ? Math.round(r2.valor! / precoBase) : Math.max(1, Math.round(r2.valor! / precoBase));
      adicionar(p, qtd, un, r2.valor);
    }
    toast(`${p.nome} adicionado pela etiqueta da balança.`);
  }

  function escolher(p: Product) {
    setSel(p);
    setQtdTxt('');
    setTimeout(() => qtdRef.current?.focus(), 0);
  }
  const qtdSel = parseNumberBR(qtdTxt);
  const previaSel = sel && qtdSel ? itemVenda(sel, qtdSel) : null;
  function confirmarSel() {
    if (!sel || !previaSel) return;
    adicionar(sel, qtdSel!);
    setSel(null);
    setBusca('');
    setQtdTxt('');
    setTimeout(() => buscaRef.current?.focus(), 0);
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

  // ---------- pagamento ----------
  function addPagamento(forma: string) {
    atualizar((x) => {
      const ja = x.pagos.find((pg) => pg.forma === forma);
      const pagoSemEste = x.pagos.filter((pg) => pg !== ja).reduce((a, pg) => a + (pg.valor ?? 0), 0);
      const falta = Math.max(0, fech.total - pagoSemEste);
      if (ja) return { ...x, pagos: x.pagos.map((pg) => (pg === ja ? { ...pg, valor: falta || pg.valor } : pg)) };
      return { ...x, pagos: [...x.pagos, { key: newId(), forma, valor: falta || null }] };
    });
  }

  // ---------- pausar, retomar, cancelar ----------
  function pausar() {
    if (!r.linhas.length) return;
    const p: VendaPausada = { id: newId(), quando: new Date().toISOString(), cliente: r.cliente.trim(), linhas: r.linhas.map(({ produtoId, qtd, unidade, total, desconto }) => ({ produtoId, qtd, unidade, ...(total != null ? { total } : {}), ...(desconto ? { desconto } : {}) })) };
    act.config((s) => ({ ...s, vendasPausadas: [...(s.vendasPausadas ?? []), p] }));
    rascunho = null;
    setR(vazio());
    toast('Venda pausada. Ela fica guardada aqui embaixo para você retomar.');
  }
  async function retomar(p: VendaPausada) {
    if (r.linhas.length && !(await confirm({ titulo: 'Trocar a venda atual?', mensagem: 'A venda que está aberta agora será pausada para você retomar depois.', confirmar: 'Pausar e retomar a outra' }))) return;
    if (r.linhas.length) pausar();
    act.config((s) => ({ ...s, vendasPausadas: (s.vendasPausadas ?? []).filter((x) => x.id !== p.id) }));
    const n: Rascunho = { ...vazio(), cliente: p.cliente, linhas: p.linhas.map((l) => ({ key: newId(), ...l })) };
    rascunho = n;
    setR(n);
  }
  async function cancelarAtual() {
    if (!r.linhas.length && !r.pagos.length) return;
    if (!(await confirm({ titulo: 'Cancelar esta venda?', mensagem: 'Os itens e os pagamentos lançados saem da tela. Nada foi registrado ainda.', confirmar: 'Cancelar venda', perigo: true }))) return;
    rascunho = null;
    setR(vazio());
  }

  function finalizar() {
    if (itens.length === 0) return toast('Adicione ao menos um produto.', 'erro');
    // sem pagamento lançado: assume que veio tudo na primeira forma escolhida (Pix)
    const pagamentos = r.pagos.length ? fech : fecharPdv(itens.map((x) => x.it), r.desconto, [{ forma: 'pix', valor: fech.total }], config);
    if (r.pagos.length && fech.falta > 0) return toast(`Ainda falta receber ${formatBRL(fech.falta)}.`, 'erro');
    if (r.pagos.length && fech.excesso > 0) return toast(`O pagamento passou ${formatBRL(fech.excesso)} da conta e não há dinheiro para dar troco. Ajuste os valores.`, 'erro');
    const principal = [...pagamentos.pagamentos].sort((a, b) => b.valor - a.valor)[0] ?? { forma: 'pix', label: 'Pix' };
    const venda: Venda = {
      id: newId(),
      quando: new Date().toISOString(),
      itens: itens.map((x) => x.it),
      desconto: pagamentos.desconto,
      total: pagamentos.total,
      pagamento: principal.forma,
      pagamentoLabel: pagamentos.pagamentos.map((p) => p.label).join(' + ') || principal.label,
      taxa: pagamentos.taxa,
      cliente: r.cliente.trim(),
      pagamentos: pagamentos.pagamentos,
      ...(pagamentos.troco > 0 ? { troco: pagamentos.troco } : {}),
    };
    act.registrarVenda(venda);
    rascunho = null;
    setR(vazio());
    setDia(diaLocal(new Date()));
    toast(pagamentos.troco > 0 ? `Venda registrada: ${formatBRL(venda.total)}. Troco: ${formatBRL(pagamentos.troco)}.` : `Venda registrada: ${formatBRL(venda.total)}.`);
    setTimeout(() => buscaRef.current?.focus(), 0);
  }

  async function cancelar(v: Venda) {
    const ok = await confirm({ titulo: 'Cancelar esta venda?', mensagem: `A venda de ${formatBRL(v.total)} sai dos totais e os produtos voltam para o estoque.`, confirmar: 'Cancelar venda', perigo: true });
    if (ok) act.cancelarVenda(v.id);
  }

  const doDia = (config.vendas ?? []).filter((v) => diaLocal(v.quando) === dia);
  const res = resumoVendas(doDia);

  return (
    <div className="page">
      <PageHeader titulo="Vendas (PDV)" subtitulo="Busque ou passe o código de barras, ajuste quantidades e descontos e receba em uma ou mais formas de pagamento. O estoque baixa sozinho." />

      {vendaveis.length === 0 && (
        <Notice tone="info">
          Nenhum produto com preço de venda ainda. Defina os preços em <Link to="/produtos">Produtos</Link> ou <Link to="/precificacao">Precificação</Link>.
        </Notice>
      )}

      <div className="pdv2">
        <div className="pdv2-esq">
          <section className="card pdv2-barra">
            <div className="pdv2-busca">
              <Icon name="search" />
              <input
                ref={buscaRef}
                type="search"
                aria-label="Buscar produto ou passar o código de barras"
                placeholder="Buscar produto ou passar o código de barras da balança"
                value={busca}
                autoComplete="off"
                onChange={(e) => {
                  setBusca(e.target.value);
                  setSel(null);
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  if (pareceEtiqueta(busca)) lerEtiqueta(busca);
                  else if (achados.length === 1) escolher(achados[0]);
                }}
              />
            </div>
            <div className="pdv2-acoes">
              <Button variant="ghost" icon="file" onClick={() => setColar((c) => (c == null ? '' : null))} aria-expanded={colar != null}>
                Pedido do WhatsApp
              </Button>
              <Button variant="secondary" onClick={pausar} disabled={!r.linhas.length}>
                Pausar venda
              </Button>
              <Button variant="danger" onClick={cancelarAtual} disabled={!r.linhas.length && !r.pagos.length}>
                Cancelar venda
              </Button>
            </div>
            {achados.length > 0 && (
              <ul className="pdv-lista pdv2-achados">
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
                          <input id="pdv-q" ref={qtdRef} inputMode="decimal" value={qtdTxt} onChange={(e) => setQtdTxt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmarSel()} autoComplete="off" />
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
              </ul>
            )}
            {busca.trim() && !pareceEtiqueta(busca) && achados.length === 0 && <p className="muted small">Nenhum produto com esse nome.</p>}
            {colar != null && (
              <div className="lote-colar">
                <label htmlFor="pdv-colar">Mensagem do pedido (do cardápio)</label>
                <textarea id="pdv-colar" rows={5} value={colar} onChange={(e) => setColar(e.target.value)} placeholder="Cole aqui a mensagem que o cliente mandou pelo cardápio." />
                <div className="row-gap">
                  <Button icon="check" onClick={lerColado} disabled={!colar.trim()}>
                    Adicionar itens do pedido
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="card pdv2-itens">
            {itens.length === 0 ? (
              <Empty icon="cart" titulo="Nenhum item na venda">
                Busque o produto pelo nome ou passe a etiqueta da balança no leitor.
              </Empty>
            ) : (
              <div className="table-scroll">
                <table className="table pdv2-tabela">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="num">Qtd.</th>
                      <th className="num">Desc.</th>
                      <th className="num">Subtotal</th>
                      <th className="c-actions">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map(({ l, p, it, tabela }) => {
                      const q = qtdNoProduto(p, l.qtd, l.unidade);
                      const falta = p.estoque != null && q != null && q.toNumber() > p.estoque;
                      return (
                        <tr key={l.key}>
                          <td className="strong pdv2-item">
                            {p.nome}
                            <small className={`pdv2-estoque ${falta ? 'falta' : ''}`}>
                              {formatBRL(p.venda)}/{p.unidade} · {p.estoque == null ? 'estoque não controlado' : `estoque ${n3(p.estoque)} ${p.unidade}`}
                              {falta && (
                                <span className="pdv2-alerta" role="img" aria-label="Estoque insuficiente" title="Estoque insuficiente">
                                  !
                                </span>
                              )}
                            </small>
                          </td>
                          <td className="num pdv2-c-qtd">
                            {l.total != null ? (
                              <span className="muted nowrap" title="Valor da etiqueta da balança">
                                {qtdTexto(l.qtd, l.unidade)}
                              </span>
                            ) : (
                              <QtdLinha valor={l.qtd} unidade={l.unidade} rotulo={`Quantidade de ${p.nome}`} onChange={(n) => mudarLinha(l.key, { qtd: n })} />
                            )}
                          </td>
                          <td className="num pdv2-c-desc">
                            <input
                              className={`pdv2-desc ${it.desconto ? 'on' : ''}`}
                              aria-label={`Desconto de ${p.nome} (ex.: 10% ou 2,50)`}
                              placeholder="0"
                              title="Digite 10% ou 2,50"
                              value={l.desconto ?? ''}
                              onChange={(e) => mudarLinha(l.key, { desconto: e.target.value })}
                            />
                          </td>
                          <td className="num strong nowrap pdv2-c-sub">
                            {it.desconto ? <s className="muted pdv2-riscado">{formatBRL(tabela)}</s> : null}
                            {formatBRL(it.total)}
                          </td>
                          <td className="c-actions">
                            <button type="button" className="icon-btn danger" aria-label={`Tirar ${p.nome} da venda`} onClick={() => tirarLinha(l.key)}>
                              <Icon name="trash" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <label className="pdv2-cliente">
              <span>Cliente</span>
              <input value={r.cliente} placeholder="Nome do cliente (opcional)" onChange={(e) => atualizar((x) => ({ ...x, cliente: e.target.value }))} />
            </label>
          </section>

          {pausadas.length > 0 && (
            <section className="card">
              <h2 className="pdv2-h">Vendas pausadas</h2>
              <ul className="pdv2-pausadas">
                {pausadas.map((p) => {
                  const total = p.linhas.reduce((a, l) => {
                    const prod = porId.get(l.produtoId);
                    const it = prod ? itemVenda(prod, l.qtd, l.unidade) : null;
                    const t = l.total ?? it?.total ?? 0;
                    return a + t - descontoDoTexto(l.desconto, t);
                  }, 0);
                  return (
                    <li key={p.id}>
                      <span>
                        <strong>{p.cliente || 'Sem nome'}</strong>
                        <small className="muted">
                          {' '}
                          · {p.linhas.length} item(ns) · {p.quando ? new Date(p.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </small>
                      </span>
                      <strong>{formatBRL(total)}</strong>
                      <Button variant="secondary" onClick={() => retomar(p)}>
                        Retomar
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <aside className="card pdv2-caixa" aria-label="Pagamento">
          <dl className="pdv2-totais">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatBRL(fech.bruto)}</dd>
            </div>
            {fech.descontoItens + fech.desconto > 0 && (
              <div>
                <dt>Descontos</dt>
                <dd>− {formatBRL(fech.descontoItens + fech.desconto)}</dd>
              </div>
            )}
            <div className="pdv2-total">
              <dt>Total</dt>
              <dd>{formatBRL(fech.total)}</dd>
            </div>
          </dl>
          <div className="pdv2-pagofalta">
            <div>
              <span>Pago</span>
              <strong>{formatBRL(fech.pago)}</strong>
            </div>
            <div className={fech.troco > 0 ? 'troco' : fech.falta > 0 && r.pagos.length ? 'falta' : ''}>
              <span>{fech.troco > 0 ? 'Troco' : 'Falta'}</span>
              <strong>{formatBRL(fech.troco > 0 ? fech.troco : r.pagos.length ? fech.falta : fech.total)}</strong>
            </div>
          </div>

          <div className="pdv2-formas">
            <span className="pdv2-rotulo">Receber em</span>
            <div className="pdv2-botoes-pag">
              {formas.map((f) => (
                <button key={f.id} type="button" className="pdv2-forma" onClick={() => addPagamento(f.id)} disabled={!itens.length}>
                  {f.label}
                </button>
              ))}
            </div>
            {r.pagos.length > 0 && (
              <ul className="pdv2-pagos">
                {r.pagos.map((pg) => {
                  const f = formas.find((x) => x.id === pg.forma);
                  return (
                    <li key={pg.key}>
                      <span>{f?.label ?? pg.forma}</span>
                      <MoneyInput ariaLabel={`Valor recebido em ${f?.label ?? pg.forma}`} value={pg.valor} onChange={(v) => atualizar((x) => ({ ...x, pagos: x.pagos.map((y) => (y.key === pg.key ? { ...y, valor: v } : y)) }))} />
                      <button type="button" className="icon-btn danger" aria-label={`Tirar pagamento em ${f?.label ?? pg.forma}`} onClick={() => atualizar((x) => ({ ...x, pagos: x.pagos.filter((y) => y.key !== pg.key) }))}>
                        <Icon name="x" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {fech.taxa > 0 && <p className="muted small">Taxa da maquininha: {formatBRL(fech.taxa)} · você recebe {formatBRL(fech.liquido)}</p>}
            {fech.excesso > 0 && <p className="pdv2-aviso">Passou {formatBRL(fech.excesso)} da conta sem dinheiro para dar troco.</p>}
          </div>

          <details className="pdv2-descvenda">
            <summary>Desconto na venda inteira</summary>
            <div className="row-gap">
              <select aria-label="Tipo de desconto" value={r.desconto.tipo} onChange={(e) => atualizar((x) => ({ ...x, desconto: { tipo: e.target.value as 'valor' | 'pct', valor: null } }))} style={{ maxWidth: 80 }}>
                <option value="valor">R$</option>
                <option value="pct">%</option>
              </select>
              {r.desconto.tipo === 'valor' ? (
                <MoneyInput ariaLabel="Desconto na venda" value={r.desconto.valor} onChange={(v) => atualizar((x) => ({ ...x, desconto: { tipo: 'valor', valor: v } }))} />
              ) : (
                <input
                  aria-label="Desconto na venda"
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
          </details>

          <Button icon="check" onClick={finalizar} disabled={!itens.length || (r.pagos.length > 0 && (fech.falta > 0 || fech.excesso > 0))} className="pdv-registrar">
            {r.pagos.length ? 'Finalizar venda' : `Finalizar no Pix · ${formatBRL(fech.total)}`}
          </Button>
          {!r.pagos.length && itens.length > 0 && <p className="muted small">Sem forma escolhida, a venda entra como Pix. Para outra forma ou para dividir, toque em “Receber em”.</p>}
        </aside>
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
