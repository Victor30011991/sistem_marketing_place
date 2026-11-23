/** Ajustes de cor da foto do Posta Aí (sem depender do navegador, para testar). */
export interface AjusteCor {
  brilho?: number;
  contraste?: number;
  saturacao?: number;
  calor?: number;
}

/** Filtros prontos: combinações dos ajustes da foto. */
export const FILTROS_FOTO: { id: string; nome: string; a: AjusteCor }[] = [
  { id: 'natural', nome: 'Natural', a: { brilho: 0, contraste: 0, saturacao: 0, calor: 0 } },
  { id: 'quente', nome: 'Quente', a: { brilho: 0.03, contraste: 0.1, saturacao: 0.15, calor: 0.35 } },
  { id: 'rustico', nome: 'Rústico', a: { brilho: -0.05, contraste: 0.2, saturacao: -0.2, calor: 0.25 } },
  { id: 'vibrante', nome: 'Vibrante', a: { brilho: 0.02, contraste: 0.15, saturacao: 0.35, calor: 0.05 } },
  { id: 'suave', nome: 'Suave', a: { brilho: 0.08, contraste: -0.15, saturacao: -0.1, calor: 0.1 } },
  { id: 'pb', nome: 'P&B', a: { brilho: 0, contraste: 0.15, saturacao: -1, calor: 0 } },
];

export const temAjuste = (a: AjusteCor) => !!(a.brilho || a.contraste || a.saturacao || a.calor);

/** Aplica brilho, contraste, saturação e temperatura nos pixels (funciona em qualquer navegador). */
export function filtrarPixels(d: Uint8ClampedArray, a: AjusteCor): void {
  const br = (a.brilho ?? 0) * 80;
  const ct = 1 + (a.contraste ?? 0);
  const st = 1 + (a.saturacao ?? 0);
  const cl = (a.calor ?? 0) * 28;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const cinza = 0.299 * r + 0.587 * g + 0.114 * b;
    r = cinza + (r - cinza) * st;
    g = cinza + (g - cinza) * st;
    b = cinza + (b - cinza) * st;
    r = (r - 128) * ct + 128 + br + cl;
    g = (g - 128) * ct + 128 + br + cl * 0.35;
    b = (b - 128) * ct + 128 + br - cl;
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
}

