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
  pedidoNuvem(d: Record<string, unknown>): unknown;
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

  it('monta o link do catálogo a partir do endereço do sistema', () => {
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
    // pacote, frasco, litro: vendidos inteiros, com o preço de cada
    const unid = Object.fromEntries(cats[0].itens.filter((i) => i.pu).map((i) => [i.n, [i.pu, i.ud, i.pk]]));
    expect(unid).toEqual({ 'Pacote 250 g': [1000, 'pacote 250 g', undefined], Suco: [1000, 'litro', undefined] });
    expect(cats[1].itens.map(({ n, pk }) => ({ n, pk }))).toEqual([{ n: 'Sem categoria', pk: 3000 }]);
    const motivos = Object.fromEntries(r.fora.map((f) => [f.produto.id, f.motivo]));
    expect(motivos).toEqual({ b: 'oculto', d: 'sem-preco' });
    expect(r.total).toBe(5);
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
    const pk = montarCardapio(lista(), defaultStore(), null).arquivo.categorias[0].itens[0].pk!;
    const b = counterBasis(p)!;
    for (const g of [50, 100, 137, 250, 333, 500, 750, 1000, 1250, 2500, 9999]) {
      expect(L.precoItem(g, pk)).toBe(valueForQuantity(g, b));
    }
  });
});

