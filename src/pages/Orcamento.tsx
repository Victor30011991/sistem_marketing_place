import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Empty, Field, MoneyInput, Notice, NumberInput, PageHeader, downloadBlob } from '../ui/ui';
import { Icon } from '../ui/icons';
import { formatBRL, formatPercent, parseNumberBR } from '../core/money';
import { norm, slug } from '../core/normalize';
import { compatibleUnits } from '../core/units';
import { installments, lineTotal, orcamentoTotais, type Desconto, type OrcamentoItem } from '../core/orcamento';
import {
  SITUACOES,
  cfgOrcamento,
  chavePix,
  dataBR,
  hojeIso,
  linkConfirmar,
  paraPdv,
  pixCopiaECola,
  proximoNumero,
  somarDias,
  textoWhatsapp,
  totaisOrcamento,
  validadeTexto,
  vencido,
} from '../core/orcamentos';
import { normalizarWhatsapp } from '../core/vitrine';
import { ligarCliente } from '../core/clientes';
import { logoDataUrl, logoSrc } from '../ui/logo';
import { imprimirBobina } from '../ui/imprimir';
import { CupomOrcamento } from '../components/CupomOrcamento';
import type { ConfigOrcamento, OrcamentoSalvo, SituacaoOrcamento } from '../types';

interface Rascunho {
  /** id do orçamento salvo que está sendo editado (null = ainda não salvo) */
  id: string | null;
  numero: number | null;
  criado: string | null;
  situacao: SituacaoOrcamento;
  cliente: { nome: string; telefone: string; endereco: string };
  itens: OrcamentoItem[];
  desconto: Desconto;
  parcelas: number;
  validade: string;
  obs: string;
}
const vazio = (cfg: ConfigOrcamento): Rascunho => ({
  id: null,
  numero: null,
  criado: null,
  situacao: 'rascunho',
  cliente: { nome: '', telefone: '', endereco: '' },
  itens: [],
  desconto: { tipo: 'valor', valor: null },
  parcelas: 1,
  validade: cfg.validadeDias > 0 ? somarDias(hojeIso(), cfg.validadeDias) : '',
  obs: '',
});
// O orçamento em edição sobrevive à troca de tela; salvo, ele fica na lista (e na nuvem).
let rascunho: Rascunho | null = null;

const fmtQtd = (n: number) => String(Number(n.toFixed(3))).replace('.', ',');
const podeCompartilhar = (f: File) => typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [f] });

function Qtd({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  const [text, setText] = useState(value == null ? '' : fmtQtd(value));
  return (
    <input
      className="orc-qtd"
      inputMode="decimal"
      aria-label={label}
      autoComplete="off"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseNumberBR(e.target.value);
        onChange(n != null && n > 0 ? n : null);
      }}
    />
  );
}

