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

  /**
   * Mensagem do pedido: abertura, nota em bloco de código (fonte fixa no WhatsApp), dados do cliente e fechamento.
   * dados: { loja, abertura, fechamento, itens: [{ n, g, total }], nome, endereco, obs, origem }
   */
  function montarMensagem(d) {
    var abertura = String(d.abertura || '').replace(/\{loja\}/g, d.loja || '');
    var linhas = [];
    for (var i = 0; i < d.itens.length; i++) {
      var it = d.itens[i];
      linhas.push(corta(it.n));
      linhas.push(lin('  ' + fmtGramas(it.g), brl(it.total)));
    }
    linhas.push(new Array(LARGURA + 1).join('-'));
    linhas.push(lin('Subtotal', brl(subtotal(d.itens))));
    linhas.push(lin('Entrega', 'a combinar'));

    var partes = [abertura, '', '```', linhas.join('\n'), '```', ''];
    partes.push('*Nome:* ' + String(d.nome || '').trim());
    partes.push('*Endereço:* ' + String(d.endereco || '').trim());
    if (String(d.obs || '').trim()) partes.push('*Observações:* ' + String(d.obs).trim());
    var o = normalizarOrigem(d.origem);
    if (o) partes.push('*Cheguei pelo:* ' + ROTULO_ORIGEM[o]);
    if (String(d.fechamento || '').trim()) {
      partes.push('');
      partes.push(String(d.fechamento).trim());
    }
    return partes.join('\n');
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
    ROTULO_ORIGEM: ROTULO_ORIGEM,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = lib;
  else root.CardapioLib = lib;
})(typeof window !== 'undefined' ? window : this);
