import './pacote.css';
import { useState } from 'react';
import { useApp } from '../state/store';
import { useFeedback } from '../ui/feedback';
import { Button, Field } from '../ui/ui';
import { QrSvg } from './PixQr';
import { ATALHOS, destinoAtalho, dominioValido, limparDominio, linkCurto } from '../core/linksCurtos';
import { normalizarWhatsapp, vitrineDe } from '../core/vitrine';

/** Links curtos com o nome da loja, prontos para copiar e com QR para imprimir. */
export default function LinksCurtos() {
  const { state, act } = useApp();
  const { toast } = useFeedback();
  const v = vitrineDe(state.loja);
  const [texto, setTexto] = useState(v.linkCurto ?? '');
  const [qr, setQr] = useState<string | null>(null);
  const dominio = limparDominio(v.linkCurto ?? '');
  const base = typeof window !== 'undefined' ? window.location.href : '';
  const wa = normalizarWhatsapp(v.whatsapp) || normalizarWhatsapp(state.loja.telefone);
  const erro = texto.trim() && !dominioValido(limparDominio(texto)) ? 'Use só o endereço, ex.: temperei.github.io' : null;

  function salvar() {
    const d = limparDominio(texto);
    if (d && !dominioValido(d)) return;
    act.loja({ vitrine: { ...v, linkCurto: d || undefined } });
    setTexto(d);
    toast(d ? 'Endereço curto salvo.' : 'Endereço curto removido.');
  }
  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copiado.');
    } catch {
      toast('Não deu para copiar. Selecione o link e copie à mão.', 'erro');
    }
  }

  return (
    <div className="lc">
      <h3 className="vit-sub">Links curtos com o nome da loja</h3>
      <div className="lc-campo">
        <Field label="Endereço curto" hint="O site só com os atalhos, ex.: temperei.github.io" erro={erro}>
          {(id) => <input id={id} value={texto} placeholder="temperei.github.io" inputMode="url" autoCapitalize="off" spellCheck={false} onChange={(e) => setTexto(e.target.value)} onBlur={salvar} onKeyDown={(e) => e.key === 'Enter' && salvar()} />}
        </Field>
      </div>
      {dominio ? (
        <ul className="lc-lista">
          {ATALHOS.map((a) => {
            const url = linkCurto(dominio, a);
            const curto = url.replace(/^https:\/\//, '').replace(/\/$/, '');
            const aberto = qr === a.caminho;
            return (
              <li key={a.caminho || 'raiz'}>
                <div className="lc-txt">
                  <strong>{a.rotulo}</strong>
                  <span className="lc-url">{curto}</span>
                  <small className="muted">{a.dica}</small>
                </div>
                <div className="lc-bts">
                  <Button variant="secondary" icon="copy" onClick={() => copiar(url)}>
                    Copiar
                  </Button>
                  <Button variant="ghost" aria-expanded={aberto} onClick={() => setQr(aberto ? null : a.caminho)}>
                    QR
                  </Button>
                </div>
                {aberto && (
                  <div className="lc-qr">
                    <QrSvg texto={url} px={180} rotulo={`QR code de ${curto}`} />
                    <span className="muted small">Leva para: {destinoAtalho(a, base, wa).replace(/^https:\/\//, '')}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted small">Quando o endereço curto estiver no ar, escreva ele acima: aqui aparecem os links prontos para copiar e o QR de cada um.</p>
      )}
    </div>
  );
}
