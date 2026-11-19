import { useState } from 'react';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Empty, Field, Indicadores, Modal, MoneyInput, NumberInput, PageHeader, Tabs } from '../ui/ui';
import { Icon } from '../ui/icons';
import { formatBRL } from '../core/money';
import { devedores, novaConta, quitar, receberDoCliente, saldo, situacao, somaDias, textoCobranca, totais, type Devedor } from '../core/contas';
import { cfgOrcamento, pixCopiaECola } from '../core/orcamentos';
import { normalizarWhatsapp } from '../core/vitrine';
import { diaLocal } from '../core/vendas';
import { useQuem } from '../nuvem/NuvemProvider';
import type { Conta } from '../types';

type Aba = 'receber' | 'pagar';
const br = (iso: string) => iso.split('-').reverse().join('/');
const FORMAS = [
  { id: 'dinheiro', rotulo: 'Dinheiro' },
  { id: 'pix', rotulo: 'Pix' },
  { id: 'cartao', rotulo: 'Cartão' },
  { id: 'transferencia', rotulo: 'Transferência / boleto' },
];
const ROTULO_SIT = { aberta: 'Em aberto', parcial: 'Pago em parte', paga: 'Paga', vencida: 'Vencida', cancelada: 'Cancelada' };

interface Janela {
  modo: 'receberCliente' | 'quitar' | 'nova';
  devedor?: Devedor;
  conta?: Conta;
}

