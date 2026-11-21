import ExcelJS from 'exceljs';
import type { LinhaLista } from '../core/balanca';

/** Planilha para o software da balança: Código (0001…), Descrição, Preço/un, Tara, Validade, Tipo venda. */
export async function planilhaBalanca(linhas: LinhaLista[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Produtos balança');
  ws.columns = [
    { header: 'Código', key: 'codigo', width: 9 },
    { header: 'Descrição', key: 'descricao', width: 42 },
    { header: 'Preço/un', key: 'preco', width: 12 },
    { header: 'Tara(kg)', key: 'tara', width: 10 },
    { header: 'Validade', key: 'validade', width: 10 },
    { header: 'Tipo venda', key: 'tipo', width: 12 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const l of linhas) ws.addRow({ codigo: l.codigo, descricao: l.descricao, preco: l.preco / 100, tara: 0, validade: 0, tipo: l.tipo });
  ws.getColumn('codigo').numFmt = '@';
  ws.getColumn('preco').numFmt = '#,##0.00';
  ws.getColumn('tara').numFmt = '0.000';
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** A mesma lista em texto (CSV com ponto e vírgula, como o Excel brasileiro abre). */
export function csvBalanca(linhas: LinhaLista[]): string {
  const q = (t: string) => (/[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t);
  const corpo = linhas.map((l) => [l.codigo, q(l.descricao), (l.preco / 100).toFixed(2).replace('.', ','), '0,000', '0', l.tipo].join(';'));
  return ['Código;Descrição;Preço/un;Tara(kg);Validade;Tipo venda', ...corpo].join('\r\n') + '\r\n';
}
