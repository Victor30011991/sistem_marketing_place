import { Fragment, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Empty, Field, MoneyInput, Notice, PageHeader } from '../ui/ui';
import { Icon } from '../ui/icons';
import { aplicarLote, calcularLote, itemVazio, loteVazio, sugerirCategoria, sugerirProduto } from '../core/lote';
import { lerNFeXml, lerTextoNota, type NotaLida } from '../core/nota';
import { formatBRL, parseNumberBR } from '../core/money';
import { norm } from '../core/normalize';
import type { Lote, LoteItem, Product } from '../types';

const UNIDADES = ['kg', 'g', 'pacote', 'caixa', 'frasco', 'L', 'ml', 'un'];

// o rascunho sobrevive quando a pessoa troca de tela (some ao fechar a página)
let rascunho: Lote | null = null;
let avisosRascunho: string[] = [];

const dataBR = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split('-').reverse().join('/') : iso || '—');
const qtdTxt = (n: number) => String(Number(n.toFixed(3))).replace('.', ',');

/** Campo de quantidade (aceita vírgula). */
function Qtd({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [txt, setTxt] = useState(value ? qtdTxt(value) : '');
  const foco = useRef(false);
  const [antes, setAntes] = useState(value);
  if (!foco.current && antes !== value) {
    setAntes(value);
    setTxt(value ? qtdTxt(value) : '');
  }
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      autoComplete="off"
      className="num-in"
      value={txt}
      onFocus={() => (foco.current = true)}
      onBlur={() => {
        foco.current = false;
        setTxt(value ? qtdTxt(value) : '');
      }}
      onChange={(e) => {
        setTxt(e.target.value);
        const n = parseNumberBR(e.target.value);
        onChange(n != null && n >= 0 ? n : 0);
      }}
    />
  );
}

