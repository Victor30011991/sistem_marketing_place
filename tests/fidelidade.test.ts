import { describe, expect, it } from 'vitest';
import { aniversariantes, bolinhas, cartaoDe, fidelidadeDe, linhaCartao, mensagemAniversario } from '../src/core/fidelidade';
import { clientesDe } from '../src/core/clientes';
import { filtrarPixels } from '../src/core/filtroFoto';
import { estilosDe } from '../src/core/estilosArte';
import type { Cliente, Venda } from '../src/types';

const cli = (o: Partial<Cliente> = {}): Cliente => ({ id: 'c1', nome: 'Bruna Lima', telefone: '', endereco: '', obs: '', criado: '', ...o });
const venda = (dia: number, total = 1000, o: Partial<Venda> = {}): Venda => ({ id: 'v' + dia, quando: `2026-11-${String(dia).padStart(2, '0')}T12:00:00.000Z`, itens: [], desconto: 0, total, pagamento: 'pix', pagamentoLabel: 'Pix', taxa: 0, cliente: 'Bruna Lima', clienteId: 'c1', ...o });
const cfg = { ativo: true, compras: 3, premio: '100 g grátis', minimo: 500 };

describe('cartão fidelidade', () => {
  it('conta compras acima do mínimo, sem canceladas', () => {
    const vs = [venda(1), venda(2, 300), venda(3, 1000, { cancelada: 'x' }), venda(4)];
    const k = cartaoDe(cli(), vs, cfg);
    expect(k).toMatchObject({ contadas: 2, faltam: 1, premioPronto: false });
    expect(bolinhas(k)).toBe('●●○');
    expect(linhaCartao(k, cfg)).toContain('2 de 3');
  });
  it('libera o prêmio e recomeça depois de entregue', () => {
    const vs = [venda(1), venda(2), venda(3), venda(10)];
    expect(cartaoDe(cli(), vs, cfg).premioPronto).toBe(true);
    const k = cartaoDe(cli({ resgates: ['2026-11-05T00:00:00.000Z'] }), vs, cfg);
    expect(k).toMatchObject({ contadas: 1, premios: 1, premioPronto: false });
  });
  it('lê configuração e cliente com aniversário e resgates', () => {
    expect(fidelidadeDe({ ativo: true, compras: 1, premio: '', minimo: -5 })).toEqual({ ativo: true, compras: 2, premio: '100 g de tempero à escolha', minimo: 0 });
    const [c] = clientesDe([{ nome: 'X', aniversario: '12-25', resgates: ['a', 3] }])!;
    expect(c).toMatchObject({ aniversario: '12-25', resgates: ['a'] });
    expect(clientesDe([{ nome: 'Y', aniversario: '25/12' }])![0].aniversario).toBeUndefined();
  });
});

describe('aniversários', () => {
  it('lista quem faz aniversário nos próximos dias, hoje primeiro', () => {
    const cs = [cli({ id: 'a', nome: 'Ana', aniversario: '11-25' }), cli({ id: 'b', nome: 'Bia', aniversario: '11-22' }), cli({ id: 'c', nome: 'Cris', aniversario: '01-10' })];
    const r = aniversariantes(cs, new Date(2026, 10, 22), 7);
    expect(r.map((x) => [x.cliente.nome, x.emDias])).toEqual([['Bia', 0], ['Ana', 3]]);
    expect(mensagemAniversario(cs[0], 'Temperei', '100 g grátis')).toContain('Feliz aniversário, Ana!');
  });
  it('vira o ano (31/12 → 02/01)', () => {
    expect(aniversariantes([cli({ aniversario: '01-02' })], new Date(2026, 11, 31), 7)[0].emDias).toBe(2);
  });
});

describe('Posta Aí: filtros e selos', () => {
  it('filtro quente esquenta e P&B tira a cor', () => {
    const d = new Uint8ClampedArray([100, 100, 100, 255]);
    filtrarPixels(d, { calor: 0.5 });
    expect(d[0]).toBeGreaterThan(d[2]);
    const c = new Uint8ClampedArray([200, 50, 50, 255]);
    filtrarPixels(c, { saturacao: -1 });
    expect(c[0]).toBe(c[1]);
  });
  it('selo, contorno e faixa do texto sobrevivem ao salvar', () => {
    const [e] = estilosDe([{ id: 'e', nome: 'x', fundo: 'creme', camadas: [{ tipo: 'selo', x: 0.5, y: 0.5, w: 0.3, h: 0.2, formaSelo: 'estrela', campo: 'preco' }, { tipo: 'texto', x: 0, y: 0, w: 1, h: 0.1, contorno: true, fundoTexto: 'destaque' }] }])!;
    expect(e.camadas[0]).toMatchObject({ tipo: 'selo', formaSelo: 'estrela', campo: 'preco' });
    expect(e.camadas[1]).toMatchObject({ contorno: true, fundoTexto: 'destaque' });
  });
});
