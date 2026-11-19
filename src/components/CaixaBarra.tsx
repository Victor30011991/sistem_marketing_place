import { useState } from 'react';
import { useApp } from '../state/store';
import { useFeedback } from '../ui/feedback';
import { Button, Field, Modal, MoneyInput, Notice } from '../ui/ui';
import { Icon } from '../ui/icons';
import { formatBRL } from '../core/money';
import { abrirCaixa, caixaAberto, fecharCaixa, movimento, resumoCaixa, textoFechamento } from '../core/caixa';
import { useQuem } from '../nuvem/NuvemProvider';
import type { Caixa, MovimentoCaixa } from '../types';

type Janela = null | 'abrir' | 'sangria' | 'reforco' | 'fechar';
const hora = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');

/** Faixa do caixa no topo do PDV: abrir, sangria/reforço, fechar e conferir. */
export function CaixaBarra() {
  const { state, act } = useApp();
  const { toast } = useFeedback();
  const quem = useQuem();
  const caixas = state.config.caixas ?? [];
  const vendas = state.config.vendas ?? [];
  const aberto = caixaAberto(caixas);
  const [janela, setJanela] = useState<Janela>(null);
  const [valor, setValor] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const [fechado, setFechado] = useState<Caixa | null>(null);
  const r = aberto ? resumoCaixa(aberto, vendas) : null;

  const salvar = (c: Caixa) => act.config((s) => ({ ...s, caixas: [c, ...(s.caixas ?? []).filter((x) => x.id !== c.id)] }));
  const abrirJanela = (j: Janela) => {
    setValor(j === 'abrir' ? (caixas.find((c) => c.fechadoEm)?.contado ?? null) : null);
    setMotivo('');
    setJanela(j);
  };
  function confirmar() {
    if (janela === 'abrir') {
      salvar(abrirCaixa(valor ?? 0, quem));
      toast('Caixa aberto. Bom trabalho!');
    } else if ((janela === 'sangria' || janela === 'reforco') && aberto) {
      if (!valor) return toast('Digite o valor.', 'erro');
      const m: MovimentoCaixa = movimento(janela, valor, motivo, quem);
      salvar({ ...aberto, movimentos: [...aberto.movimentos, m] });
      toast(janela === 'sangria' ? `Sangria de ${formatBRL(valor)} registrada.` : `Reforço de ${formatBRL(valor)} registrado.`);
    } else if (janela === 'fechar' && aberto) {
      if (valor == null) return toast('Conte o dinheiro da gaveta e digite o valor.', 'erro');
      const f = fecharCaixa(aberto, vendas, valor, quem, motivo);
      salvar(f);
      setFechado(f);
      setJanela(null);
      return;
    }
    setJanela(null);
  }
  const copiar = async (c: Caixa) => {
    try {
      await navigator.clipboard.writeText(textoFechamento(c, vendas, state.loja.nomeFantasia));
      toast('Resumo copiado. É só colar no WhatsApp.');
    } catch {
      toast('Não foi possível copiar.', 'erro');
    }
  };

  const titulo = { abrir: 'Abrir o caixa', sangria: 'Sangria (tirar dinheiro)', reforco: 'Reforço (pôr dinheiro)', fechar: 'Fechar o caixa' };
  const dif = janela === 'fechar' && r && valor != null ? valor - r.previsto : null;

  return (
    <>
      <section className={`card caixa-barra ${aberto ? 'aberto' : ''}`} aria-label="Caixa do dia">
        {aberto && r ? (
          <>
            <div className="caixa-info">
              <strong>
                <Icon name="check" size={16} /> Caixa aberto
              </strong>
              <span className="muted small">
                desde {hora(aberto.abertoEm)}
                {aberto.abertoPor ? ` por ${aberto.abertoPor}` : ''}
              </span>
            </div>
            <div className="caixa-info">
              <span className="muted small">Dinheiro na gaveta (previsto)</span>
              <strong className="caixa-valor">{formatBRL(r.previsto)}</strong>
            </div>
            <div className="row-gap wrap caixa-acoes">
              <Button variant="ghost" onClick={() => abrirJanela('sangria')}>
                Sangria
              </Button>
              <Button variant="ghost" onClick={() => abrirJanela('reforco')}>
                Reforço
              </Button>
              <Button variant="secondary" icon="check" onClick={() => abrirJanela('fechar')}>
                Fechar caixa
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="caixa-info">
              <strong>Caixa fechado</strong>
              <span className="muted small">Abra com o troco do dia para conferir o dinheiro no fim. Dá para vender mesmo sem abrir.</span>
            </div>
            <Button icon="plus" onClick={() => abrirJanela('abrir')}>
              Abrir caixa
            </Button>
          </>
        )}
      </section>

      <Modal
        open={!!janela}
        title={janela ? titulo[janela] : ''}
        onClose={() => setJanela(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setJanela(null)}>
              Voltar
            </Button>
            <Button onClick={confirmar}>{janela === 'abrir' ? 'Abrir caixa' : janela === 'fechar' ? 'Fechar caixa' : 'Registrar'}</Button>
          </>
        }
      >
        {janela === 'fechar' && r && (
          <ul className="pdv-pag">
            <li>
              <span>Troco inicial</span>
              <span>{formatBRL(aberto!.trocoInicial)}</span>
            </li>
            <li>
              <span>Dinheiro das vendas</span>
              <span>+ {formatBRL(r.dinheiro)}</span>
            </li>
            {r.reforcos > 0 && (
              <li>
                <span>Reforços</span>
                <span>+ {formatBRL(r.reforcos)}</span>
              </li>
            )}
            {r.sangrias > 0 && (
              <li>
                <span>Sangrias</span>
                <span>− {formatBRL(r.sangrias)}</span>
              </li>
            )}
            <li>
              <strong>Previsto na gaveta</strong>
              <strong>{formatBRL(r.previsto)}</strong>
            </li>
            <li className="muted">
              <span>
                Vendas do caixa: {r.vendas.vendas} · {r.vendas.porPagamento.map((p) => `${p.label} ${formatBRL(p.total)}`).join(' · ')}
              </span>
            </li>
          </ul>
        )}
        <Field label={janela === 'abrir' ? 'Troco inicial na gaveta' : janela === 'fechar' ? 'Dinheiro contado na gaveta' : 'Valor'}>
          {(id) => <MoneyInput id={id} value={valor} onChange={setValor} />}
        </Field>
        {(janela === 'sangria' || janela === 'reforco' || janela === 'fechar') && (
          <Field label={janela === 'fechar' ? 'Observação (opcional)' : 'Motivo (opcional)'}>{(id) => <input id={id} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={janela === 'sangria' ? 'Ex.: pagamento do motoboy' : ''} />}</Field>
        )}
        {dif != null && (
          <Notice tone={dif === 0 ? 'ok' : 'warn'}>{dif === 0 ? 'Bateu certinho.' : dif > 0 ? `Sobrando ${formatBRL(dif)} na gaveta.` : `Faltando ${formatBRL(-dif)} na gaveta.`}</Notice>
        )}
      </Modal>

      <Modal
        open={!!fechado}
        title="Caixa fechado"
        onClose={() => setFechado(null)}
        footer={
          fechado && (
            <>
              <Button variant="secondary" icon="copy" onClick={() => copiar(fechado)}>
                Copiar resumo
              </Button>
              <Button onClick={() => setFechado(null)}>Pronto</Button>
            </>
          )
        }
      >
        {fechado && <pre className="orc-texto">{textoFechamento(fechado, vendas, state.loja.nomeFantasia)}</pre>}
      </Modal>
    </>
  );
}

