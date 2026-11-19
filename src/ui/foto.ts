/** Foto do produto para o cardápio: quadrada, 120 px, JPEG leve (uns 5 KB). */
export async function fotoProduto(file: File, lado = 120): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((ok, erro) => {
      img.onload = () => ok();
      img.onerror = () => erro(new Error('Este arquivo não parece ser uma imagem.'));
      img.src = url;
    });
    const c = document.createElement('canvas');
    c.width = c.height = lado;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, lado, lado);
    const m = Math.min(img.width, img.height); // recorta o centro
    ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
    return c.toDataURL('image/jpeg', 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}
