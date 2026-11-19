import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aplicarLote, arredondar, calcularLote, itemVazio, loteVazio, precoMultiplicador, REGRA_PADRAO, repartir, sugerirCategoria, sugerirProduto } from '../src/core/lote';
import { lerNFeXml, lerTextoNota, type NotaLida } from '../src/core/nota';
import { criarBackup, lerBackup } from '../src/core/backup';
import { defaultSettings, defaultStore } from '../src/core/defaults';
import type { Lote, LoteItem, Product } from '../src/types';

const xml = readFileSync('tests/fixtures/nfe598.xml', 'utf8');
const texto = readFileSync('tests/fixtures/danfe598.txt', 'utf8');

const ok = (r: ReturnType<typeof lerNFeXml>): NotaLida => {
  if (!r.ok) throw new Error(r.motivo);
  return r;
};

const loteDe = (n: NotaLida, o: Partial<Lote> = {}): Lote => ({ ...loteVazio(), fornecedor: n.fornecedor, numero: n.numero, data: n.data, frete: n.frete, desconto: n.desconto, outras: n.outras, itens: n.itens, ...o });

const prod = (o: Partial<Product> & { id: string; nome: string }): Product => ({
  categoria: 'Temperos', unidade: 'kg', custo: null, custosAdicionais: 0, venda: null, propQtd: 100, propUnidade: 'g', observacoes: '', ...o,
});

describe('repartir', () => {
  it('não perde nem cria centavo', () => {
    for (const [v, p] of [[100, [1, 1, 1]], [550_38, [3, 3, 3, 2, 1, 1, 1]], [-7, [2, 5]], [0, [1, 2]], [1, [1, 1, 1]]] as [number, number[]][]) {
      const r = repartir(v, p);
      expect(r.reduce((a, b) => a + b, 0)).toBe(v);
    }
  });
  it('é proporcional', () => {
    expect(repartir(1000, [1, 3])).toEqual([250, 750]);
    expect(repartir(100, [0, 0])).toEqual([50, 50]);
  });
});

describe('nota XML (NF-e 598 real)', () => {
  const n = ok(lerNFeXml(xml));
  it('lê fornecedor, número, data, frete e itens', () => {
    expect(n.fornecedor).toBe('REIS DISTRIBUIDORA DE GRANEIS LTDA');
    expect(n.numero).toBe('598');
    expect(n.data).toBe('2026-09-30');
    expect(n.frete).toBe(55038);
    expect(n.itens).toHaveLength(50);
    expect(n.itens.reduce((a, i) => a + i.valor, 0)).toBe(224658);
    expect(n.itens.reduce((a, i) => a + i.desconto, 0)).toBe(6740);
    expect(n.desconto).toBe(0); // o desconto da nota já está nos itens: não pode contar duas vezes
    expect(n.itens[0]).toMatchObject({ nome: 'Acafrao em po puro curcuma', ncm: '09103000', unidade: 'kg', qtd: 3, valor: 5370, desconto: 161 });
  });
  it('limpa os nomes da nota ("***oferta", "kg" no fim, tudo maiúsculo)', () => {
    const nomes = n.itens.map((i) => i.nome);
    expect(nomes).toContain('Farinha de uva');
    expect(nomes).toContain('Cha verde bancha');
    expect(nomes).toContain('Lemon pepper');
    expect(nomes.every((x) => !/oferta|\*/i.test(x))).toBe(true);
  });
  it('avisa quando "UN" foi tratado como kg', () => {
    expect(n.avisos.join(' ')).toMatch(/UN/);
  });
  it('recusa arquivo que não é NF-e', () => {
    expect(lerNFeXml('<html></html>').ok).toBe(false);
    expect(lerNFeXml('<infNFe></infNFe>').ok).toBe(false); // sem itens
  });
});

