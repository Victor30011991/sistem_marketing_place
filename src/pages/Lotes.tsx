import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Empty, Field, MoneyInput, Notice, PageHeader } from '../ui/ui';
import { Icon } from '../ui/icons';
import { aplicarLote, calcularLote, itemVazio, loteVazio, REGRA_PADRAO, sugerirCategoria, sugerirProduto } from '../core/lote';
import { suggestedCents } from '../core/pricing';
import { lerNFeXml, lerTextoNota, type NotaLida } from '../core/nota';
import { formatBRL, parseNumberBR } from '../core/money';
import { norm } from '../core/normalize';
import type { Lote, LoteItem, Product, RegraPreco } from '../types';

const UNIDADES = ['kg', 'g', 'pacote', 'caixa', 'frasco', 'L', 'ml', 'un'];

// o rascunho sobrevive quando a pessoa troca de tela (some ao fechar a página)
let rascunho: Lote | null = null;
let avisosRascunho: string[] = [];
// nota que chegou pelo "Importar arquivo" e deve abrir já preenchida aqui
let notaPendente: { nota: NotaLida; origem: string } | null = null;
export function lancarNota(nota: NotaLida, origem: string) {
  notaPendente = { nota, origem };
}

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
  // a regra de preço da última nota fica lembrada para a próxima
  const regraLembrada: RegraPreco = config.lotes?.[0]?.preco ?? REGRA_PADRAO;
  const novoLote = () => loteVazio(regraLembrada);
  const [lote, setLoteBruto] = useState<Lote>(() => rascunho ?? novoLote());
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
  const previa = useMemo(() => aplicarLote(lote, lista.produtos, lista.categorias, (p) => suggestedCents(p, config)), [lote, lista.produtos, lista.categorias, config]);
  const regra = lote.preco ?? { ...REGRA_PADRAO, modo: 'manter' as const };
  const mudarRegra = (patch: Partial<RegraPreco>) => mudar({ preco: { ...regra, ...patch } });
  const jaAplicado = (config.lotes ?? []).find((l) => l.numero && l.numero === lote.numero.trim() && norm(l.fornecedor) === norm(lote.fornecedor));

  // ---------- entrada da nota ----------
  function receber(nota: NotaLida, origem: string) {
    const itens = nota.itens.map((it) => {
      const s = sugerirProduto(it.nome, lista.produtos);
      return { ...it, produtoId: s ? s.id : null, categoria: s ? '' : sugerirCategoria(it.ncm, lista.categorias, it.nome) };
    });
    const l: Lote = { ...novoLote(), fornecedor: nota.fornecedor, numero: nota.numero, data: nota.data || new Date().toISOString().slice(0, 10), frete: nota.frete, desconto: nota.desconto, outras: nota.outras, itens };
    rascunho = l;
    avisosRascunho = nota.avisos;
    setLoteBruto(l);
    setAvisos(nota.avisos);
    const ligados = itens.filter((i) => i.produtoId).length;
    toast(`${origem}: ${itens.length} itens lidos, ${ligados} já ligados a produtos seus. Confira a tabela antes de aplicar.`);
  }

  useEffect(() => {
    if (!notaPendente) return;
    const n = notaPendente;
    notaPendente = null;
    receber(n.nota, n.origem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setLoteBruto(novoLote());
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
            Vão ser atualizados <strong>{previa.atualizados}</strong> produto(s) e criados <strong>{previa.novos}</strong> novo(s). O estoque soma as quantidades da nota, o custo passa a incluir frete e despesas{regra.modo !== 'manter' ? ' e o preço de venda segue a regra escolhida' : ''}.
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
    setLoteBruto(novoLote());
    toast(regra.modo === 'manter' && previa.novos > 0 ? `Lote aplicado. ${previa.novos} produto(s) novo(s) estão sem preço de venda: defina em Produtos ou Precificação.` : `Lote aplicado: ${previa.atualizados} atualizado(s), ${previa.novos} novo(s), com estoque, custo e preço.`);
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

          <section className="card lote-passo">
            <div className="card-head">
              <h2>1. Confira a nota</h2>
              <Button variant="ghost" icon="x" onClick={descartar}>
                Descartar lote
              </Button>
            </div>
            <div className="lote-cab">
              <Field label="Fornecedor">{(id) => <input id={id} value={lote.fornecedor} onChange={(e) => mudar({ fornecedor: e.target.value })} />}</Field>
              <Field label="Nº da nota">{(id) => <input id={id} value={lote.numero} onChange={(e) => mudar({ numero: e.target.value })} inputMode="numeric" />}</Field>
              <Field label="Data">{(id) => <input id={id} type="date" value={lote.data} onChange={(e) => mudar({ data: e.target.value })} />}</Field>
              <Field label="Desconto da nota" hint="Só o que não está nos itens.">
                {(id) => <MoneyInput id={id} value={lote.desconto || null} onChange={(v) => mudar({ desconto: v ?? 0 })} />}
              </Field>
            </div>
            <p className="muted small">Total desta nota pelo sistema: <strong>{formatBRL(calc.totais.total)}</strong>. Confira se bate com o “Valor total da nota”.</p>
          </section>

          <section className="card lote-passo">
            <h2>2. Frete</h2>
            <div className="lote-cab">
              <Field label="Valor do frete" hint="Já vem da nota. Some aqui se pagou outro frete por fora.">
                {(id) => <MoneyInput id={id} value={lote.frete || null} onChange={(v) => mudar({ frete: v ?? 0 })} />}
              </Field>
              <Field label="Dividir o frete por" hint={calc.metodo === 'valor' && lote.rateio === 'peso' ? 'Caiu para valor: há item sem peso.' : 'Por quilo: cada kg recebe a mesma parte do frete.'}>
                {(id) => (
                  <select id={id} value={lote.rateio} onChange={(e) => mudar({ rateio: e.target.value as Lote['rateio'] })}>
                    <option value="peso">Quilo (recomendado)</option>
                    <option value="valor">Valor de cada item</option>
                  </select>
                )}
              </Field>
            </div>
            {calc.totais.kg != null && lote.frete > 0 && (
              <p className="muted small">
                {formatBRL(lote.frete)} ÷ {qtdTxt(calc.totais.kg)} kg = <strong>{formatBRL(Math.round(lote.frete / calc.totais.kg))} por kg</strong> de frete em cada produto.
              </p>
            )}
          </section>

          <section className="card lote-passo">
            <h2>3. Imposto pago por fora</h2>
            <Notice tone="warn">
              O <strong>ICMS, PIS e COFINS que aparecem na nota já estão no preço</strong> dos produtos. Não some de novo: isso deixa o custo e o preço mais altos do que deveriam.
            </Notice>
            <div className="lote-cab">
              <Field label="Guia de imposto paga por esta compra" hint="Ex.: guia de ICMS (antecipação ou diferencial de alíquota). Deixe vazio se não pagou.">
                {(id) => <MoneyInput id={id} value={lote.outras || null} onChange={(v) => mudar({ outras: v ?? 0 })} />}
              </Field>
            </div>
          </section>

          <section className="card lote-passo">
            <h2>4. Juros</h2>
            <div className="lote-cab">
              <Field label="Juros da compra" hint="Se comprou a prazo ou parcelado. À vista: deixe vazio.">
                {(id) => <MoneyInput id={id} value={lote.juros || null} onChange={(v) => mudar({ juros: v ?? 0 })} />}
              </Field>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>
                5. Produtos <span className="muted small">· {lote.itens.length} itens na nota</span>
              </h2>
              <Button variant="secondary" icon="plus" onClick={novoItem}>
                Adicionar item
              </Button>
            </div>
            <p className="muted small">
              Confira o produto de cada item e corrija só os errados. Para juntar itens num produto só (ex.: as argilas), escolha o mesmo produto neles. {novos > 0 && <>Os {novos} sem produto serão <strong>criados</strong> com o custo real, e você define o preço depois.</>} O custo real inclui a parte do frete de cada item.
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

          <section className="card lote-passo">
            <h2>6. Preço de venda</h2>
            <div className="lote-regra" role="radiogroup" aria-label="Como definir o preço de venda">
              {(
                [
                  ['multiplicador', 'Custo real × número', 'O seu jeito: ex. custo × 2, arredondado.'],
                  ['sugerido', 'Pela margem do sistema', 'Usa custos fixos, taxas e margem da Precificação.'],
                  ['manter', 'Manter o preço atual', 'Só atualiza custo e estoque. Produto novo fica sem preço.'],
                ] as [RegraPreco['modo'], string, string][]
              ).map(([m, t, d]) => (
                <label key={m} className={`lote-opcao ${regra.modo === m ? 'on' : ''}`}>
                  <input type="radio" name="regra-preco" checked={regra.modo === m} onChange={() => mudarRegra({ modo: m })} />
                  <strong>{t}</strong>
                  <span>{d}</span>
                </label>
              ))}
            </div>
            {regra.modo !== 'manter' && (
              <div className="lote-cab">
                {regra.modo === 'multiplicador' && (
                  <Field label="Multiplicar o custo real por" hint="2 = preço é o dobro do custo.">
                    {() => <Qtd label="Multiplicar o custo real por" value={regra.fator} onChange={(v) => mudarRegra({ fator: v })} />}
                  </Field>
                )}
                <Field label="Arredondar o preço do kg para">
                  {(id) => (
                    <select id={id} value={regra.passo} onChange={(e) => mudarRegra({ passo: Number(e.target.value) })}>
                      <option value={50}>R$ 0,50 mais próximo</option>
                      <option value={100}>R$ 1,00 mais próximo</option>
                      <option value={10}>R$ 0,10 mais próximo</option>
                      <option value={1}>Não arredondar</option>
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
            )}
          </section>

          <section className="card lote-passo">
            <div className="card-head">
              <h2>7. Resumo e confirmação</h2>
              <span className="muted small">
                {previa.atualizados} atualizado(s) · {previa.novos} novo(s){previa.ignorados > 0 && ` · ${previa.ignorados} com problema`}
              </span>
            </div>
            <dl className="lote-resumo">
              <div><dt>Produtos</dt><dd>{formatBRL(calc.totais.produtos)}</dd></div>
              {calc.totais.descontoItens + calc.totais.descontoNota > 0 && <div><dt>Descontos</dt><dd>− {formatBRL(calc.totais.descontoItens + calc.totais.descontoNota)}</dd></div>}
              {calc.totais.frete > 0 && <div><dt>Frete</dt><dd>+ {formatBRL(calc.totais.frete)}</dd></div>}
              {calc.totais.outras > 0 && <div><dt>Guia de imposto</dt><dd>+ {formatBRL(calc.totais.outras)}</dd></div>}
              {calc.totais.juros > 0 && <div><dt>Juros</dt><dd>+ {formatBRL(calc.totais.juros)}</dd></div>}
              <div className="total"><dt>Total pago</dt><dd>{formatBRL(calc.totais.total)}</dd></div>
              {calc.totais.kg != null && <div><dt>Peso</dt><dd>{qtdTxt(calc.totais.kg)} kg · média de {formatBRL(Math.round(calc.totais.total / calc.totais.kg))}/kg</dd></div>}
            </dl>
            <div className="table-scroll">
              <table className="table lote-final">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="num">Custo real / kg</th>
                    <th className="num">Venda / kg</th>
                    <th className="num">Venda / 100 g</th>
                    <th className="num">Preço antes</th>
                    <th className="num">Estoque</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.linhas.map((l) => {
                    const porKg = (v: number | null | undefined) => (v == null ? null : l.unidade === 'g' ? Math.round(v * 1000) : v);
                    const vk = porKg(l.vendaDepois);
                    const antes = porKg(l.vendaAntes);
                    const kg = l.unidade === 'kg' || l.unidade === 'g';
                    return (
                      <tr key={l.itemId}>
                        <td className="strong">
                          {l.nome}
                          {l.novo && <span className="chip chip-accent lote-chip">novo</span>}
                          {l.problema && <small className="lote-confira">{l.problema}</small>}
                        </td>
                        <td className="num">{l.custoDepois != null ? formatBRL(porKg(l.custoDepois)) : '—'}{!kg && l.custoDepois != null && <small className="muted"> /{l.unidade}</small>}</td>
                        <td className="num strong">{vk != null ? formatBRL(vk) : <span className="lote-sobe">sem preço</span>}</td>
                        <td className="num">{vk != null && kg ? formatBRL(Math.round(vk / 10)) : '—'}</td>
                        <td className={`num ${antes != null && vk != null && vk > antes ? 'lote-sobe' : antes != null && vk != null && vk < antes ? 'lote-desce' : 'muted'}`}>{antes != null ? formatBRL(antes) : '—'}</td>
                        <td className="num muted">{l.problema ? '—' : `${l.estoqueAntes != null ? qtdTxt(l.estoqueAntes) : 0} → ${qtdTxt(l.estoqueDepois)} ${l.unidade}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="row-gap wrap">
              <Button icon="check" onClick={aplicar}>
                Confirmar e atualizar estoque, custos e preços
              </Button>
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
