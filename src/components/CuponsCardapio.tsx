import './pacote.css';
import { useApp } from '../state/store';
import { useFeedback } from '../ui/feedback';
import { Button, Field, MoneyInput } from '../ui/ui';
import { Icon } from '../ui/icons';
import { CUPONS_MAX, cupomValendo, cuponsDe, hojeISO, limparCodigo, novoCupom, textoCupom } from '../core/cupons';
import { vitrineDe } from '../core/vitrine';
import type { CupomCardapio } from '../types';

const SUGESTOES: Omit<CupomCardapio, 'id'>[] = [
  { codigo: 'PRIMEIRA10', tipo: 'pct', valor: 10, minimo: 0, ativo: true, nota: 'Primeira compra' },
  { codigo: 'VOLTEI', tipo: 'valor', valor: 500, minimo: 3000, ativo: true, nota: 'Para quem sumiu' },
];

/** Cupons que o cliente digita no pedido do catálogo. */
export default function CuponsCardapio() {
  const { state, act } = useApp();
  const { confirm } = useFeedback();
  const v = vitrineDe(state.loja);
  const cupons = cuponsDe(v.cupons);
  const hoje = hojeISO();
  const salvar = (n: CupomCardapio[]) => act.loja({ vitrine: { ...v, cupons: n } });
  const mudar = (id: string, patch: Partial<CupomCardapio>) => salvar(cupons.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const repetido = (c: CupomCardapio) => !!c.codigo && cupons.some((x) => x.id !== c.id && x.codigo === c.codigo);

  async function excluir(c: CupomCardapio) {
    if (await confirm({ titulo: `Excluir o cupom ${c.codigo || 'sem código'}?`, mensagem: <p>Quem tentar usar esse código no catálogo vai ver que ele não existe.</p>, confirmar: 'Excluir cupom', perigo: true }))
      salvar(cupons.filter((x) => x.id !== c.id));
  }
  function adicionar(base?: Omit<CupomCardapio, 'id'>) {
    if (cupons.length >= CUPONS_MAX) return;
    const n = { ...novoCupom(), ...(base ?? {}) };
    if (base && cupons.some((x) => x.codigo === base.codigo)) return;
    salvar([...cupons, n]);
  }

  return (
    <section className="card cupons" aria-labelledby="cupons-titulo">
      <div className="cupons-cab">
        <div>
          <h2 id="cupons-titulo">Cupons de desconto</h2>
          <p className="muted small">O cliente digita o código na tela do pedido. O desconto vale só nos produtos, não na entrega, e já vem aplicado quando o pedido cai no PDV.</p>
        </div>
        <Button icon="plus" variant="secondary" onClick={() => adicionar()} disabled={cupons.length >= CUPONS_MAX}>
          Novo cupom
        </Button>
      </div>

      {!cupons.length && (
        <div className="cupons-vazio">
          <p>Comece com um destes:</p>
          <div className="row-gap wrap">
            {SUGESTOES.map((s) => (
              <Button key={s.codigo} variant="ghost" icon="plus" onClick={() => adicionar(s)}>
                {s.codigo} · {s.nota}
              </Button>
            ))}
          </div>
        </div>
      )}

      <ul className="cupons-lista">
        {cupons.map((c) => {
          const vale = cupomValendo(c, hoje);
          const situacao = !c.codigo ? 'Falta o código' : repetido(c) ? 'Código repetido' : !c.ativo ? 'Pausado' : c.ate && c.ate < hoje ? 'Venceu' : c.valor <= 0 ? 'Falta o valor' : 'Valendo';
          return (
            <li key={c.id} className={`cupom-item ${vale && !repetido(c) ? 'on' : ''}`}>
              <div className="cupom-topo">
                <span className={`cupom-sit ${vale && !repetido(c) ? 'ok' : ''}`}>{situacao}</span>
                <span className="muted small">{c.codigo && c.valor > 0 ? textoCupom(c) : ''}</span>
                <button type="button" className="icon-btn danger" aria-label={`Excluir o cupom ${c.codigo || 'sem código'}`} onClick={() => excluir(c)}>
                  <Icon name="trash" />
                </button>
              </div>
              <div className="cupom-campos">
                <Field label="Código" hint="Letras e números, sem espaço.">
                  {(id) => <input id={id} className="mono" value={c.codigo} maxLength={20} aria-invalid={repetido(c) || undefined} onChange={(e) => mudar(c.id, { codigo: limparCodigo(e.target.value) })} />}
                </Field>
                <Field label="Desconto">
                  {(id) => (
                    <div className="row-gap cupom-valor">
                      <select aria-label="Tipo de desconto" value={c.tipo} onChange={(e) => mudar(c.id, { tipo: e.target.value as CupomCardapio['tipo'], valor: e.target.value === 'pct' ? 10 : 500 })}>
                        <option value="pct">%</option>
                        <option value="valor">R$</option>
                      </select>
                      {c.tipo === 'pct' ? (
                        <input id={id} type="number" min={1} max={90} inputMode="numeric" value={c.valor || ''} onChange={(e) => mudar(c.id, { valor: Math.max(0, Math.min(90, Math.round(Number(e.target.value) || 0))) })} />
                      ) : (
                        <MoneyInput ariaLabel="Valor do desconto" value={c.valor || null} onChange={(x) => mudar(c.id, { valor: Math.max(0, x ?? 0) })} />
                      )}
                    </div>
                  )}
                </Field>
                <Field label="Pedido mínimo" hint="Vazio = qualquer valor.">
                  {() => <MoneyInput ariaLabel="Pedido mínimo" value={c.minimo || null} onChange={(x) => mudar(c.id, { minimo: Math.max(0, x ?? 0) })} />}
                </Field>
                <Field label="Vale até" hint="Vazio = sem prazo.">
                  {(id) => <input id={id} type="date" value={c.ate ?? ''} onChange={(e) => mudar(c.id, { ate: e.target.value || undefined })} />}
                </Field>
                <Field label="Para quê (só vocês veem)">
                  {(id) => <input id={id} value={c.nota ?? ''} maxLength={80} placeholder="Ex.: primeira compra" onChange={(e) => mudar(c.id, { nota: e.target.value })} />}
                </Field>
              </div>
              <label className="check">
                <input type="checkbox" checked={c.ativo} onChange={(e) => mudar(c.id, { ativo: e.target.checked })} />
                <span>Valendo no catálogo</span>
              </label>
            </li>
          );
        })}
      </ul>
      {cupons.length > 0 && <p className="muted small">Quem abre o código do catálogo consegue ver os cupons valendo. Para promoção grande, use prazo curto.</p>}
    </section>
  );
}
