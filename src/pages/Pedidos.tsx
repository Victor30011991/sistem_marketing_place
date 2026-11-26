import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Empty, Notice, PageHeader } from '../ui/ui';
import { Icon } from '../ui/icons';
import { formatBRL } from '../core/money';
import { SITUACOES_PEDIDO } from '../core/clientes';
import { normalizarWhatsapp } from '../core/vitrine';
import { usePedidos } from '../nuvem/PedidosProvider';
import { useNuvem } from '../nuvem/NuvemProvider';
import { useApp } from '../state/store';
import type { Pedido, SituacaoPedido } from '../types';

const gramas = (g: number) => (g >= 1000 ? `${String(g / 1000).replace('.', ',')} kg` : `${g} g`);
const quando = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hoje = new Date().toDateString() === d.toDateString();
  return `${hoje ? 'hoje' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

export default function Pedidos() {
  useDocumentTitle('Pedidos');
  const { pedidos, ativo, mudar, paraPdv } = usePedidos();
  const { fase, entrar } = useNuvem();
  const { state } = useApp();
  const { toast, confirm } = useFeedback();
  const nav = useNavigate();
  const [aba, setAba] = useState<SituacaoPedido>('novo');
  const lista = pedidos.filter((p) => p.situacao === aba);
  const conta = (s: SituacaoPedido) => pedidos.filter((p) => p.situacao === s).length;

  async function levar(p: Pedido) {
    const faltando = paraPdv(p);
    if (faltando.length) toast(`Fora do PDV (produto não existe mais): ${faltando.join(', ')}.`, 'erro');
    nav('/vendas');
  }
  async function cancelar(p: Pedido) {
    if (await confirm({ titulo: `Cancelar o pedido de ${p.nome || 'cliente'}?`, mensagem: <p>Ele vai para “Cancelados”. Dá para voltar depois.</p>, confirmar: 'Cancelar pedido', perigo: true })) mudar(p.id, 'cancelado');
  }
  const avisar = (p: Pedido) => {
    const w = normalizarWhatsapp(p.telefone);
    const primeiro = p.nome.trim().split(/\s+/)[0];
    window.open(`https://wa.me/${w}?text=${encodeURIComponent(`Oi${primeiro ? `, ${primeiro}` : ''}! Aqui é da ${state.loja.nomeFantasia} 🌿 Seu pedido de ${formatBRL(p.total)} está pronto.`)}`, '_blank', 'noopener');
  };

  return (
    <div className="page">
      <PageHeader titulo="Pedidos" subtitulo="Os pedidos feitos no catálogo chegam aqui na hora, com um bip. Separe, avise o cliente e leve para o PDV para receber." />
      {!ativo ? (
        <Empty icon="cloud" titulo="Os pedidos chegam pela nuvem" acoes={fase === 'desligado' || fase === 'negado' ? <Button icon="cloud" onClick={entrar}>Entrar na nuvem</Button> : undefined}>
          {fase === 'sincronizando' || fase === 'carregando' ? 'Conectando…' : 'Entre na nuvem com o e-mail da loja para receber os pedidos do catálogo aqui.'}
        </Empty>
      ) : (
        <>
          <div className="tabs" role="tablist">
            {SITUACOES_PEDIDO.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={aba === s.id} className={`tab ${aba === s.id ? 'on' : ''}`} onClick={() => setAba(s.id)}>
                {s.rotulo}
                {conta(s.id) > 0 && <em className="tab-conta">{conta(s.id)}</em>}
              </button>
            ))}
          </div>
          {lista.length === 0 ? (
            <Empty icon="cart" titulo={aba === 'novo' ? 'Nenhum pedido novo' : 'Nada aqui'}>
              {aba === 'novo' ? 'Quando um cliente finalizar no catálogo, o pedido aparece aqui. Mostramos os últimos 30 dias.' : 'Os pedidos passam por aqui conforme vocês avançam.'}
            </Empty>
          ) : (
            <div className="ped-grade">
              {lista.map((p) => (
                <article key={p.id} className={`card ped ${p.situacao}`}>
                  <header className="ped-topo">
                    <div>
                      <h2>{p.nome || 'Sem nome'}</h2>
                      <small className="muted">
                        {quando(p.criado)}
                        {p.origem ? ` · veio do ${p.origem}` : ''}
                      </small>
                    </div>
                    <strong className="ped-total">{formatBRL(p.total)}</strong>
                  </header>
                  {(p.endereco || p.telefone) && (
                    <p className="ped-end">
                      {p.endereco}
                      {p.telefone && (
                        <>
                          {p.endereco ? <br /> : null}
                          <span className="muted">WhatsApp: {p.telefone}</span>
                        </>
                      )}
                    </p>
                  )}
                  <ul className="ped-itens">
                    {p.itens.map((i, k) => (
                      <li key={k}>
                        <span>
                          <strong>{i.u ? `${i.g} ×` : gramas(i.g)}</strong> {i.n}
                          {i.u ? <small className="muted"> ({i.u})</small> : null}
                        </span>
                        <span>{formatBRL(i.t)}</span>
                      </li>
                    ))}
                  </ul>
                  {p.obs && <p className="ped-obs">“{p.obs}”</p>}
                  <div className="row-gap wrap">
                    {p.situacao === 'novo' && (
                      <Button icon="check" onClick={() => mudar(p.id, 'separando')}>
                        Começar a separar
                      </Button>
                    )}
                    {p.situacao === 'separando' && (
                      <Button icon="check" onClick={() => mudar(p.id, 'pronto')}>
                        Marcar como pronto
                      </Button>
                    )}
                    {p.situacao === 'pronto' && (
                      <Button icon="cart" onClick={() => levar(p)}>
                        Levar para o PDV
                      </Button>
                    )}
                    {(p.situacao === 'pronto' || p.situacao === 'separando') && normalizarWhatsapp(p.telefone) && (
                      <Button variant="secondary" icon="copy" onClick={() => avisar(p)}>
                        Avisar que está pronto
                      </Button>
                    )}
                    {(p.situacao === 'novo' || p.situacao === 'separando') && (
                      <Button variant="ghost" icon="x" onClick={() => cancelar(p)}>
                        Cancelar
                      </Button>
                    )}
                    {p.situacao === 'cancelado' && (
                      <Button variant="ghost" icon="undo" onClick={() => mudar(p.id, 'novo')}>
                        Voltar para novos
                      </Button>
                    )}
                    {p.situacao === 'entregue' && p.vendaPausada && (
                      <Link to="/vendas" className="btn btn-ghost">
                        <Icon name="cart" /> Ver no PDV
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          <Notice tone="info">No PDV, o pedido fica em “Vendas pausadas”: toque em “Retomar”, receba e finalize. Aí o estoque baixa e a venda entra no histórico do cliente.</Notice>
        </>
      )}
    </div>
  );
}
