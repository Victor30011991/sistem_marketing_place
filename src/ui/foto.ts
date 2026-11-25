/** Foto do produto para o catálogo: quadrada, 120 px, JPEG leve (uns 5 KB). */
export async function fotoProduto(file: File, lado = 120, quadrado = true): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((ok, erro) => {
      img.onload = () => ok();
      img.onerror = () => erro(new Error('Este arquivo não parece ser uma imagem.'));
      img.src = url;
    });
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    if (quadrado) {
      c.width = c.height = lado;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, lado, lado);
      const m = Math.min(img.width, img.height); // recorta o centro
      ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
      return c.toDataURL('image/jpeg', 0.72);
    }
    const k = Math.min(1, lado / Math.max(img.width, img.height));
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    // PNG mantém o fundo transparente (bom para ilustrações); foto vira JPEG leve
    return file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
