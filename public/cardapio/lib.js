/* Funções puras do cardápio (sem tela). Também são testadas no projeto, em tests/vitrine.test.ts. */
(function (root) {
  'use strict';

  var LARGURA = 30;

  /** 12345 -> "R$ 123,45" */
  function brl(cents) {
    var neg = cents < 0;
    var c = Math.abs(Math.round(cents));
    var inteiro = Math.floor(c / 100);
    var dec = String(c % 100);
    if (dec.length < 2) dec = '0' + dec;
    return (neg ? '-' : '') + 'R$ ' + String(inteiro).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
  }

  /** 250 -> "250 g" · 1500 -> "1,5 kg" */
  function fmtGramas(g) {
    if (g >= 1000) return String(Number((g / 1000).toFixed(3))).replace('.', ',') + ' kg';
    return g + ' g';
  }

  /** Preço de g gramas, em centavos, com meio para cima. pk = centavos por quilo. Só usa números inteiros. */
  function precoItem(g, pk) {
    return Math.floor((g * pk + 500) / 1000);
  }

  /** "250", "250 g", "1,5 kg", "1kg" -> gramas (inteiro). Texto que não dá para entender = null. */
  function parseGramas(texto) {
    var m = String(texto == null ? '' : texto)
      .toLowerCase()
      .trim()
      .match(/^(\d+(?:[.,]\d+)?)\s*(kg|quilos?|g|gr|gramas?)?$/);
    if (!m) return null;
    var n = Number(m[1].replace(',', '.'));
    if (!isFinite(n)) return null;
    var g = Math.round(m[2] && m[2].charAt(0) === 'k' || (m[2] && m[2].indexOf('quilo') === 0) ? n * 1000 : n);
    return g > 0 ? g : null;
  }

  function subtotal(itens) {
    var t = 0;
    for (var i = 0; i < itens.length; i++) t += itens[i].total;
    return t;
  }

  function lin(esq, dir) {
    var sp = LARGURA - esq.length - dir.length;
    if (sp < 1) sp = 1;
    return esq + new Array(sp + 1).join(' ') + dir;
  }

  function corta(t) {
    return t.length > LARGURA ? t.slice(0, LARGURA - 1) + '…' : t;
  }

  var ROTULO_ORIGEM = { instagram: 'Instagram', facebook: 'Facebook', whatsapp: 'WhatsApp' };

  function normalizarOrigem(o) {
    var k = String(o || '').toLowerCase();
    return ROTULO_ORIGEM[k] ? k : '';
  }

  var PAGAMENTOS = { pix: 'Pix', cartao: 'Cartão na entrega', dinheiro: 'Dinheiro' };

  /** Texto curto de como o cliente recebe e paga (vai junto do pedido para a loja). */
  function resumoEntrega(d) {
    var p = [];
    if (d.modo === 'retirada') p.push('Retirada na loja');
    else if (d.modo === 'entrega') p.push(d.taxa > 0 ? 'Entrega (taxa ' + brl(d.taxa) + ')' : 'Entrega (taxa a combinar)');
    if (PAGAMENTOS[d.pagamento]) p.push('Pagamento: ' + PAGAMENTOS[d.pagamento] + (d.pagamento === 'dinheiro' && String(d.troco || '').trim() ? ' (troco para ' + String(d.troco).trim() + ')' : ''));
    return p.join(' · ');
  }

  /**
   * Mensagem do pedido: abertura, nota em bloco de código (fonte fixa no WhatsApp), dados do cliente e fechamento.
   * dados: { loja, abertura, fechamento, itens: [{ n, g, total }], nome, telefone?, endereco, obs, origem,
   *          modo?: 'entrega' | 'retirada', taxa?: centavos (0 = a combinar), pagamento?: 'pix' | 'cartao' | 'dinheiro', troco? }
   */
  function montarMensagem(d) {
    var abertura = String(d.abertura || '').replace(/\{loja\}/g, d.loja || '');
    var linhas = [];
    for (var i = 0; i < d.itens.length; i++) {
      var it = d.itens[i];
      linhas.push(corta(it.n));
      linhas.push(lin('  ' + fmtGramas(it.g), brl(it.total)));
    }
    var sub = subtotal(d.itens);
    linhas.push(new Array(LARGURA + 1).join('-'));
    linhas.push(lin('Subtotal', brl(sub)));
    if (d.modo === 'retirada') linhas.push(lin('Retirada', 'na loja'));
    else if (d.taxa > 0) { linhas.push(lin('Entrega', brl(d.taxa))); linhas.push(lin('Total', brl(sub + d.taxa))); }
    else linhas.push(lin('Entrega', 'a combinar'));

    var partes = [abertura, '', '```', linhas.join('\n'), '```', ''];
    partes.push('*Nome:* ' + String(d.nome || '').trim());
    if (String(d.telefone || '').trim()) partes.push('*WhatsApp:* ' + String(d.telefone).trim());
    if (d.modo === 'retirada') partes.push('*Retirada:* na loja');
    else partes.push('*Endereço:* ' + String(d.endereco || '').trim());
    if (PAGAMENTOS[d.pagamento]) partes.push('*Pagamento:* ' + PAGAMENTOS[d.pagamento] + (d.pagamento === 'dinheiro' && String(d.troco || '').trim() ? ' (troco para ' + String(d.troco).trim() + ')' : ''));
    if (String(d.obs || '').trim()) partes.push('*Observações:* ' + String(d.obs).trim());
    var o = normalizarOrigem(d.origem);
    if (o) partes.push('*Cheguei pelo:* ' + ROTULO_ORIGEM[o]);
    if (String(d.fechamento || '').trim()) {
      partes.push('');
      partes.push(String(d.fechamento).trim());
    }
    return partes.join('\n');
  }

  /** Valor no formato da API REST do Firestore. */
  function campoFs(v) {
    if (Array.isArray(v)) return { arrayValue: { values: v.map(campoFs) } };
    if (v && typeof v === 'object') {
      var f = {};
      Object.keys(v).forEach(function (k) { if (v[k] !== undefined) f[k] = campoFs(v[k]); });
      return { mapValue: { fields: f } };
    }
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    return { stringValue: String(v == null ? '' : v) };
  }

  /**
   * Pedido para gravar na nuvem (a loja vê na hora, na tela Pedidos).
   * dados: { itens: [{ i, n, g, total }], nome, telefone, endereco, obs, origem }
   */
  function pedidoNuvem(d) {
    var itens = d.itens.slice(0, 80).map(function (it) {
      var x = { n: String(it.n).slice(0, 120), g: Math.round(it.g), t: Math.round(it.total) };
      if (it.i) x.i = String(it.i).slice(0, 64);
      return x;
    });
    var resumo = resumoEntrega(d);
    var obs = [resumo, String(d.obs || '').trim()].filter(Boolean).join('\n');
    var dados = {
      criado: new Date().toISOString(),
      nome: String(d.nome || '').trim().slice(0, 80),
      telefone: String(d.telefone || '').trim().slice(0, 30),
      endereco: (d.modo === 'retirada' ? 'Retirada na loja' : String(d.endereco || '').trim()).slice(0, 300),
      obs: obs.slice(0, 500),
      itens: itens,
      total: subtotal(d.itens),
      origem: normalizarOrigem(d.origem),
      situacao: 'novo',
    };
    return { fields: campoFs(dados).mapValue.fields };
  }

  // ---------- Pix copia e cola (mesmo cálculo do sistema) ----------
  function crc16(t) {
    var crc = 0xffff;
    for (var i = 0; i < t.length; i++) {
      crc ^= t.charCodeAt(i) << 8;
      for (var b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return ('0000' + crc.toString(16).toUpperCase()).slice(-4);
  }
  /** pix = { k: chave formatada, n: nome, c: cidade } (já em ASCII, vindos do sistema). */
  function pixCopiaECola(pix, valorCentavos, txid) {
    if (!pix || !pix.k || !pix.n || !pix.c || !(valorCentavos > 0)) return null;
    var f = function (id, v) { return id + ('0' + v.length).slice(-2) + v; };
    var tx = String(txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
    var corpo = f('00', '01') + f('26', f('00', 'br.gov.bcb.pix') + f('01', pix.k)) + f('52', '0000') + f('53', '986') +
      f('54', (valorCentavos / 100).toFixed(2)) + f('58', 'BR') + f('59', String(pix.n).slice(0, 25)) + f('60', String(pix.c).slice(0, 15)) + f('62', f('05', tx)) + '6304';
    return corpo + crc16(corpo);
  }

  // ---------- aberto / fechado ----------
  var DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  function minutos(h) { var m = /^(\d{2}):(\d{2})$/.exec(h || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
  function fmtHora(h) { var m = /^(\d{2}):(\d{2})$/.exec(h || ''); return m ? Number(m[1]) + 'h' + (m[2] === '00' ? '' : m[2]) : h; }
  /** horarios: 7 dias (domingo = 0), cada um [abre, fecha] ou null. Devolve { aberto, texto } ou null sem horários. */
  function statusHorario(horarios, agora) {
    if (!Array.isArray(horarios) || horarios.length !== 7) return null;
    var d = agora.getDay();
    var min = agora.getHours() * 60 + agora.getMinutes();
    var hoje = horarios[d];
    if (hoje && minutos(hoje[0]) <= min && min < minutos(hoje[1])) return { aberto: true, texto: 'Aberto agora · fecha às ' + fmtHora(hoje[1]) };
    if (hoje && min < minutos(hoje[0])) return { aberto: false, texto: 'Fechado · abre hoje às ' + fmtHora(hoje[0]) };
    for (var k = 1; k <= 7; k++) {
      var h = horarios[(d + k) % 7];
      if (h) return { aberto: false, texto: 'Fechado · abre ' + (k === 1 ? 'amanhã' : DIAS[(d + k) % 7]) + ' às ' + fmtHora(h[0]) };
    }
    return { aberto: false, texto: 'Fechado no momento' };
  }

  function urlWhatsapp(numero, texto) {
    return 'https://wa.me/' + String(numero).replace(/\D/g, '') + '?text=' + encodeURIComponent(texto);
  }

  var lib = {
    brl: brl,
    fmtGramas: fmtGramas,
    precoItem: precoItem,
    parseGramas: parseGramas,
    subtotal: subtotal,
    normalizarOrigem: normalizarOrigem,
    montarMensagem: montarMensagem,
    urlWhatsapp: urlWhatsapp,
    pedidoNuvem: pedidoNuvem,
    resumoEntrega: resumoEntrega,
    pixCopiaECola: pixCopiaECola,
    statusHorario: statusHorario,
    fmtHora: fmtHora,
    PAGAMENTOS: PAGAMENTOS,
    ROTULO_ORIGEM: ROTULO_ORIGEM,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = lib;
  else root.CardapioLib = lib;
})(typeof window !== 'undefined' ? window : this);
