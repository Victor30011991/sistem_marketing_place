/**
 * Organização sugerida das categorias do catálogo: cria as que faltam, renomeia as antigas
 * e põe tudo na ordem das prateleiras do catálogo. Os produtos não mudam de categoria
 * (só acompanham o novo nome quando a categoria deles é renomeada).
 */
import { norm } from './normalize';

/** Na ordem em que aparecem no catálogo. */
export const CATEGORIAS_SUGERIDAS = [
  'Especiarias em pó',
  'Ervas secas',
  'Temperos prontos',
  'Sais e pimentas',
  'Chás e ervas',
  'Raízes e cascas',
  'Farinhas',
  'Sementes e grãos',
  'Fibras e matinais',
  'Castanhas e amendoim',
  'Frutas secas',
  'Petiscos',
  'Doces',
  'Doces de pote',
  'Mel e própolis',
  'Cacau e chocolates',
  'Açúcares e adoçantes',
  'Pimentas',
  'Geleias',
  'Manteiga de garrafa',
  'Óleos e vinagres',
  'Argilas e cuidados naturais',
  'Suplementos',
  'Outros',
];

/** Nome novo ← nomes antigos que viram ele. */
const RENOMEAR: [string, string[]][] = [
  ['Raízes e cascas', ['Remedio', 'Remédios']],
  ['Fibras e matinais', ['Granolas e cereais', 'Granolas']],
  ['Pimentas', ['Pimenta']],
  ['Geleias', ['Geleia']],
  ['Manteiga de garrafa', ['Manteigas', 'Manteiga']],
  ['Argilas e cuidados naturais', ['Argilas e minerais', 'Argilas']],
];

/** Categorias antigas que ficam até a loja mudar os produtos, logo antes da primeira sugerida. */
const FICAM_ANTES: Record<string, string[]> = {
  'Especiarias em pó': ['Temperos'],
};

export interface PlanoCategorias {
  renomear: [string, string][];
  criar: string[];
  ordem: string[];
  mudou: boolean;
}

export function planoCategorias(atuais: string[]): PlanoCategorias {
  const achar = (lista: string[], nome: string) => lista.find((c) => norm(c) === norm(nome));
  const renomear: [string, string][] = [];
  for (const [para, antigos] of RENOMEAR) {
    if (atuais.includes(para)) continue;
    // "Geléias" → "Geleias": mesma palavra, grafia nova
    const de = atuais.find((c) => [para, ...antigos].some((a) => norm(a) === norm(c)) && !renomear.some(([x]) => x === c));
    if (de) renomear.push([de, para]);
  }
  const nomes = atuais.map((c) => renomear.find(([de]) => de === c)?.[1] ?? c);
  const ordem: string[] = [];
  const por = (n: string) => {
    if (!ordem.some((c) => norm(c) === norm(n))) ordem.push(n);
  };
  const outros = CATEGORIAS_SUGERIDAS[CATEGORIAS_SUGERIDAS.length - 1];
  for (const s of CATEGORIAS_SUGERIDAS) {
    if (s === outros) continue;
    for (const antes of FICAM_ANTES[s] ?? []) {
      const e = achar(nomes, antes);
      if (e) por(e);
    }
    por(achar(nomes, s) ?? s);
  }
  for (const c of nomes) if (norm(c) !== norm(outros)) por(c);
  por(achar(nomes, outros) ?? outros);
  const criar = ordem.filter((c) => !achar(nomes, c));
  const mudou = renomear.length > 0 || criar.length > 0 || ordem.some((c, i) => c !== nomes[i]) || ordem.length !== nomes.length;
  return { renomear, criar, ordem, mudou };
}
