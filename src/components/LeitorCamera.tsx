import { useEffect, useRef, useState } from 'react';
import { Modal, Notice } from '../ui/ui';

/** Leitor de código de barras pela câmera: usa o leitor do próprio navegador quando existe; senão, o ZXing (carregado só aqui). */
interface Props {
  open: boolean;
  onClose: () => void;
  onLer: (codigo: string) => void;
}

interface Detector {
  detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

export function LeitorCamera({ open, onClose, onLer }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState('');
  const lido = useRef(false);

  useEffect(() => {
    if (!open) return;
    lido.current = false;
    setErro('');
    let parar = () => {};
    let vivo = true;
    const achou = (codigo: string) => {
      if (lido.current || !codigo) return;
      lido.current = true;
      navigator.vibrate?.(60);
      parar();
      onLer(codigo.trim());
    };
    (async () => {
      const v = video.current;
      if (!v) return;
      const Nativo = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      try {
        if (Nativo) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
          if (!vivo) return stream.getTracks().forEach((t) => t.stop());
          v.srcObject = stream;
          await v.play();
          const det = new Nativo({ formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e'] });
          const timer = window.setInterval(async () => {
            try {
              const r = await det.detect(v);
              if (r[0]) achou(r[0].rawValue);
            } catch {
              /* quadro sem código */
            }
          }, 250);
          parar = () => {
            window.clearInterval(timer);
            stream.getTracks().forEach((t) => t.stop());
          };
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          if (!vivo) return;
          const leitor = new BrowserMultiFormatReader();
          const ctrl = await leitor.decodeFromConstraints({ video: { facingMode: 'environment' }, audio: false }, v, (res) => {
            if (res) achou(res.getText());
          });
          parar = () => ctrl.stop();
          if (!vivo) parar();
        }
      } catch (e) {
        const nome = (e as Error)?.name;
        setErro(
          nome === 'NotAllowedError'
            ? 'O navegador não deixou usar a câmera. Toque no cadeado ao lado do endereço e permita a câmera.'
            : nome === 'NotFoundError'
              ? 'Não achei câmera neste aparelho.'
              : 'Não foi possível abrir a câmera. Use o leitor ou digite o código.',
        );
      }
    })();
    return () => {
      vivo = false;
      parar();
    };
  }, [open, onLer]);

  return (
    <Modal open={open} title="Ler código de barras" onClose={onClose}>
      {erro ? (
        <Notice tone="warn">{erro}</Notice>
      ) : (
        <>
          <div className="leitor-cam">
            <video ref={video} muted playsInline aria-label="Imagem da câmera" />
            <span className="leitor-mira" aria-hidden="true" />
          </div>
          <p className="muted small">Aponte para o código de barras da etiqueta da balança ou da embalagem. Ele é lido sozinho.</p>
        </>
      )}
    </Modal>
  );
}
