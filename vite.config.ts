import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Cardápio público: põe a versão do build nos arquivos, para o celular nunca ficar com a versão antiga guardada. */
function versaoNoCardapio() {
  return {
    name: 'versao-no-cardapio',
    apply: 'build' as const,
    closeBundle() {
      const v = Date.now().toString(36);
      for (const pagina of ['cardapio', 'loja']) {
        const f = resolve(__dirname, `dist/${pagina}/index.html`);
        if (!existsSync(f)) continue;
        writeFileSync(f, readFileSync(f, 'utf8').replace(/"(\.\.?\/[a-z/]*?(?:lib|cardapio|loja)\.(?:js|css))"/g, `"$1?v=${v}"`));
      }
    },
  };
}

// base './' faz o site funcionar em qualquer endereço do GitHub Pages
// (usuario.github.io/repositorio/) sem precisar configurar o nome do repositório.
export default defineConfig({
  base: './',
  plugins: [react(), versaoNoCardapio()],
  build: { chunkSizeWarningLimit: 2000 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
