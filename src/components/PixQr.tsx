import './pacote.css';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { qrMatriz } from '../core/qr';
import { formatBRL } from '../core/money';
import { cfgOrcamento, pixCopiaECola } from '../core/orcamentos';
import { useFeedback } from '../ui/feedback';
import { Button } from '../ui/ui';

/** QR code em SVG, do tamanho pedido em pixels. */
export function QrSvg({ texto, px, rotulo }: { texto: string; px: number; rotulo: string }) {
  const m = useMemo(() => qrMatriz(texto), [texto]);
  const n = m.length;
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={px} height={px} shapeRendering="crispEdges" role="img" aria-label={rotulo}>
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      <path d={m.flatMap((lin, r) => lin.map((on, c) => (on ? `M${c} ${r}h1v1h-1z` : ''))).join('')} fill="#000" />
    </svg>
  );
}

/** Pix do balcão: QR com o valor exato para o cliente ler no celular, e o copia e cola. */
export function PixBalcao({ orcamentoCfg, valor, txid }: { orcamentoCfg: unknown; valor: number; txid: string }) {
  const { toast } = useFeedback();
  const [grande, setGrande] = useState(false);
  const pix = useMemo(() => (valor > 0 ? pixCopiaECola(cfgOrcamento(orcamentoCfg), valor, txid) : null), [orcamentoCfg, valor, txid]);
  const temChave = !!cfgOrcamento(orcamentoCfg).pixChave.trim();
  if (!temChave)
    return (
      <p className="muted small">
        Para mostrar o QR do Pix aqui, cadastre a chave em <Link to="/orcamento">Orçamento › Pix</Link>.
      </p>
    );
  if (!pix) return <p className="muted small">Confira a chave, o nome e a cidade do Pix em <Link to="/orcamento">Orçamento</Link>.</p>;
  async function copiar() {
    try {
      await navigator.clipboard.writeText(pix as string);
      toast('Código Pix copiado.');
    } catch {
      toast('Não deu para copiar. Segure no código e copie.', 'erro');
    }
  }
  return (
    <div className="pix-balcao">
      <button type="button" className="pix-qr" onClick={() => setGrande(true)} aria-label={`Ampliar o QR do Pix de ${formatBRL(valor)}`}>
        <QrSvg texto={pix} px={168} rotulo={`QR do Pix de ${formatBRL(valor)}`} />
      </button>
      <div className="pix-info">
        <strong>{formatBRL(valor)}</strong>
        <span className="muted small">O cliente lê com o app do banco e o valor já vem preenchido. Confira o comprovante antes de finalizar.</span>
        <div className="row-gap wrap">
          <Button variant="secondary" onClick={() => setGrande(true)}>
            Mostrar grande
          </Button>
          <Button variant="ghost" onClick={copiar}>
            Copiar código
          </Button>
        </div>
      </div>
      {grande && (
        <div className="pix-tela" role="dialog" aria-modal="true" aria-label="QR do Pix" onClick={() => setGrande(false)} onKeyDown={(e) => e.key === 'Escape' && setGrande(false)}>
          <div className="pix-tela-caixa" onClick={(e) => e.stopPropagation()}>
            <p className="pix-tela-valor">Pix · {formatBRL(valor)}</p>
            <QrSvg texto={pix} px={Math.min(360, typeof window !== 'undefined' ? window.innerWidth - 80 : 360)} rotulo={`QR do Pix de ${formatBRL(valor)}`} />
            <p className="muted">Aponte a câmera do app do banco</p>
            <Button autoFocus onClick={() => setGrande(false)}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
