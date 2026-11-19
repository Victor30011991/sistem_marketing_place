import { useApp } from '../state/store';
import { Icon } from '../ui/icons';
import { useNuvem } from './NuvemProvider';

/** Situação da nuvem e do salvamento, na barra lateral. */
export function NuvemBox() {
  const { state } = useApp();
  const n = useNuvem();
  const total = state.lista.produtos.length;

  let tom: 'clean' | 'dirty' | 'bad' = state.sujo ? 'dirty' : 'clean';
  let texto = state.sujo ? 'Alterações não salvas' : total > 0 ? 'Tudo salvo' : 'Lista vazia';
  if (n.fase === 'conectado') {
    if (!n.online) [tom, texto] = ['dirty', 'Sem internet: guardado aqui, sobe quando voltar'];
    else if (n.enviando) [tom, texto] = ['dirty', 'Enviando para a nuvem…'];
    else [tom, texto] = ['clean', 'Salvo na nuvem'];
  } else if (n.fase === 'sincronizando' || n.fase === 'carregando') [tom, texto] = ['dirty', 'Conectando à nuvem…'];
  else if (n.fase === 'escolher') [tom, texto] = ['dirty', 'Escolha qual lista vale'];
  else if (n.fase === 'erro') [tom, texto] = ['bad', n.erro];
  else if (n.fase === 'negado') [tom, texto] = ['bad', `${n.email} não tem acesso. Entre com o e-mail da loja.`];

  const ligado = n.fase === 'conectado' || n.fase === 'sincronizando' || n.fase === 'escolher' || n.fase === 'erro';
  return (
    <>
      <span className={`savebox-status ${tom}`} role="status">
        <i aria-hidden="true" />
        <span>{texto}</span>
      </span>
      {n.erro && n.fase === 'desligado' && <span className="savebox-msg">{n.erro}</span>}
      {n.fase === 'erro' && (
        <button type="button" className="btn btn-light" onClick={n.tentarDeNovo}>
          <Icon name="cloud" /> Tentar de novo
        </button>
      )}
      {!ligado && (
        <button type="button" className="btn btn-light" onClick={n.entrar} disabled={n.fase === 'carregando'} title="Entre com a conta Google da loja para guardar tudo na nuvem e usar em mais de um aparelho">
          <Icon name="cloud" /> Entrar na nuvem
        </button>
      )}
      {ligado && (
        <button type="button" className="savebox-sair" onClick={n.sair} title="Sair da nuvem neste aparelho">
          <Icon name="logout" size={15} /> <span>Sair</span> <span className="savebox-email">({n.email})</span>
        </button>
      )}
    </>
  );
}