describe('vitrine: backup', () => {
  it('a configuração do catálogo sobrevive ao backup .txt', () => {
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

  it('monta a mensagem do pedido com um item por linha', () => {
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
    expect(txt).toContain('🛒 *Pedido · 2 itens*');
    expect(txt).toContain('▪️ Açafrão em Pó Puro · 100 g · *R$ 5,25*');
    expect(txt).toContain('Subtotal: R$ 24,15');
    expect(txt).toContain('Entrega: a combinar');
    expect(txt).toContain('*Total: R$ 24,15 + entrega*');
    expect(txt).toContain('👤 *Samara*');
    expect(txt).toContain('📍 Quadra M2, casa 07');
    expect(txt).toContain('Cheguei pelo Instagram');
    expect(txt).not.toContain('📝');
    expect(txt).not.toContain('```');
    expect(txt.trim().endsWith('Obrigado!')).toBe(true);
  });

  it('origem desconhecida é ignorada e o link do WhatsApp é seguro', () => {
    const txt = L.montarMensagem({ loja: 'X', abertura: 'a', fechamento: '', itens: [{ n: 'A', g: 100, total: 100 }], nome: 'N', endereco: 'E', obs: 'sem sal', origem: '<script>' });
    expect(txt).not.toContain('Cheguei');
    expect(txt).toContain('📝 sem sal');
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

  it('o arquivo do catálogo leva os botões ativos, na ordem, com o texto escolhido', () => {
    const botoes = [b('whatsapp'), { ...b('cardapio'), rotulo: 'Fazer pedido' }, { ...b('site', 'temperei.com.br'), ativo: false }, b('facebook'), b('maps', 'Parnaíba')];
    const r = montarCardapio({ nome: 'L', categorias: [], produtos: [] }, { ...defaultStore(), vitrine: { ...v, botoes } }, null);
    expect(r.arquivo.loja.botoes.map((x) => [x.t, x.r])).toEqual([['whatsapp', 'WhatsApp'], ['cardapio', 'Fazer pedido'], ['maps', 'Como chegar']]);
  });

  it('sem botões escolhidos usa o padrão (Catálogo, Instagram, Facebook, WhatsApp) e sobrevive ao backup', () => {
    expect(botoesPadrao().map((x) => x.tipo)).toEqual(['cardapio', 'instagram', 'facebook', 'whatsapp']);
    const loja2 = { ...defaultStore(), vitrine: { ...v, botoes: [{ ...b('maps', 'Parnaíba'), rotulo: 'Onde estamos' }] } };
    const r = lerBackup(criarBackup({ nome: 'L', produtos: [], categorias: [] }, loja2, defaultSettings()));
    expect(r.ok && r.loja.vitrine?.botoes).toEqual(loja2.vitrine.botoes);
  });
});

describe('vendido por unidade', () => {
  it('nome da unidade no catálogo', async () => {
    const { rotuloUnidade } = await import('../src/core/units');
    expect(rotuloUnidade({ unidade: 'frasco', conteudoQtd: 500, conteudoUnidade: 'ml' })).toBe('frasco 500 ml');
    expect(rotuloUnidade({ unidade: 'un' })).toBe('unidade');
    expect(rotuloUnidade({ unidade: 'L' })).toBe('litro');
    expect(rotuloUnidade({ unidade: 'pacote', conteudoQtd: 0.5, conteudoUnidade: 'kg' })).toBe('pacote 0,5 kg');
    expect(rotuloUnidade({ unidade: 'dúzia' })).toBe('dúzia');
  });

  it('a mensagem e o pedido da nuvem levam a quantidade e o que é', () => {
    const itens = [{ i: 'm', n: 'Mel', g: 2, total: 5000, ud: 'frasco 500 ml' }, { i: 'r', n: 'Rapé', g: 1, total: 700, ud: 'unidade' }, { i: 'l', n: 'Leite', g: 3, total: 900, ud: 'litro' }];
    const t = L.montarMensagem({ loja: 'T', abertura: '', fechamento: '', itens, nome: 'A', endereco: '', obs: '', origem: '', modo: 'retirada' });
    expect(t).toContain('▪️ Mel · 2 × frasco 500 ml · *R$ 50,00*');
    expect(t).toContain('▪️ Rapé · 1 unidade · *R$ 7,00*');
    expect(t).toContain('▪️ Leite · 3 litros · *R$ 9,00*');
    const doc = L.pedidoNuvem({ itens, nome: 'A', telefone: '', endereco: '', obs: '', origem: '', modo: 'retirada' }) as { fields: { itens: { arrayValue: { values: { mapValue: { fields: Record<string, { stringValue?: string }> } }[] } } } };
    expect(doc.fields.itens.arrayValue.values[0].mapValue.fields.u.stringValue).toBe('frasco 500 ml');
  });
});

describe('pedido por unidade no sistema', () => {
  it('o pedido chega no PDV na unidade do produto', async () => {
    const { pedidoDe, pedidoParaPdv } = await import('../src/core/clientes');
    const p = pedidoDe('x', { nome: 'A', obs: '', itens: [{ i: 'm', n: 'Mel', g: 2, t: 5000, u: 'frasco 500 ml' }, { i: 'o', n: 'Orégano', g: 100, t: 590 }] })!;
    expect(p.itens[0].u).toBe('frasco 500 ml');
    const prods = [prod({ id: 'm', nome: 'Mel', unidade: 'frasco' }), prod({ id: 'o', nome: 'Orégano' })];
    const { venda } = pedidoParaPdv(p, prods, null);
    expect(venda.linhas).toEqual([{ produtoId: 'm', qtd: 2, unidade: 'frasco', total: 5000 }, { produtoId: 'o', qtd: 100, unidade: 'g', total: 590 }]);
  });

  it('produto novo da nota já nasce com o conteúdo do frasco', async () => {
    const { aplicarLote, itemVazio, loteVazio } = await import('../src/core/lote');
    const l = { ...loteVazio(), itens: [{ ...itemVazio(), nome: 'Mel', unidade: 'frasco', qtd: 12, valor: 18000, conteudoQtd: 500, conteudoUnidade: 'ml' }] };
    const r = aplicarLote(l, [], []);
    const mel = r.produtos.find((x) => x.nome === 'Mel')!;
    expect(mel).toMatchObject({ unidade: 'frasco', conteudoQtd: 500, conteudoUnidade: 'ml', custo: 1500 });
  });
});
