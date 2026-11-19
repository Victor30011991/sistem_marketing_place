import qrcode from 'qrcode-generator';

/** Matriz do QR code (true = módulo preto). Só texto ASCII (Pix e links já são). */
export function qrMatriz(texto: string, correcao: 'L' | 'M' | 'Q' | 'H' = 'M'): boolean[][] {
  const qr = qrcode(0, correcao);
  qr.addData(texto, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}
