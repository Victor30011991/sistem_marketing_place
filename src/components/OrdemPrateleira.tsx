import './balancaCodigos.css';
import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { useFeedback } from '../ui/feedback';
import { Button, Field, Notice } from '../ui/ui';
import { codigo4 } from '../core/balanca';
import {
  aplicarNumeracao,
  desfazerNumeracao,
  gruposPrateleira,
  listaCodigos,
  mover,
  numerarPrateleira,
  ordemDosGrupos,
  previaNumeracao,
  PRATELEIRA_PADRAO,
  textoCodigos,
  type GrupoPrateleira,
} from '../core/prateleira';
import { linkWhatsapp, maisVendidos } from '../core/pdvExtras';
import type { Prateleira } from '../types';
import { vitrineDe } from '../core/vitrine';

const PASSOS = [1, 5, 10, 20, 50, 100];

/** Arrumar categorias e potes na ordem da loja e numerar a balança nessa ordem. */
export default function OrdemPrateleira({ prateleira, salvar, onBaixarCarga }: { prateleira?: Prateleira; salvar: (p: Prateleira) => void; onBaixarCarga?: () => void }) {
  const { state, act } = useApp();
  const { toast, confirm } = useFeedback();
  const { lista, loja } = state;
  const prat = prateleira ?? PRATELEIRA_PADRAO;
  const grupos = useMemo(() => gruposPrateleira(lista.produtos, lista.categorias, prat), [lista.produtos, lista.categorias, prat]);
  const [catSel, setCatSel] = useState<string>(grupos[0]?.cat ?? '');
  const grupo = grupos.find((g) => g.cat === catSel) ?? grupos[0];
  const [arrasto, setArrasto] = useState<{ tipo: 'cat' | 'item'; i: number } | null>(null);

  const num = useMemo(() => numerarPrateleira(grupos, prat), [grupos, prat]);
  const previa = useMemo(() => previaNumeracao(grupos, num.codigos), [grupos, num]);
  const mudam = previa.filter((m) => m.antes !== m.depois);

  const guardarGrupos = (gs: GrupoPrateleira[]) => salvar(ordemDosGrupos(gs, prat));
  function moverCat(de: number, para: number) {
    guardarGrupos(mover(grupos, de, para));
  }
  function moverItem(de: number, para: number) {
    if (!grupo) return;
    guardarGrupos(grupos.map((g) => (g.cat === grupo.cat ? { ...g, itens: mover(g.itens, de, para) } : g)));
  }
  function ordenarGrupo(modo: 'alfa' | 'vendidos') {
    if (!grupo) return;
    let itens = [...grupo.itens].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (modo === 'vendidos') {
      const top = maisVendidos(state.config.vendas ?? [], grupo.itens, grupo.itens.length, 90).map((p) => p.id);
      itens = [...grupo.itens].sort((a, b) => top.indexOf(a.id) - top.indexOf(b.id));
    }
    guardarGrupos(grupos.map((g) => (g.cat === grupo.cat ? { ...g, itens } : g)));
  }

  async function aplicar() {
    if (num.erro) return toast(num.erro, 'erro');
    if (!mudam.length) return toast('Os códigos já estão nessa ordem.');
    const ok = await confirm({
      titulo: `Mudar ${mudam.length} código${mudam.length === 1 ? '' : 's'}?`,
      mensagem: <p>Depois, mande a carga nova para a balança e imprima a lista de códigos de novo. Se não gostar, use “Desfazer a última”.</p>,
      confirmar: 'Aplicar numeração',
      perigo: true,
    });
    if (!ok) return;
    const r = aplicarNumeracao(lista.produtos, num.codigos, prat);
    act.produtos(r.produtos);
    salvar(r.prateleira);
    toast('Códigos novos aplicados. Agora mande a carga para a balança.');
  }
  function desfazer() {
    const r = desfazerNumeracao(lista.produtos, prat);
    act.produtos(r.produtos);
    salvar(r.prateleira);
    toast('Voltaram os códigos de antes.');
  }
  function mandarWhatsapp() {
    const texto = textoCodigos(listaCodigos(gruposPrateleira(lista.produtos, lista.categorias, prat)), loja.nomeFantasia, true, true);
    window.open(linkWhatsapp(vitrineDe(loja).whatsapp || loja.telefone, texto), '_blank', 'noopener');
  }

  const alca = (tipo: 'cat' | 'item', i: number, fn: (de: number, para: number) => void) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setArrasto({ tipo, i });
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (e: React.DragEvent) => arrasto?.tipo === tipo && e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (arrasto?.tipo === tipo) fn(arrasto.i, i);
      setArrasto(null);
    },
    onDragEnd: () => setArrasto(null),
  });

  if (!grupos.length) return <Notice tone="info">Cadastre produtos com preço, vendidos por peso ou unidade, para arrumar a prateleira.</Notice>;

  return (
    <div className="prat-grid">
      <div className="prat-col">
        <h3>
          <span className="passo-n">1</span> Prateleiras
        </h3>
        <p className="muted small">A ordem das categorias, da primeira prateleira à última. Arraste ou use as setas.</p>
        <ol className="prat-lista">
          {grupos.map((g, i) => (
            <li key={g.cat} className={`${g.cat === grupo?.cat ? 'on' : ''} ${arrasto?.tipo === 'cat' && arrasto.i === i ? 'arrastando' : ''}`} {...alca('cat', i, moverCat)}>
              <span className="prat-alca" aria-hidden="true">⋮⋮</span>
              <span className="prat-n">{i + 1}</span>
              <button type="button" className="prat-nome" aria-pressed={g.cat === grupo?.cat} onClick={() => setCatSel(g.cat)}>
                {g.cat} <small>{g.itens.length}</small>
              </button>
              <button type="button" className="icon-btn" aria-label={`Subir ${g.cat}`} disabled={i === 0} onClick={() => moverCat(i, i - 1)}>
                <span aria-hidden="true">↑</span>
              </button>
              <button type="button" className="icon-btn" aria-label={`Descer ${g.cat}`} disabled={i === grupos.length - 1} onClick={() => moverCat(i, i + 1)}>
                <span aria-hidden="true">↓</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {grupo && (
        <div className="prat-col">
          <h3>
            <span className="passo-n">2</span> Potes de {grupo.cat}
          </h3>
          <p className="muted small">Na ordem em que estão na prateleira, da esquerda para a direita.</p>
          <ol className="prat-lista">
            {grupo.itens.map((x, i) => (
              <li key={x.id} className={arrasto?.tipo === 'item' && arrasto.i === i ? 'arrastando' : ''} {...alca('item', i, moverItem)}>
                <span className="prat-alca" aria-hidden="true">⋮⋮</span>
                <span className="prat-n">{i + 1}</span>
                <span className="prat-nome prat-txt">
                  {x.nome}
                  {x.plu ? <small className="mono"> {codigo4(x.plu)}</small> : null}
                </span>
                <button type="button" className="icon-btn" aria-label={`Subir ${x.nome}`} disabled={i === 0} onClick={() => moverItem(i, i - 1)}>
                  <span aria-hidden="true">↑</span>
                </button>
                <button type="button" className="icon-btn" aria-label={`Descer ${x.nome}`} disabled={i === grupo.itens.length - 1} onClick={() => moverItem(i, i + 1)}>
                  <span aria-hidden="true">↓</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="row-gap wrap">
            <Button variant="secondary" onClick={() => ordenarGrupo('alfa')}>
              Ordem alfabética nesta prateleira
            </Button>
            <Button variant="secondary" onClick={() => ordenarGrupo('vendidos')}>
              Mais vendidos primeiro
            </Button>
          </div>
        </div>
      )}

      <div className="prat-col">
        <h3>
          <span className="passo-n">3</span> Numerar nessa ordem
        </h3>
        <div className="form-grid">
          <Field label="Começar em">
            {(id) => (
              <input id={id} type="number" min={1} max={9999} value={prat.inicio} onChange={(e) => salvar({ ...prat, inicio: Math.max(1, Math.min(9999, Math.round(Number(e.target.value) || 1))) })} />
            )}
          </Field>
          <Field label="De quanto em quanto">
            {(id) => (
              <select id={id} value={prat.passo} onChange={(e) => salvar({ ...prat, passo: Number(e.target.value) })}>
                {PASSOS.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'De 1 em 1' : `De ${n} em ${n}`}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={prat.centena} onChange={(e) => salvar({ ...prat, centena: e.target.checked })} />
          <span>Cada prateleira começa numa centena nova (1ª em 0100, 2ª em 0200…)</span>
        </label>
        {num.erro && <Notice tone="warn">{num.erro}</Notice>}
        <div className="prat-previa table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Hoje</th>
                <th>Novo</th>
                <th>Produto</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g, gi) => {
                const linhas = previa.filter((m) => m.cat === g.cat);
                return [
                  <tr key={'c' + g.cat} className="prat-cat">
                    <td colSpan={3}>
                      {gi + 1} · {g.cat}
                    </td>
                  </tr>,
                  ...linhas.map((m) => (
                    <tr key={m.produto.id} className={m.antes !== m.depois ? 'prat-muda' : ''}>
                      <td className="mono">{m.antes ? m.antes === m.depois ? codigo4(m.antes) : <s>{codigo4(m.antes)}</s> : '—'}</td>
                      <td className="mono">
                        <strong>{codigo4(m.depois)}</strong>
                      </td>
                      <td>{m.produto.nome}</td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
        {mudam.length > 0 ? (
          <Notice tone="warn">
            <strong>
              {mudam.length} código{mudam.length === 1 ? ' muda' : 's mudam'}.
            </strong>{' '}
            Depois de aplicar, mande a carga nova para a balança e imprima a lista de códigos de novo.
          </Notice>
        ) : (
          <Notice tone="ok">Os códigos já estão nessa ordem.</Notice>
        )}
        <div className="row-gap wrap">
          <Button onClick={aplicar} disabled={!mudam.length || !!num.erro}>
            Aplicar numeração
          </Button>
          {prat.antes && (
            <Button variant="secondary" onClick={desfazer}>
              Desfazer a última
            </Button>
          )}
        </div>
        <div className="row-gap wrap">
          {onBaixarCarga && (
            <Button variant="secondary" icon="download" onClick={onBaixarCarga}>
              Baixar carga da balança
            </Button>
          )}
          <Button variant="secondary" icon="send" onClick={mandarWhatsapp}>
            Mandar lista no nosso WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}
