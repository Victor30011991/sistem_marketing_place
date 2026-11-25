import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../state/store';
import { useFeedback, useDocumentTitle } from '../ui/feedback';
import { logoSrc } from '../ui/logo';
import Entrada from './Entrada';
import { Avisos } from '../components/Avisos';
import { useNuvem } from '../nuvem/NuvemProvider';

export default function Home() {
  useDocumentTitle('Início');
  const { state, act } = useApp();
  const { confirm } = useFeedback();
  const nav = useNavigate();
  const total = state.lista.produtos.length;
  const naNuvem = useNuvem().fase === 'conectado';

  async function novaLista() {
    if (naNuvem && total > 0) {
      const ok = await confirm({
        titulo: 'Apagar a lista da nuvem?',
        mensagem: (
          <>
            <p>
              Vocês estão na nuvem: começar uma lista nova <strong>apaga os {total} produtos</strong> para todos os aparelhos, e o catálogo do cliente fica vazio.
            </p>
            <p className="muted">Se quiser guardar uma cópia, salve em Excel antes. Dados da loja, custos, taxas e vendas continuam.</p>
          </>
        ),
        confirmar: 'Apagar e começar nova',
        perigo: true,
      });
      if (!ok) return;
    } else if (state.sujo && total > 0) {
      const ok = await confirm({
        titulo: 'Começar uma lista nova?',
        mensagem: (
          <>
            <p>
              A lista atual (<strong>{state.lista.nome}</strong>, {total} produtos) tem alterações que ainda não foram salvas em Excel. Ao começar uma lista nova elas serão descartadas.
            </p>
            <p className="muted">Seus dados da loja, custos, taxas e margens continuam como estão.</p>
          </>
        ),
        confirmar: 'Descartar e começar nova',
        perigo: true,
      });
      if (!ok) return;
    }
    act.novaLista();
    nav('/produtos');
  }

  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">Sistema da loja</span>
          <h1>Do custo ao balcão, tudo num lugar.</h1>
          <p>
            Preços com margem certa, estoque, vendas no PDV, pedidos do catálogo, orçamentos e relatórios. Funciona no computador e no celular, com os dados na nuvem para vocês dois. <a href="https://github.com/Victor30011991/sistem_marketing_place#manual-de-uso" target="_blank" rel="noopener noreferrer">Ver o manual de uso</a>.
          </p>
        </div>
        <div className="hero-logo">
          <img src={logoSrc(state.loja)} alt={`Logomarca ${state.loja.nomeFantasia}`} />
        </div>
      </section>

      <Avisos />
      <Entrada onNovaLista={novaLista} />

      {total > 0 && (
        <p className="resume">
          Lista aberta: <strong>{state.lista.nome}</strong> · {total} produto{total === 1 ? '' : 's'} ·{' '}
          <Link to="/produtos">continuar editando</Link>
        </p>
      )}

      <section className="howto">
        <div>
          <h2>Como seus dados são guardados</h2>
          <p className="muted">
            Com <strong>Entrar na nuvem</strong> (no menu), tudo fica salvo sozinho e aparece nos aparelhos dos dois. Sem a nuvem, o arquivo Excel é a base: salve antes de fechar (o sistema avisa). O <strong>Backup (.txt)</strong> guarda uma cópia de tudo, por segurança.
          </p>
        </div>
        <ol className="steps">
          <li>
            <span>1</span>
            <div>
              <strong>Entre na nuvem</strong>
              <small>Com o e-mail da loja: salva sozinho, nos dois aparelhos.</small>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Use no dia a dia</strong>
              <small>Venda no PDV, separe os pedidos, mande orçamentos.</small>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Guarde uma cópia</strong>
              <small>De vez em quando, baixe o Backup (.txt) ou o Excel.</small>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
