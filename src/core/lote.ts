import Decimal from 'decimal.js';
import type { Lote, LoteItem, Product } from '../types';
import { roundCents } from './money';
import { convertQty, familyOf } from './units';
import { norm, newId } from './normalize';
import { weightedAverageCost } from './pricing';

export interface ItemCalculado {
  id: string;
  /** valor do item já com o desconto dele */
  liquido: number;
  /** parte do frete, juros, extras e desconto da nota que coube a este item (pode ser negativa) */
  extras: number;
  /** o que o item custou de verdade */
  total: number;
  /** peso em kg (null se a unidade não for de massa) */
  kg: number | null;
  /** custo real por kg, em centavos (null se não for de massa) */
  custoKg: number | null;
  /** custo real por unidade da nota (kg, g, un…), em centavos */
  custoUnidade: number | null;
}

export interface TotaisLote {
  produtos: number;
  descontoItens: number;
  liquido: number;
  frete: number;
  juros: number;
  outras: number;
  descontoNota: number;
  /** o que sai do bolso: produtos − descontos + frete + juros + outras */
  total: number;
  kg: number | null;
  /** quanto os custos extras pesam sobre o valor dos produtos, em % */
  extrasPct: number;
}

export interface LoteCalculado {
  itens: ItemCalculado[];
  totais: TotaisLote;
  metodo: 'peso' | 'valor' | 'igual';
  avisos: string[];
}

const D = (n: number | Decimal) => new Decimal(n);