describe('nota copiada do PDF (mesma NF-e 598)', () => {
  const t = ok(lerTextoNota(texto));
  const x = ok(lerNFeXml(xml));
  it('acha os 50 itens, o frete e os dados da nota', () => {
    expect(t.itens).toHaveLength(50);
    expect(t.fornecedor).toBe('REIS DISTRIBUIDORA DE GRANEIS LTDA');
    expect(t.numero).toBe('598');
    expect(t.data).toBe('2026-09-30');
    expect(t.frete).toBe(55038);
    expect(t.desconto).toBe(0);
    expect(t.avisos.filter((a) => /não bate/.test(a))).toHaveLength(0);
  });
  it('lê exatamente os mesmos itens que o XML', () => {
    t.itens.forEach((it, i) => {
      expect(it.nome).toBe(x.itens[i].nome);
      expect([it.ncm, it.unidade, it.qtd, it.valor, it.desconto]).toEqual([x.itens[i].ncm, x.itens[i].unidade, x.itens[i].qtd, x.itens[i].valor, x.itens[i].desconto]);
    });
  });
  it('avisa quando a soma não bate com o total da nota', () => {
    const quebrado = texto.replace(/^6676 HORTELA.*$/m, '');
    const r = lerTextoNota(quebrado);
    expect(r.ok && r.avisos.join(' ')).toMatch(/não bate/);
  });
});

describe('lote: a nota 598 inteira', () => {
  const nota = ok(lerNFeXml(xml));
  const lote = loteDe(nota);

  it('o total do lote é o total da nota (R$ 2.729,56) e o frete pesa 25,3%', () => {
    const c = calcularLote(lote);
    expect(c.totais.total).toBe(272956);
    expect(c.totais.kg).toBe(121);
    expect(c.metodo).toBe('peso');
    expect(c.totais.extrasPct).toBe(25.3);
    expect(c.itens.reduce((a, i) => a + i.total, 0)).toBe(272956);
  });

  it('divide o frete por peso: Açafrão e Argila', () => {
    const c = calcularLote(lote);
    const i = (nome: string) => c.itens[nota.itens.findIndex((x) => x.nome === nome)];
    // (53,70 − 1,61 + 3 kg × R$ 4,5486) ÷ 3
    expect(i('Acafrao em po puro curcuma').custoKg).toBe(2191);
    expect(i('Argila preta').custoKg).toBe(1222); // (15,80 − 0,47 + 2 kg × R$ 4,5486) ÷ 2
  });

  it('divide o frete por valor: itens baratos pagam menos frete', () => {
    const c = calcularLote({ ...lote, rateio: 'valor' });
    const i = (nome: string) => c.itens[nota.itens.findIndex((x) => x.nome === nome)];
    expect(c.metodo).toBe('valor');
    expect(c.totais.total).toBe(272956);
    expect(i('Acafrao em po puro curcuma').custoKg).toBe(2175);
    expect(i('Argila preta').custoKg).toBe(960);
  });

  it('juros e outras despesas entram no custo', () => {
    const c = calcularLote({ ...lote, juros: 10000, outras: 5000 });
    expect(c.totais.total).toBe(272956 + 15000);
    expect(c.itens.reduce((a, i) => a + i.total, 0)).toBe(272956 + 15000);
  });

  it('item que não é de peso faz o rateio cair para o valor e avisa', () => {
    const l = { ...lote, itens: lote.itens.map((i, k) => (k === 0 ? { ...i, unidade: 'pacote' } : i)) };
    const c = calcularLote(l);
    expect(c.metodo).toBe('valor');
    expect(c.avisos.join(' ')).toMatch(/dividido pelo valor/);
    expect(c.totais.kg).toBeNull();
  });
});

