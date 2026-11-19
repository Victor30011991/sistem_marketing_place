import { describe, expect, it } from 'vitest';
import type { OrcamentoSalvo } from '../src/types';
import { defaultStore } from '../src/core/defaults';
import { CFG_PADRAO, LARGURA_WHATS, chavePix, crc16, orcamentosDe, paraPdv, pixCopiaECola, proximoNumero, textoWhatsapp, totaisOrcamento, validadeTexto, vencido } from '../src/core/orcamentos';
import { descontoDoTexto } from '../src/core/vendas';
import { qrMatriz } from '../src/core/qr';

const orc = (extra: Partial<OrcamentoSalvo> = {}): OrcamentoSalvo => ({
  id: 'o1', numero: 15, criado: '2026-11-19T10:00:00', atualizado: '2026-11-19T10:00:00',
  cliente: { nome: 'Maria', telefone: '', endereco: '' },
  itens: [
    { produtoId: 'a', nome: 'Açafrão', qtd: 250, unidade: 'g', preco: 4400, unidadePreco: 'kg', total: 1100 },
    { produtoId: 'c', nome: 'Cominho', qtd: 500, unidade: 'g', preco: 4400, unidadePreco: 'kg', total: 2200 },
    { produtoId: 'p', nome: 'Páprica defumada', qtd: 100, unidade: 'g', preco: 4400, unidadePreco: 'kg', total: 440 },
  ],
  desconto: { tipo: 'valor', valor: 240 }, parcelas: 1, validade: '2026-11-22', obs: '', situacao: 'enviado', ...extra,
});

describe('Pix copia e cola', () => {
  it('CRC16 do Banco Central (vetor padrão)', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
  it('normaliza as chaves', () => {
    expect(chavePix('celular', '(86) 99999-1234')).toBe('+5586999991234');
    expect(chavePix('celular', '+55 86 99999-1234')).toBe('+5586999991234');
    expect(chavePix('cnpj', '12.345.678/0001-90')).toBe('12345678000190');
    expect(chavePix('cpf', '123')).toBeNull();
    expect(chavePix('email', ' Loja@Temperei.com ')).toBe('loja@temperei.com');
  });
  it('monta o código com valor, nome e cidade sem acento', () => {
    const cfg = { ...CFG_PADRAO, pixTipo: 'email' as const, pixChave: 'loja@temperei.com', pixNome: 'Temperei Especiarias Ltda ME', pixCidade: 'São Raimundo Nonato' };
    const p = pixCopiaECola(cfg, 3500, 'ORC15')!;
    expect(p.startsWith('000201')).toBe(true);
    expect(p).toContain('0014br.gov.bcb.pix0117loja@temperei.com');
    expect(p).toContain('540535.00');
    expect(p).toContain('5925Temperei Especiarias Ltda');
    expect(p).toContain('6015Sao Raimundo No');
    expect(p).toContain('62090505ORC15');
    expect(p.slice(-8, -4)).toBe('6304');
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4));
    expect(pixCopiaECola({ ...cfg, pixChave: '' }, 3500, 'x')).toBeNull();
    // o QR code do Pix cabe e é gerado
    expect(qrMatriz(p).length).toBeGreaterThan(20);
  });
});

describe('texto do WhatsApp', () => {
  it('bloco de código alinhado, sem passar da largura', () => {
    const t = textoWhatsapp(orc(), { ...defaultStore(), nomeFantasia: 'Temperei' }, CFG_PADRAO, null);
    const bloco = t.split('```')[1].split('\n');
    expect(bloco.every((l) => l.length <= LARGURA_WHATS)).toBe(true);
    expect(bloco).toContain('  250 g ' + '.'.repeat(13) + ' R$ 11,00');
    expect(bloco.at(-1)).toBe('TOTAL' + ' '.repeat(17) + 'R$ 35,00');
    expect(t).toContain('*TEMPEREI* · Orçamento nº 15');
    expect(t).toContain('Você economiza R$ 2,40');
    expect(t).toContain('Preços garantidos até domingo, 22/11');
    expect(t).not.toContain('no cartão');
  });
  it('parcelamento só quando oferecido', () => {
    expect(textoWhatsapp(orc({ parcelas: 3 }), defaultStore(), CFG_PADRAO, null)).toContain('ou 3× de R$ 11,66 no cartão');
  });
});

describe('regras', () => {
  it('totais, número, validade e vencido', () => {
    expect(totaisOrcamento(orc())).toEqual({ subtotal: 3740, desconto: 240, total: 3500 });
    expect(proximoNumero([orc(), orc({ numero: 7 })])).toBe(16);
    expect(validadeTexto('2026-11-22')).toBe('domingo, 22/11');
    expect(vencido(orc(), '2026-11-23')).toBe(true);
    expect(vencido(orc({ situacao: 'vendido' }), '2026-11-23')).toBe(false);
  });
  it('vira venda no PDV com o mesmo total', () => {
    const p = paraPdv(orc());
    const soma = p.linhas.reduce((a, l) => a + (l.total ?? 0) - descontoDoTexto(l.desconto, l.total ?? 0), 0);
    expect(soma).toBe(3500);
    expect(p.cliente).toBe('Maria (orç. 15)');
  });
  it('lê de volta do backup', () => {
    const [o] = orcamentosDe([orc(), { lixo: true }, 3])!.filter((x) => x.itens.length);
    expect(o).toEqual(orc());
  });
});
