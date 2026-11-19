import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

/**
 * Imprime um pedaço de tela num papel de largura fixa (bobina térmica, ex.: 80 mm).
 * A altura do papel é a do conteúdo, para não sair papel em branco.
 */
export async function imprimirBobina(conteudo: ReactNode, larguraMm: number, titulo = 'Impressão'): Promise<void> {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${larguraMm}mm;height:10px;border:0`;
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo.replace(/</g, '')}</title></head><body></body></html>`);
  doc.close();
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => doc.head.appendChild(n.cloneNode(true)));
  const st = doc.createElement('style');
  doc.head.appendChild(st);
  const raiz = doc.createElement('div');
  raiz.style.width = `${larguraMm}mm`;
  doc.body.appendChild(raiz);
  const root = createRoot(raiz);
  flushSync(() => root.render(conteudo));
  await Promise.all([...doc.images].map((img) => img.decode().catch(() => undefined)));
  await doc.fonts?.ready;
  const alturaMm = Math.ceil((raiz.getBoundingClientRect().height * 25.4) / 96) + 4;
  st.textContent = `@page{size:${larguraMm}mm ${alturaMm}mm;margin:0}html,body{margin:0;padding:0;background:#fff}`;
  const limpar = () =>
    setTimeout(() => {
      root.unmount();
      frame.remove();
    }, 500);
  frame.contentWindow!.addEventListener('afterprint', limpar);
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
}
