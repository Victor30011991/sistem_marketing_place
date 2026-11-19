/**
 * Texto de um PDF (nota fiscal / DANFE), lido no próprio navegador com o pdf.js.
 * A biblioteca só é baixada quando alguém escolhe um PDF, então não pesa no resto do sistema.
 * PDF escaneado (foto) não tem texto: aí a função devolve '' e a tela pede o XML.
 */

interface ItemTexto {
  str: string;
  transform: number[];
}

/** Junta os pedaços de texto de uma página em linhas, de cima para baixo e da esquerda para a direita. */
export function montarLinhas(itens: ItemTexto[]): string {
  const linhas: { y: number; partes: { x: number; t: string }[] }[] = [];
  for (const it of itens) {
    const t = it.str;
    if (!t || !t.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    let linha = linhas.find((l) => Math.abs(l.y - y) <= 2);
    if (!linha) {
      linha = { y, partes: [] };
      linhas.push(linha);
    }
    linha.partes.push({ x, t: t.trim() });
  }
  return linhas
    .sort((a, b) => b.y - a.y)
    .map((l) => l.partes.sort((a, b) => a.x - b.x).map((p) => p.t).join(' '))
    .join('\n');
}

export async function textoDoPdf(dados: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(dados), isEvalSupported: false }).promise;
  const paginas: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pagina = await doc.getPage(i);
    const c = await pagina.getTextContent();
    paginas.push(montarLinhas(c.items.flatMap((x) => ('str' in x ? [{ str: x.str, transform: x.transform as number[] }] : []))));
  }
  await doc.destroy();
  return paginas.join('\n');
}
