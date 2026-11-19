import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { criarBackup, lerBackup } from '../src/core/backup';
import { defaultSettings, defaultStore } from '../src/core/defaults';
import { counterBasis, valueForQuantity } from '../src/core/units';
import {
  VITRINE_PADRAO,
  linkCardapio,
  montarCardapio,
  normalizarFacebook,
  normalizarInstagram,
  normalizarWhatsapp,
  vitrineDe,
  botoesPadrao,
  linkBotao,
  novoBotao,
} from '../src/core/vitrine';
import type { ListState, Product } from '../src/types';

interface Lib {
  brl(c: number): string;
  fmtGramas(g: number): string;
  precoItem(g: number, pk: number): number;
  parseGramas(t: string): number | null;
  montarMensagem(d: Record<string, unknown>): string;
  urlWhatsapp(n: string, t: string): string;
}
const m = { exports: {} as unknown };
new Function('module', readFileSync('public/cardapio/lib.js', 'utf8'))(m);
const L = m.exports as Lib;

const prod = (o: Partial<Product> & { id: string; nome: string }): Product => ({
  categoria: 'Temperos', unidade: 'kg', custo: 1790, custosAdicionais: 123, venda: 5250, propQtd: 100, propUnidade: 'g', observacoes: 'segredo do custo', ...o,
});
const lista = (): ListState => ({
  nome: 'L',
  categorias: ['Temperos', 'Chás'],
  produtos: [
    prod({ id: 'a', nome: 'Açafrão' }),
    prod({ id: 'b', nome: 'Chá Verde', categoria: 'Chás', venda: 4950 }),
    prod({ id: 'c', nome: 'Pimenta em g', unidade: 'g', venda: 8 }), // R$ 0,08 por g = R$ 80/kg
    prod({ id: 'd', nome: 'Sem preço', venda: null }),
    prod({ id: 'e', nome: 'Suco', unidade: 'L', venda: 1000 }),
    prod({ id: 'f', nome: 'Pacote 250 g', unidade: 'pacote', venda: 1000, conteudoQtd: 250, conteudoUnidade: 'g' }),
    prod({ id: 'g', nome: 'Sem categoria', categoria: '', venda: 3000 }),
  ],
});

describe('vitrine: configuração', () => {
  it('lê qualquer loja sem quebrar e aplica os padrões', () => {
    expect(vitrineDe(undefined)).toEqual(VITRINE_PADRAO);
    expect(vitrineDe({ vitrine: { minGramas: -5, ocultos: [1, 'x'], whatsapp: 3 } as never }).minGramas).toBe(50);
    expect(vitrineDe({ vitrine: { ocultos: [1, 'x'] } as never }).ocultos).toEqual(['x']);
    expect(vitrineDe({ vitrine: { abertura: '' } as never }).abertura).toBe(VITRINE_PADRAO.abertura);
  });

  it('normaliza WhatsApp, Instagram e Facebook', () => {
    expect(normalizarWhatsapp('(86) 99999-1234')).toBe('5586999991234');
    expect(normalizarWhatsapp('+55 86 99999-1234')).toBe('5586999991234');
    expect(normalizarWhatsapp('123')).toBe('');
    expect(normalizarInstagram('@temperei')).toBe('https://instagram.com/temperei');
    expect(normalizarInstagram('https://www.instagram.com/temperei/?hl=pt')).toBe('https://www.instagram.com/temperei/?hl=pt');
    expect(normalizarInstagram('instagram.com/temperei')).toBe('https://instagram.com/temperei');
    expect(normalizarInstagram('https://site-malicioso.com/x')).toBe('');
    expect(normalizarInstagram('javascript:alert(1)')).toBe('');
    expect(normalizarFacebook('temperei')).toBe('https://facebook.com/temperei');
    expect(normalizarFacebook('https://facebook.com/temperei')).toBe('https://facebook.com/temperei');
    expect(normalizarFacebook('https://outro.com/temperei')).toBe('');
    // endereço copiado sem o https:// (perfil do Facebook com ?id= e link do Instagram com ?igsh=)
    expect(normalizarFacebook('facebook.com/profile.php?id=61550000000000')).toBe('https://facebook.com/profile.php?id=61550000000000');
    expect(normalizarFacebook('www.facebook.com/temperei')).toBe('https://www.facebook.com/temperei');
    expect(normalizarInstagram('www.instagram.com/temperei_/?igsh=abc')).toBe('https://www.instagram.com/temperei_/?igsh=abc');
  });

  it('monta o link do cardápio a partir do endereço do sistema', () => {
    expect(linkCardapio('https://victor30011991.github.io/temperei_sistem/#/pagina')).toBe('https://victor30011991.github.io/temperei_sistem/cardapio/');
    expect(linkCardapio('https://victor30011991.github.io/temperei_sistem/index.html#/x', 'instagram')).toBe('https://victor30011991.github.io/temperei_sistem/cardapio/?o=instagram');
  });
});

