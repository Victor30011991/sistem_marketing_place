import { digitoEan13 } from './balanca';

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARIDADE = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** Os 95 módulos (1 = barra preta) de um EAN-13. Recebe 12 ou 13 dígitos (o 13º é conferido/calculado). */
export function modulosEan13(codigo: string): string | null {
  const d = codigo.replace(/\D/g, '');
  if (d.length !== 12 && d.length !== 13) return null;
  const doze = d.slice(0, 12);
  const cheio = doze + digitoEan13(doze);
  if (d.length === 13 && cheio !== d) return null;
  const n = [...cheio].map(Number);
  const par = PARIDADE[n[0]];
  let s = '101';
  for (let i = 1; i <= 6; i++) s += (par[i - 1] === 'L' ? L : G)[n[i]];
  s += '01010';
  for (let i = 7; i <= 12; i++) s += R[n[i]];
  return s + '101';
}

/** Completa o dígito verificador. */
export const ean13 = (doze: string) => doze + digitoEan13(doze);
