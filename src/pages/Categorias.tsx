import { useState } from 'react';
import { useApp } from '../state/store';
import { useFeedback, useDocumentTitle } from '../ui/feedback';
import { Button, Empty, PageHeader } from '../ui/ui';
import { Icon } from '../ui/icons';
import { norm } from '../core/normalize';
import { planoCategorias } from '../core/categorias';

export default function Categorias() {
  useDocumentTitle('Categorias');
  const { state, act } = useApp();
  const { confirm, toast } = useFeedback();
  const [nova, setNova] = useState('');
  const [edit, setEdit] = useState<{ de: string; texto: string } | null>(null);
  const { categorias, produtos } = state.lista;
  const count = (c: string) => produtos.filter((p) => p.categoria === c).length;
  const semCat = produtos.filter((p) => !p.categoria).length;
  const plano = planoCategorias(categorias);

  async function organizar() {
    const ok = await confirm({
      titulo: 'Organizar as categorias?',
      mensagem: (
        <>
          {plano.renomear.length > 0 && (
            <>
              <p>
                <strong>Mudam de nome</strong> (os produtos vão junto):
              </p>
              <ul>
                {plano.renomear.map(([de, para]) => (
                  <li key={de}>
                    {de} → {para}
                  </li>
                ))}
              </ul>
            </>
          )}
          {plano.criar.length > 0 && (
            <p>
              <strong>Novas:</strong> {plano.criar.join(', ')}.
            </p>
          )}
          <p>Nenhum produto muda de categoria. Categoria vazia não aparece no catálogo: ela surge quando vocês colocarem o primeiro produto nela.</p>
        </>
      ),
      confirmar: 'Organizar categorias',
    });
    if (!ok) return;
    act.organizarCategorias(plano.renomear, plano.ordem);
    toast('Categorias organizadas. Agora é só mudar os produtos de lugar.');
  }

  function adicionar() {
    const n = nova.trim();
    if (!n) return;
    if (categorias.some((c) => norm(c) === norm(n))) return toast('Essa categoria já existe.', 'erro');
    act.addCategoria(n);
    setNova('');
  }

  function renomear() {
    if (!edit) return;
    const t = edit.texto.trim();
    if (!t) return;
    if (norm(t) !== norm(edit.de) && categorias.some((c) => norm(c) === norm(t))) {
      return toast('Já existe uma categoria com esse nome.', 'erro');
    }
    act.renomearCategoria(edit.de, t);
    setEdit(null);
  }

  async function excluir(c: string) {
    const n = count(c);
    const ok = await confirm({
      titulo: `Excluir a categoria “${c}”?`,
      mensagem: n > 0 ? (
        <p>
          Os <strong>{n}</strong> produto{n === 1 ? '' : 's'} desta categoria <strong>não serão excluídos</strong>: ficarão “Sem categoria”.
        </p>
      ) : (
        <p>A categoria está vazia.</p>
      ),
      confirmar: 'Excluir categoria',
      perigo: true,
    });
    if (ok) act.excluirCategoria(c);
  }

  return (
    <div className="page narrow">
      <PageHeader titulo="Categorias" subtitulo="Organize os produtos do seu jeito. Crie, renomeie e exclua quando quiser." />

      {plano.mudou && produtos.length > 0 && (
        <section className="card cat-sugestao" aria-labelledby="cat-sug-titulo">
          <div>
            <h2 id="cat-sug-titulo">Organização sugerida</h2>
            <p className="muted small">
              {[plano.criar.length ? `Cria ${plano.criar.length} categoria${plano.criar.length === 1 ? '' : 's'} nova${plano.criar.length === 1 ? '' : 's'}` : '', plano.renomear.length ? `renomeia ${plano.renomear.length}` : '', 'põe na ordem do catálogo'].filter(Boolean).join(', ')}
              . Os produtos ficam onde estão.
            </p>
          </div>
          <Button icon="tag" variant="secondary" onClick={organizar}>
            Ver e aplicar
          </Button>
        </section>
      )}

      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          adicionar();
        }}
      >
        <input aria-label="Nome da nova categoria" placeholder="Nome da nova categoria (ex.: Grãos, Temperos, Bovinos)" value={nova} onChange={(e) => setNova(e.target.value)} />
        <Button icon="plus" disabled={!nova.trim()} onClick={adicionar}>
          Adicionar
        </Button>
      </form>

      {categorias.length === 0 && semCat === 0 ? (
        <Empty titulo="Nenhuma categoria ainda" icon="tag">
          As categorias também são criadas automaticamente quando você importa um arquivo que traz essa coluna.
        </Empty>
      ) : (
        <ul className="list-card">
          {categorias.map((c) => (
            <li key={c}>
              {edit?.de === c ? (
                <form
                  className="add-row inline"
                  onSubmit={(e) => {
                    e.preventDefault();
                    renomear();
                  }}
                >
                  <input aria-label={`Novo nome de ${c}`} value={edit.texto} onChange={(e) => setEdit({ de: c, texto: e.target.value })} autoFocus />
                  <Button onClick={renomear} icon="check">
                    Salvar
                  </Button>
                  <Button variant="ghost" onClick={() => setEdit(null)}>
                    Cancelar
                  </Button>
                </form>
              ) : (
                <>
                  <span className="li-main">
                    <strong>{c}</strong>
                    <small className="muted">
                      {count(c) ? `${count(c)} produto${count(c) === 1 ? '' : 's'}` : 'Vazia · não aparece no catálogo'}
                    </small>
                  </span>
                  <span className="row-actions">
                    <button type="button" className="icon-btn" aria-label={`Renomear ${c}`} onClick={() => setEdit({ de: c, texto: c })}>
                      <Icon name="edit" />
                    </button>
                    <button type="button" className="icon-btn danger" aria-label={`Excluir ${c}`} onClick={() => excluir(c)}>
                      <Icon name="trash" />
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
          {semCat > 0 && (
            <li>
              <span className="li-main">
                <strong className="muted">Sem categoria</strong>
                <small className="muted">
                  {semCat} produto{semCat === 1 ? '' : 's'}
                </small>
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
