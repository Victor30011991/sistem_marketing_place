import { useApp } from '../state/store';
import { useFeedback } from './feedback';
import { lerBackup } from '../core/backup';

/** Pergunta e restaura um backup .txt (usado no Início e em Salvar em Excel). Devolve true se restaurou. */
export function useRestaurarBackup() {
  const { state, act } = useApp();
  const { toast, confirm } = useFeedback();
  const n = state.lista.produtos.length;
  return async function restaurarTexto(texto: string): Promise<boolean> {
    const r = lerBackup(texto);
    if (!r.ok) {
      toast(r.motivo, 'erro');
      return false;
    }
    const quando = r.geradoEm ? new Date(r.geradoEm).toLocaleString('pt-BR') : 'data desconhecida';
    const ok = await confirm({
      titulo: 'Restaurar este backup?',
      perigo: n > 0,
      confirmar: 'Restaurar backup',
      mensagem: (
        <>
          <p>
            Backup de <strong>{quando}</strong>: lista “{r.lista.nome}” com <strong>{r.lista.produtos.length}</strong> produto{r.lista.produtos.length === 1 ? '' : 's'}.
          </p>
          <p>
            {n > 0 ? <>Isto <strong>substitui</strong> a lista atual ({n} produto{n === 1 ? '' : 's'}), os dados da loja, custos, taxas e margens. Salve um backup ou um Excel antes, se precisar do que está aqui.</> : 'Produtos, dados da loja, custos, taxas e margens serão carregados.'}
          </p>
          {r.ignorados > 0 && <p className="muted">{r.ignorados} item(ns) incompleto(s) do arquivo serão ignorados.</p>}
        </>
      ),
    });
    if (!ok) return false;
    act.restaurarBackup(r.lista, r.loja, r.config);
    toast('Backup restaurado. Salve em Excel para guardar este estado.');
    return true;
  };
}