describe('aplicar o lote aos produtos', () => {
  const nota = ok(lerNFeXml(xml));
  const produtos: Product[] = [
    prod({ id: 'acafrao', nome: 'Açafrão em Pó Puro', custo: 2617, estoque: 1 }),
    prod({ id: 'argilas', nome: 'Argila Branca / Dourada / Preta / Rosa / Vermelha', custo: 1155, estoque: 0 }),
    prod({ id: 'farinha-linhaca', nome: 'Farinha de Linhaça Marrom', custo: 1682 }),
  ];

  it('sugere o produto certo e não confunde semente com farinha', () => {
    expect(sugerirProduto('Acafrao em po puro curcuma', produtos)).toEqual({ id: 'acafrao', nivel: 'parecido' });
    expect(sugerirProduto('Argila preta', produtos)?.id).toBe('argilas');
    expect(sugerirProduto('Farinha de linhaca marrom', produtos)).toEqual({ id: 'farinha-linhaca', nivel: 'exato' });
    expect(sugerirProduto('Semente de linhaca marrom', produtos)).toBeNull();
    expect(sugerirProduto('Hortela', produtos)).toBeNull();
  });

  it('atualiza custo e estoque; cria produto novo com custo real', () => {
    const itens = nota.itens.slice(0, 1).concat(nota.itens.filter((i) => i.nome === 'Hortela'));
    const l = loteDe({ ...nota, itens, frete: 0 }, { custo: 'ultimo', itens: itens.map((i) => ({ ...i, produtoId: i.nome.startsWith('Acafrao') ? 'acafrao' : null, categoria: i.nome === 'Hortela' ? 'Chás e ervas' : '' })) });
    const r = aplicarLote(l, produtos, ['Temperos']);
    const a = r.produtos.find((p) => p.id === 'acafrao')!;
    expect(a.custo).toBe(1736); // (53,70 − 1,61) ÷ 3 kg
    expect(a.estoque).toBe(4); // 1 + 3
    const h = r.produtos.find((p) => p.nome === 'Hortela')!;
    expect(h).toMatchObject({ unidade: 'kg', estoque: 2, categoria: 'Chás e ervas', venda: 2750 }); // R$ 13,82 × 2 = 27,64 → 27,50
    expect(h.custo).toBe(1382); // (28,50 − 0,86) ÷ 2
    expect(r.categorias).toContain('Chás e ervas');
    expect(r.atualizados).toBe(1);
    expect(r.novos).toBe(1);
    expect(r.linhas[0].variacaoPct).toBe(-33.7);
    // o original não muda
    expect(produtos[0].custo).toBe(2617);
  });

  it('custo médio: mistura o estoque que já existe com a compra nova', () => {
    const it = { ...itemVazio(), nome: 'Açafrão', produtoId: 'acafrao', qtd: 3, valor: 6000, desconto: 0 }; // R$ 20,00/kg
    const l: Lote = { ...loteVazio(), custo: 'medio', itens: [it] };
    const r = aplicarLote(l, produtos, []);
    // estoque 1 kg a R$ 26,17 + 3 kg a R$ 20,00 = R$ 86,17 ÷ 4 kg
    expect(r.produtos.find((p) => p.id === 'acafrao')!.custo).toBe(2154);
  });

  it('vários itens da nota no mesmo produto (as 5 argilas) somam o estoque', () => {
    const itens = nota.itens.filter((i) => i.nome.startsWith('Argila')).map((i) => ({ ...i, produtoId: 'argilas' }));
    const r = aplicarLote(loteDe({ ...nota, itens, frete: 0 }, { itens }), produtos, []);
    expect(itens).toHaveLength(5);
    expect(r.produtos.find((p) => p.id === 'argilas')!.estoque).toBe(10);
    expect(r.atualizados).toBe(1);
  });

  it('ignora item sem quantidade ou com unidade impossível, sem quebrar', () => {
    const l: Lote = { ...loteVazio(), itens: [
      { ...itemVazio(), nome: 'A', produtoId: 'acafrao', qtd: 0, valor: 1000 },
      { ...itemVazio(), nome: 'B', produtoId: 'acafrao', unidade: 'L', qtd: 2, valor: 1000 },
    ] };
    const r = aplicarLote(l, produtos, []);
    expect(r.ignorados).toBe(2);
    expect(r.produtos).toEqual(produtos);
  });
});

describe('categoria pelo NCM', () => {
  it('sugere e reaproveita a categoria que a loja já tem', () => {
    expect(sugerirCategoria('21039029', [])).toBe('Temperos');
    expect(sugerirCategoria('21039029', ['Temperos e especiarias'])).toBe('Temperos e especiarias');
    expect(sugerirCategoria('12119090', ['Chás'])).toBe('Chás');
    expect(sugerirCategoria('25084090', [])).toBe('Argilas e minerais');
    expect(sugerirCategoria('99999999', ['Temperos'])).toBe('');
    // o nome manda antes do NCM: o NCM da farinha de beterraba é de legume seco
    expect(sugerirCategoria('07129090', ['Farinhas', 'Temperos'], 'Farinha de beterraba pura')).toBe('Farinhas');
    expect(sugerirCategoria('07129090', [], 'Cebolinha desidratada')).toBe('Temperos');
    expect(sugerirCategoria('12119090', [], 'Mix de chimarrao')).toBe('Chás e ervas');
  });
});

