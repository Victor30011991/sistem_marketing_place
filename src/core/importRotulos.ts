import type { InfoNutricional, Product } from '../types';
import { norm } from './normalize';

/**
 * Importa informações de rótulo (tabela nutricional por 100 g, ingredientes, alérgicos e glúten) de uma planilha CSV
 * com ponto e vírgula, como a que o Excel brasileiro salva. Cabeçalho na 1ª linha; a coluna "Produto" liga ao cadastro.
 */

export interface LinhaRotulo {
  nome: string;
  nutricao: InfoNutricional | null;
  ingredientes: string;
  alergenicos: string;
  gluten: Product['gluten'] | null;
}

/** Divide uma linha CSV respeitando aspas. */
export function camposCsv(linha: string, sep = ';'): string[] {
  const out: string[] = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      out.push(atual);
      atual = '';
    } else atual += c;
  }
  out.push(atual);
  return out.map((s) => s.trim());
}

/** "1.234,5" ou "1234.5" → 1234.5; vazio → null. */
export function numeroBr(t: string): number | null {
  const s = t.replace(/[^\d,.-]/g, '');
  if (!s) return null;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const COLUNAS: Record<string, string[]> = {
  nome: ['produto', 'nome'],
  porcao: ['porcao'],
  kcal: ['valorenergetico', 'kcal', 'energia'],
  carboidratos: ['carboidratos'],
  acucares: ['acucares', 'acucarestotais'],
  proteinas: ['proteinas'],
  gorduras: ['gordurastotais', 'gorduras'],
  saturadas: ['gordurassaturadas', 'saturadas'],
  fibras: ['fibras', 'fibrasalimentares', 'fibra'],
  sodio: ['sodio'],
  ingredientes: ['ingredientes'],
  alergenicos: ['alergicos', 'alergenicos', 'alergenos'],
  gluten: ['gluten'],
};

const chaveCab = (t: string) => norm(t.replace(/\(.*?\)/g, '')).replace(/[^a-z]/g, '');

/** Lê o CSV. Linhas sem valor energético ficam sem tabela (só ingredientes/alérgicos/glúten). */
export function lerRotulosCsv(texto: string): LinhaRotulo[] {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) return [];
  const sep = (linhas[0].match(/;/g)?.length ?? 0) >= (linhas[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const cab = camposCsv(linhas[0], sep).map(chaveCab);
  const idx: Record<string, number> = {};
  for (const [campo, nomes] of Object.entries(COLUNAS)) idx[campo] = cab.findIndex((c) => nomes.includes(c));
  if (idx.nome < 0) return [];
  const out: LinhaRotulo[] = [];
  for (const l of linhas.slice(1)) {
    const c = camposCsv(l, sep);
    const v = (campo: string) => (idx[campo] >= 0 ? (c[idx[campo]] ?? '') : '');
    const nome = v('nome');
    if (!nome) continue;
    const kcal = numeroBr(v('kcal'));
    const porcao = numeroBr(v('porcao'));
    const num = (campo: string) => numeroBr(v(campo)) ?? 0;
    const nutricao: InfoNutricional | null =
      kcal != null && porcao
        ? { porcao, kcal, carboidratos: num('carboidratos'), acucares: num('acucares'), proteinas: num('proteinas'), gorduras: num('gorduras'), saturadas: num('saturadas'), fibras: num('fibras'), sodio: num('sodio') }
        : null;
    const g = norm(v('gluten'));
    const gluten: LinhaRotulo['gluten'] = !g ? null : /nao|sem/.test(g) ? 'nao-contem' : /contem/.test(g) ? 'contem' : null;
    out.push({ nome, nutricao, ingredientes: v('ingredientes'), alergenicos: v('alergenicos'), gluten });
  }
  return out;
}

export interface CasamentoRotulos {
  pares: { produto: Product; linha: LinhaRotulo }[];
  semProduto: LinhaRotulo[];
}

/** Liga cada linha a um produto pelo nome (igual, sem acento/maiúsculas; senão, um nome que contém o outro). */
export function casarRotulos(linhas: LinhaRotulo[], produtos: Product[]): CasamentoRotulos {
  const chave = (t: string) => norm(t).replace(/[^a-z0-9]/g, '');
  const usados = new Set<string>();
  const pares: CasamentoRotulos['pares'] = [];
  const semProduto: LinhaRotulo[] = [];
  for (const linha of linhas) {
    const k = chave(linha.nome);
    const livres = produtos.filter((p) => !usados.has(p.id));
    const p =
      livres.find((x) => chave(x.nome) === k) ??
      (livres.filter((x) => chave(x.nome).includes(k) || k.includes(chave(x.nome))).length === 1
        ? livres.find((x) => chave(x.nome).includes(k) || k.includes(chave(x.nome)))
        : undefined);
    if (p) {
      usados.add(p.id);
      pares.push({ produto: p, linha });
    } else semProduto.push(linha);
  }
  return { pares, semProduto };
}

/** Aplica nos produtos: só preenche o que a planilha traz (campo vazio não apaga o que já existe). */
export function aplicarRotulos(produtos: Product[], pares: CasamentoRotulos['pares']): Product[] {
  const porId = new Map(pares.map((x) => [x.produto.id, x.linha]));
  return produtos.map((p) => {
    const l = porId.get(p.id);
    if (!l) return p;
    const novo = { ...p };
    if (l.nutricao) novo.nutricao = l.nutricao;
    if (l.ingredientes) novo.ingredientes = l.ingredientes;
    if (l.alergenicos) novo.alergenicos = l.alergenicos;
    if (l.gluten) novo.gluten = l.gluten;
    return novo;
  });
}