export default function Contas() {
  useDocumentTitle('Contas');
  const { state, act } = useApp();
  const { toast, confirm } = useFeedback();
  const quem = useQuem();
  const contas = state.config.contas ?? [];
  const clientes = state.config.clientes ?? [];
  const hoje = diaLocal(new Date());
  const [aba, setAba] = useState<Aba>('receber');
  const [verPagas, setVerPagas] = useState(false);
  const [j, setJ] = useState<Janela | null>(null);
  const [valor, setValor] = useState<number | null>(null);
  const [forma, setForma] = useState('dinheiro');
  const [nova, setNova] = useState({ descricao: '', favorecido: '', clienteId: '', vencimento: hoje, mensal: false });

  const t = totais(contas, hoje);
  const devs = devedores(contas, clientes, hoje);
  const pagar = contas.filter((c) => c.tipo === 'pagar' && (verPagas || saldo(c) > 0)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const cfgOrc = cfgOrcamento(state.config.orcamentoCfg);

  const gravar = (lista: Conta[]) => act.config((s) => ({ ...s, contas: lista }));
  const abrir = (x: Janela) => {
    setValor(x.devedor ? x.devedor.saldo : x.conta ? saldo(x.conta) : null);
    setForma('dinheiro');
    if (x.modo === 'nova') setNova({ descricao: '', favorecido: '', clienteId: '', vencimento: aba === 'receber' ? somaDias(hoje, state.config.prazoFiado ?? 30) : hoje, mensal: false });
    setJ(x);
  };

  function confirmar() {
    if (!j) return;
    if (j.modo === 'nova') {
      if (!nova.descricao.trim() || !valor) return toast('Preencha a descrição e o valor.', 'erro');
      if (aba === 'receber' && !nova.clienteId) return toast('Escolha o cliente.', 'erro');
      const c = novaConta({
        tipo: aba,
        descricao: nova.descricao.trim(),
        valor,
        vencimento: nova.vencimento,
        ...(aba === 'receber' ? { clienteId: nova.clienteId } : { ...(nova.favorecido.trim() ? { favorecido: nova.favorecido.trim() } : {}), ...(nova.mensal ? { mensal: true } : {}) }),
      });
      gravar([...contas, c]);
      toast('Conta lançada.');
    } else if (j.modo === 'receberCliente' && j.devedor) {
      if (!valor) return toast('Digite o valor recebido.', 'erro');
      gravar(receberDoCliente(contas, j.devedor.clienteId, valor, forma, quem));
      toast(`Recebido ${formatBRL(Math.min(valor, j.devedor.saldo))}${forma === 'dinheiro' ? ' (entra no caixa)' : ''}.`);
    } else if (j.modo === 'quitar' && j.conta) {
      if (!valor) return toast('Digite o valor.', 'erro');
      const r = quitar(j.conta, valor, forma, quem);
      gravar([...contas.map((c) => (c.id === r.conta.id ? r.conta : c)), ...(r.proxima ? [r.proxima] : [])]);
      toast(r.proxima ? `Pago. A do mês que vem (${br(r.proxima.vencimento)}) já foi lançada.` : 'Pagamento registrado.');
    }
    setJ(null);
  }
  async function cancelar(c: Conta) {
    if (await confirm({ titulo: `Cancelar “${c.descricao}”?`, mensagem: <p>A conta sai dos totais. Os pagamentos já feitos continuam registrados.</p>, confirmar: 'Cancelar conta', perigo: true })) gravar(contas.map((x) => (x.id === c.id ? { ...x, cancelada: true } : x)));
  }
  const cobrar = (d: Devedor) => {
    const pix = cfgOrc.pixChave.trim() ? pixCopiaECola(cfgOrc, d.saldo, 'FIADO') : null;
    window.open(`https://wa.me/${normalizarWhatsapp(d.cliente?.telefone ?? '')}?text=${encodeURIComponent(textoCobranca(d, state.loja.nomeFantasia, pix))}`, '_blank', 'noopener');
  };

  return (
    <div className="page">
      <PageHeader titulo="Contas" subtitulo="O fiado dos clientes e as contas da loja (fornecedores, aluguel, luz…), com vencimento e aviso." acoes={<Button icon="plus" onClick={() => abrir({ modo: 'nova' })}>{aba === 'receber' ? 'Novo fiado' : 'Nova conta a pagar'}</Button>} />
      <Indicadores
        itens={[
          { rotulo: 'A receber (fiado)', valor: formatBRL(t.receber), nota: t.receberVencido ? `${formatBRL(t.receberVencido)} vencido` : 'Nada vencido', tom: t.receberVencido ? 'warn' : 'neutro' },
          { rotulo: 'A pagar', valor: formatBRL(t.pagar) },
          { rotulo: 'Vence em 7 dias', valor: formatBRL(t.pagar7dias), nota: 'Contas a pagar' },
          { rotulo: 'A pagar vencido', valor: formatBRL(t.pagarVencido), tom: t.pagarVencido ? 'warn' : 'neutro' },
        ]}
      />
      <Tabs value={aba} onChange={setAba} itens={[{ id: 'receber', label: 'A receber (fiado)' }, { id: 'pagar', label: 'A pagar' }]} />

      {aba === 'receber' &&
        (devs.length === 0 ? (
          <Empty icon="user" titulo="Ninguém devendo">No PDV, escolha a forma “Fiado” para vender e anotar aqui. O prazo padrão é de {state.config.prazoFiado ?? 30} dias.</Empty>
        ) : (
          <div className="ped-grade">
            {devs.map((d) => (
              <article key={d.clienteId} className={`card conta-card ${d.vencido ? 'vencida' : ''}`}>
                <header className="ped-topo">
                  <div>
                    <h2>{d.cliente?.nome ?? 'Sem cliente'}</h2>
                    <small className="muted">{d.vencido ? `${formatBRL(d.vencido)} vencido desde ${br(d.maisAntiga)}` : `vence ${br(d.maisAntiga)}`}</small>
                  </div>
                  <strong className="ped-total">{formatBRL(d.saldo)}</strong>
                </header>
                <ul className="ped-itens">
                  {d.contas.map((c) => (
                    <li key={c.id}>
                      <span>
                        {c.descricao} <small className="muted">· {br(c.vencimento)}</small>
                      </span>
                      <span>{formatBRL(saldo(c))}</span>
                    </li>
                  ))}
                </ul>
                <div className="row-gap wrap">
                  <Button icon="check" onClick={() => abrir({ modo: 'receberCliente', devedor: d })}>
                    Receber
                  </Button>
                  {normalizarWhatsapp(d.cliente?.telefone ?? '') && (
                    <Button variant="secondary" icon="copy" onClick={() => cobrar(d)}>
                      Lembrar no WhatsApp
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ))}

      {aba === 'pagar' && (
        <section className="card">
          <div className="card-head">
            <h2>Contas a pagar</h2>
            <label className="check">
              <input type="checkbox" checked={verPagas} onChange={(e) => setVerPagas(e.target.checked)} /> Mostrar as pagas
            </label>
          </div>
          {pagar.length === 0 ? (
            <p className="muted">Nenhuma conta {verPagas ? '' : 'em aberto'}. Lance boletos de fornecedor, aluguel, luz… Marque “todo mês” para as fixas.</p>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Vencimento</th>
                    <th>Conta</th>
                    <th className="num">Valor</th>
                    <th>Situação</th>
                    <th className="c-actions">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagar.map((c) => {
                    const sit = situacao(c, hoje);
                    return (
                      <tr key={c.id} className={sit === 'paga' || sit === 'cancelada' ? 'muted' : ''}>
                        <td className={sit === 'vencida' ? 'rel-desce' : ''}>{br(c.vencimento)}</td>
                        <td>
                          {c.descricao}
                          {c.favorecido && <small className="muted"> · {c.favorecido}</small>}
                          {c.mensal && <small className="muted"> · todo mês</small>}
                        </td>
                        <td className="num">{formatBRL(sit === 'parcial' ? saldo(c) : c.valor)}</td>
                        <td>{ROTULO_SIT[sit]}</td>
                        <td className="c-actions orc-acoes">
                          {saldo(c) > 0 && (
                            <Button variant="secondary" onClick={() => abrir({ modo: 'quitar', conta: c })}>
                              Pagar
                            </Button>
                          )}
                          {!c.cancelada && saldo(c) > 0 && (
                            <button type="button" className="icon-btn danger" aria-label={`Cancelar ${c.descricao}`} onClick={() => cancelar(c)}>
                              <Icon name="trash" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="card">
        <Field label="Prazo padrão do fiado" hint="Quantos dias o cliente tem para pagar o que comprou fiado no PDV.">
          {(id) => <NumberInput id={id} value={state.config.prazoFiado ?? 30} min={1} max={365} integer suffix="dias" onChange={(v) => act.config((s) => ({ ...s, prazoFiado: v }))} className="orc-parc" />}
        </Field>
      </section>

      <Modal
        open={!!j}
        title={j?.modo === 'nova' ? (aba === 'receber' ? 'Novo fiado' : 'Nova conta a pagar') : j?.modo === 'receberCliente' ? `Receber de ${j.devedor?.cliente?.nome ?? 'cliente'}` : `Pagar: ${j?.conta?.descricao ?? ''}`}
        onClose={() => setJ(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setJ(null)}>
              Voltar
            </Button>
            <Button onClick={confirmar}>{j?.modo === 'nova' ? 'Lançar' : j?.modo === 'receberCliente' ? 'Registrar recebimento' : 'Registrar pagamento'}</Button>
          </>
        }
      >
        {j?.modo === 'nova' && (
          <div className="form-grid">
            {aba === 'receber' ? (
              <Field label="Cliente" className="span-2">
                {(id) => (
                  <select id={id} value={nova.clienteId} onChange={(e) => setNova({ ...nova, clienteId: e.target.value })}>
                    <option value="">Escolha…</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            ) : (
              <Field label="Para quem" hint="Fornecedor, imobiliária, companhia de luz…">{(id) => <input id={id} value={nova.favorecido} onChange={(e) => setNova({ ...nova, favorecido: e.target.value })} />}</Field>
            )}
            <Field label="Descrição">{(id) => <input id={id} value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} placeholder={aba === 'pagar' ? 'Ex.: Aluguel' : 'Ex.: Compra de 10/11'} />}</Field>
            <Field label="Valor">{(id) => <MoneyInput id={id} value={valor} onChange={setValor} />}</Field>
            <Field label="Vencimento">{(id) => <input id={id} type="date" value={nova.vencimento} onChange={(e) => setNova({ ...nova, vencimento: e.target.value || hoje })} />}</Field>
            {aba === 'pagar' && (
              <label className="check span-2">
                <input type="checkbox" checked={nova.mensal} onChange={(e) => setNova({ ...nova, mensal: e.target.checked })} /> Repetir todo mês (ao pagar, a próxima já fica lançada)
              </label>
            )}
          </div>
        )}
        {j && j.modo !== 'nova' && (
          <div className="form-grid">
            <Field label="Valor" hint={j.devedor ? `Saldo: ${formatBRL(j.devedor.saldo)}. Pode receber uma parte: abate das contas mais antigas.` : j.conta ? `Saldo: ${formatBRL(saldo(j.conta))}` : undefined}>
              {(id) => <MoneyInput id={id} value={valor} onChange={setValor} />}
            </Field>
            <Field label="Forma">
              {(id) => (
                <select id={id} value={forma} onChange={(e) => setForma(e.target.value)}>
                  {FORMAS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.rotulo}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