describe('histórico de lotes no backup', () => {
  it('sobrevive ao backup .txt', () => {
    const cfg = defaultSettings();
    const l = { ...loteDe(ok(lerNFeXml(xml))), aplicadoEm: '2026-11-18T12:00:00.000Z' };
    cfg.lotes = [l];
    const r = lerBackup(criarBackup({ nome: 'L', produtos: [], categorias: [] }, defaultStore(), cfg));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.lotes).toHaveLength(1);
      expect(r.config.lotes![0].itens).toHaveLength(50);
      expect(r.config.lotes![0].frete).toBe(55038);
      expect(r.config.lotes![0].aplicadoEm).toBe('2026-11-18T12:00:00.000Z');
    }
  });
});

describe('achados da vistoria', () => {
  const it2 = (o: Partial<LoteItem>): LoteItem => ({ ...itemVazio(), ...o });

  it('desconto da nota é dividido pelo valor: item barato e pesado não fica negativo nem some', () => {
    const l: Lote = { ...loteVazio(), desconto: 5000, rateio: 'peso', itens: [it2({ nome: 'A', qtd: 10, valor: 10000 }), it2({ nome: 'B', qtd: 10, valor: 500 })] };
    const c = calcularLote(l);
    expect(c.itens.every((i) => i.total > 0)).toBe(true);
    expect(c.itens.reduce((a, i) => a + i.total, 0)).toBe(10500 - 5000);
    const r = aplicarLote(l, [], []);
    expect(r.ignorados).toBe(0);
    expect(r.produtos.reduce((a, p) => a + (p.estoque ?? 0), 0)).toBe(20);
  });

  it('frete por peso, juros e impostos pelo valor', () => {
    const l: Lote = { ...loteVazio(), frete: 1000, juros: 1100, rateio: 'peso', itens: [it2({ nome: 'A', qtd: 1, valor: 10000 }), it2({ nome: 'B', qtd: 1, valor: 1000 })] };
    const c = calcularLote(l);
    expect(c.itens.map((i) => i.extras)).toEqual([500 + 1000, 500 + 100]);
  });

  it('DANFE sem coluna de desconto não lê a base do ICMS como desconto', () => {
    const t = 'CÓDIGO DESCRIÇÃO NCM/SH CST CFOP UN QUANT VALOR UNIT VALOR TOTAL B.CÁLC ICMS VALOR ICMS ALÍQ. ICMS ALÍQ. IPI\n6814 ACAFRAO EM PO 09103000 0/00 6102 KG 3,0000 17,9000 53,70 53,70 9,67 18,00';
    const r = lerTextoNota(t);
    expect(r.ok && r.itens[0]).toMatchObject({ valor: 5370, desconto: 0 });
  });

  it('nota de fornecedor do Simples Nacional (CSOSN 0/102) é lida', () => {
    const r = lerTextoNota('ALÍQ. IPI\n6814 ACAFRAO EM PO 09103000 0/102 5102 KG 3,0000 17,9000 53,70 0,00 0,00 0,00');
    expect(r.ok && r.itens).toHaveLength(1);
  });

  it('IPI e ICMS-ST da nota entram no custo', () => {
    const x = xml.replace('<vOutro>0.00</vOutro>', '<vOutro>0.00</vOutro><vIPI>50.00</vIPI><vST>80.00</vST>');
    const n = ok(lerNFeXml(x));
    expect(n.outras).toBe(13000);
    expect(calcularLote(loteDe(n)).totais.total).toBe(272956 + 13000);
  });

  it('o mesmo produto duas vezes na nota vira um produto só, com estoque somado', () => {
    const l: Lote = { ...loteVazio(), itens: [it2({ nome: 'Farinha de uva', qtd: 2, valor: 4700 }), it2({ nome: 'Farinha de uva', qtd: 1, valor: 2000 })] };
    const r = aplicarLote(l, [], []);
    expect(r.novos).toBe(1);
    expect(r.produtos).toHaveLength(1);
    expect(r.produtos[0]).toMatchObject({ estoque: 3, custo: 2233 }); // (47,00 + 20,00) ÷ 3
  });

  it('item do histórico sem nome mas ligado a produto não some no backup', () => {
    const cfg = defaultSettings();
    cfg.lotes = [{ ...loteVazio(), itens: [it2({ nome: '', produtoId: 'acafrao', qtd: 1, valor: 100 })] }];
    const r = lerBackup(criarBackup({ nome: 'L', produtos: [], categorias: [] }, defaultStore(), cfg));
    expect(r.ok && r.config.lotes![0].itens).toHaveLength(1);
  });
});

