import './pacote.css';
import { useApp } from '../state/store';
import { Button } from '../ui/ui';
import { mixesPossiveis, vitrineDe } from '../core/vitrine';
import type { AjusteMix } from '../types';

const PESOS = [25, 50, 100, 150, 200];

/** Mixes de temperos que aparecem sozinhos no catálogo: a loja escolhe quais, o nome, a descrição e as gramas. */
export default function MixesCatalogo() {
  const { state, act } = useApp();
  const v = vitrineDe(state.loja);
  const ocultos = new Set(v.ocultos);
  const mixes = mixesPossiveis(state.lista.produtos.filter((p) => !ocultos.has(p.id)), v);
  const cfg = v.mixesCfg ?? {};
  const mudar = (id: string, patch: Partial<AjusteMix> | null) => {
    const n = { ...cfg };
    if (patch === null) delete n[id];
    else n[id] = { ...(n[id] ?? {}), ...patch };
    act.loja({ vitrine: { ...v, mixesCfg: Object.keys(n).length ? n : undefined } });
  };
  const ligados = mixes.filter((m) => m.ativo).length;

  return (
    <section className="card mixes-cat" aria-labelledby="mixes-titulo">
      <h2 id="mixes-titulo">Mixes de temperos</h2>
      <p className="muted small">
        Aparecem sozinhos no carrossel quando a loja tem todos os temperos de uma receita. O cliente vê o nome, o que leva e o preço, e leva tudo com um toque. Até 4 aparecem por vez.
      </p>
      {v.mixes === false && <p className="small"><strong>Os mixes estão desligados</strong> em Página da loja › Destaques e divulgação.</p>}
      {!mixes.length ? (
        <p className="muted">Nenhuma receita fecha com os temperos cadastrados agora.</p>
      ) : (
        <ul className="mixes-lista">
          {mixes.map((m) => {
            const mexido = !!cfg[m.id];
            return (
              <li key={m.id} className={m.ativo ? 'on' : ''}>
                <label className="check">
                  <input type="checkbox" checked={m.ativo} onChange={(e) => mudar(m.id, { ativo: e.target.checked ? undefined : false })} />
                  <span>Aparece no catálogo</span>
                </label>
                <div className="mixes-campos">
                  <label className="field">
                    <span className="field-label">Nome no catálogo</span>
                    <input value={cfg[m.id]?.nome ?? m.nome} maxLength={60} onChange={(e) => mudar(m.id, { nome: e.target.value })} />
                  </label>
                  <label className="field">
                    <span className="field-label">Frase embaixo (para quê)</span>
                    <input value={cfg[m.id]?.desc ?? m.desc} maxLength={90} placeholder="Ex.: no forno ou na air fryer" onChange={(e) => mudar(m.id, { desc: e.target.value })} />
                  </label>
                  <label className="field mixes-g">
                    <span className="field-label">Gramas de cada</span>
                    <select value={m.g} onChange={(e) => mudar(m.id, { g: Number(e.target.value) })}>
                      {[...new Set([...PESOS, m.g])].sort((a, b) => a - b).map((g) => (
                        <option key={g} value={g}>
                          {g} g
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="mixes-leva">
                  <strong>Leva:</strong> {m.temperos.join(', ')} <span className="muted">· receita “{m.receita}”</span>
                </p>
                {mexido && (
                  <Button variant="ghost" onClick={() => mudar(m.id, null)}>
                    Voltar ao padrão
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {mixes.length > 0 && <p className="muted small">{ligados} de {mixes.length} ligados{ligados > 4 ? ' · aparecem os 4 primeiros' : ''}.</p>}
    </section>
  );
}
