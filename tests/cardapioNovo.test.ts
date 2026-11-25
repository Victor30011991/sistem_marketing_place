import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultStore } from '../src/core/defaults';
import { montarCardapio, vitrineDe, HORARIOS_PADRAO } from '../src/core/vitrine';
import { cfgOrcamento, dadosPix, pixCopiaECola } from '../src/core/orcamentos';
import type { ListState, Product, Venda } from '../src/types';

interface Lib {
  montarMensagem(d: Record<string, unknown>): string;
  pedidoNuvem(d: Record<string, unknown>): { fields: Record<string, { stringValue?: string; integerValue?: string }> };
  pixCopiaECola(p: unknown, v: number, tx: string): string | null;
  statusHorario(h: unknown, agora: Date): { aberto: boolean; texto: string } | null;
}
const m = { exports: {} as unknown };
new Function('module', readFileSync('public/cardapio/lib.js', 'utf8'))(m);
const L = m.exports as Lib;

const prod = (o: Partial<Product> & { id: string; nome: string }): Product => ({
  categoria: 'Temperos', unidade: 'kg', custo: 1000, custosAdicionais: 0, venda: 4700, propQtd: 100, propUnidade: 'g', observacoes: 'custo secreto', ...o,
});
const lista: ListState = {
  nome: 'L',
  categorias: ['Temperos'],
  produtos: [
    prod({ id: 'p', nome: 'Páprica defumada', modoUso: 'Batata, frango e molhos.', gluten: 'nao-contem', ingredientes: 'Páprica.' }),
    prod({ id: 'a', nome: 'Alho em pó' }),
    prod({ id: 'c', nome: 'Cebola desidratada' }),
    prod({ id: 'o', nome: 'Orégano' }),
  ],
};
const venda = (ids: string[]): Venda => ({ id: ids.join(''), quando: new Date().toISOString(), itens: ids.map((produtoId) => ({ produtoId, nome: produtoId, quantidade: 100, unidade: 'g', total: 470 })), total: 940 } as unknown as Venda);

describe('catálogo novo: arquivo publicado', () => {
  const loja = { ...defaultStore(), endereco: 'Av. Dr. João Silva Filho, 2360', vitrine: { ...vitrineDe(defaultStore()), horarios: HORARIOS_PADRAO, entrega: { ativa: true, taxa: 'fixa' as const, valor: 500, retirada: true }, pagamentos: { pix: true, cartao: false, dinheiro: true }, pesos: [50, 100, 250, 500] } };
  const pix = dadosPix({ ...cfgOrcamento({}), pixTipo: 'celular', pixChave: '(86) 99999-0000', pixNome: 'Temperei', pixCidade: 'Parnaíba' });
  const { arquivo } = montarCardapio(lista, loja, null, new Date(), { vendas: [venda(['p', 'a']), venda(['p', 'a', 'o'])], pix });
  it('leva entrega, pagamento, horário, pesos, Pix e endereço', () => {
    expect(arquivo.loja.entrega).toEqual({ ativa: true, taxa: 'fixa', valor: 500, retirada: true });
    expect(arquivo.loja.pag).toEqual({ pix: true, cartao: false, dinheiro: true });
    expect(arquivo.loja.horarios![0]).toBeNull();
    expect(arquivo.loja.horarios![1]).toEqual(['08:00', '18:00']);
    expect(arquivo.loja.pesos).toEqual([50, 100, 250, 500]);
    expect(arquivo.loja.pix).toEqual({ k: '+5586999990000', n: 'Temperei', c: 'Parnaiba' });
    expect(arquivo.loja.endereco).toContain('2360');
  });
  it('detalhes do produto, mais vendido, quem levou também levou e mix', () => {
    const p = arquivo.categorias.find((c) => c.nome === 'Temperos')!.itens.find((i) => i.i === 'p')!;
    expect(p).toMatchObject({ u: 'Batata, frango e molhos.', gl: 'n', ig: 'Páprica.', mv: 1 });
    expect(p.j![0]).toBe('a');
    expect(arquivo.mixes?.[0]).toMatchObject({ n: 'Mix para frango assado', g: 50 });
    expect(arquivo.mixes![0].i.sort()).toEqual(['a', 'c', 'o', 'p']);
    expect(JSON.stringify(arquivo)).not.toContain('custo secreto');
  });
  it('mix só usa o produto cujo nome começa com o tempero (amendoim com salsa não vira salsa)', () => {
    const l2 = { ...lista, produtos: [...lista.produtos.filter((p) => p.id !== 'o'), prod({ id: 'x', nome: 'Amendoim crocante cebola e oregano' })] };
    const r = montarCardapio(l2, loja, null);
    expect(r.arquivo.mixes?.some((m) => m.i.includes('x'))).toBeFalsy();
  });
  it('mixes podem ser desligados', () => {
    const r = montarCardapio(lista, { ...loja, vitrine: { ...loja.vitrine, mixes: false } }, null);
    expect(r.arquivo.mixes).toBeUndefined();
  });
});

