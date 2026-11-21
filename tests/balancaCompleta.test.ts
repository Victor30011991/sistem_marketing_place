import { describe, expect, it } from 'vitest';
import { crc32, gerarCargaCompleta, linhaFraciona, linhaInfNutr, linhasInfoExtra, linhaTxInfo, medidaCaseira, montarZip, textoLivre } from '../src/core/balancaCompleta';
import { BALANCA_PADRAO } from '../src/core/balanca';
import type { Product, StoreInfo } from '../src/types';

const prod = (o: Partial<Product> & { id: string; nome: string }): Product => ({
  categoria: 'Temperos', unidade: 'kg', custo: 2000, custosAdicionais: 0, venda: 4250, propQtd: 100, propUnidade: 'g', observacoes: '', ...o,
});
const loja = { nomeFantasia: 'Temperei', razaoSocial: 'Loja Exemplo Ltda', cnpj: '00.000.000/0001-00', endereco: 'Rua das Flores, 10 - Centro', telefone: '(11) 90000-0000' } as StoreInfo;
const nutri = { porcao: 5, kcal: 300, carboidratos: 50, acucares: 2, proteinas: 10, gorduras: 5, saturadas: 1, fibras: 20, sodio: 30000 / 10 };

describe('carga completa da balança (Toledo MGV)', () => {
  it('texto sem acento e em maiúsculas', () => {
    expect(textoLivre('Açúcar, pimenta-do-reino: 1ª')).toBe('ACUCAR, PIMENTA-DO-REINO: 1');
  });
  it('INFNUTRI igual ao exemplo da Wind Mega: 45 + | + 61, valores da porção', () => {
    const l = linhaInfNutr(12, nutri);
    expect(l).toHaveLength(107);
    const [a, b] = l.split('|');
    expect(a).toBe('N000012' + '0'.repeat(38));
    expect(b).toHaveLength(61);
    expect(b.slice(4, 7)).toBe('005'); // porção 5 g
    expect(b.slice(13, 17)).toBe('0015'); // 300 kcal em 100 g → 15 kcal na porção
    expect(b.slice(17, 21)).toBe('0025'); // 50 g de carboidrato → 2,5 g na porção
    expect(b.slice(-14, -11)).toBe('001'); // sódio 3000 mg/100 g → alto em sódio
  });
  it('mesmo tamanho de linha dos exemplos (INFNUTRI)', () => {
    const ex = 'N00167000000000000000000000000000000000000000|1000180001005031000550000002302200580030100062600000000000000';
    expect(linhaInfNutr(1670, nutri)).toHaveLength(ex.length);
    expect(linhaInfNutr(1670, nutri).indexOf('|')).toBe(ex.indexOf('|'));
  });
  it('medida caseira pela porção', () => {
    expect(medidaCaseira(5).texto).toBe('1 colher de chá');
    expect(medidaCaseira(40)).toMatchObject({ qtd: 4, codigo: '00' });
  });
  it('TXINFO: ingredientes, alérgenos, glúten e conservação em linhas de 56', () => {
    const p = prod({ id: 'a', nome: 'Tempero Baiano', ingredientes: 'Sal, cominho, páprica', alergenicos: 'Pode conter amendoim', modoUso: 'Use a gosto' });
    const linhas = linhasInfoExtra(p);
    expect(linhas[0]).toMatch(/^INGREDIENTES: SAL, COMINHO, PAPRICA\. ALERGICOS:/);
    expect(linhas.every((l) => l.length <= 56)).toBe(true);
    expect(linhas.join(' ')).toContain('MODO DE USO: USE A GOSTO');
    expect(linhaTxInfo(7, p.nome, linhas)).toHaveLength(106 + 56 * linhas.length);
    expect(linhasInfoExtra(prod({ id: 'b', nome: 'X' }))).toEqual([]);
  });
  it('FRACIONA com os dados da loja', () => {
    const l = linhaFraciona(1, loja) as string;
    expect(l).toHaveLength(272);
    expect(l.slice(104, 160)).toMatch(/^FRACIONADO E EMBALADO POR: LOJA EXEMPLO LTDA/);
    expect(linhaFraciona(1, { ...loja, razaoSocial: '', nomeFantasia: '' })).toBeNull();
  });
  it('liga os códigos no ITENSMGV e gera só os arquivos que têm conteúdo', () => {
    const ps = [
      prod({ id: 'a', nome: 'Tempero Baiano', plu: 2, nutricao: nutri, ingredientes: 'Sal', gluten: 'nao-contem' }),
      prod({ id: 'b', nome: 'Cominho', plu: 1, especiariaPura: true, nutricao: nutri }),
      prod({ id: 'c', nome: 'Sem código' }),
    ];
    const c = gerarCargaCompleta(ps, BALANCA_PADRAO, loja);
    expect(c.arquivos.map((a) => a.nome)).toEqual(['ITENSMGV.TXT', 'INFNUTRI.TXT', 'TXINFO.TXT', 'CAMPEXT1.TXT', 'FRACIONA.TXT']);
    const ext = c.arquivos[3].texto.replace(/\r\n$/, '');
    expect(ext).toHaveLength(272);
    expect(ext.slice(0, 4)).toBe('0002');
    expect(ext.slice(104).trim()).toBe('NAO CONTEM GLUTEN');
    const [cominho, baiano] = c.arquivos[0].texto.trim().split('\r\n');
    expect(cominho.slice(3, 9)).toBe('000001');
    expect(cominho.slice(68, 74)).toBe('000000'); // sem info extra
    expect(cominho.slice(78, 84)).toBe('000000'); // especiaria pura: sem tabela
    expect(baiano.slice(68, 74)).toBe('000002'); // info extra
    expect(baiano.slice(78, 84)).toBe('000002'); // nutricional
    expect(baiano.slice(122, 126)).toBe('0001'); // fracionador
    expect(baiano.slice(126, 130)).toBe('0002'); // campo extra 1: não contém glúten
    expect(baiano).toHaveLength(150);
    expect(c.fora.map((f) => f.motivo)).toEqual(['sem código da balança']);
    expect(c).toMatchObject({ produtos: 2, comNutricao: 1, comInfo: 1, fracionador: true });
  });
  it('zip válido', () => {
    const z = montarZip([{ nome: 'A.TXT', texto: 'abc' }]);
    expect(Array.from(z.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(crc32(new TextEncoder().encode('abc'))).toBe(0x352441c2);
  });
});