/** Reparte `valor` (centavos) em partes proporcionais aos pesos, sem perder nem criar centavo (maior resto). */
export function repartir(valor: number, pesos: number[]): number[] {
  if (pesos.length === 0) return [];
  const soma = pesos.reduce((a, b) => a + b, 0);
  const w = soma > 0 ? pesos : pesos.map(() => 1);
  const total = soma > 0 ? soma : w.length;
  const sinal = valor < 0 ? -1 : 1;
  const abs = Math.abs(valor);
  const exatos = w.map((x) => D(abs).times(x).div(total));
  const pisos = exatos.map((e) => e.floor().toNumber());
  let sobra = abs - pisos.reduce((a, b) => a + b, 0);
  const ordem = exatos.map((e, i) => ({ i, f: e.minus(e.floor()).toNumber() })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (const o of ordem) {
    if (sobra <= 0) break;
    pisos[o.i] += 1;
    sobra -= 1;
  }
  return pisos.map((p) => p * sinal);
}

export function kgDoItem(i: Pick<LoteItem, 'qtd' | 'unidade'>): number | null {
  if (familyOf(i.unidade) !== 'massa') return null;
  const q = convertQty(i.qtd, i.unidade, 'kg');
  return q == null ? null : q.toNumber();
}

export function calcularLote(l: Lote): LoteCalculado {
  const avisos: string[] = [];
  const liquidos = l.itens.map((i) => Math.max(0, i.valor - i.desconto));
  const kgs = l.itens.map(kgDoItem);
  const todosPesam = l.itens.length > 0 && kgs.every((k) => k != null && k > 0);
  const somaLiq = liquidos.reduce((a, b) => a + b, 0);

  let metodo: LoteCalculado['metodo'];
  let pesos: number[];
  if (l.rateio === 'peso' && todosPesam) {
    metodo = 'peso';
    pesos = kgs as number[];
  } else if (somaLiq > 0) {
    metodo = 'valor';
    pesos = liquidos;
    if (l.rateio === 'peso') avisos.push('Há itens que não são vendidos por peso (kg ou g). O frete foi dividido pelo valor de cada item.');
  } else {
    metodo = 'igual';
    pesos = l.itens.map(() => 1);
  }

  // frete: pelo método escolhido (peso é o que a transportadora cobra).
  // juros, impostos/outras e desconto da nota: sempre pelo valor de cada item (são cobrados sobre o valor).
  const bolo = l.frete + l.juros + l.outras - l.desconto;
  const partesFrete = repartir(l.frete, pesos);
  const partesValor = repartir(l.juros + l.outras - l.desconto, somaLiq > 0 ? liquidos : l.itens.map(() => 1));
  const partes = partesFrete.map((f, i) => f + partesValor[i]);
  const itens: ItemCalculado[] = l.itens.map((it, i) => {
    const total = liquidos[i] + partes[i];
    const kg = kgs[i];
    return {
      id: it.id,
      liquido: liquidos[i],
      extras: partes[i],
      total,
      kg,
      custoKg: kg && kg > 0 ? roundCents(D(total).div(kg)) : null,
      custoUnidade: it.qtd > 0 ? roundCents(D(total).div(it.qtd)) : null,
    };
  });

  const produtos = l.itens.reduce((a, i) => a + i.valor, 0);
  const descontoItens = l.itens.reduce((a, i) => a + Math.min(i.desconto, i.valor), 0);
  const total = somaLiq + bolo;
  const kg = todosPesam ? (kgs as number[]).reduce((a, b) => a + b, 0) : null;
  if (total <= 0 && l.itens.length > 0) avisos.push('O total do lote ficou zerado ou negativo. Confira os valores.');
  if (l.desconto > somaLiq + l.frete + l.juros + l.outras && l.itens.length > 0) avisos.push('O desconto da nota é maior que o valor dos itens.');
  return {
    itens,
    metodo,
    avisos,
    totais: {
      produtos,
      descontoItens,
      liquido: somaLiq,
      frete: l.frete,
      juros: l.juros,
      outras: l.outras,
      descontoNota: l.desconto,
      total,
      kg,
      extrasPct: somaLiq > 0 ? D(bolo).div(somaLiq).times(100).toDecimalPlaces(1).toNumber() : 0,
    },
  };
}

// ---------- casar item da nota com produto do sistema ----------

const IGNORAR = new Set(['de', 'do', 'da', 'dos', 'das', 'em', 'e', 'com', 'a', 'o', 'kg', 'g', 'un', 'tipo']);

function tokens(texto: string): Set<string> {
  return new Set(
    norm(texto)
      .split(/[^a-z0-9]+/)
      .filter((t) => t && !IGNORAR.has(t)),
  );
}

export interface Sugestao {
  id: string;
  nivel: 'exato' | 'parecido';
}

/** Procura o produto do sistema que corresponde ao nome da nota. Só sugere quando tem confiança. */
export function sugerirProduto(nome: string, produtos: Product[]): Sugestao | null {
  const alvo = norm(nome);
  if (!alvo) return null;
  const exato = produtos.find((p) => norm(p.nome) === alvo);
  if (exato) return { id: exato.id, nivel: 'exato' };
  const a = tokens(nome);
  if (a.size === 0) return null;
  let melhor: { id: string; score: number } | null = null;
  for (const p of produtos) {
    const b = tokens(p.nome);
    if (b.size === 0) continue;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    if (inter === 0) continue;
    const dice = (2 * inter) / (a.size + b.size);
    const menor = Math.min(a.size, b.size);
    const contido = inter === menor && menor >= 2; // todas as palavras do nome menor estão no maior
    const score = contido ? Math.max(dice, 0.8) : dice;
    if (score >= 0.75 && (!melhor || score > melhor.score)) melhor = { id: p.id, score };
  }
  return melhor ? { id: melhor.id, nivel: 'parecido' } : null;
}

// ---------- categoria sugerida pelo NCM ----------

const NCM_CATEGORIA: Record<string, string> = {
  '0903': 'Temperos', '0904': 'Temperos', '0906': 'Temperos', '0907': 'Temperos', '0908': 'Temperos', '0909': 'Temperos', '0910': 'Temperos',
  '2103': 'Temperos', '2104': 'Temperos', '0712': 'Temperos',
  '1211': 'Chás e ervas', '0902': 'Chás e ervas',
  '1101': 'Farinhas', '1102': 'Farinhas', '1103': 'Farinhas', '1104': 'Farinhas', '1105': 'Farinhas', '1106': 'Farinhas',
  '1204': 'Sementes e grãos', '1207': 'Sementes e grãos', '1209': 'Sementes e grãos', '0713': 'Sementes e grãos', '1214': 'Sementes e grãos', '1005': 'Sementes e grãos', '1008': 'Sementes e grãos',
  '2008': 'Castanhas e amendoim', '0802': 'Castanhas e amendoim', '1202': 'Castanhas e amendoim',
  '2508': 'Argilas e minerais', '2521': 'Argilas e minerais', '2530': 'Argilas e minerais',
  '1904': 'Granolas e cereais',
};

/** Categoria sugerida a partir do NCM. Se a loja já tem uma categoria parecida, usa o nome dela. Desconhecido = ''. */
/** Palavras do nome que decidem a categoria antes do NCM (o NCM de "farinha de beterraba" é de legume seco). */
const PALAVRA_CATEGORIA: [RegExp, string][] = [
  [/^farinha\b/, 'Farinhas'],
  [/^(cha|chas)\b|\bmix de chimarrao\b/, 'Chás e ervas'],
  [/^(semente|sementes|chia|grao de bico|linhaca)\b/, 'Sementes e grãos'],
  [/^(amendoim|castanha|mix de castanhas)\b/, 'Castanhas e amendoim'],
  [/^(argila|dolomita)\b/, 'Argilas e minerais'],
  [/^(tempero|tempera|pimenta|paprica|caldo|creme de cebola|chimichurri|curry|lemon pepper|orange pepper|acafrao|alho|cebolinha|salsa|coentro|fumaca)\b/, 'Temperos'],
  [/^granola\b/, 'Granolas e cereais'],
];

export function sugerirCategoria(ncm: string, existentes: string[], nome = ''): string {
  const n = norm(nome);
  const porNome = PALAVRA_CATEGORIA.find(([re]) => re.test(n))?.[1];
  const rotulo = porNome ?? NCM_CATEGORIA[ncm.replace(/\D/g, '').slice(0, 4)];
  if (!rotulo) return '';
  const r = norm(rotulo);
  const raiz = r.split(' ')[0].replace(/s$/, '');
  const igual = existentes.find((c) => norm(c) === r);
  if (igual) return igual;
  const parecida = existentes.find((c) => {
    const n = norm(c);
    return n.includes(r) || r.includes(n) || n.split(' ')[0].replace(/s$/, '') === raiz;
  });
  return parecida ?? rotulo;
}

// ---------- aplicar o lote ----------

export interface LinhaPrevia {
  itemId: string;
  nome: string;
  novo: boolean;
  unidade: string;
  qtd: number;
  custoAntes: number | null;
  custoDepois: number | null;
  estoqueAntes: number | null;
  estoqueDepois: number;
  /** variação do custo em %, quando existe custo anterior */
  variacaoPct: number | null;
  problema?: string;
}

export interface ResultadoLote {
  produtos: Product[];
  categorias: string[];
  linhas: LinhaPrevia[];
  atualizados: number;
  novos: number;
  ignorados: number;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Calcula (sem alterar nada) como ficam produtos, custos e estoque depois do lote. */
export function aplicarLote(l: Lote, produtos: Product[], categorias: string[]): ResultadoLote {
  const calc = calcularLote(l);
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const novos: Product[] = [];
  const mudados = new Map<string, Product>();
  const linhas: LinhaPrevia[] = [];
  let cats = [...categorias];
  let ignorados = 0;

  l.itens.forEach((it, i) => {
    const c = calc.itens[i];
    const base = { itemId: it.id, nome: it.nome, qtd: it.qtd };
    if (!(it.qtd > 0) || c.total <= 0) {
      ignorados++;
      linhas.push({ ...base, novo: !it.produtoId, unidade: it.unidade, custoAntes: null, custoDepois: null, estoqueAntes: null, estoqueDepois: 0, variacaoPct: null, problema: 'Sem quantidade ou sem valor.' });
      return;
    }
    const atual = it.produtoId ? mudados.get(it.produtoId) ?? porId.get(it.produtoId) : undefined;
    if (it.produtoId && !atual) {
      ignorados++;
      linhas.push({ ...base, novo: false, unidade: it.unidade, custoAntes: null, custoDepois: null, estoqueAntes: null, estoqueDepois: 0, variacaoPct: null, problema: 'O produto escolhido não existe mais.' });
      return;
    }
    if (atual) {
      const q = convertQty(it.qtd, it.unidade, atual.unidade);
      if (q == null) {
        ignorados++;
        linhas.push({ ...base, novo: false, unidade: atual.unidade, custoAntes: atual.custo, custoDepois: null, estoqueAntes: atual.estoque ?? null, estoqueDepois: atual.estoque ?? 0, variacaoPct: null, problema: `Não dá para converter ${it.unidade} em ${atual.unidade}.` });
        return;
      }
      const qtd = q.toNumber();
      const ultimo = roundCents(D(c.total).div(q));
      const custo = l.custo === 'medio' ? weightedAverageCost(atual.estoque, atual.custo, qtd, c.total) ?? ultimo : ultimo;
      const estoque = r3((atual.estoque ?? 0) + qtd);
      mudados.set(atual.id, { ...atual, custo, estoque });
      linhas.push({
        ...base, novo: false, unidade: atual.unidade, qtd,
        custoAntes: atual.custo, custoDepois: custo, estoqueAntes: atual.estoque ?? null, estoqueDepois: estoque,
        variacaoPct: atual.custo ? D(custo).minus(atual.custo).div(atual.custo).times(100).toDecimalPlaces(1).toNumber() : null,
      });
      return;
    }
    // produto novo
    const massa = familyOf(it.unidade) === 'massa';
    const unidade = massa ? 'kg' : it.unidade;
    const q = massa ? convertQty(it.qtd, it.unidade, 'kg')!.toNumber() : it.qtd;
    const custo = roundCents(D(c.total).div(q));
    // o mesmo produto duas vezes na nota (ex.: um item em oferta): soma no produto já criado neste lote
    const jaCriado = novos.findIndex((x) => norm(x.nome) === norm(it.nome) && x.unidade === unidade);
    if (jaCriado >= 0) {
      const x = novos[jaCriado];
      const estoque = r3((x.estoque ?? 0) + q);
      const custoMedio = roundCents(D(x.custo ?? 0).times(x.estoque ?? 0).plus(c.total).div(estoque));
      novos[jaCriado] = { ...x, estoque, custo: custoMedio };
      linhas.push({ ...base, novo: true, unidade, qtd: q, custoAntes: x.custo, custoDepois: custoMedio, estoqueAntes: x.estoque ?? 0, estoqueDepois: estoque, variacaoPct: null });
      return;
    }
    const categoria = it.categoria.trim();
    if (categoria && !cats.some((x) => norm(x) === norm(categoria))) cats = [...cats, categoria];
    novos.push({
      id: newId(), nome: it.nome.trim(), categoria, unidade, custo, custosAdicionais: 0, venda: null,
      propQtd: unidade === 'kg' ? 100 : null, propUnidade: unidade === 'kg' ? 'g' : null, observacoes: '', estoque: r3(q),
    });
    linhas.push({ ...base, novo: true, unidade, qtd: q, custoAntes: null, custoDepois: custo, estoqueAntes: null, estoqueDepois: r3(q), variacaoPct: null });
  });

  const atualizadosIds = new Set(mudados.keys());
  return {
    produtos: [...produtos.map((p) => mudados.get(p.id) ?? p), ...novos],
    categorias: cats,
    linhas,
    atualizados: atualizadosIds.size,
    novos: novos.length,
    ignorados,
  };
}

export function loteVazio(): Lote {
  return { id: newId(), data: new Date().toISOString().slice(0, 10), fornecedor: '', numero: '', frete: 0, juros: 0, outras: 0, desconto: 0, rateio: 'peso', custo: 'medio', itens: [] };
}

export function itemVazio(): LoteItem {
  return { id: newId(), nome: '', produtoId: null, categoria: '', ncm: '', unidade: 'kg', qtd: 0, valor: 0, desconto: 0 };
}
