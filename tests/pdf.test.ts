import { describe, expect, it } from 'vitest';
import { montarLinhas } from '../src/import/pdfTexto';
import { lerTextoNota, totaisEmTabela } from '../src/core/nota';

// Layout do texto que o pdf.js tira de um DANFE: rótulos numa linha, valores na linha de baixo,
// e o cabeçalho dos itens quebrado em duas linhas ("VALOR VALOR VALOR …" / "UNIT TOTAL DESC …").
const DANFE_PDF = `RECEBEMOS DE REIS DISTRIBUIDORA DE GRANEIS LTDA OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL
EMISSÃO: 30/09/2026 VALOR TOTAL: R$ 2.729,56
Nº. 000.000.598
BASE DE CÁLC. DO ICMS VALOR DO ICMS BASE DE CÁLC. ICMS S.T. VALOR DO ICMS SUBST. V. IMP. IMPORTAÇÃO VALOR DO PIS V. TOTAL PRODUTOS
2.688,49 146,56 0,00 0,00 0,00 44,36 103,60
VALOR DO FRETE VALOR DO SEGURO DESCONTO OUTRAS DESPESAS VALOR TOTAL IPI VALOR DA COFINS V. TOTAL DA NOTA
550,38 0,00 3,10 0,00 0,00 194,49 650,88
NOME / RAZÃO SOCIAL FRETE CÓDIGO ANTT PLACA DO VEÍCULO UF CNPJ / CPF
VALOR VALOR VALOR B.CÁLC VALOR VALOR ALÍQ. ALÍQ.
CÓDIGO PRODUTO DESCRIÇÃO DO PRODUTO / SERVIÇO NCM/SH O/CST CFOP UN QUANT
UNIT TOTAL DESC ICMS ICMS IPI ICMS IPI
6814 / 6874 ACAFRAO EM PO PURO CURCUMA 09103000 2/00 6102 KG 3,0000 17,9000 53,70 1,61 65,25 2,61 4,00
11202 CHIA PREMIUM 12079990 0/00 6102 KG 2,0000 24,9500 49,90 1,49 78,36 5,49 7,00`;

describe('nota lida de PDF', () => {
  it('casa os rótulos do quadro de totais com os valores da linha de baixo', () => {
    const t = totaisEmTabela(DANFE_PDF);
    expect(t).toMatchObject({ frete: 550.38, seguro: 0, desconto: 3.1, outras: 0, ipi: 0, totalProdutos: 103.6, icms: 146.56, icmsSt: 0, totalNota: 650.88 });
  });
  it('lê itens, frete e desconto mesmo com o cabeçalho quebrado em duas linhas', () => {
    const r = lerTextoNota(DANFE_PDF);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.itens.map((i) => [i.nome, i.qtd, i.valor, i.desconto])).toEqual([
      ['Acafrao em po puro curcuma', 3, 5370, 161],
      ['Chia premium', 2, 4990, 149],
    ]);
    expect(r.frete).toBe(55038);
    expect(r.desconto).toBe(0); // os 3,10 de desconto já estão nos itens
    expect(r.avisos.filter((a) => /não bate/.test(a))).toHaveLength(0);
  });
  it('monta as linhas do PDF de cima para baixo e da esquerda para a direita', () => {
    const it = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] });
    expect(montarLinhas([it('mundo', 60, 700), it('Olá', 10, 701), it('linha 2', 10, 680), it(' ', 5, 690)])).toBe('Olá mundo\nlinha 2');
  });
});