describe('catálogo novo: página do cliente', () => {
  it('Pix do catálogo é igual ao do sistema', () => {
    const cfg = { ...cfgOrcamento({}), pixTipo: 'celular' as const, pixChave: '86999990000', pixNome: 'Temperei', pixCidade: 'Parnaíba' };
    const d = dadosPix(cfg)!;
    expect(L.pixCopiaECola({ k: d.chave, n: d.nome, c: d.cidade }, 3230, 'CARDAPIO')).toBe(pixCopiaECola(cfg, 3230, 'CARDAPIO'));
    expect(L.pixCopiaECola(undefined, 100, 'x')).toBeNull();
  });
  it('aberto ou fechado pelo horário', () => {
    const hs = HORARIOS_PADRAO.map((d) => (d.aberto ? [d.abre, d.fecha] : null));
    expect(L.statusHorario(hs, new Date(2026, 10, 19, 10, 0))).toEqual({ aberto: true, texto: 'Aberto agora · fecha às 18h' });
    expect(L.statusHorario(hs, new Date(2026, 10, 19, 7, 0))!.texto).toBe('Fechado · abre hoje às 8h');
    expect(L.statusHorario(hs, new Date(2026, 10, 21, 14, 0))!.texto).toBe('Fechado · abre segunda às 8h'); // sábado à tarde
    expect(L.statusHorario(hs, new Date(2026, 10, 19, 19, 0))!.texto).toBe('Fechado · abre amanhã às 8h');
    expect(L.statusHorario(undefined, new Date())).toBeNull();
  });
  it('mensagem com retirada, taxa fixa e pagamento; pedido na nuvem com o resumo em observações', () => {
    const itens = [{ i: 'p', n: 'Páprica', g: 100, total: 470 }];
    const ret = L.montarMensagem({ loja: 'T', abertura: 'Oi', fechamento: '', itens, nome: 'Maria', telefone: '86 9', endereco: 'Rua X', modo: 'retirada', pagamento: 'pix' });
    expect(ret).toContain('🏪 Retirada na loja');
    expect(ret).toContain('*Total: R$ 4,70*');
    expect(ret).toContain('📱 86 9');
    expect(ret).not.toContain('Rua X');
    expect(ret).toContain('💳 Pix');
    const ent = L.montarMensagem({ loja: 'T', abertura: 'Oi', fechamento: '', itens, nome: 'Maria', endereco: 'Rua X', modo: 'entrega', taxa: 500, pagamento: 'dinheiro', troco: '50' });
    expect(ent).toContain('🛵 Entrega: R$ 5,00');
    expect(ent).toContain('*Total: R$ 9,70*');
    expect(ent).toContain('troco para 50');
    const antigo = L.montarMensagem({ loja: 'T', abertura: 'Oi', fechamento: '', itens, nome: 'M', endereco: 'E' });
    expect(antigo).toContain('Entrega: a combinar');
    expect(L.montarMensagem({ loja: 'T', abertura: '', fechamento: '', itens, nome: 'M', telefone: '86994953216', endereco: 'E' })).toContain('📱 (86) 99495-3216');
    const nv = L.pedidoNuvem({ itens, nome: 'Maria', telefone: '86', endereco: 'Rua', obs: 'sem pressa', modo: 'retirada', pagamento: 'cartao' });
    expect(nv.fields.endereco.stringValue).toBe('Retirada na loja');
    expect(nv.fields.obs.stringValue).toBe('Retirada na loja · Pagamento: Cartão na entrega\nsem pressa');
    expect(Object.keys(nv.fields).sort()).toEqual(['criado', 'endereco', 'itens', 'nome', 'obs', 'origem', 'situacao', 'telefone', 'total']);
  });
  it('vitrine lê e limpa os campos novos', () => {
    const v = vitrineDe({ vitrine: { entrega: { ativa: false, taxa: 'x', valor: -3 }, horarios: [1, 2], pesos: [500, 'a', 50, 50], pagamentos: { cartao: false }, mixes: false } as never });
    expect(v.entrega).toEqual({ ativa: false, taxa: 'combinar', valor: 0, retirada: true });
    expect(v.horarios).toBeUndefined();
    expect(v.pesos).toEqual([50, 500]);
    expect(v.pagamentos).toEqual({ pix: true, cartao: false, dinheiro: true });
    expect(v.mixes).toBe(false);
  });
});

