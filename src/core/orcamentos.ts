/** Orçamentos salvos: números, totais, Pix copia e cola, texto do WhatsApp e passagem para o PDV. */
import type { ConfigOrcamento, ItemOrcamento, OrcamentoSalvo, SituacaoOrcamento, StoreInfo, VendaPausada } from '../types';
import { formatBRL } from './money';
import { installments, orcamentoTotais, type Totais } from './orcamento';
import { newId } from './normalize';
import { normalizarInstagram, normalizarWhatsapp, vitrineDe } from './vitrine';

export const CFG_PADRAO: ConfigOrcamento = {
  validadeDias: 7,
  formas: 'Pix, dinheiro ou cartão',
  pixTipo: 'celular',
  pixChave: '',
  pixNome: '',
  pixCidade: '',
  parcelarAcima: 30000,
  mensagem: 'Responda "QUERO" para confirmar',
  cupom: 80,
};

export const SITUACOES: { id: SituacaoOrcamento; rotulo: string }[] = [
  { id: 'rascunho', rotulo: 'Rascunho' },
  { id: 'enviado', rotulo: 'Enviado' },
  { id: 'aprovado', rotulo: 'Aprovado' },
  { id: 'perdido', rotulo: 'Não fechou' },
  { id: 'vendido', rotulo: 'Virou venda' },
];

export function cfgOrcamento(raw: unknown): ConfigOrcamento {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (k: keyof ConfigOrcamento) => (typeof o[k] === 'string' ? (o[k] as string) : (CFG_PADRAO[k] as string));
  const n = (k: keyof ConfigOrcamento, min: number, max: number) => (typeof o[k] === 'number' && Number.isFinite(o[k]) ? Math.min(Math.max(o[k] as number, min), max) : (CFG_PADRAO[k] as number));
  return {
    validadeDias: Math.round(n('validadeDias', 0, 365)),
    formas: s('formas'),
    pixTipo: ['cpf', 'cnpj', 'celular', 'email', 'aleatoria'].includes(o.pixTipo as string) ? (o.pixTipo as ConfigOrcamento['pixTipo']) : CFG_PADRAO.pixTipo,
    pixChave: s('pixChave'),
    pixNome: s('pixNome'),
    pixCidade: s('pixCidade'),
    parcelarAcima: Math.round(n('parcelarAcima', 0, 1e9)),
    mensagem: s('mensagem'),
    cupom: o.cupom === 58 ? 58 : 80,
  };
}

export function totaisOrcamento(o: Pick<OrcamentoSalvo, 'itens' | 'desconto'>): Totais {
  return orcamentoTotais(
    o.itens.reduce((a, i) => a + i.total, 0),
    o.desconto,
  );
}

export const proximoNumero = (lista: OrcamentoSalvo[]) => lista.reduce((m, o) => Math.max(m, o.numero), 0) + 1;

const z = (n: number) => String(n).padStart(2, '0');
export const hojeIso = (d = new Date()) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  return hojeIso(new Date(a, m - 1, d + dias));
}
export const dataBR = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
/** "sexta, 22/11" */
export function validadeTexto(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return `${DIAS[new Date(a, m - 1, d).getDay()]}, ${z(d)}/${z(m)}`;
}
export const vencido = (o: Pick<OrcamentoSalvo, 'validade' | 'situacao'>, hoje = hojeIso()) => !!o.validade && o.validade < hoje && (o.situacao === 'enviado' || o.situacao === 'rascunho');

export function novoOrcamento(cfg: ConfigOrcamento, lista: OrcamentoSalvo[]): OrcamentoSalvo {
  const agora = new Date().toISOString();
  return {
    id: newId(),
    numero: proximoNumero(lista),
    criado: agora,
    atualizado: agora,
    cliente: { nome: '', telefone: '', endereco: '' },
    itens: [],
    desconto: { tipo: 'valor', valor: null },
    parcelas: 1,
    validade: cfg.validadeDias > 0 ? somarDias(hojeIso(), cfg.validadeDias) : '',
    obs: '',
    situacao: 'rascunho',
  };
}

// ---------------------------------------------------------------- texto

const fmtQtd = (n: number) => String(Number(n.toFixed(3))).replace('.', ',');
export const qtdTexto = (i: Pick<ItemOrcamento, 'qtd' | 'unidade'>) => `${fmtQtd(i.qtd)} ${i.unidade}`;
export const precoTexto = (i: Pick<ItemOrcamento, 'preco' | 'unidadePreco'>) => `${formatBRL(i.preco)}/${i.unidadePreco}`;