export default function Orcamento() {
  useDocumentTitle('Orçamento');
  const { state, act } = useApp();
  const { toast, confirm } = useFeedback();
  const nav = useNavigate();
  const { loja, config } = state;
  const cfg = cfgOrcamento(config.orcamentoCfg);
  const salvos = config.orcamentos ?? [];
  const [r, setR] = useState<Rascunho>(() => rascunho ?? vazio(cfg));
  const [busca, setBusca] = useState('');
  const [escolha, setEscolha] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [previa, setPrevia] = useState<'imagem' | 'texto'>('imagem');
  const [filtro, setFiltro] = useState('');

  const atualizar = (fn: (r: Rascunho) => Rascunho) =>
    setR((old) => {
      rascunho = fn(old);
      return rascunho;
    });
  const setCfg = (patch: Partial<ConfigOrcamento>) => act.config((c) => ({ ...c, orcamentoCfg: { ...cfgOrcamento(c.orcamentoCfg), ...patch } }));

  const produtos = state.lista.produtos;
  const vendaveis = useMemo(() => {
    const nq = norm(busca);
    return produtos.filter((p) => p.venda != null && (!nq || norm(p.nome).includes(nq))).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [produtos, busca]);

  const linhas = r.itens
    .map((it) => {
      const p = produtos.find((x) => x.id === it.produtoId);
      return p ? { it, p, sub: lineTotal(p, it.qtd, it.unidade) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
  const validas = linhas.filter((l) => l.sub != null);
  const tot = orcamentoTotais(
    validas.reduce((a, l) => a + (l.sub ?? 0), 0),
    r.desconto,
  );
  const semItens = validas.length === 0;

  /** O orçamento como vai para o cliente (preços de agora). */
  const montar = (numero: number): OrcamentoSalvo => {
    const agora = new Date().toISOString();
    return {
      id: r.id ?? crypto.randomUUID().replace(/-/g, ''),
      numero,
      criado: r.criado ?? agora,
      atualizado: agora,
      cliente: { nome: r.cliente.nome.trim(), telefone: r.cliente.telefone.trim(), endereco: r.cliente.endereco.trim() },
      itens: validas.map((l) => ({ produtoId: l.p.id, nome: l.p.nome, qtd: l.it.qtd!, unidade: l.it.unidade, preco: l.p.venda!, unidadePreco: l.p.unidade, total: l.sub! })),
      desconto: r.desconto,
      parcelas: r.parcelas,
      validade: r.validade,
      obs: r.obs.trim(),
      situacao: r.situacao,
    };
  };
  const numeroAtual = r.numero ?? proximoNumero(salvos);
  const atual = montar(numeroAtual);
  const pix = cfg.pixChave.trim() ? pixCopiaECola(cfg, tot.total, `ORC${numeroAtual}`) : null;
  const texto = textoWhatsapp(atual, loja, cfg, pix);

  /** Guarda na lista (e na nuvem). Ao enviar, o rascunho passa a "enviado". */
  function salvar(enviar = false): OrcamentoSalvo | null {
    if (semItens) {
      toast('Adicione ao menos um item com quantidade.', 'erro');
      return null;
    }
    const o = { ...montar(numeroAtual), situacao: enviar && r.situacao === 'rascunho' ? ('enviado' as const) : r.situacao };
    act.config((c) => {
      // liga ao cadastro de clientes (cria se tiver WhatsApp)
      const lig = o.cliente.nome ? ligarCliente(c.clientes ?? [], o.cliente) : { lista: c.clientes ?? [], id: null };
      const oo = lig.id ? { ...o, clienteId: lig.id } : o;
      const lista = c.orcamentos ?? [];
      return { ...c, clientes: lig.lista, orcamentos: lista.some((x) => x.id === o.id) ? lista.map((x) => (x.id === o.id ? oo : x)) : [oo, ...lista] };
    });
    atualizar((x) => ({ ...x, id: o.id, numero: o.numero, criado: o.criado, situacao: o.situacao }));
    return o;
  }

  // ---------- prévia da imagem ----------
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const chavePrevia = JSON.stringify([atual.itens, atual.cliente.nome, atual.desconto, atual.parcelas, atual.validade, atual.obs, numeroAtual, pix, cfg, loja.nomeFantasia, loja.logo, loja.cores]);
  useEffect(() => {
    if (semItens || previa !== 'imagem') return;
    let vivo = true;
    let url: string | null = null;
    const t = setTimeout(async () => {
      const { orcamentoImagem } = await import('../export/orcamentoImagem');
      const b = await orcamentoImagem(atual, loja, logoSrc(loja), cfg, pix);
      if (!vivo) return;
      url = URL.createObjectURL(b);
      setImgUrl(url);
    }, 450);
    return () => {
      vivo = false;
      clearTimeout(t);
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chavePrevia, semItens, previa]);

  // ---------- saídas ----------
  const nomeArq = (o: OrcamentoSalvo) => `orcamento-${o.numero}-${slug(o.cliente.nome) || 'cliente'}`;
  async function gerarImagem(o: OrcamentoSalvo) {
    const { orcamentoImagem } = await import('../export/orcamentoImagem');
    const p = cfg.pixChave.trim() ? pixCopiaECola(cfg, totaisOrcamento(o).total, `ORC${o.numero}`) : null;
    return new File([await orcamentoImagem(o, loja, logoSrc(loja), cfg, p)], `${nomeArq(o)}.png`, { type: 'image/png' });
  }
  async function gerarPdf(o: OrcamentoSalvo) {
    const { buildOrcamentoPdf } = await import('../export/orcamentoPdf');
    const t = totaisOrcamento(o);
    const buf = await buildOrcamentoPdf(
      {
        numero: o.numero,
        data: dataBR(o.criado),
        validade: validadeTexto(o.validade),
        formas: cfg.formas.trim(),
        pix: cfg.pixChave.trim() ? pixCopiaECola(cfg, t.total, `ORC${o.numero}`) : null,
        confirmar: linkConfirmar(o, loja),
        mensagem: cfg.mensagem.trim(),
        cliente: o.cliente,
        linhas: o.itens.map((i) => ({ nome: i.nome, qtd: `${fmtQtd(i.qtd)} ${i.unidade}`, unitario: `${formatBRL(i.preco)} / ${i.unidadePreco}`, subtotal: i.total })),
        subtotal: t.subtotal,
        desconto: t.desconto,
        descontoLabel: o.desconto.tipo === 'pct' && t.desconto > 0 ? formatPercent(o.desconto.valor ?? 0, 1) : '',
        total: t.total,
        pagamento: { label: cfg.formas.trim(), parcelas: o.parcelas },
        observacoes: o.obs,
      },
      loja,
      await logoDataUrl(loja),
    );
    return new File([buf], `${nomeArq(o)}.pdf`, { type: 'application/pdf' });
  }
  async function executar(qual: string, fn: (o: OrcamentoSalvo) => Promise<void>) {
    const o = salvar(true);
    if (!o) return;
    setOcupado(qual);
    try {
      await fn(o);
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast('Não deu certo desta vez. Tente de novo.', 'erro');
    } finally {
      setOcupado('');
    }
  }
  const whatsCliente = normalizarWhatsapp(r.cliente.telefone);
  const abrirWhats = (t: string) => window.open(`https://wa.me/${whatsCliente}?text=${encodeURIComponent(t)}`, '_blank', 'noopener');

  const compartilharImagem = () =>
    executar('imagem', async (o) => {
      const f = await gerarImagem(o);
      if (podeCompartilhar(f)) await navigator.share({ files: [f], text: textoWhatsapp(o, loja, cfg, pix) });
      else {
        downloadBlob(f, f.name, f.type);
        toast('Imagem baixada. No WhatsApp Web, arraste a imagem para a conversa do cliente.');
        abrirWhats(`Olá${o.cliente.nome ? `, ${o.cliente.nome.split(' ')[0]}` : ''}! Segue o seu orçamento nº ${o.numero} 👇`);
      }
    });
  const enviarTexto = () =>
    executar('texto', async (o) => {
      abrirWhats(textoWhatsapp(o, loja, cfg, pix));
    });
  const copiarTexto = () =>
    executar('copiar', async (o) => {
      await navigator.clipboard.writeText(textoWhatsapp(o, loja, cfg, pix));
      toast('Texto copiado. É só colar na conversa.');
    });
  const baixarImagem = () =>
    executar('baixarImg', async (o) => {
      const f = await gerarImagem(o);
      downloadBlob(f, f.name, f.type);
    });
  const baixarPdf = () =>
    executar('pdf', async (o) => {
      const f = await gerarPdf(o);
      downloadBlob(f, f.name, f.type);
    });
  const email = () =>
    executar('email', async (o) => {
      const f = await gerarPdf(o);
      const corpo = textoWhatsapp(o, loja, cfg, pix).replace(/```/g, '').replace(/\*/g, '');
      const assunto = `Orçamento nº ${o.numero} · ${loja.nomeFantasia}`;
      if (podeCompartilhar(f)) await navigator.share({ files: [f], title: assunto, text: corpo });
      else {
        downloadBlob(f, f.name, f.type);
        window.location.href = `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo + '\n\n(PDF do orçamento em anexo)')}`;
        toast('PDF baixado. Anexe no e-mail que abriu.');
      }
    });
  const cupom = () =>
    executar('cupom', async (o) => {
      const p = cfg.pixChave.trim() ? pixCopiaECola(cfg, totaisOrcamento(o).total, `ORC${o.numero}`) : null;
      await imprimirBobina(<CupomOrcamento o={o} loja={loja} logo={logoSrc(loja)} cfg={cfg} pix={p} confirmar={linkConfirmar(o, loja)} />, cfg.cupom, `Orçamento ${o.numero}`);
    });

  // ---------- lista ----------
  function abrir(o: OrcamentoSalvo) {
    const n: Rascunho = {
      id: o.id,
      numero: o.numero,
      criado: o.criado,
      situacao: o.situacao,
      cliente: o.cliente,
      itens: o.itens.filter((i) => produtos.some((p) => p.id === i.produtoId)).map((i) => ({ key: crypto.randomUUID(), produtoId: i.produtoId, qtd: i.qtd, unidade: i.unidade })),
      desconto: o.desconto,
      parcelas: o.parcelas,
      validade: o.validade,
      obs: o.obs,
    };
    rascunho = n;
    setR(n);
    window.scrollTo({ top: 0 });
    if (n.itens.length < o.itens.length) toast('Alguns produtos deste orçamento não existem mais e ficaram de fora.', 'erro');
  }
  function novo() {
    rascunho = vazio(cfg);
    setR(rascunho);
  }
  const mudarSituacao = (id: string, situacao: SituacaoOrcamento) => {
    act.config((c) => ({ ...c, orcamentos: (c.orcamentos ?? []).map((x) => (x.id === id ? { ...x, situacao, atualizado: new Date().toISOString() } : x)) }));
    if (r.id === id) atualizar((x) => ({ ...x, situacao }));
  };
  async function virarVenda(o: OrcamentoSalvo) {
    const ok = await confirm({
      titulo: `Levar o orçamento nº ${o.numero} para o PDV?`,
      mensagem: <p>Ele entra em “Vendas pausadas” com os mesmos preços e desconto. No PDV, toque em “Retomar”, receba e finalize: aí o estoque baixa.</p>,
      confirmar: 'Levar para o PDV',
    });
    if (!ok) return;
    act.config((c) => ({ ...c, vendasPausadas: [...(c.vendasPausadas ?? []), paraPdv(o)], orcamentos: (c.orcamentos ?? []).map((x) => (x.id === o.id ? { ...x, situacao: 'vendido' as const } : x)) }));
    nav('/vendas');
  }
  async function excluir(o: OrcamentoSalvo) {
    const ok = await confirm({ titulo: `Excluir o orçamento nº ${o.numero}?`, mensagem: <p>Ele sai da lista dos dois aparelhos.</p>, confirmar: 'Excluir orçamento', perigo: true });
    if (!ok) return;
    act.config((c) => ({ ...c, orcamentos: (c.orcamentos ?? []).filter((x) => x.id !== o.id) }));
    if (r.id === o.id) novo();
  }
  const listaFiltrada = salvos.filter((o) => !filtro || norm(o.cliente.nome).includes(norm(filtro)) || String(o.numero) === filtro.trim());

  const adicionar = (id: string) => {
    const p = produtos.find((x) => x.id === id);
    if (!p) return;
    atualizar((o) => ({ ...o, itens: [...o.itens, { key: crypto.randomUUID(), produtoId: p.id, qtd: 1, unidade: p.unidade }] }));
    setEscolha('');
    setBusca('');
  };
  const mudarItem = (key: string, patch: Partial<OrcamentoItem>) => atualizar((o) => ({ ...o, itens: o.itens.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));
  const setCli = (k: keyof Rascunho['cliente'], v: string) => atualizar((o) => ({ ...o, cliente: { ...o.cliente, [k]: v } }));
  const sugerirParcelar = cfg.parcelarAcima > 0 && tot.total >= cfg.parcelarAcima && r.parcelas <= 1;
  const pixInvalido = cfg.pixChave.trim() && !chavePix(cfg.pixTipo, cfg.pixChave);
  const pixIncompleto = cfg.pixChave.trim() && !pixInvalido && (!cfg.pixNome.trim() || !cfg.pixCidade.trim());

  return (
    <div className="page">
      <PageHeader
        titulo="Orçamento"
        subtitulo="Monte o orçamento e mande do jeito que o cliente preferir: imagem ou texto no WhatsApp, PDF, e-mail ou cupom impresso. Fica salvo na lista abaixo."
        acoes={
          <Button variant="ghost" icon="plus" onClick={novo}>
            Novo orçamento
          </Button>
        }
      />

      {produtos.filter((p) => p.venda != null).length === 0 ? (
        <Empty icon="box" titulo="Nenhum produto com preço de venda">
          Cadastre produtos com preço de venda para montar orçamentos.
        </Empty>
      ) : (
        <div className="orc">
          <div className="orc-main">
            <section className="card" aria-labelledby="orc-cli">
              <div className="card-head">
                <h2 id="orc-cli">
                  Orçamento nº {numeroAtual} {r.id ? <small className="muted">· salvo</small> : <small className="muted">· novo</small>}
                </h2>
              </div>
              <div className="form-grid">
                <Field label="Nome do cliente">
                  {(id) => (
                    <>
                      <input
                        id={id}
                        autoComplete="off"
                        list="orc-clientes"
                        value={r.cliente.nome}
                        onChange={(e) => {
                          const nome = e.target.value;
                          const c = (config.clientes ?? []).find((x) => x.nome === nome);
                          atualizar((o) => ({ ...o, cliente: c ? { nome, telefone: o.cliente.telefone || c.telefone, endereco: o.cliente.endereco || c.endereco } : { ...o.cliente, nome } }));
                        }}
                      />
                      <datalist id="orc-clientes">
                        {(config.clientes ?? []).map((c) => (
                          <option key={c.id} value={c.nome}>
                            {c.telefone}
                          </option>
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>
                <Field label="WhatsApp do cliente" hint="Para abrir a conversa direto.">
                  {(id) => <input id={id} type="tel" inputMode="tel" autoComplete="off" value={r.cliente.telefone} onChange={(e) => setCli('telefone', e.target.value)} placeholder="(86) 99999-0000" />}
                </Field>
                <Field label="Endereço / observações do cliente" className="span-2">
                  {(id) => <input id={id} autoComplete="off" value={r.cliente.endereco} onChange={(e) => setCli('endereco', e.target.value)} />}
                </Field>
              </div>
            </section>

            <section className="card" aria-labelledby="orc-itens">
              <h2 id="orc-itens">Itens</h2>
              <div className="orc-add">
                <Field label="Buscar produto">{(id) => <input id={id} type="search" autoComplete="off" value={busca} onChange={(e) => setBusca(e.target.value)} />}</Field>
                <Field label="Adicionar ao orçamento">
                  {(id) => (
                    <select id={id} value={escolha} onChange={(e) => adicionar(e.target.value)}>
                      <option value="">{vendaveis.length ? 'Escolha o produto…' : 'Nenhum produto encontrado'}</option>
                      {vendaveis.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} · {formatBRL(p.venda)}/{p.unidade}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
              {linhas.length === 0 ? (
                <p className="muted">Nenhum item ainda. Escolha um produto acima.</p>
              ) : (
                <div className="table-scroll">
                  <table className="table compact">
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Quantidade</th>
                        <th className="num">Valor unit.</th>
                        <th className="num">Subtotal</th>
                        <th className="c-actions">
                          <span className="sr-only">Remover</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map(({ it, p, sub }) => {
                        const un = compatibleUnits(p.unidade);
                        return (
                          <tr key={it.key}>
                            <td className="strong">{p.nome}</td>
                            <td>
                              <div className="row-gap">
                                <Qtd value={it.qtd} label={`Quantidade de ${p.nome}`} onChange={(v) => mudarItem(it.key, { qtd: v })} />
                                {un.length > 1 ? (
                                  <select aria-label={`Unidade de ${p.nome}`} value={it.unidade} onChange={(e) => mudarItem(it.key, { unidade: e.target.value })}>
                                    {un.map((u) => (
                                      <option key={u} value={u}>
                                        {u}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="muted">{p.unidade}</span>
                                )}
                              </div>
                            </td>
                            <td className="num muted">
                              {formatBRL(p.venda)} / {p.unidade}
                            </td>
                            <td className="num">
                              <strong>{sub == null ? '—' : formatBRL(sub)}</strong>
                            </td>
                            <td className="c-actions">
                              <button type="button" className="icon-btn danger" aria-label={`Remover ${p.nome}`} onClick={() => atualizar((o) => ({ ...o, itens: o.itens.filter((i) => i.key !== it.key) }))}>
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
              {linhas.length > validas.length && <Notice tone="warn">Há itens sem quantidade válida. Eles ficam de fora até você preencher.</Notice>}
            </section>

            <section className="card" aria-labelledby="orc-cond">
              <h2 id="orc-cond">Condições</h2>
              <div className="form-grid">
                <Field label="Desconto (opcional)" hint={tot.desconto > 0 ? `O cliente vê: “Você economiza ${formatBRL(tot.desconto)}”.` : undefined}>
                  {(id) => (
                    <div className="row-gap">
                      <select className="desc-tipo" aria-label="Tipo de desconto" value={r.desconto.tipo} onChange={(e) => atualizar((o) => ({ ...o, desconto: { tipo: e.target.value as Desconto['tipo'], valor: null } }))}>
                        <option value="valor">R$</option>
                        <option value="pct">%</option>
                      </select>
                      {r.desconto.tipo === 'valor' ? (
                        <MoneyInput id={id} value={r.desconto.valor} onChange={(v) => atualizar((o) => ({ ...o, desconto: { ...o.desconto, valor: v } }))} />
                      ) : (
                        <input
                          id={id}
                          inputMode="decimal"
                          placeholder="Ex.: 5"
                          autoComplete="off"
                          defaultValue={r.desconto.valor ?? ''}
                          key={r.id ?? 'novo'}
                          onChange={(e) => {
                            const n = parseNumberBR(e.target.value);
                            atualizar((o) => ({ ...o, desconto: { ...o.desconto, valor: n != null && n >= 0 ? n : null } }));
                          }}
                        />
                      )}
                    </div>
                  )}
                </Field>
                <Field label="Válido até" hint={r.validade ? `O cliente vê: “Preços garantidos até ${validadeTexto(r.validade)}”.` : 'Sem validade'}>
                  {(id) => <input id={id} type="date" value={r.validade} onChange={(e) => atualizar((o) => ({ ...o, validade: e.target.value }))} />}
                </Field>
                <div className="span-2 orc-parcelar">
                  <label className="check">
                    <input type="checkbox" checked={r.parcelas > 1} onChange={(e) => atualizar((o) => ({ ...o, parcelas: e.target.checked ? 3 : 1 }))} /> Oferecer parcelamento no cartão
                  </label>
                  {r.parcelas > 1 && (
                    <span className="row-gap">
                      <NumberInput value={r.parcelas} min={2} max={24} integer suffix="vezes" ariaLabel="Número de parcelas" onChange={(v) => atualizar((o) => ({ ...o, parcelas: v }))} className="orc-parc" />
                      <span className="muted small">
                        {r.parcelas}× de {formatBRL(installments(tot.total, r.parcelas)[0])}
                      </span>
                    </span>
                  )}
                </div>
                {sugerirParcelar && (
                  <div className="span-2">
                    <Notice tone="info">Compra acima de {formatBRL(cfg.parcelarAcima)}: se fizer sentido, ofereça parcelamento. Este aviso não aparece para o cliente.</Notice>
                  </div>
                )}
                <Field label="Observações" className="span-2" hint="Prazo de entrega, frete, condições… aparece para o cliente.">
                  {(id) => <textarea id={id} rows={2} value={r.obs} onChange={(e) => atualizar((o) => ({ ...o, obs: e.target.value }))} />}
                </Field>
              </div>
            </section>
          </div>

          <aside className="card orc-resumo" aria-label="Enviar o orçamento">
            <h2>Enviar</h2>
            <dl className="orc-linhas">
              {tot.desconto > 0 && (
                <>
                  <div>
                    <dt>Subtotal</dt>
                    <dd>{formatBRL(tot.subtotal)}</dd>
                  </div>
                  <div>
                    <dt>Desconto</dt>
                    <dd>- {formatBRL(tot.desconto)}</dd>
                  </div>
                </>
              )}
              <div className="orc-total">
                <dt>Total</dt>
                <dd>{formatBRL(tot.total)}</dd>
              </div>
            </dl>
            <div className="orc-envio">
              <Button icon="upload" onClick={compartilharImagem} disabled={semItens || !!ocupado}>
                {ocupado === 'imagem' ? 'Preparando…' : 'Enviar imagem'}
              </Button>
              <Button variant="secondary" icon="copy" onClick={enviarTexto} disabled={semItens || !!ocupado}>
                Enviar texto no WhatsApp
              </Button>
              <div className="orc-envio-mais">
                <Button variant="ghost" icon="copy" onClick={copiarTexto} disabled={semItens || !!ocupado}>
                  Copiar texto
                </Button>
                <Button variant="ghost" icon="download" onClick={baixarImagem} disabled={semItens || !!ocupado}>
                  Baixar imagem
                </Button>
                <Button variant="ghost" icon="pdf" onClick={baixarPdf} disabled={semItens || !!ocupado}>
                  {ocupado === 'pdf' ? 'Gerando…' : 'Baixar PDF (A4)'}
                </Button>
                <Button variant="ghost" icon="file" onClick={email} disabled={semItens || !!ocupado}>
                  E-mail
                </Button>
                <Button variant="ghost" icon="label" onClick={cupom} disabled={semItens || !!ocupado}>
                  Imprimir cupom
                </Button>
                <Button variant="ghost" icon="save" onClick={() => salvar() && toast('Orçamento salvo.')} disabled={semItens}>
                  Só salvar
                </Button>
              </div>
            </div>
            {!semItens && (
              <div className="orc-previa">
                <div className="tabs" role="tablist" aria-label="Prévia">
                  <button type="button" role="tab" aria-selected={previa === 'imagem'} className={`tab ${previa === 'imagem' ? 'on' : ''}`} onClick={() => setPrevia('imagem')}>
                    Imagem
                  </button>
                  <button type="button" role="tab" aria-selected={previa === 'texto'} className={`tab ${previa === 'texto' ? 'on' : ''}`} onClick={() => setPrevia('texto')}>
                    Texto
                  </button>
                </div>
                {previa === 'imagem' ? imgUrl ? <img src={imgUrl} alt={`Prévia da imagem do orçamento nº ${numeroAtual}`} /> : <p className="muted small">Montando a prévia…</p> : <pre className="orc-texto">{texto}</pre>}
              </div>
            )}
            {semItens && <small className="muted">Adicione ao menos um item com quantidade.</small>}
          </aside>
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Orçamentos salvos</h2>
          {salvos.length > 0 && <input type="search" aria-label="Buscar orçamento por cliente ou número" placeholder="Cliente ou nº" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ maxWidth: 220 }} />}
        </div>
        {salvos.length === 0 ? (
          <p className="muted">Os orçamentos enviados ou salvos aparecem aqui, com a situação de cada um.</p>
        ) : (
          <div className="table-scroll">
            <table className="table orc-lista">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Cliente</th>
                  <th className="num">Total</th>
                  <th>Validade</th>
                  <th>Situação</th>
                  <th className="c-actions">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((o) => (
                  <tr key={o.id} className={o.id === r.id ? 'sel' : ''}>
                    <td>{o.numero}</td>
                    <td>
                      {o.cliente.nome || <span className="muted">Sem nome</span>}
                      <small className="muted"> · {dataBR(o.criado)}</small>
                    </td>
                    <td className="num">{formatBRL(totaisOrcamento(o).total)}</td>
                    <td>{o.validade ? <span className={vencido(o) ? 'rel-desce' : ''}>{vencido(o) ? 'venceu ' : ''}{dataBR(o.validade)}</span> : '—'}</td>
                    <td>
                      <select aria-label={`Situação do orçamento ${o.numero}`} value={o.situacao} onChange={(e) => mudarSituacao(o.id, e.target.value as SituacaoOrcamento)}>
                        {SITUACOES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.rotulo}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="c-actions orc-acoes">
                      <button type="button" className="icon-btn" aria-label={`Abrir orçamento ${o.numero}`} title="Abrir" onClick={() => abrir(o)}>
                        <Icon name="edit" />
                      </button>
                      {o.situacao !== 'vendido' && (
                        <button type="button" className="icon-btn" aria-label={`Levar orçamento ${o.numero} para o PDV`} title="Virar venda" onClick={() => virarVenda(o)}>
                          <Icon name="cart" />
                        </button>
                      )}
                      <button type="button" className="icon-btn danger" aria-label={`Excluir orçamento ${o.numero}`} title="Excluir" onClick={() => excluir(o)}>
                        <Icon name="trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <details className="orc-cfg">
          <summary>
            <h2>Configurar orçamento</h2>
            <span className="muted small">Validade, formas de pagamento, Pix e cupom</span>
          </summary>
          <div className="form-grid">
            <Field label="Validade padrão">{(id) => <NumberInput id={id} value={cfg.validadeDias} min={0} max={365} integer suffix="dias" onChange={(v) => setCfg({ validadeDias: v })} />}</Field>
            <Field label="Formas de pagamento (como o cliente lê)">{(id) => <input id={id} value={cfg.formas} onChange={(e) => setCfg({ formas: e.target.value })} />}</Field>
            <Field label="Avisar para oferecer parcelamento acima de" hint="Só você vê o aviso. Vazio = nunca.">
              {(id) => <MoneyInput id={id} value={cfg.parcelarAcima || null} onChange={(v) => setCfg({ parcelarAcima: v ?? 0 })} />}
            </Field>
            <Field label="Frase final">{(id) => <input id={id} value={cfg.mensagem} onChange={(e) => setCfg({ mensagem: e.target.value })} />}</Field>
            <Field label="Largura do cupom">
              {(id) => (
                <select id={id} value={cfg.cupom} onChange={(e) => setCfg({ cupom: Number(e.target.value) === 58 ? 58 : 80 })}>
                  <option value={80}>80 mm</option>
                  <option value={58}>58 mm</option>
                </select>
              )}
            </Field>
          </div>
          <h3 className="orc-sub">Pix copia e cola</h3>
          <p className="muted small">Com a chave preenchida, o orçamento leva o QR code e o código do Pix já com o valor. O cliente paga sem pedir a chave.</p>
          <div className="form-grid">
            <Field label="Tipo de chave">
              {(id) => (
                <select id={id} value={cfg.pixTipo} onChange={(e) => setCfg({ pixTipo: e.target.value as ConfigOrcamento['pixTipo'] })}>
                  <option value="celular">Celular</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="aleatoria">Chave aleatória</option>
                </select>
              )}
            </Field>
            <Field label="Chave Pix" erro={pixInvalido ? 'Esta chave não confere com o tipo escolhido.' : null}>
              {(id) => <input id={id} autoComplete="off" value={cfg.pixChave} onChange={(e) => setCfg({ pixChave: e.target.value })} />}
            </Field>
            <Field label="Nome de quem recebe" hint="Como aparece no banco (até 25 letras).">
              {(id) => <input id={id} autoComplete="off" value={cfg.pixNome} onChange={(e) => setCfg({ pixNome: e.target.value })} />}
            </Field>
            <Field label="Cidade">{(id) => <input id={id} autoComplete="off" value={cfg.pixCidade} onChange={(e) => setCfg({ pixCidade: e.target.value })} />}</Field>
          </div>
          {pixIncompleto && <Notice tone="warn">Falta o nome ou a cidade: sem eles o banco não aceita o código.</Notice>}
          {pix && <Notice tone="ok">Pix pronto. Faça um teste: pague um orçamento de R$ 1,00 para a própria loja antes de mandar para clientes.</Notice>}
        </details>
      </section>
    </div>
  );
}
