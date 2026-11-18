import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { StoreInfo } from '../types';

export interface CotacaoPdfData {
  fornecedor: string;
  telefone: string;
  obs: string;
  linhas: { nome: string; qtd: string }[];
}

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const mix = (hex: string, w: string, a: number) => {
  const x = rgb(hex);
  const y = rgb(w);
  return [0, 1, 2].map((i) => Math.round(x[i] * (1 - a) + y[i] * a)) as [number, number, number];
};
const lum = ([r, g, b]: [number, number, number]) => {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** Pedido de cotação para o fornecedor: produtos e quantidades, com colunas em branco para ele preencher. Sem nenhum custo da loja. */
export async function buildCotacaoPdf(d: CotacaoPdfData, loja: StoreInfo, logoDataUrl: string | null): Promise<ArrayBuffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const primary = rgb(loja.cores.primaria);
  const dark = mix(loja.cores.primaria, '#000000', 0.35);
  const ink: [number, number, number] = [43, 29, 23];
  const muted: [number, number, number] = [107, 91, 80];
  const onPrimary: [number, number, number] = lum(primary) > 0.45 ? [31, 20, 15] : [255, 255, 255];

  const BAND = 34;
  doc.setFillColor(...rgb(loja.cores.fundo));
  doc.rect(0, 0, W, BAND, 'F');
  doc.setFillColor(...primary);
  doc.rect(0, BAND, W, 1.2, 'F');
  let textX = M;
  if (logoDataUrl) {
    try {
      const pr = doc.getImageProperties(logoDataUrl);
      const w = Math.min((pr.width / pr.height) * 26, 44);
      doc.addImage(logoDataUrl, pr.fileType, M, 4, w, w / (pr.width / pr.height));
      textX = M + w + 6;
    } catch {
      textX = M;
    }
  }
  let y = 13;
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...dark);
  if (loja.nomeFantasia) doc.text(loja.nomeFantasia, textX, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  [loja.endereco, loja.telefone, loja.cnpj ? `CNPJ ${loja.cnpj}` : ''].filter(Boolean).forEach((l) => {
    doc.text(doc.splitTextToSize(l, W - M - textX)[0], textX, y);
    y += 4.2;
  });

  y = BAND + 13;
  doc.setFont('times', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...primary);
  doc.text('Pedido de cotação', M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W - M, y, { align: 'right' });
  y += 7;
  doc.setFontSize(10);
  const info: [string, string][] = [];
  if (d.fornecedor) info.push(['Fornecedor', d.fornecedor]);
  if (d.telefone) info.push(['Telefone', d.telefone]);
  info.forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ink);
    doc.text(`${k}:`, M, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v, M + 26, y);
    y += 5.5;
  });
  doc.setTextColor(...muted);
  doc.text(doc.splitTextToSize('Por favor, informe o preço de cada item, o prazo de entrega e o valor do frete.', W - 2 * M), M, y + 1);
  y += 7;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: 18, bottom: 22 },
    theme: 'plain',
    head: [['Produto', 'Quantidade', 'Preço unitário', 'Total']],
    body: d.linhas.map((l) => [l.nome, l.qtd, '', '']),
    styles: { font: 'helvetica', fontSize: 10, textColor: ink, cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 }, lineColor: [210, 198, 178], lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: primary, textColor: onPrimary, fontStyle: 'bold', fontSize: 9.5 },
    columnStyles: { 1: { halign: 'right', cellWidth: 30 }, 2: { cellWidth: 34 }, 3: { cellWidth: 30 } },
    showHead: 'everyPage',
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 1) data.cell.styles.halign = 'right';
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fy: number = (doc as any).lastAutoTable.finalY + 10;
  const linhasObs = d.obs ? (doc.splitTextToSize(d.obs, W - 2 * M) as string[]) : [];
  if (fy + 30 + linhasObs.length * 5 > H - 22) {
    doc.addPage();
    fy = 22;
  }
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.text('Frete:', M, fy);
  doc.text('Prazo de entrega:', M + 70, fy);
  doc.setDrawColor(190, 178, 160);
  doc.line(M + 13, fy + 1, M + 64, fy + 1);
  doc.line(M + 103, fy + 1, W - M, fy + 1);
  fy += 10;
  if (linhasObs.length) {
    doc.text('Observações', M, fy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...muted);
    doc.text(linhasObs, M, fy + 5);
  }
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 210, 192);
    doc.line(M, H - 13, W - M, H - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text('Pedido de cotação — não é pedido de compra.', M, H - 8);
    if (n > 1) doc.text(`Página ${i} de ${n}`, W - M, H - 8, { align: 'right' });
  }
  return doc.output('arraybuffer');
}