export default function Lotes() {
  useDocumentTitle('Lotes de compra');
  const { state, act } = useApp();
  const { toast, confirm } = useFeedback();
  const { lista, config } = state;
  const [lote, setLoteBruto] = useState<Lote>(() => rascunho ?? loteVazio());
  const [avisos, setAvisos] = useState<string[]>(avisosRascunho);
  const [colar, setColar] = useState('');
  const [mostrarColar, setMostrarColar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setLote = (fn: (l: Lote) => Lote) =>
    setLoteBruto((l) => {
      const n = fn(l);
      rascunho = n;
      return n;
    });
  const mudar = (patch: Partial<Lote>) => setLote((l) => ({ ...l, ...patch }));
  const mudarItem = (id: string, patch: Partial<LoteItem>) => setLote((l) => ({ ...l, itens: l.itens.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const removerItem = (id: string) => setLote((l) => ({ ...l, itens: l.itens.filter((i) => i.id !== id) }));
  const novoItem = () => setLote((l) => ({ ...l, itens: [...l.itens, itemVazio()] }));

  const produtosOrd = useMemo(() => [...lista.produtos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [lista.produtos]);
  const porId = useMemo(() => new Map(lista.produtos.map((p) => [p.id, p])), [lista.produtos]);
  const calc = useMemo(() => calcularLote(lote), [lote]);
  const previa = useMemo(() => aplicarLote(lote, lista.produtos, lista.categorias), [lote, lista.produtos, lista.categorias]);
  const jaAplicado = (config.lotes ?? []).find((l) => l.numero && l.numero === lote.numero.trim() && norm(l.fornecedor) === norm(lote.fornecedor));

  // ---------- entrada da nota ----------
  function receber(nota: NotaLida, origem: string) {
    const itens = nota.itens.map((it) => {
      const s = sugerirProduto(it.nome, lista.produtos);
      return { ...it, produtoId: s ? s.id : null, categoria: s ? '' : sugerirCategoria(it.ncm, lista.categorias, it.nome) };
    });
    const l: Lote = { ...loteVazio(), fornecedor: nota.fornecedor, numero: nota.numero, data: nota.data || new Date().toISOString().slice(0, 10), frete: nota.frete, desconto: nota.desconto, outras: nota.outras, itens };
    rascunho = l;
    avisosRascunho = nota.avisos;
    setLoteBruto(l);
    setAvisos(nota.avisos);
    const ligados = itens.filter((i) => i.produtoId).length;
    toast(`${origem}: ${itens.length} itens lidos, ${ligados} já ligados a produtos seus. Confira a tabela antes de aplicar.`);
  }

  async function lerArquivo(file: File | undefined) {
    if (!file) return;
    let texto: string;
    try {
      texto = await file.text();
    } catch {
      return toast('Não foi possível ler o arquivo. Tente de novo.', 'erro');
    }
    const r = lerNFeXml(texto);
    if (!r.ok) return toast(r.motivo, 'erro');
    receber(r, 'XML da nota');
  }

  function lerColado() {
    const r = lerTextoNota(colar);
    if (!r.ok) return toast('Não consegui achar os itens neste texto. Use o XML da nota ou preencha à mão.', 'erro');
    receber(r, 'Texto da nota');
    setColar('');
    setMostrarColar(false);
  }

  async function descartar() {
    if (lote.itens.length > 0 && !(await confirm({ titulo: 'Descartar este lote?', mensagem: 'Os itens que você conferiu ou digitou serão apagados. Nada foi aplicado ao estoque ainda.', confirmar: 'Descartar', perigo: true }))) return;
    rascunho = null;
    avisosRascunho = [];
    setAvisos([]);
    setLoteBruto(loteVazio());
  }

  // ---------- aplicar ----------
  async function aplicar() {
    const faltaNome = lote.itens.filter((i) => i.qtd > 0 && !i.produtoId && !i.nome.trim());
    if (lote.itens.length === 0) return toast('Adicione os itens da nota primeiro.', 'erro');
    if (faltaNome.length) return toast('Há item novo sem nome. Dê um nome ou ligue a um produto.', 'erro');
    if (previa.atualizados + previa.novos === 0) return toast('Nenhum item pode ser aplicado. Veja os avisos na tabela.', 'erro');
    const subiram = previa.linhas.filter((l) => l.variacaoPct != null && l.variacaoPct > 0).length;
    const ok = await confirm({
      titulo: 'Aplicar este lote?',
      confirmar: 'Aplicar lote',
      mensagem: (
        <>
          <p>
            Vão ser atualizados <strong>{previa.atualizados}</strong> produto(s) e criados <strong>{previa.novos}</strong> novo(s). O estoque soma as quantidades da nota e o custo passa a incluir frete e demais despesas.
            {subiram > 0 && <> O custo sobe em {subiram} produto(s): revise os preços de venda depois.</>}
          </p>
          {previa.ignorados > 0 && <p>{previa.ignorados} item(ns) com problema ficam de fora.</p>}
          {jaAplicado && (
            <p>
              <strong>Atenção:</strong> uma nota {jaAplicado.numero} deste fornecedor já foi aplicada em {dataBR(jaAplicado.aplicadoEm ?? jaAplicado.data)}. Aplicar de novo soma o estoque em dobro.
            </p>
          )}
        </>
      ),
    });
    if (!ok) return;
    act.aplicarLote(previa.produtos, previa.categorias, { ...lote, numero: lote.numero.trim(), fornecedor: lote.fornecedor.trim(), aplicadoEm: new Date().toISOString() });
    rascunho = null;
    avisosRascunho = [];
    setAvisos([]);
    setLoteBruto(loteVazio());
    toast(previa.novos > 0 ? `Lote aplicado. ${previa.novos} produto(s) novo(s) estão sem preço de venda: abra Precificação e use “Ver sugestões para todos os produtos”.` : `Lote aplicado: ${previa.atualizados} produto(s) atualizado(s). Confira os preços em Precificação.`);
  }

  async function excluirRegistro(l: Lote) {
    const ok = await confirm({ titulo: 'Excluir o registro deste lote?', mensagem: 'Só o histórico é apagado. O estoque e os custos que ele já alterou continuam como estão.', confirmar: 'Excluir registro', perigo: true });
    if (ok) act.config((s) => ({ ...s, lotes: (s.lotes ?? []).filter((x) => x.id !== l.id) }));
  }

  const vazio = lote.itens.length === 0;
  const novos = lote.itens.filter((i) => !i.produtoId).length;
  const categoriasLista = lista.categorias;

  return (
    <div className="page">
      <PageHeader
        titulo="Lotes de compra"
        subtitulo="Lance a nota do fornecedor com todos os itens. O frete, o juros e as demais despesas são divididos entre os produtos, e cada um ganha o custo real, o estoque e o aviso de quanto subiu ou desceu."
      />

      {vazio && (
        <section className="card lote-entrada">
          <h2>Como você quer lançar a nota?</h2>
          <div className="lote-opcoes">
            <button type="button" className="lote-opcao" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={24} />
              <strong>Enviar o XML da nota</strong>
              <span>O mais exato. É o arquivo .xml que o fornecedor manda junto com a nota (NF-e).</span>
            </button>
            <button type="button" className="lote-opcao" onClick={() => setMostrarColar((v) => !v)} aria-expanded={mostrarColar}>
              <Icon name="file" size={24} />
              <strong>Colar o texto do PDF</strong>
              <span>Abra o PDF da nota, selecione tudo (Ctrl+A), copie (Ctrl+C) e cole aqui.</span>
            </button>
            <button type="button" className="lote-opcao" onClick={novoItem}>
              <Icon name="edit" size={24} />
              <strong>Digitar à mão</strong>
              <span>Para compras sem nota ou com poucos itens.</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" hidden onChange={(e) => { lerArquivo(e.target.files?.[0]); e.target.value = ''; }} />
          {mostrarColar && (
            <div className="lote-colar">
              <label htmlFor="colar-nota">Texto copiado do PDF da nota</label>
              <textarea id="colar-nota" rows={8} value={colar} onChange={(e) => setColar(e.target.value)} placeholder="Cole aqui o texto da nota inteira, com os produtos e os totais." />
              <div className="row-gap">
                <Button icon="check" onClick={lerColado} disabled={!colar.trim()}>
                  Ler a nota
                </Button>
                <span className="muted small">Você confere tudo na tabela antes de aplicar. Se faltar item, use o XML.</span>
              </div>
            </div>
          )}
          <p className="muted small">Nada é aplicado ao estoque nem aos custos até você conferir e confirmar.</p>
        </section>
      )}

      {!vazio && (
        <>
          {avisos.map((a) => (
            <Notice key={a} tone="warn">
              {a}
            </Notice>
          ))}
          {calc.avisos.map((a) => (
            <Notice key={a} tone="warn">
              {a}
            </Notice>
          ))}

          <section className="card">
            <div className="card-head">
              <h2>Dados da compra</h2>
              <Button variant="ghost" icon="x" onClick={descartar}>
                Descartar lote
              </Button>
            </div>
            <div className="lote-cab">
              <Field label="Fornecedor">{(id) => <input id={id} value={lote.fornecedor} onChange={(e) => mudar({ fornecedor: e.target.value })} />}</Field>
              <Field label="Nº da nota">{(id) => <input id={id} value={lote.numero} onChange={(e) => mudar({ numero: e.target.value })} inputMode="numeric" />}</Field>
              <Field label="Data">{(id) => <input id={id} type="date" value={lote.data} onChange={(e) => mudar({ data: e.target.value })} />}</Field>
              <Field label="Frete" hint="Valor do frete da nota.">
                {(id) => <MoneyInput id={id} value={lote.frete || null} onChange={(v) => mudar({ frete: v ?? 0 })} />}
              </Field>
              <Field label="Juros" hint="Se comprou parcelado ou a prazo.">
                {(id) => <MoneyInput id={id} value={lote.juros || null} onChange={(v) => mudar({ juros: v ?? 0 })} />}
              </Field>
              <Field label="Impostos e outras despesas" hint="Imposto de entrada, taxas, seguro…">
                {(id) => <MoneyInput id={id} value={lote.outras || null} onChange={(v) => mudar({ outras: v ?? 0 })} />}
              </Field>
              <Field label="Desconto da nota" hint="Só o que não está nos itens.">
                {(id) => <MoneyInput id={id} value={lote.desconto || null} onChange={(v) => mudar({ desconto: v ?? 0 })} />}
              </Field>
              <Field label="Dividir o frete por" hint={calc.metodo === 'valor' && lote.rateio === 'peso' ? 'Caiu para valor: há item sem peso.' : 'Peso é o mais justo para o frete. Juros, impostos e desconto são sempre divididos pelo valor.'}>
                {(id) => (
                  <select id={id} value={lote.rateio} onChange={(e) => mudar({ rateio: e.target.value as Lote['rateio'] })}>
                    <option value="peso">Peso (kg)</option>
                    <option value="valor">Valor de cada item</option>
                  </select>
                )}
              </Field>
              <Field label="Custo do produto fica" hint="Médio mistura o estoque que você já tem com esta compra.">
                {(id) => (
                  <select id={id} value={lote.custo} onChange={(e) => mudar({ custo: e.target.value as Lote['custo'] })}>
                    <option value="medio">Custo médio (com o estoque)</option>
                    <option value="ultimo">Custo desta compra</option>
                  </select>
                )}
              </Field>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>
                Itens da nota <span className="muted small">· {lote.itens.length}</span>
              </h2>
              <Button variant="secondary" icon="plus" onClick={novoItem}>
                Adicionar item
              </Button>
            </div>
            <p className="muted small">
              Ligue cada item ao produto certo. {novos > 0 && <>Os {novos} sem produto serão <strong>criados</strong> com o custo real, e você define o preço depois.</>} O custo real inclui a parte do frete de cada item.
            </p>
            <div className="table-scroll">
              <table className="table lote-table">
                <thead>
                  <tr>
                    <th>Nome na nota</th>
                    <th>Produto no sistema</th>
                    <th className="num">Qtd.</th>
                    <th>Un.</th>
                    <th className="num">Valor</th>
                    <th className="num">Desc.</th>
                    <th className="num">Custo real / kg</th>
                    <th className="c-actions">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lote.itens.map((it, i) => {
                    const c = calc.itens[i];
                    const p: Product | undefined = it.produtoId ? porId.get(it.produtoId) : undefined;
                    const confira = p && norm(p.nome) !== norm(it.nome);
                    return (
                      <Fragment key={it.id}>
                        <tr>
                          <td className="strong">
                            <input aria-label={`Nome do item ${i + 1} na nota`} value={it.nome} onChange={(e) => mudarItem(it.id, { nome: e.target.value })} />
                          </td>
                          <td>
                            <select
                              aria-label={`Produto para ${it.nome || `item ${i + 1}`}`}
                              value={it.produtoId ?? ''}
                              onChange={(e) => {
                                const id = e.target.value || null;
                                const nomeProd = id ? porId.get(id)?.nome ?? '' : '';
                                mudarItem(it.id, { produtoId: id, nome: it.nome.trim() ? it.nome : nomeProd, categoria: id ? '' : it.categoria || sugerirCategoria(it.ncm, categoriasLista, it.nome) });
                              }}
                            >
                              <option value="">➕ Criar produto novo</option>
                              {produtosOrd.map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.nome}
                                </option>
                              ))}
                            </select>
                            {confira && <small className="lote-confira">Confira: parecido com “{p!.nome}”</small>}
                            {!it.produtoId && (
                              <>
                                <input
                                  aria-label={`Categoria do produto novo ${it.nome}`}
                                  className="lote-cat"
                                  list="lote-categorias"
                                  placeholder="Categoria do produto novo"
                                  value={it.categoria}
                                  onChange={(e) => mudarItem(it.id, { categoria: e.target.value })}
                                />
                              </>
                            )}
                          </td>
                          <td className="num">
                            <Qtd label={`Quantidade de ${it.nome || `item ${i + 1}`}`} value={it.qtd} onChange={(v) => mudarItem(it.id, { qtd: v })} />
                          </td>
                          <td>
                            <select aria-label={`Unidade de ${it.nome || `item ${i + 1}`}`} value={it.unidade} onChange={(e) => mudarItem(it.id, { unidade: e.target.value })}>
                              {(UNIDADES.includes(it.unidade) ? UNIDADES : [...UNIDADES, it.unidade]).map((u) => (
                                <option key={u}>{u}</option>
                              ))}
                            </select>
                          </td>
                          <td className="num">
                            <MoneyInput ariaLabel={`Valor de ${it.nome || `item ${i + 1}`}`} value={it.valor || null} onChange={(v) => mudarItem(it.id, { valor: v ?? 0 })} />
                          </td>
                          <td className="num">
                            <MoneyInput ariaLabel={`Desconto de ${it.nome || `item ${i + 1}`}`} value={it.desconto || null} onChange={(v) => mudarItem(it.id, { desconto: v ?? 0 })} />
                          </td>
                          <td className="num strong">{c.custoKg != null ? formatBRL(c.custoKg) : c.custoUnidade != null ? `${formatBRL(c.custoUnidade)} / ${it.unidade}` : '—'}</td>
                          <td className="c-actions">
                            <button type="button" className="icon-btn danger" aria-label={`Remover ${it.nome || `item ${i + 1}`}`} onClick={() => removerItem(it.id)}>
                              <Icon name="trash" />
                            </button>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <datalist id="lote-categorias">
              {categoriasLista.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </section>

          <section className="card">
            <h2>Resumo do lote</h2>
            <dl className="lote-resumo">
              <div><dt>Produtos</dt><dd>{formatBRL(calc.totais.produtos)}</dd></div>
              {calc.totais.descontoItens + calc.totais.descontoNota > 0 && <div><dt>Descontos</dt><dd>− {formatBRL(calc.totais.descontoItens + calc.totais.descontoNota)}</dd></div>}
              {calc.totais.frete > 0 && <div><dt>Frete</dt><dd>+ {formatBRL(calc.totais.frete)}</dd></div>}
              {calc.totais.juros > 0 && <div><dt>Juros</dt><dd>+ {formatBRL(calc.totais.juros)}</dd></div>}
              {calc.totais.outras > 0 && <div><dt>Impostos e outras despesas</dt><dd>+ {formatBRL(calc.totais.outras)}</dd></div>}
              <div className="total"><dt>Total do lote</dt><dd>{formatBRL(calc.totais.total)}</dd></div>
              {calc.totais.kg != null && <div><dt>Peso</dt><dd>{qtdTxt(calc.totais.kg)} kg</dd></div>}
              <div><dt>Custos extras sobre os produtos</dt><dd>{String(calc.totais.extrasPct).replace('.', ',')}%</dd></div>
            </dl>
            {lote.numero && <p className="muted small">Confira se o total bate com o “Valor total da nota”: {formatBRL(calc.totais.total)}.</p>}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>O que vai mudar</h2>
              <span className="muted small">
                {previa.atualizados} atualizado(s) · {previa.novos} novo(s){previa.ignorados > 0 && ` · ${previa.ignorados} com problema`}
              </span>
            </div>
            <details>
              <summary>Ver custo e estoque antes e depois, produto por produto</summary>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th className="num">Estoque</th>
                      <th className="num">Custo antes</th>
                      <th className="num">Custo depois</th>
                      <th className="num">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.linhas.map((l) => (
                      <tr key={l.itemId}>
                        <td className="strong">
                          {l.nome}
                          {l.novo && <span className="chip chip-accent lote-chip">novo</span>}
                          {l.problema && <small className="lote-confira">{l.problema}</small>}
                        </td>
                        <td className="num muted">{l.problema ? '—' : `${l.estoqueAntes != null ? qtdTxt(l.estoqueAntes) : 0} → ${qtdTxt(l.estoqueDepois)} ${l.unidade}`}</td>
                        <td className="num muted">{l.custoAntes != null ? formatBRL(l.custoAntes) : '—'}</td>
                        <td className="num">{l.custoDepois != null ? formatBRL(l.custoDepois) : '—'}</td>
                        <td className={`num ${l.variacaoPct != null && l.variacaoPct > 5 ? 'lote-sobe' : l.variacaoPct != null && l.variacaoPct < -5 ? 'lote-desce' : 'muted'}`}>
                          {l.variacaoPct == null ? '—' : `${l.variacaoPct > 0 ? '+' : ''}${String(l.variacaoPct).replace('.', ',')}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <div className="row-gap wrap">
              <Button icon="check" onClick={aplicar}>
                Aplicar lote ao estoque e aos custos
              </Button>
              <span className="muted small">Depois, abra <Link to="/precificacao">Precificação</Link> para ver os preços sugeridos.</span>
            </div>
          </section>
        </>
      )}

      <section className="card">
        <h2>Lotes já aplicados</h2>
        {(config.lotes ?? []).length === 0 ? (
          <Empty icon="truck" titulo="Nenhum lote aplicado ainda">
            Depois que você aplicar uma nota, ela fica registrada aqui. O histórico é guardado no Excel e no backup .txt.
          </Empty>
        ) : (
          <ul className="lote-hist">
            {(config.lotes ?? []).map((l) => {
              const c = calcularLote(l);
              return (
                <li key={l.id}>
                  <details>
                    <summary>
                      <span className="strong">{l.fornecedor || 'Sem fornecedor'}</span>
                      <span className="muted">{l.numero ? `Nota ${l.numero} · ` : ''}{dataBR(l.data)}</span>
                      <span className="muted">{l.itens.length} itens</span>
                      <strong>{formatBRL(c.totais.total)}</strong>
                    </summary>
                    <div className="table-scroll">
                      <table className="table">
                        <thead>
                          <tr><th>Item</th><th className="num">Qtd.</th><th className="num">Custo real / kg</th></tr>
                        </thead>
                        <tbody>
                          {l.itens.map((it, i) => (
                            <tr key={it.id}>
                              <td className="strong">{it.nome}</td>
                              <td className="num muted">{qtdTxt(it.qtd)} {it.unidade}</td>
                              <td className="num">{c.itens[i].custoKg != null ? formatBRL(c.itens[i].custoKg) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="row-gap">
                      <Button variant="ghost" icon="trash" onClick={() => excluirRegistro(l)}>
                        Excluir registro
                      </Button>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
