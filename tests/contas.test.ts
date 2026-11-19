import { describe, expect, it } from 'vitest';
import type { Venda } from '../src/types';
import { contaFiado, contasDe, devedores, dinheiroDeContas, novaConta, pagoNoPeriodo, proximoMes, quitar, receberDoCliente, saldo, situacao, textoCobranca, totais } from '../src/core/contas';
import { abrirCaixa, resumoCaixa } from '../src/core/caixa';
import { fecharPdv, formasPdv } from '../src/core/vendas';
import { defaultSettings } from '../src/core/defaults';

const maria = { id: 'c1', nome: 'Maria Souza', telefone: '86988887777', endereco: '', obs: '', criado: '' };

describe('fiado e contas', () => {
  it('fiado é uma forma do PDV, sem taxa', () => {
    expect(formasPdv(defaultSettings()).at(-1)).toEqual({ id: 'fiado', label: 'Fiado', taxa: 0 });
    const f = fecharPdv([{ produtoId: 'a', nome: 'A', qtd: 1, unidade: 'un', total: 5000, custo: 0 }], { tipo: 'valor', valor: null }, [{ forma: 'pix', valor: 2000 }, { forma: 'fiado', valor: 3000 }], defaultSettings());
    expect(f.falta).toBe(0);
    expect(f.pagamentos.find((p) => p.forma === 'fiado')?.valor).toBe(3000);
  });
  it('conta do fiado: prazo, saldo, situação e recebimento das mais antigas', () => {
    const a = contaFiado(3000, 'v1', 'c1', 30, new Date(2026, 9, 1));
    const b = contaFiado(2000, 'v2', 'c1', 30, new Date(2026, 10, 10));
    expect(a.vencimento).toBe('2026-10-31');
    expect(situacao(a, '2026-11-19')).toBe('vencida');
    const depois = receberDoCliente([a, b], 'c1', 3500, 'dinheiro', 'Samara');
    expect(depois.map(saldo)).toEqual([0, 1500]);
    expect(situacao(depois[1], '2026-11-19')).toBe('parcial');
    const [d] = devedores(depois, [maria], '2026-11-19');
    expect(d).toMatchObject({ saldo: 1500, vencido: 0 });
    expect(textoCobranca(d, 'Temperei', null)).toMatch(/^Oi, Maria!.*\n.*R\$ 15,00/s);
  });
  it('conta mensal paga gera a do mês seguinte; valor não passa do saldo', () => {
    const c = novaConta({ tipo: 'pagar', descricao: 'Aluguel', valor: 150000, vencimento: '2026-01-31', mensal: true });
    const r = quitar(c, 999999, 'pix', 'Victor');
    expect(saldo(r.conta)).toBe(0);
    expect(r.conta.pagamentos[0].valor).toBe(150000);
    expect(r.proxima).toMatchObject({ descricao: 'Aluguel', vencimento: '2026-02-28', mensal: true });
    expect(proximoMes('2026-03-15')).toBe('2026-04-15');
    expect(quitar(c, 1000, 'pix', 'V').proxima).toBeNull();
  });
  it('totais, pago no período e recebido em dinheiro entra no caixa', () => {
    const p = novaConta({ tipo: 'pagar', descricao: 'Luz', valor: 20000, vencimento: '2026-11-22' });
    const venc = novaConta({ tipo: 'pagar', descricao: 'Boleto', valor: 5000, vencimento: '2026-11-10' });
    const f = receberDoCliente([contaFiado(3000, 'v', 'c1', 30, new Date(2026, 10, 19))], 'c1', 1000, 'dinheiro', 'S');
    expect(totais([p, venc, ...f], '2026-11-19')).toEqual({ receber: 2000, receberVencido: 0, pagar: 25000, pagarVencido: 5000, pagar7dias: 20000 });
    const quando = f[0].pagamentos[0].quando;
    const cx = { ...abrirCaixa(0, 'V', new Date(Date.parse(quando) - 60000)) };
    expect(dinheiroDeContas(f, cx.abertoEm)).toBe(1000);
    expect(resumoCaixa(cx, [] as Venda[], f).previsto).toBe(1000);
    const pagaLuz = quitar(p, 20000, 'pix', 'V', new Date(2026, 10, 20, 12)).conta;
    expect(pagoNoPeriodo([pagaLuz], '2026-11-01', '2026-11-30')).toBe(20000);
    expect(contasDe([pagaLuz, { tipo: 'x' }])).toEqual([pagaLuz]);
  });
});
