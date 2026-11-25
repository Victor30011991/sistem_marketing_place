import './pacote.css';
import { Button, MoneyInput } from '../ui/ui';
import { Icon } from '../ui/icons';
import { formatBRL } from '../core/money';

/** datetime-local (AAAA-MM-DDTHH:mm) de um dia relativo a hoje, mantendo a hora escolhida. */
export function diaRelativo(diasAtras: number, hora = '12:00', agora = new Date()): string {
  const d = new Date(agora);
  d.setDate(d.getDate() - diasAtras);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${hora}`;
}

export type Conferencia = { estado: 'vazio' | 'falta' | 'confere' | 'passou'; diferenca: number };

/** Compara o total lançado com o valor anotado no caderno. */
export function conferir(total: number, esperado: number | null): Conferencia {
  if (!esperado || esperado <= 0) return { estado: 'vazio', diferenca: 0 };
  const d = total - esperado;
  return { estado: d === 0 ? 'confere' : d < 0 ? 'falta' : 'passou', diferenca: Math.abs(d) };
}

interface Props {
  retro: string;
  setRetro: (v: string) => void;
  esperado: number | null;
  setEsperado: (v: number | null) => void;
  manter: boolean;
  setManter: (v: boolean) => void;
  total: number;
  itens: number;
}

/** Lançar uma venda que não deu para registrar na hora: data, valor do caderno e conferência. */
export default function VendaOutroDia({ retro, setRetro, esperado, setEsperado, manter, setManter, total, itens }: Props) {
  const agora = new Date();
  const maxLocal = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  if (!retro)
    return (
      <div className="vod-fechado">
        <Button variant="ghost" icon="calendar" onClick={() => setRetro(diaRelativo(1))}>
          Lançar venda de outro dia
        </Button>
      </div>
    );

  const hora = retro.slice(11, 16) || '12:00';
  const data = new Date(retro);
  const dias = Math.floor((new Date(agora.toDateString()).getTime() - new Date(data.toDateString()).getTime()) / 86400000);
  const c = conferir(total, esperado);
  const pct = esperado ? Math.min(100, Math.round((total / esperado) * 100)) : 0;
  const quando = isNaN(data.getTime()) ? '' : data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });

  return (
    <section className="card vod" aria-label="Venda de outro dia">
      <div className="vod-topo">
        <h2>
          <Icon name="calendar" /> Venda de outro dia{quando ? <span className="vod-quando"> · {quando}</span> : null}
        </h2>
        <Button variant="ghost" onClick={() => { setRetro(''); setEsperado(null); setManter(false); }}>
          Voltar para venda de agora
        </Button>
      </div>

      <div className="vod-campos">
        <div className="vod-campo">
          <span className="vod-rotulo" id="vod-dia">Quando foi</span>
          <div className="vod-chips" role="group" aria-labelledby="vod-dia">
            {[
              [1, 'Ontem'],
              [2, 'Anteontem'],
            ].map(([n, r]) => (
              <button key={r} type="button" className={`vod-chip ${dias === n ? 'on' : ''}`} aria-pressed={dias === n} onClick={() => setRetro(diaRelativo(n as number, hora))}>
                {r}
              </button>
            ))}
            <input type="datetime-local" aria-label="Data e hora da venda" value={retro} max={maxLocal} onChange={(e) => e.target.value && setRetro(e.target.value)} />
          </div>
        </div>
        <label className="vod-campo">
          <span className="vod-rotulo">Valor da venda (do caderno)</span>
          <MoneyInput ariaLabel="Valor da venda anotado" value={esperado} onChange={setEsperado} />
        </label>
      </div>

      {c.estado !== 'vazio' && (
        <div className={`vod-confere ${c.estado}`} role="status" aria-live="polite">
          <div className="vod-barra" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </div>
          <p>
            {itens === 0 ? (
              <>Agora lance os itens que foram vendidos. Vou conferindo com {formatBRL(esperado as number)}.</>
            ) : c.estado === 'confere' ? (
              <>
                <Icon name="check" /> <strong>Confere:</strong> {formatBRL(total)}, igual ao caderno.
              </>
            ) : c.estado === 'falta' ? (
              <>
                Lançado {formatBRL(total)} de {formatBRL(esperado as number)}. <strong>Falta {formatBRL(c.diferenca)}</strong> em itens.
              </>
            ) : (
              <>
                Lançado {formatBRL(total)}. <strong>Passou {formatBRL(c.diferenca)}</strong> do caderno: confira as quantidades ou dê desconto.
              </>
            )}
          </p>
        </div>
      )}

      <label className="check">
        <input type="checkbox" checked={manter} onChange={(e) => setManter(e.target.checked)} />
        <span>Manter esta data nas próximas vendas (para passar o caderno do dia)</span>
      </label>
      <p className="muted small">
        Escolha como foi pago em “Receber em”. A venda fica no dia escolhido e só entra no caixa se for de hoje, depois que o caixa abriu.
        {dias > 7 ? ' Os preços usados são os de hoje: se mudaram, ajuste o total do item.' : ''}
      </p>
    </section>
  );
}