describe('catálogo: aparência, cor do produto e fidelidade', () => {
  it('sem escolha: cores da Minha loja, fundo claro e letra de serifa quadrada', () => {
    const { arquivo } = montarCardapio(lista, defaultStore(), null);
    const c = defaultStore().cores;
    expect(arquivo.loja.cores).toMatchObject({ p: c.primaria, d: c.destaque, f: c.fundo, b: '#FAFAF7' });
    expect(arquivo.loja.letra).toBe('slab');
    expect(arquivo.loja.fid).toBeUndefined();
  });
  it('a aparência escolhida vale por cima da Minha loja e lixo é ignorado', () => {
    const loja = { ...defaultStore(), vitrine: { ...vitrineDe(defaultStore()), visual: { fundo: '#ffffff', principal: '#a8432a', destaque: 'verde', letra: 'classica' as const } } };
    const v = vitrineDe(loja);
    expect(v.visual).toEqual({ fundo: '#FFFFFF', principal: '#A8432A', letra: 'classica' });
    const { arquivo } = montarCardapio(lista, { ...loja, vitrine: v }, null);
    expect(arquivo.loja.cores.b).toBe('#FFFFFF');
    expect(arquivo.loja.cores.p).toBe('#A8432A');
    expect(arquivo.loja.cores.d).toBe(defaultStore().cores.destaque);
    expect(arquivo.loja.letra).toBe('classica');
  });
  it('a cor da bolinha do produto vai para o site; cor inválida não', () => {
    const l2: ListState = { ...lista, produtos: [prod({ id: 'x', nome: 'Curry', cor: '#d49a1e' }), prod({ id: 'y', nome: 'Cominho', cor: 'amarelo' })] };
    const { arquivo } = montarCardapio(l2, defaultStore(), null);
    const itens = arquivo.categorias.flatMap((c) => c.itens);
    expect(itens.find((i) => i.i === 'x')!.c).toBe('#D49A1E');
    expect(itens.find((i) => i.i === 'y')!.c).toBeUndefined();
  });
  it('fidelidade ligada leva só a regra; desligada não vai', () => {
    const lig = montarCardapio(lista, defaultStore(), null, new Date(), { fidelidade: { ativo: true, compras: 10, premio: ' 100 g de tempero ', minimo: 2000 } });
    expect(lig.arquivo.loja.fid).toEqual({ n: 10, p: '100 g de tempero', m: 2000 });
    const des = montarCardapio(lista, defaultStore(), null, new Date(), { fidelidade: { ativo: false, compras: 10, premio: 'x', minimo: 0 } });
    expect(des.arquivo.loja.fid).toBeUndefined();
  });
});

describe('kits no catálogo', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Lx = L as any;
  it('a mensagem mostra o kit numa linha só, com os itens embaixo', () => {
    const t = Lx.montarMensagem({ itens: [{ kit: true, n: 'Churrasco no ponto', g: 2, total: 3180, desc: 'Páprica 100 g · Chimichurri 100 g' }, { n: 'Curry', g: 100, total: 375 }], nome: 'Ana', modo: 'retirada', pagamento: 'pix', abertura: 'Olá', loja: 'T' });
    expect(t).toContain('🎁 2x Churrasco no ponto · *R$ 31,80*');
    expect(t).toContain('Páprica 100 g · Chimichurri 100 g');
    expect(t).toContain('Total: R$ 35,55');
  });
  it('dividir o preço do kit fecha a soma exata', () => {
    expect(Lx.ratearKit(1590, [475, 730, 580])).toEqual([423, 650, 517]);
    expect(Lx.ratearKit(1590, [475, 730, 580]).reduce((a: number, b: number) => a + b, 0)).toBe(1590);
    expect(Lx.ratearKit(100, [0, 0])).toEqual([100, 0]);
  });
});

describe('entrega grátis', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Lx = L as any;
  it('mensagem e resumo mostram entrega grátis e o total sem taxa', () => {
    const d = { itens: [{ n: 'Curry', g: 1000, total: 3750 }], nome: 'Ana', endereco: 'Rua A', modo: 'entrega', taxa: 0, gratis: true, pagamento: 'pix', abertura: 'Olá', loja: 'T' };
    const t = Lx.montarMensagem(d);
    expect(t).toContain('🛵 Entrega: grátis');
    expect(t).toContain('Total: R$ 37,50*');
    expect(t).not.toContain('+ entrega');
    expect(Lx.resumoEntrega(d)).toContain('Entrega (grátis)');
  });
  it('a loja guarda o valor da entrega grátis; valor inválido some', () => {
    const ok = vitrineDe({ vitrine: { ...vitrineDe(defaultStore()), entrega: { ativa: true, taxa: 'fixa', valor: 500, retirada: true, gratisAcima: 5000 } } });
    expect(ok.entrega?.gratisAcima).toBe(5000);
    const ruim = vitrineDe({ vitrine: { ...vitrineDe(defaultStore()), entrega: { ativa: true, taxa: 'fixa', valor: 500, retirada: true, gratisAcima: -3 } } });
    expect(ruim.entrega?.gratisAcima).toBeUndefined();
  });
});