/** Linha de largura fixa: texto à esquerda, valor à direita, pontinhos no meio. */
function linha(esq: string, dir: string, w: number, enche = ' '): string {
  const espaco = w - esq.length - dir.length;
  if (espaco < 1) return `${esq} ${dir}`;
  return esq + (enche === ' ' ? ' '.repeat(espaco) : ' ' + enche.repeat(Math.max(0, espaco - 2)) + ' ') + dir;
}
const brl = (c: number) => formatBRL(c).replace(/ /g, ' ');

export const LARGURA_WHATS = 30;

/** Texto para colar no WhatsApp: cabeçalho, itens e totais num bloco de código (fica alinhado), o resto em texto normal. */
export function textoWhatsapp(o: OrcamentoSalvo, loja: StoreInfo, cfg: ConfigOrcamento, pix: string | null): string {
  const t = totaisOrcamento(o);
  const W = LARGURA_WHATS;
  const bloco: string[] = [];
  for (const i of o.itens) {
    bloco.push(i.nome.length > W ? i.nome.slice(0, W - 1) + '…' : i.nome);
    bloco.push(linha('  ' + qtdTexto(i), brl(i.total), W, '.'));
  }
  bloco.push('-'.repeat(W));
  if (t.desconto > 0) {
    bloco.push(linha('Subtotal', brl(t.subtotal), W));
    bloco.push(linha('Desconto', '- ' + brl(t.desconto), W));
  }
  bloco.push(linha('TOTAL', brl(t.total), W));

  const partes: string[] = [];
  partes.push(`*${(loja.nomeFantasia || 'Orçamento').toUpperCase()}* · Orçamento nº ${o.numero}`);
  partes.push([o.cliente.nome.trim() ? `Para: ${o.cliente.nome.trim()}` : '', dataBR(o.criado)].filter(Boolean).join(' · '));
  partes.push('');
  partes.push('```' + bloco.join('\n') + '```');
  partes.push('');
  if (t.desconto > 0) partes.push(`🎁 Você economiza ${brl(t.desconto)}`);
  if (o.parcelas > 1) partes.push(`💳 ou ${o.parcelas}× de ${brl(installments(t.total, o.parcelas)[0])} no cartão`);
  if (cfg.formas.trim()) partes.push(`Pagamento: ${cfg.formas.trim()}`);
  if (o.validade) partes.push(`⏰ Preços garantidos até ${validadeTexto(o.validade)}`);
  if (o.obs.trim()) partes.push('', o.obs.trim());
  if (pix) partes.push('', 'Pix copia e cola (valor já preenchido):', pix);
  if (cfg.mensagem.trim()) partes.push('', cfg.mensagem.trim() + ' 🙂');
  return partes.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Número de WhatsApp da loja (página da loja ou telefone). */
export function whatsLoja(loja: StoreInfo): string {
  const v = vitrineDe(loja);
  return normalizarWhatsapp(v.whatsapp) || normalizarWhatsapp(loja.telefone);
}

/** Contatos da loja para o rodapé: "(86) 99999-1234" e "@temperei". */
export function contatosLoja(loja: StoreInfo): { whats: string; insta: string } {
  const w = whatsLoja(loja);
  const n = w.startsWith('55') ? w.slice(2) : w;
  const whats = n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : w ? `+${w}` : '';
  const url = normalizarInstagram(vitrineDe(loja).instagram);
  const h = url.replace(/^https:\/\/([a-z0-9-]+\.)?instagram\.com\//i, '').split(/[/?#]/)[0];
  return { whats, insta: h ? `@${h}` : '' };
}

/** Link para o cliente confirmar pelo WhatsApp da loja (vai no QR do PDF e do cupom). */
export function linkConfirmar(o: OrcamentoSalvo, loja: StoreInfo): string | null {
  const w = whatsLoja(loja);
  return w ? `https://wa.me/${w}?text=${encodeURIComponent(`Olá! Quero confirmar o orçamento nº ${o.numero}.`)}` : null;
}

// ---------------------------------------------------------------- Pix (BR Code estático)

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), como pede o Banco Central. */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const ascii = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .trim();

export function chavePix(tipo: ConfigOrcamento['pixTipo'], chave: string): string | null {
  const c = chave.trim();
  const dig = c.replace(/\D/g, '');
  switch (tipo) {
    case 'cpf':
      return dig.length === 11 ? dig : null;
    case 'cnpj':
      return dig.length === 14 ? dig : null;
    case 'celular': {
      const n = dig.startsWith('55') && dig.length >= 12 ? dig.slice(2) : dig;
      return n.length === 10 || n.length === 11 ? `+55${n}` : null;
    }
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? c.toLowerCase() : null;
    case 'aleatoria':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c) ? c.toLowerCase() : null;
  }
}

