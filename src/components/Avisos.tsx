import { Link } from 'react-router-dom';
import { useApp } from '../state/store';
import { useNuvem } from '../nuvem/NuvemProvider';
import { usePedidos } from '../nuvem/PedidosProvider';
import { vencendo } from '../core/validade';
import { saldo } from '../core/contas';
import { diaLocal } from '../core/vendas';
import { Icon } from '../ui/icons';

const br = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

/** O que pede atenção hoje: pedidos novos, contas vencendo, mercadoria vencendo e backup. */
export function Avisos() {
  const { state } = useApp();
  const { fase } = useNuvem();
  const { novos } = usePedidos();
  const hoje = diaLocal(new Date());
  const venc = vencendo(state.config.lotes ?? [], state.lista.produtos, hoje, 30);
  const contas = (state.config.contas ?? []).filter((c) => c.tipo === 'pagar' && saldo(c) > 0 && c.vencimento <= hoje);
  const semBackup =
    fase !== 'conectado' && state.lista.produtos.length > 0 && (!state.config.ultimoDownload || Date.now() - Date.parse(state.config.ultimoDownload) > 30 * 86400000);
  const itens: { tom: 'bad' | 'warn' | 'info'; texto: React.ReactNode; to: string; acao: string }[] = [];
  if (novos) itens.push({ tom: 'warn', texto: <><strong>{novos} pedido(s) novo(s)</strong> do cardápio esperando.</>, to: '/pedidos', acao: 'Ver pedidos' });
  if (contas.length) itens.push({ tom: 'bad', texto: <><strong>{contas.length} conta(s) a pagar</strong> vencida(s) ou vencendo hoje.</>, to: '/contas', acao: 'Ver contas' });
  for (const v of venc.slice(0, 4))
    itens.push({
      tom: v.dias < 0 ? 'bad' : 'warn',
      texto: (
        <>
          <strong>{v.nome}</strong> {v.dias < 0 ? `venceu em ${br(v.validade)}` : v.dias === 0 ? 'vence hoje' : `vence em ${v.dias} dia(s) (${br(v.validade)})`} · {v.lote}
        </>
      ),
      to: '/etiquetas',
      acao: 'Fazer promoção',
    });
  if (venc.length > 4) itens.push({ tom: 'info', texto: <>E mais {venc.length - 4} produto(s) perto da validade.</>, to: '/relatorios', acao: 'Ver todos' });
  if (semBackup) itens.push({ tom: 'info', texto: <>Faz tempo que não baixa um backup. Sem a nuvem, ele é a sua segurança.</>, to: '/excel', acao: 'Fazer backup' });
  if (!itens.length) return null;
  return (
    <section className="card avisos" aria-label="Avisos de hoje">
      <h2>Para hoje</h2>
      <ul>
        {itens.map((i, k) => (
          <li key={k} className={`aviso-${i.tom}`}>
            <Icon name={i.tom === 'info' ? 'info' : 'alert'} size={18} />
            <span>{i.texto}</span>
            <Link to={i.to}>{i.acao}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
