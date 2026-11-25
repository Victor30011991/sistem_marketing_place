import { describe, expect, it } from 'vitest';
import { ATALHOS, destinoAtalho, dominioValido, limparDominio, linkCurto, paginaAtalho } from '../src/core/linksCurtos';

const base = 'https://victor30011991.github.io/sistem_marketing_place/#/vitrine';
const a = (c: string) => ATALHOS.find((x) => x.caminho === c)!;

describe('links curtos', () => {
  it('limpa o endereço digitado', () => {
    expect(limparDominio(' https://Temperei.GitHub.io/insta ')).toBe('temperei.github.io');
    expect(dominioValido('temperei.github.io')).toBe(true);
    expect(dominioValido('temperei')).toBe(false);
    expect(dominioValido('-x.com')).toBe(false);
  });
  it('monta o link curto e o destino de cada atalho', () => {
    expect(linkCurto('temperei.github.io', a('insta'))).toBe('https://temperei.github.io/insta');
    expect(linkCurto('temperei.github.io', a(''))).toBe('https://temperei.github.io/');
    expect(destinoAtalho(a(''), base, '5586995373999')).toBe('https://victor30011991.github.io/sistem_marketing_place/cardapio/#/loja');
    expect(destinoAtalho(a('insta'), base, '')).toBe('https://victor30011991.github.io/sistem_marketing_place/cardapio/?o=instagram#/loja');
    expect(destinoAtalho(a('pedir'), base, '')).toBe('https://victor30011991.github.io/sistem_marketing_place/cardapio/?o=whatsapp');
    expect(destinoAtalho(a('zap'), base, '558695373999')).toBe('https://wa.me/558695373999');
    expect(destinoAtalho(a('zap'), base, '')).toContain('#/loja');
  });
  it('a página do atalho redireciona e escapa o texto', () => {
    const h = paginaAtalho('https://x.io/?a=1&b=2', 'Loja <b>', 'Desc "x"', 'https://x.io/logo.jpg');
    expect(h).toContain('url=https://x.io/?a=1&amp;b=2');
    expect(h).toContain('location.replace("https://x.io/?a=1&b=2")');
    expect(h).toContain('<title>Loja &lt;b&gt;</title>');
    expect(h).toContain('content="Desc &quot;x&quot;"');
  });
});