/** Pix copia e cola com valor. null = chave, nome ou cidade faltando/inválidos. */
export function pixCopiaECola(cfg: ConfigOrcamento, valorCentavos: number, txid: string): string | null {
  const chave = chavePix(cfg.pixTipo, cfg.pixChave);
  const nome = ascii(cfg.pixNome).slice(0, 25);
  const cidade = ascii(cfg.pixCidade).slice(0, 15);
  if (!chave || !nome || !cidade || valorCentavos <= 0) return null;
  const f = (id: string, v: string) => id + String(v.length).padStart(2, '0') + v;
  const tx = txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const corpo =
    f('00', '01') +
    f('26', f('00', 'br.gov.bcb.pix') + f('01', chave)) +
    f('52', '0000') +
    f('53', '986') +
    f('54', (valorCentavos / 100).toFixed(2)) +
    f('58', 'BR') +
    f('59', nome) +
    f('60', cidade) +
    f('62', f('05', tx)) +
    '6304';
  return corpo + crc16(corpo);
}

// ---------------------------------------------------------------- PDV e backup

/** Venda pausada no PDV com os itens e preços do orçamento; o desconto vira desconto nos itens. */
export function paraPdv(o: OrcamentoSalvo): VendaPausada {
  const t = totaisOrcamento(o);
  // reparte o desconto entre os itens, sem perder centavo
  const descs = o.itens.map((i) => (t.subtotal ? Math.floor((t.desconto * i.total) / t.subtotal) : 0));
  let resto = t.desconto - descs.reduce((a, b) => a + b, 0);
  for (let k = 0; resto > 0 && o.itens.length; k = (k + 1) % o.itens.length, resto--) descs[k]++;
  return {
    id: newId(),
    quando: new Date().toISOString(),
    cliente: `${o.cliente.nome.trim() || 'Cliente'} (orç. ${o.numero})`,
    linhas: o.itens.map((i, k) => ({
      produtoId: i.produtoId,
      qtd: i.qtd,
      unidade: i.unidade,
      total: i.total,
      ...(descs[k] > 0 ? { desconto: (descs[k] / 100).toFixed(2).replace('.', ',') } : {}),
    })),
  };
}

export function orcamentosDe(raw: unknown): OrcamentoSalvo[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const n = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  return raw.flatMap((x) => {
    if (!x || typeof x !== 'object') return [];
    const o = x as Record<string, unknown>;
    const cli = (o.cliente && typeof o.cliente === 'object' ? o.cliente : {}) as Record<string, unknown>;
    const d = (o.desconto && typeof o.desconto === 'object' ? o.desconto : {}) as Record<string, unknown>;
    const itens = (Array.isArray(o.itens) ? o.itens : []).flatMap((i) => {
      if (!i || typeof i !== 'object') return [];
      const it = i as Record<string, unknown>;
      return typeof it.produtoId === 'string' && n(it.qtd) > 0 ? [{ produtoId: it.produtoId, nome: s(it.nome), qtd: n(it.qtd), unidade: s(it.unidade) || 'un', preco: n(it.preco), unidadePreco: s(it.unidadePreco) || 'un', total: n(it.total) }] : [];
    });
    const sit = SITUACOES.some((x) => x.id === o.situacao) ? (o.situacao as SituacaoOrcamento) : 'enviado';
    return [
      {
        id: s(o.id) || newId(),
        numero: Math.max(1, Math.round(n(o.numero, 1))),
        criado: s(o.criado),
        atualizado: s(o.atualizado) || s(o.criado),
        cliente: { nome: s(cli.nome), telefone: s(cli.telefone), endereco: s(cli.endereco) },
        itens,
        desconto: { tipo: d.tipo === 'pct' ? 'pct' : 'valor', valor: typeof d.valor === 'number' ? d.valor : null },
        parcelas: Math.min(Math.max(Math.round(n(o.parcelas, 1)), 1), 24),
        validade: s(o.validade),
        obs: s(o.obs),
        situacao: sit,
      } satisfies OrcamentoSalvo,
    ];
  });
}