describe('regra de preço do lote', () => {
  it('reproduz a tabela do dono: custo × 2 arredondado para R$ 0,50', () => {
    const casos: [number, number][] = [[2617, 5250], [2851, 5700], [5232, 10450], [4153, 8300], [1250, 2500], [2471, 4950]];
    for (const [custo, venda] of casos) expect(precoMultiplicador(custo, 'kg', REGRA_PADRAO)).toBe(venda);
    expect(arredondar(5234, 100)).toBe(5200);
    expect(arredondar(5234, 1)).toBe(5234);
  });

  const base = (): Product[] => [prod({ id: 'a', nome: 'Açafrão', custo: 2000, venda: 9990, estoque: 0 })];
  const it1 = (): LoteItem => ({ ...itemVazio(), nome: 'Açafrão', produtoId: 'a', qtd: 3, valor: 6000 }); // R$ 20,00/kg

  it('multiplicador muda o preço dos produtos da nota', () => {
    const r = aplicarLote({ ...loteVazio(), itens: [it1()] }, base(), []);
    expect(r.produtos[0]).toMatchObject({ custo: 2000, venda: 4000 });
    expect(r.linhas[0]).toMatchObject({ vendaAntes: 9990, vendaDepois: 4000 });
  });
  it('manter não mexe no preço', () => {
    const r = aplicarLote({ ...loteVazio({ ...REGRA_PADRAO, modo: 'manter' }), itens: [it1()] }, base(), []);
    expect(r.produtos[0].venda).toBe(9990);
  });
  it('sugerido usa o preço da margem do sistema, arredondado', () => {
    const r = aplicarLote({ ...loteVazio({ modo: 'sugerido', fator: 2, passo: 50 }), itens: [it1()] }, base(), [], (p) => (p.custo ?? 0) * 1.7 + 3);
    expect(r.produtos[0].venda).toBe(3400); // 3403 → 34,00
  });
  it('produto por grama arredonda o preço do quilo', () => {
    const g = [prod({ id: 'g', nome: 'Pimenta', unidade: 'g', custo: 2, venda: 5 })];
    // R$ 30,00 por 1000 g = 3 centavos/g; × 1,75 = 5,25 centavos/g = R$ 52,50/kg (o arredondamento é no preço do quilo)
    const r = aplicarLote({ ...loteVazio({ modo: 'multiplicador', fator: 1.75, passo: 50 }), custo: 'ultimo', itens: [{ ...itemVazio(), nome: 'Pimenta', produtoId: 'g', unidade: 'g', qtd: 1000, valor: 3000 }] }, g, []);
    expect(Math.round(r.produtos[0].venda! * 1000)).toBe(5250);
  });
  it('a regra fica guardada no lote e volta do backup', () => {
    const cfg = defaultSettings();
    cfg.lotes = [{ ...loteVazio({ modo: 'multiplicador', fator: 2.2, passo: 100 }), itens: [it1()] }];
    const r = lerBackup(criarBackup({ nome: 'L', produtos: [], categorias: [] }, defaultStore(), cfg));
    expect(r.ok && r.config.lotes![0].preco).toEqual({ modo: 'multiplicador', fator: 2.2, passo: 100 });
  });
});
