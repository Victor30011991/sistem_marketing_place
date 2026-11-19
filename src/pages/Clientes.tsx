import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Empty, Field, Indicadores, Modal, PageHeader } from '../ui/ui';
import { Icon } from '../ui/icons';
import { formatBRL } from '../core/money';
import { norm } from '../core/normalize';
import { historico, mensagemSaudade, novoCliente } from '../core/clientes';
import { totaisOrcamento } from '../core/orcamentos';
import { normalizarWhatsapp } from '../core/vitrine';
import type { Cliente } from '../types';

const SUMIDO = 60;
const br = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
type Filtro = 'todos' | 'sumidos' | 'nunca';

export default function Clientes() {
  useDocumentTitle('Clientes');
  const { state, act } = useApp();
  const { toast, confirm } = useFeedback();
  const clientes = state.config.clientes ?? [];
  const vendas = state.config.vendas ?? [];
  const orcamentos = state.config.orcamentos ?? [];
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [aberto, setAberto] = useState<Cliente | null>(null);

  const linhas = useMemo(() => clientes.map((c) => ({ c, h: historico(c, vendas, orcamentos) })), [clientes, vendas, orcamentos]);
  const sumidos = linhas.filter((l) => l.h.diasSemComprar != null && l.h.diasSemComprar >= SUMIDO);
  const nunca = linhas.filter((l) => l.h.compras === 0);
  const doMes = linhas.filter((l) => l.h.ultima && l.h.ultima.slice(0, 7) === new Date().toISOString().slice(0, 7));
  const visiveis = (filtro === 'sumidos' ? sumidos : filtro === 'nunca' ? nunca : linhas)
    .filter((l) => !busca || norm(l.c.nome).includes(norm(busca)) || l.c.telefone.replace(/\D/g, '').includes(busca.replace(/\D/g, '') || '§'))
    .sort((a, b) => (filtro === 'sumidos' ? b.h.total - a.h.total : a.c.nome.localeCompare(b.c.nome, 'pt-BR')));

  const salvar = (c: Cliente) => act.config((s) => {
    const l = s.clientes ?? [];
    return { ...s, clientes: l.some((x) => x.id === c.id) ? l.map((x) => (x.id === c.id ? c : x)) : [...l, c] };
  });
  async function excluir(c: Cliente) {
    if (!(await confirm({ titulo: `Excluir ${c.nome}?`, mensagem: <p>As vendas dela continuam no histórico, só o cadastro sai.</p>, confirmar: 'Excluir cliente', perigo: true }))) return;
    act.config((s) => ({ ...s, clientes: (s.clientes ?? []).filter((x) => x.id !== c.id) }));
    setAberto(null);
  }
  function importar() {
    const nomes = new Map<string, string>();
    for (const v of vendas) if (v.cliente.trim() && !v.clienteId) nomes.set(norm(v.cliente), v.cliente.replace(/\s*\((orç\.|pedido)[^)]*\)\s*$/, '').trim());
    for (const o of orcamentos) if (o.cliente.nome.trim()) nomes.set(norm(o.cliente.nome), o.cliente.nome.trim());
    const ja = new Set(clientes.map((c) => norm(c.nome)));
    const novos = [...nomes.values()].filter((n) => n && !ja.has(norm(n))).map((nome) => {
      const o = orcamentos.find((x) => norm(x.cliente.nome) === norm(nome));
      return novoCliente({ nome, telefone: o?.cliente.telefone, endereco: o?.cliente.endereco });
    });
    if (!novos.length) return toast('Nenhum nome novo nas vendas e orçamentos.');
    act.config((s) => ({ ...s, clientes: [...(s.clientes ?? []), ...novos] }));
    toast(`${novos.length} cliente(s) criados a partir das vendas e orçamentos.`);
  }

  const hAberto = aberto ? historico(aberto, vendas, orcamentos) : null;
  const wa = aberto ? normalizarWhatsapp(aberto.telefone) : '';

  return (
    <div className="page">
      <PageHeader
        titulo="Clientes"
        subtitulo="Quem compra, quanto e do quê. O cadastro se completa sozinho com os pedidos do cardápio e os orçamentos."
        acoes={
          <>
            <Button variant="ghost" icon="upload" onClick={importar}>
              Trazer das vendas
            </Button>
            <Button icon="plus" onClick={() => setAberto(novoCliente())}>
              Novo cliente
            </Button>
          </>
        }
      />
      <Indicadores
        itens={[
          { rotulo: 'Clientes', valor: clientes.length, nota: `${nunca.length} ainda sem compra` },
          { rotulo: 'Compraram este mês', valor: doMes.length },
          { rotulo: 'Sumidos', valor: sumidos.length, nota: `Sem comprar há ${SUMIDO} dias ou mais`, tom: sumidos.length ? 'warn' : 'neutro' },
          { rotulo: 'Gasto médio por cliente', valor: formatBRL(linhas.length ? Math.round(linhas.reduce((a, l) => a + l.h.total, 0) / Math.max(1, linhas.length - nunca.length)) : 0) },
        ]}
      />
      <section className="card">
        <div className="card-head">
          <div className="rel-atalhos">
            {(
              [
                ['todos', 'Todos'],
                ['sumidos', `Sumidos (${sumidos.length})`],
                ['nunca', 'Sem compras'],
              ] as [Filtro, string][]
            ).map(([id, r]) => (
              <button key={id} type="button" className={`chip-btn ${filtro === id ? 'on' : ''}`} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
                {r}
              </button>
            ))}
          </div>
          <input type="search" aria-label="Buscar cliente por nome ou telefone" placeholder="Nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 240 }} />
        </div>
        {clientes.length === 0 ? (
          <Empty icon="store" titulo="Nenhum cliente ainda" acoes={<Button onClick={importar}>Trazer das vendas e orçamentos</Button>}>
            Os pedidos do cardápio e os orçamentos com WhatsApp criam o cadastro sozinhos.
          </Empty>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>WhatsApp</th>
                  <th className="num">Compras</th>
                  <th className="num">Total gasto</th>
                  <th className="num">Última compra</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map(({ c, h }) => (
                  <tr key={c.id} className="linha-clicavel" onClick={() => setAberto(c)}>
                    <td>
                      <button type="button" className="link-btn" onClick={(e) => { e.stopPropagation(); setAberto(c); }}>
                        {c.nome}
                      </button>
                    </td>
                    <td>{c.telefone || <span className="muted">—</span>}</td>
                    <td className="num">{h.compras}</td>
                    <td className="num">{formatBRL(h.total)}</td>
                    <td className="num">
                      {br(h.ultima)}
                      {h.diasSemComprar != null && h.diasSemComprar >= SUMIDO && <small className="rel-desce"> · {h.diasSemComprar} dias</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={!!aberto}
        wide
        title={aberto && clientes.some((x) => x.id === aberto.id) ? aberto.nome || 'Cliente' : 'Novo cliente'}
        onClose={() => setAberto(null)}
        footer={
          aberto && (
            <>
              {clientes.some((x) => x.id === aberto.id) && (
                <Button variant="ghost" icon="trash" onClick={() => excluir(aberto)}>
                  Excluir
                </Button>
              )}
              <Button
                onClick={() => {
                  if (!aberto.nome.trim()) return toast('Escreva o nome do cliente.', 'erro');
                  salvar({ ...aberto, nome: aberto.nome.trim() });
                  setAberto(null);
                  toast('Cliente salvo.');
                }}
              >
                Salvar cliente
              </Button>
            </>
          )
        }
      >
        {aberto && (
          <div className="cli-det">
            <div className="form-grid">
              <Field label="Nome">{(id) => <input id={id} value={aberto.nome} onChange={(e) => setAberto({ ...aberto, nome: e.target.value })} />}</Field>
              <Field label="WhatsApp">{(id) => <input id={id} type="tel" value={aberto.telefone} onChange={(e) => setAberto({ ...aberto, telefone: e.target.value })} />}</Field>
              <Field label="Endereço" className="span-2">{(id) => <input id={id} value={aberto.endereco} onChange={(e) => setAberto({ ...aberto, endereco: e.target.value })} />}</Field>
              <Field label="Anotações" className="span-2" hint="Preferências, aniversário, como gosta de receber…">
                {(id) => <textarea id={id} rows={2} value={aberto.obs} onChange={(e) => setAberto({ ...aberto, obs: e.target.value })} />}
              </Field>
            </div>
            {hAberto && hAberto.compras + hAberto.orcamentos.length > 0 && (
              <>
                <Indicadores
                  itens={[
                    { rotulo: 'Compras', valor: hAberto.compras },
                    { rotulo: 'Total gasto', valor: formatBRL(hAberto.total) },
                    { rotulo: 'Por compra', valor: formatBRL(hAberto.ticket) },
                    { rotulo: 'Última', valor: br(hAberto.ultima), nota: hAberto.diasSemComprar != null ? `há ${hAberto.diasSemComprar} dia(s)` : undefined },
                  ]}
                />
                {hAberto.favoritos.length > 0 && (
                  <p>
                    <strong>Mais compra:</strong> {hAberto.favoritos.map((f) => f.nome).join(', ')}
                  </p>
                )}
                <ul className="pdv-pag cli-hist">
                  {hAberto.vendas.slice(0, 8).map((v) => (
                    <li key={v.id}>
                      <span>
                        {br(v.quando)} · {v.itens.map((i) => i.nome).join(', ')}
                      </span>
                      <strong>{formatBRL(v.total)}</strong>
                    </li>
                  ))}
                  {hAberto.orcamentos.slice(0, 4).map((o) => (
                    <li key={o.id} className="muted">
                      <span>
                        Orçamento nº {o.numero} · {br(o.criado)}
                      </span>
                      <span>{formatBRL(totaisOrcamento(o).total)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {wa && (
              <div className="row-gap wrap">
                <a className="btn btn-secondary" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                  <Icon name="copy" /> Abrir WhatsApp
                </a>
                {hAberto && hAberto.compras > 0 && (
                  <a className="btn btn-ghost" href={`https://wa.me/${wa}?text=${encodeURIComponent(mensagemSaudade(aberto, state.loja.nomeFantasia, hAberto.favoritos[0]?.nome))}`} target="_blank" rel="noopener noreferrer">
                    <Icon name="sparkle" /> Mandar mensagem de saudade
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