/** Lista curta dos caixas anteriores, para conferir diferenças. */
export function CaixasAnteriores() {
  const { state } = useApp();
  const vendas = state.config.vendas ?? [];
  const fechados = (state.config.caixas ?? []).filter((c) => c.fechadoEm).slice(0, 10);
  if (!fechados.length) return null;
  return (
    <section className="card">
      <h2>Caixas anteriores</h2>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Quem</th>
              <th className="num">Vendas</th>
              <th className="num">Previsto</th>
              <th className="num">Contado</th>
              <th className="num">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {fechados.map((c) => {
              const r = resumoCaixa(c, vendas);
              return (
                <tr key={c.id}>
                  <td>{c.dia.split('-').reverse().join('/')}</td>
                  <td>{[c.abertoPor, c.fechadoPor].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(' → ') || '—'}</td>
                  <td className="num">{formatBRL(r.vendas.total)}</td>
                  <td className="num">{formatBRL(c.previsto ?? r.previsto)}</td>
                  <td className="num">{formatBRL(c.contado ?? 0)}</td>
                  <td className={`num ${r.diferenca ? 'rel-desce' : 'rel-sobe'}`}>{!r.diferenca ? 'ok' : r.diferenca > 0 ? `sobrou ${formatBRL(r.diferenca)}` : `faltou ${formatBRL(-r.diferenca)}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
