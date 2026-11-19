import type { CSSProperties } from 'react';
import type { ConfigOrcamento, OrcamentoSalvo, StoreInfo } from '../types';
import { formatBRL } from '../core/money';
import { installments } from '../core/orcamento';
import { contatosLoja, dataBR, precoTexto, qtdTexto, totaisOrcamento, validadeTexto } from '../core/orcamentos';
import { qrMatriz } from '../core/qr';

function Qr({ texto, mm }: { texto: string; mm: number }) {
  const m = qrMatriz(texto);
  const n = m.length;
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} style={{ width: `${mm}mm`, height: `${mm}mm`, display: 'block', margin: '0 auto' }} shapeRendering="crispEdges" aria-hidden="true">
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      {m.flatMap((lin, r) => lin.map((on, c) => (on ? <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#000" /> : null)))}
    </svg>
  );
}

/** Orçamento em bobina térmica (58 ou 80 mm), preto e branco. */
export function CupomOrcamento({ o, loja, logo, cfg, pix, confirmar }: { o: OrcamentoSalvo; loja: StoreInfo; logo: string; cfg: ConfigOrcamento; pix: string | null; confirmar: string | null }) {
  const t = totaisOrcamento(o);
  const pequeno = cfg.cupom === 58;
  const base: CSSProperties = { fontFamily: '"DM Sans Variable", Arial, sans-serif', fontSize: pequeno ? '7.5pt' : '9pt', color: '#000', lineHeight: 1.25, padding: '2mm 3mm 4mm', boxSizing: 'border-box', width: '100%' };
  const linha: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '2mm' };
  const tracejado: CSSProperties = { borderTop: '0.3mm dashed #000', margin: '1.6mm 0' };
  const ct = contatosLoja(loja);
  return (
    <div style={base}>
      <div style={{ textAlign: 'center' }}>
        <img src={logo} alt="" style={{ width: pequeno ? '16mm' : '20mm', height: pequeno ? '16mm' : '20mm', objectFit: 'contain', filter: 'grayscale(1) contrast(1.3)' }} />
        <div style={{ fontWeight: 700, fontSize: '1.35em' }}>{loja.nomeFantasia}</div>
        {[loja.endereco, ct.whats && `WhatsApp ${ct.whats}`, ct.insta].filter(Boolean).map((x) => (
          <div key={x as string}>{x}</div>
        ))}
      </div>
      <div style={tracejado} />
      <div style={{ ...linha, fontWeight: 700 }}>
        <span>ORÇAMENTO Nº {o.numero}</span>
        <span>{dataBR(o.criado)}</span>
      </div>
      {o.cliente.nome.trim() && <div>Para: {o.cliente.nome.trim()}</div>}
      <div style={tracejado} />
      {o.itens.map((i, k) => (
        <div key={k} style={{ marginBottom: '1.2mm' }}>
          <div style={{ fontWeight: 600 }}>{i.nome}</div>
          <div style={linha}>
            <span>
              {qtdTexto(i)} × {precoTexto(i)}
            </span>
            <strong>{formatBRL(i.total)}</strong>
          </div>
        </div>
      ))}
      <div style={tracejado} />
      {t.desconto > 0 && (
        <>
          <div style={linha}>
            <span>Subtotal</span>
            <span>{formatBRL(t.subtotal)}</span>
          </div>
          <div style={linha}>
            <span>Desconto</span>
            <span>- {formatBRL(t.desconto)}</span>
          </div>
        </>
      )}
      <div style={{ ...linha, fontWeight: 800, fontSize: '1.45em', marginTop: '0.8mm' }}>
        <span>TOTAL</span>
        <span>{formatBRL(t.total)}</span>
      </div>
      {o.parcelas > 1 && <div style={{ textAlign: 'right' }}>ou {o.parcelas}× de {formatBRL(installments(t.total, o.parcelas)[0])} no cartão</div>}
      {t.desconto > 0 && <div style={{ textAlign: 'center', fontWeight: 700, marginTop: '1mm' }}>Você economiza {formatBRL(t.desconto)}</div>}
      <div style={tracejado} />
      {o.validade && <div style={{ textAlign: 'center', fontWeight: 700 }}>Preços garantidos até {validadeTexto(o.validade)}</div>}
      {cfg.formas.trim() && <div style={{ textAlign: 'center' }}>Pagamento: {cfg.formas.trim()}</div>}
      {o.obs.trim() && <div style={{ marginTop: '1.5mm', whiteSpace: 'pre-wrap' }}>{o.obs.trim()}</div>}
      {pix && (
        <div style={{ marginTop: '2.5mm', textAlign: 'center' }}>
          <div style={{ fontWeight: 700 }}>Pague com Pix</div>
          <Qr texto={pix} mm={pequeno ? 30 : 36} />
          <div>Valor já preenchido</div>
        </div>
      )}
      {confirmar && (
        <div style={{ marginTop: '2.5mm', textAlign: 'center' }}>
          <div style={{ fontWeight: 700 }}>Confirme pelo WhatsApp</div>
          <Qr texto={confirmar} mm={pequeno ? 24 : 28} />
        </div>
      )}
      {cfg.mensagem.trim() && <div style={{ textAlign: 'center', fontWeight: 700, marginTop: '2mm' }}>{cfg.mensagem.trim()}</div>}
      <div style={{ textAlign: 'center', marginTop: '2mm', fontSize: '0.85em' }}>Orçamento sem valor fiscal</div>
    </div>
  );
}