describe('vitrine: arquivo publicado', () => {
  it('leva só nome, categoria e preço — nunca custos, margens ou observações', () => {
    const loja = { ...defaultStore(), vitrine: { ...VITRINE_PADRAO, whatsapp: '86999991234' } };
    const r = montarCardapio(lista(), loja, null);
    const json = JSON.stringify(r.arquivo);
    expect(json).not.toContain('segredo do custo');
    expect(json).not.toMatch(/custo|margem|estoque|observ/i);
    expect(r.arquivo.loja.whatsapp).toBe('5586999991234');
  });

  it('agrupa por categoria, calcula o preço por quilo e explica o que ficou de fora', () => {
    const loja = { ...defaultStore(), vitrine: { ...VITRINE_PADRAO, ocultos: ['b'] } };
    const r = montarCardapio(lista(), loja, null);
    const cats = r.arquivo.categorias;
    expect(cats.map((c) => c.nome)).toEqual(['Temperos', 'Outros']);
    const temperos = Object.fromEntries(cats[0].itens.map((i) => [i.n, i.pk]));
    expect(temperos['Açafrão']).toBe(5250); // kg
    expect(temperos['Pimenta em g']).toBe(8000); // R$ 0,08/g = R$ 80/kg
    expect(temperos['Pacote 250 g']).toBe(4000); // R$ 10 por 250 g = R$ 40/kg
    expect(cats[1].itens).toEqual([{ n: 'Sem categoria', pk: 3000 }]);
    const motivos = Object.fromEntries(r.fora.map((f) => [f.produto.id, f.motivo]));
    expect(motivos).toEqual({ b: 'oculto', d: 'sem-preco', e: 'nao-peso' });
    expect(r.total).toBe(4);
  });

  it('usa o telefone da loja e a frase da loja quando a vitrine não define', () => {
    const loja = { ...defaultStore(), telefone: '(86) 98888-7777', informacoes: 'Produtos Naturais' };
    const a = montarCardapio(lista(), loja, null).arquivo.loja;
    expect(a.whatsapp).toBe('5586988887777');
    expect(a.slogan).toBe('Produtos Naturais');
    expect(a.min).toBe(50);
  });

  it('a página calcula o mesmo valor que o sistema (orçamento) para qualquer quantidade', () => {
    const p = lista().produtos[0];
    const pk = montarCardapio(lista(), defaultStore(), null).arquivo.categorias[0].itens[0].pk;
    const b = counterBasis(p)!;
    for (const g of [50, 100, 137, 250, 333, 500, 750, 1000, 1250, 2500, 9999]) {
      expect(L.precoItem(g, pk)).toBe(valueForQuantity(g, b));
    }
  });
});

describe('vitrine: backup', () => {
  it('a configuração do cardápio sobrevive ao backup .txt', () => {
    const loja = { ...defaultStore(), vitrine: { ...VITRINE_PADRAO, instagram: '@temperei', minGramas: 100, ocultos: ['a'], abertura: 'Oi {loja}!' } };
    const txt = criarBackup(lista(), loja, defaultSettings());
    const r = lerBackup(txt);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.loja.vitrine).toEqual(loja.vitrine);
  });

  it('backup antigo, sem vitrine, continua abrindo', () => {
    const txt = criarBackup(lista(), defaultStore(), defaultSettings());
    const r = lerBackup(txt);
    expect(r.ok && r.loja.vitrine).toBeUndefined();
  });
});

describe('página do cliente: lib.js', () => {
  it('entende o que o cliente digita', () => {
    expect(L.parseGramas('250')).toBe(250);
    expect(L.parseGramas('250 g')).toBe(250);
    expect(L.parseGramas('1,5 kg')).toBe(1500);
    expect(L.parseGramas('1kg')).toBe(1000);
    expect(L.parseGramas('0')).toBeNull();
    expect(L.parseGramas('')).toBeNull();
    expect(L.parseGramas('muito')).toBeNull();
    expect(L.parseGramas('-5')).toBeNull();
  });

  it('formata valor e gramas', () => {
    expect(L.brl(5250)).toBe('R$ 52,50');
    expect(L.brl(123456)).toBe('R$ 1.234,56');
    expect(L.fmtGramas(250)).toBe('250 g');
    expect(L.fmtGramas(1500)).toBe('1,5 kg');
    expect(L.precoItem(150, 5250)).toBe(788); // 787,5 sobe, igual ao sistema
  });

  it('monta a mensagem com a nota em bloco de código', () => {
    const txt = L.montarMensagem({
      loja: 'Temperei',
      abertura: 'Olá, {loja}! Pedido:',
      fechamento: 'Obrigado!',
      itens: [
        { n: 'Açafrão em Pó Puro', g: 100, total: 525 },
        { n: 'Chia Premium', g: 300, total: 1890 },
      ],
      nome: 'Samara',
      endereco: 'Quadra M2, casa 07',
      obs: '',
      origem: 'instagram',
    });
    expect(txt.startsWith('Olá, Temperei! Pedido:')).toBe(true);
    expect(txt).toContain('```\nAçafrão em Pó Puro');
    expect(txt).toContain('Subtotal');
    expect(txt).toContain('R$ 24,15');
    expect(txt).toContain('a combinar');
    expect(txt).toContain('*Nome:* Samara');
    expect(txt).toContain('*Endereço:* Quadra M2, casa 07');
    expect(txt).toContain('*Cheguei pelo:* Instagram');
    expect(txt).not.toContain('Observações');
    expect(txt.trim().endsWith('Obrigado!')).toBe(true);
    for (const l of txt.split('```')[1].split('\n')) expect(l.length).toBeLessThanOrEqual(30);
  });

  it('origem desconhecida é ignorada e o link do WhatsApp é seguro', () => {
    const txt = L.montarMensagem({ loja: 'X', abertura: 'a', fechamento: '', itens: [{ n: 'A', g: 100, total: 100 }], nome: 'N', endereco: 'E', obs: 'sem sal', origem: '<script>' });
    expect(txt).not.toContain('Cheguei');
    expect(txt).toContain('*Observações:* sem sal');
    const url = L.urlWhatsapp('+55 (86) 99999-1234', 'olá & tudo\nbem');
    expect(url).toBe('https://wa.me/5586999991234?text=ol%C3%A1%20%26%20tudo%0Abem');
  });
});

describe('botões do cartão (link na bio)', () => {
  const v = { ...VITRINE_PADRAO, whatsapp: '(86) 99999-1234', instagram: '@temperei' };
  const loja = { telefone: '', nomeFantasia: 'Temperei' };
  const b = (tipo: Parameters<typeof novoBotao>[0], valor = '') => ({ ...novoBotao(tipo), valor });

  it('monta o link certo para cada tipo', () => {
    expect(linkBotao(b('cardapio'), v, loja)).toBe('#cardapio');
    expect(linkBotao(b('whatsapp'), v, loja)).toMatch(/^https:\/\/wa\.me\/5586999991234\?text=/);
    expect(linkBotao(b('whatsapp', '86 98888-7777'), v, loja)).toMatch(/^https:\/\/wa\.me\/5586988887777/);
    expect(linkBotao(b('instagram'), v, loja)).toBe('https://instagram.com/temperei');
    expect(linkBotao(b('facebook'), v, loja)).toBe(''); // sem Facebook: o botão não aparece
    expect(linkBotao(b('maps', 'Rua Santa Rita, 579, Parnaíba'), v, loja)).toBe('https://www.google.com/maps/search/?api=1&query=Rua%20Santa%20Rita%2C%20579%2C%20Parna%C3%ADba');
    expect(linkBotao(b('maps', 'https://maps.app.goo.gl/abc123'), v, loja)).toBe('https://maps.app.goo.gl/abc123');
    expect(linkBotao(b('ifood', 'www.ifood.com.br/delivery/parnaiba-pi/temperei'), v, loja)).toBe('https://www.ifood.com.br/delivery/parnaiba-pi/temperei');
    expect(linkBotao(b('ifood', 'https://outro.com/x'), v, loja)).toBe('');
    expect(linkBotao(b('site', 'linktr.ee/temperei'), v, loja)).toBe('https://linktr.ee/temperei');
    expect(linkBotao(b('telefone', '(86) 3322-1100'), v, loja)).toBe('tel:+558633221100');
  });

  it('recusa links perigosos', () => {
    for (const ruim of ['javascript:alert(1)', 'data:text/html,oi', 'vbscript:x', 'ftp://x.com']) {
      expect(linkBotao(b('site', ruim), v, loja)).toBe('');
      expect(linkBotao(b('maps', ruim), v, loja)).toBe('');
    }
  });

  it('o arquivo do cardápio leva os botões ativos, na ordem, com o texto escolhido', () => {
    const botoes = [b('whatsapp'), { ...b('cardapio'), rotulo: 'Fazer pedido' }, { ...b('site', 'temperei.com.br'), ativo: false }, b('facebook'), b('maps', 'Parnaíba')];
    const r = montarCardapio({ nome: 'L', categorias: [], produtos: [] }, { ...defaultStore(), vitrine: { ...v, botoes } }, null);
    expect(r.arquivo.loja.botoes.map((x) => [x.t, x.r])).toEqual([['whatsapp', 'WhatsApp'], ['cardapio', 'Fazer pedido'], ['maps', 'Como chegar']]);
  });

  it('sem botões escolhidos usa o padrão (Cardápio, Instagram, Facebook, WhatsApp) e sobrevive ao backup', () => {
    expect(botoesPadrao().map((x) => x.tipo)).toEqual(['cardapio', 'instagram', 'facebook', 'whatsapp']);
    const loja2 = { ...defaultStore(), vitrine: { ...v, botoes: [{ ...b('maps', 'Parnaíba'), rotulo: 'Onde estamos' }] } };
    const r = lerBackup(criarBackup({ nome: 'L', produtos: [], categorias: [] }, loja2, defaultSettings()));
    expect(r.ok && r.loja.vitrine?.botoes).toEqual(loja2.vitrine.botoes);
  });
});
