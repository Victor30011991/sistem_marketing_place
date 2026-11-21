/* Página pública do cardápio. Não conhece o sistema de precificação: só lê o cardápio publicado (nome, categoria e preço). */
(function () {
  'use strict';
  var L = window.CardapioLib;
  var app = document.getElementById('app');
  var params = new URLSearchParams(location.search);
  var PREVIEW = params.get('preview') === '1';
  var ORIGEM = L.normalizarOrigem(params.get('o'));
  var DESTAQUES = { 'Ofertas': 1, 'Mais vendidos': 1, 'Chegou agora': 1 };

  var dados = null;
  var carrinho = {}; // chave "i:<id>" -> gramas
  var form = { nome: '', telefone: '', endereco: '', obs: '', modo: '', pagamento: '', troco: '' };
  var ui = { busca: '', peso: {}, erro: '', tentou: false, outro: '' };

  // ---------- guarda só nesta aba do navegador (some ao fechar) ----------
  function guardar() {
    try { sessionStorage.setItem('cardapio-pedido', JSON.stringify({ carrinho: carrinho, form: form })); } catch (e) { /* sem armazenamento: tudo bem */ }
  }
  function recuperar() {
    try {
      var s = JSON.parse(sessionStorage.getItem('cardapio-pedido') || 'null');
      if (s && s.carrinho) { carrinho = s.carrinho; form = Object.assign(form, s.form || {}); }
    } catch (e) { /* ignora */ }
  }

  // ---------- utilidades de tela ----------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] == null || attrs[k] === false) continue;
      if (k === 'class') el.className = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (k === 'text') el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  var ICONES = {
    menu: '<path d="M5 6h14M5 12h14M5 18h9"/>',
    instagram: '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><path d="M16.8 7.2h.01"/>',
    facebook: '<path d="M14 8h3V4h-3a4 4 0 00-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5A.5.5 0 0114 8z"/>',
    whatsapp: '<path d="M4 20l1.3-4.2A8 8 0 1112 20a8 8 0 01-3.9-1z"/><path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 .7c-.8-.4-1.6-1.2-2-2l.7-1-1-2z"/>',
    voltar: '<path d="M15 6l-6 6 6 6"/>',
    cesta: '<path d="M4 9h16l-1.5 10h-13zM8 9l3-5M16 9l-3-5"/>',
    maps: '<path d="M12 21s-6-5.5-6-11a6 6 0 0112 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
    ifood: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2"/>',
    site: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"/>',
    telefone: '<path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 005.2 5.2l1.3-2 4 1.5v3a2 2 0 01-2.2 2A16 16 0 014.5 5.7a2 2 0 012-2.2z"/>',
    busca: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    moto: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17h6l-3-7h4l2 7M12 10l-2-3H7"/>',
    loja: '<path d="M4 10l1.5-5h13L20 10M4 10v10h16V10M4 10c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3"/><path d="M10 20v-5h4v5"/>',
    copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    check: '<path d="M5 12l4.5 4.5L19 7"/>',
    tag: '<path d="M3.5 12.5V4.5a1 1 0 011-1h8l8 8-9 9z"/><circle cx="8" cy="8" r="1.4"/>',
  };
  function icone(nome, tam) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', String(tam || 22)); s.setAttribute('height', String(tam || 22)); s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.9');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONES[nome] || ''; // textos fixos do próprio arquivo, nunca dados do cardápio
    return s;
  }
  function avisar(texto) {
    var t = document.getElementById('aviso');
    if (!t) { t = h('div', { id: 'aviso', class: 'aviso-flutuante', role: 'status' }); document.body.appendChild(t); }
    t.textContent = texto; t.classList.add('on');
    clearTimeout(avisar.t); avisar.t = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }

  // ---------- cores vindas da loja ----------
  function rgb(hex) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null; var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function toHex(c) { return '#' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join(''); }
  function mistura(c, alvo, t) { return c.map(function (v, i) { return v + (alvo[i] - v) * t; }); }
  function lum(c) { var a = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
  function aplicarCores(c) {
    var p = rgb(c && c.p), d = rgb(c && c.d), f = rgb(c && c.f);
    var r = document.documentElement.style;
    if (p) { r.setProperty('--p', toHex(p)); r.setProperty('--p-dark', toHex(mistura(p, [0, 0, 0], 0.42))); r.setProperty('--on-p', lum(p) > 0.4 ? '#2b1d17' : '#ffffff'); }
    if (d) { r.setProperty('--d', toHex(mistura(d, [0, 0, 0], 0.15))); r.setProperty('--d-raw', toHex(d)); r.setProperty('--on-d', lum(d) > 0.4 ? '#2b1d17' : '#ffffff'); }
    if (f) { r.setProperty('--f', toHex(f)); r.setProperty('--bg', toHex(mistura(f, [255, 255, 255], 0.65))); }
    var k = rgb(c && c.k); if (k) r.setProperty('--k', toHex(k));
  }

  // ---------- dados ----------
  var mapa = {};
  function item(cat, it) {
    return { chave: it.i ? 'i:' + it.i : cat + '|' + it.n, cat: cat, i: it.i, n: it.n, pk: it.pk, pa: it.pa, s: it.s,
      f: /^data:image\/(jpeg|png|webp);base64,/.test(it.f || '') ? it.f : null,
      u: it.u, ig: it.ig, gl: it.gl, al: it.al, mv: it.mv, j: Array.isArray(it.j) ? it.j : [] };
  }
  function indexar() {
    mapa = {};
    dados.categorias.forEach(function (cat) { cat.itens.forEach(function (it) {
      var x = item(cat.nome, it);
      if (!mapa[x.chave] || DESTAQUES[mapa[x.chave].cat]) mapa[x.chave] = x; // guarda a categoria "de verdade"
    }); });
  }
  function todosItens() { return Object.keys(mapa).map(function (k) { return mapa[k]; }); }
  function itensDoPedido() {
    var out = [];
    Object.keys(carrinho).forEach(function (k) {
      var it = mapa[k];
      if (it) out.push({ chave: k, i: it.i, n: it.n, g: carrinho[k], total: L.precoItem(carrinho[k], it.pk) });
      else delete carrinho[k]; // item que saiu do cardápio
    });
    return out;
  }
  function min() { return (dados.loja && dados.loja.min) || 50; }
  function pesos() {
    var p = Array.isArray(dados.loja.pesos) && dados.loja.pesos.length ? dados.loja.pesos : [50, 100, 250, 500];
    return p.filter(function (g) { return g >= min(); });
  }
  function pesoPadrao(chave) { var ps = pesos(); return ui.peso[chave] || (ps.indexOf(100) >= 0 ? 100 : ps[0] || min()); }
  function entrega() { return dados.loja.entrega || { ativa: true, taxa: 'combinar', valor: 0, retirada: true }; }
  function modos() { var e = entrega(); var m = []; if (e.ativa) m.push('entrega'); if (e.retirada) m.push('retirada'); return m.length ? m : ['entrega']; }
  function pagamentos() {
    var p = dados.loja.pag || { pix: true, cartao: true, dinheiro: true };
    var out = ['pix', 'cartao', 'dinheiro'].filter(function (k) { return p[k]; });
    return out.length ? out : ['pix', 'cartao', 'dinheiro'];
  }
  function taxa() { var e = entrega(); return form.modo === 'entrega' && e.taxa === 'fixa' && e.valor > 0 ? e.valor : 0; }
  function add(chave, g, silencioso) {
    carrinho[chave] = (carrinho[chave] || 0) + g; guardar();
    if (!silencioso) avisar(L.fmtGramas(g) + ' de ' + mapa[chave].n + ' no pedido');
  }

  // ---------- rotas por # ----------
  function rota() {
    var r = (location.hash || '').replace(/^#\/?/, '');
    if (r === 'pedido') return { tela: 'pedido' };
    if (r.indexOf('p/') === 0) return { tela: 'produto', chave: decodeURIComponent(r.slice(2)) };
    if (r.indexOf('c/') === 0) return { tela: 'categoria', idx: Number(r.slice(2)) || 0 };
    return { tela: 'inicio' };
  }
  function ir(r) { location.hash = r ? '#/' + r : ''; }
  var rolagemInicio = 0;
  // guarda a rolagem de cada tela; ao voltar de um produto ou do pedido, volta para onde estava
  var rolagens = {}, hashAnterior = location.hash;
  window.addEventListener('hashchange', function () {
    ui.erro = ''; ui.outro = '';
    var t = document.getElementById('aviso'); if (t) t.classList.remove('on');
    var antes = hashAnterior; hashAnterior = location.hash;
    rolagens[antes] = window.scrollY;
    var veioDe = /#\/(p\/|pedido)/.test(antes);
    var r = rota();
    if (r.tela === 'categoria') { if (/^#?\/?$/.test(antes)) ui.veioDoInicio = true; } else if (r.tela !== 'produto') ui.veioDoInicio = false;
    desenhar();
    window.scrollTo(0, veioDe && r.tela !== 'produto' ? rolagens[location.hash] || 0 : r.tela === 'inicio' && !antes ? 0 : r.tela === 'inicio' ? rolagens[location.hash] || 0 : 0);
  });

  // ---------- montinho de tempero desenhado (a miniatura de quem ainda não tem foto) ----------
  var TONS = [
    [/amendoim/, '#B9824A'],
    [/castanha|caju|amendoa|macadamia|pistache|baru/, '#D8B98C'],
    [/nozes|\bnoz\b|pecan/, '#8A5A30'],
    [/\bmel\b|melado/, '#D9921A'],
    [/molho|tabasco|sriracha/, '#B5201A'],
    [/azeite|oleo/, '#8A8A2A'],
    [/vinagre|shoyu|xarope|melaco/, '#5A2A14'],
    [/chocolate|cacau/, '#4A2A1A'],
    [/passa|ameixa|tamara/, '#4A2030'],
    [/damasco/, '#E08A2A'],
    [/paprica|colorau|urucum|pimenta|chili|calabresa|tomate|goji|hibisco/, '#B5401A'],
    [/curcuma|acafrao|curry|acafr|mostarda/, '#E3A21A'],
    [/lemon|limao/, '#C9B64A'],
    [/oregano|salsa|cebolinha|manjericao|alecrim|tomilho|erva|hortela|louro|chimichurri|cha |cha$|cha\b|camomila|cidreira|boldo|moringa|spirulina|matcha/, '#5E6E2E'],
    [/canela|cominho|cravo|noz|cafe|cacau|granola|amendoim|castanha|linhaca|chia|gergelim|aveia|anis|erva doce|bacon|caldo|defumad/, '#8A4A24'],
    [/beterraba|uva|acai|cranberry/, '#7A2440'],
    [/alho|cebola|sal|gengibre|farinha|coco|banana|batata|fermento|aveia|polvilho|tapioca|arroz/, '#D2B98A'],
  ];
  var PALETA_RESERVA = ['#B5401A', '#E3A21A', '#5E6E2E', '#8A4A24', '#C9853A'];
  function semAcento(t) { return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function tomDe(nome) {
    var n = semAcento(nome);
    for (var i = 0; i < TONS.length; i++) if (TONS[i][0].test(n)) return TONS[i][1];
    var hsh = 0; for (var k = 0; k < n.length; k++) hsh = (hsh * 31 + n.charCodeAt(k)) >>> 0;
    return PALETA_RESERVA[hsh % PALETA_RESERVA.length];
  }
  function misturaHex(hex, alvo, t) {
    var a = parseInt(hex.slice(1), 16), b = parseInt(alvo.slice(1), 16);
    return '#' + [16, 8, 0].map(function (s) { var x = (a >> s) & 255, y = (b >> s) & 255; return Math.round(x + (y - x) * t).toString(16).padStart(2, '0'); }).join('');
  }
  var cacheMonte = {};
  function monteURL(tom, px, fundoFixo) {
    var chave = tom + '|' + px + '|' + (fundoFixo || '');
    if (cacheMonte[chave]) return cacheMonte[chave];
    var c = document.createElement('canvas'); c.width = px; c.height = px;
    var x = c.getContext('2d');
    var fundo = fundoFixo || getComputedStyle(document.documentElement).getPropertyValue('--f').trim() || '#efdfc6';
    x.fillStyle = fundo; x.fillRect(0, 0, px, px);
    var g = x.createRadialGradient(px / 2, px * .55, px * .05, px / 2, px * .55, px * .7);
    g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, px, px);
    var paleta = [tom, misturaHex(tom, '#000000', .25), misturaHex(tom, '#ffffff', .22), misturaHex(tom, '#000000', .1)];
    var seed = 11; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    x.fillStyle = 'rgba(43,29,23,.16)'; x.beginPath(); x.ellipse(px / 2, px * .76, px * .4, px * .085, 0, 0, 6.28); x.fill();
    var n = Math.round(px * px / 28), gr = Math.max(1.2, px / 110);
    for (var i = 0; i < n; i++) {
      var ang = rnd() * Math.PI, rr = Math.sqrt(rnd());
      var cx = px / 2 + Math.cos(ang) * rr * px * .38, cy = px * .74 - Math.sin(ang) * rr * px * .44 * (1 - Math.abs(Math.cos(ang)) * .25);
      x.fillStyle = paleta[Math.floor(rnd() * paleta.length)];
      x.fillRect(cx, cy, gr + rnd() * gr * 1.4, gr + rnd() * gr * 1.4);
    }
    return (cacheMonte[chave] = c.toDataURL('image/png'));
  }

  /** Tigela vista de cima, cheia do tempero (miniatura de produto e de categoria). */
  var cacheTigela = {};
  function tigelaURL(tom, px, fundoFixo) {
    var chave = tom + '|' + px + '|' + (fundoFixo || '');
    if (cacheTigela[chave]) return cacheTigela[chave];
    var c = document.createElement('canvas'); c.width = px; c.height = px;
    var x = c.getContext('2d');
    if (fundoFixo !== 'transparente') {
      x.fillStyle = fundoFixo || getComputedStyle(document.documentElement).getPropertyValue('--f').trim() || '#efdfc6';
      x.fillRect(0, 0, px, px);
    }
    var cx = px / 2, cy = px / 2, R = px * .42;
    // sombra
    x.fillStyle = 'rgba(43,29,23,.22)'; x.beginPath(); x.ellipse(cx + px * .02, cy + px * .04, R * 1.02, R * 1.0, 0, 0, 6.28); x.fill();
    // tigela de barro
    var gb = x.createRadialGradient(cx - R * .3, cy - R * .35, R * .2, cx, cy, R * 1.05);
    gb.addColorStop(0, '#f3e6d2'); gb.addColorStop(.75, '#d9c3a3'); gb.addColorStop(1, '#a98a66');
    x.fillStyle = gb; x.beginPath(); x.arc(cx, cy, R, 0, 6.28); x.fill();
    // tempero dentro
    var r2 = R * .8;
    x.save(); x.beginPath(); x.arc(cx, cy + R * .03, r2, 0, 6.28); x.clip();
    x.fillStyle = misturaHex(tom, '#000000', .2); x.fillRect(0, 0, px, px);
    var pal = [tom, misturaHex(tom, '#000000', .3), misturaHex(tom, '#ffffff', .25), misturaHex(tom, '#000000', .12)];
    var seed = 5; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    var n = Math.round(px * px / 9), gr = Math.max(1.3, px / 90);
    for (var i = 0; i < n; i++) { x.fillStyle = pal[Math.floor(rnd() * 4)]; x.fillRect(cx - r2 + rnd() * r2 * 2, cy - r2 + rnd() * r2 * 2, gr + rnd() * gr, gr + rnd() * gr); }
    var luz = x.createRadialGradient(cx - r2 * .35, cy - r2 * .4, 0, cx - r2 * .35, cy - r2 * .4, r2 * 1.2);
    luz.addColorStop(0, 'rgba(255,255,255,.28)'); luz.addColorStop(1, 'rgba(0,0,0,.18)');
    x.fillStyle = luz; x.fillRect(0, 0, px, px);
    x.restore();
    // borda interna
    x.strokeStyle = 'rgba(120,90,60,.35)'; x.lineWidth = Math.max(1, px / 120); x.beginPath(); x.arc(cx, cy + R * .03, r2, 0, 6.28); x.stroke();
    return (cacheTigela[chave] = c.toDataURL('image/png'));
  }

  /** Tigela de madeira em 3/4 com o tempero amontoado (desenho realista, sem foto). */
  var cachePote = {};
  function poteURL(tom, px, fundoFixo, tipo) {
    var chave = tom + '|' + px + '|' + (fundoFixo || '') + '|' + (tipo || '');
    if (cachePote[chave]) return cachePote[chave];
    var c = document.createElement('canvas'); c.width = px; c.height = px;
    var x = c.getContext('2d');
    if (fundoFixo !== 'transparente') {
      x.fillStyle = fundoFixo || getComputedStyle(document.documentElement).getPropertyValue('--f').trim() || '#efdfc6';
      x.fillRect(0, 0, px, px);
    }
    function mh(a, b, t) { var p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16); return '#' + [16, 8, 0].map(function (s) { var u = (p >> s) & 255, v = (q >> s) & 255; return Math.round(u + (v - u) * t).toString(16).padStart(2, '0'); }).join(''); }
    var seed = 7; function r() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    if (tipo === 'mel' || tipo === 'molho' || tipo === 'garrafa') return (cachePote[chave] = frasco(c, x, tom, px, tipo, mh));
    var cx = px / 2, topo = px * 0.50, rx = px * 0.40, ry = rx * 0.30, fundoY = px * 0.86;
    // sombra no balcão
    var sg = x.createRadialGradient(cx, fundoY, 0, cx, fundoY, rx * 1.15);
    sg.addColorStop(0, 'rgba(40,25,15,.38)'); sg.addColorStop(1, 'rgba(40,25,15,0)');
    x.fillStyle = sg; x.beginPath(); x.ellipse(cx, fundoY + px * .01, rx * 1.15, ry * 0.75, 0, 0, 6.28); x.fill();
    // corpo da tigela (madeira)
    function corpo() { x.beginPath(); x.moveTo(cx - rx, topo); x.bezierCurveTo(cx - rx, topo + (fundoY - topo) * 0.95, cx - rx * 0.45, fundoY, cx, fundoY); x.bezierCurveTo(cx + rx * 0.45, fundoY, cx + rx, topo + (fundoY - topo) * 0.95, cx + rx, topo); x.ellipse(cx, topo, rx, ry, 0, 0, Math.PI, false); x.closePath(); }
    var madeira = x.createLinearGradient(cx - rx, 0, cx + rx, 0);
    madeira.addColorStop(0, '#5a3418'); madeira.addColorStop(.28, '#9a6334'); madeira.addColorStop(.5, '#b47a44'); madeira.addColorStop(.75, '#8a5528'); madeira.addColorStop(1, '#4a2a12');
    x.fillStyle = madeira; corpo(); x.fill();
    // veios da madeira
    x.save(); corpo(); x.clip();
    for (var v = 0; v < 26; v++) {
      var yy = topo + r() * (fundoY - topo); x.strokeStyle = 'rgba(60,30,10,' + (0.08 + r() * 0.12) + ')'; x.lineWidth = Math.max(.6, px / 300 + r() * px / 260);
      x.beginPath(); x.moveTo(cx - rx, yy); x.bezierCurveTo(cx - rx * .3, yy + (r() - .5) * px * .06, cx + rx * .3, yy + (r() - .5) * px * .06, cx + rx, yy + (r() - .5) * px * .03); x.stroke();
    }
    var brilho = x.createLinearGradient(0, topo, 0, fundoY);
    brilho.addColorStop(0, 'rgba(255,230,200,.18)'); brilho.addColorStop(.5, 'rgba(255,230,200,0)'); brilho.addColorStop(1, 'rgba(0,0,0,.25)');
    x.fillStyle = brilho; x.fillRect(0, 0, px, px);
    x.restore();
    // borda (aro)
    x.fillStyle = '#c48b52'; x.beginPath(); x.ellipse(cx, topo, rx, ry, 0, 0, 6.28); x.fill();
    var irx = rx * 0.9, iry = ry * 0.82;
    x.fillStyle = '#3d2210'; x.beginPath(); x.ellipse(cx, topo + ry * 0.04, irx, iry, 0, 0, 6.28); x.fill();
    // montinho do tempero
    var pico = topo - ry - px * (tipo === 'graos' ? 0.10 : 0.14);
    function monte() { x.beginPath(); x.moveTo(cx - irx, topo + ry * .04); x.bezierCurveTo(cx - irx * .7, topo - ry * .9, cx - irx * .35, pico, cx, pico); x.bezierCurveTo(cx + irx * .35, pico, cx + irx * .7, topo - ry * .9, cx + irx, topo + ry * .04); x.ellipse(cx, topo + ry * .04, irx, iry, 0, 0, Math.PI, false); x.closePath(); }
    var base = x.createRadialGradient(cx - irx * .35, pico + (topo - pico) * .3, px * .02, cx, topo, irx * 1.2);
    base.addColorStop(0, mh(tom, '#ffffff', .28)); base.addColorStop(.55, tom); base.addColorStop(1, mh(tom, '#000000', .38));
    x.fillStyle = base; monte(); x.fill();
    x.save(); monte(); x.clip();
    var pal = [tom, mh(tom, '#000000', .25), mh(tom, '#ffffff', .2), mh(tom, '#000000', .45), mh(tom, '#ffffff', .4)];
    var forma = { castanha: 22, amendoim: 30, folhas: 30, doce: 30, fruta: 26 }[tipo];
    if (forma) {
      // peças grandes, de trás para a frente
      var sz = px / forma, pecas = [];
      var qtd = Math.round((irx * 2 * (topo + iry - pico)) / (sz * sz * (tipo === 'castanha' ? 1.6 : 1.9)));
      for (var q = 0; q < qtd; q++) pecas.push([cx - irx + r() * irx * 2, pico + sz * .4 + r() * (topo + iry - pico), r() * 6.28, .8 + r() * .45, Math.floor(r() * pal.length)]);
      pecas.sort(function (a, b) { return a[1] - b[1]; });
      var doces = [tom, mh(tom, '#ffffff', .3), '#C0392B', '#E8B04A', '#6E8B3D', '#8E4A7A'];
      pecas.forEach(function (pc) {
        var gx = pc[0], gy = pc[1], ang = pc[2], k = pc[3] * sz, cor = pal[pc[4]];
        x.save(); x.translate(gx, gy); x.rotate(ang);
        if (tipo === 'castanha') {
          x.lineCap = 'round'; x.lineWidth = k * .7; x.strokeStyle = mh(cor, '#000000', .25); x.beginPath(); x.arc(0, 0, k, .3, 2.9); x.stroke();
          x.lineWidth = k * .55; x.strokeStyle = mh(tom, '#ffffff', .15 + (pc[4] % 3) * .08); x.beginPath(); x.arc(0, 0, k, .35, 2.85); x.stroke();
          x.lineWidth = k * .14; x.strokeStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(0, -k * .08, k * 1.05, .7, 2.3); x.stroke();
        } else if (tipo === 'amendoim') {
          x.fillStyle = mh(cor, '#000000', .2); x.beginPath(); x.arc(-k * .45, 0, k * .62, 0, 6.28); x.arc(k * .45, 0, k * .58, 0, 6.28); x.fill();
          x.fillStyle = cor; x.beginPath(); x.arc(-k * .45, -k * .05, k * .52, 0, 6.28); x.arc(k * .45, -k * .05, k * .48, 0, 6.28); x.fill();
          x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.arc(-k * .6, -k * .25, k * .16, 0, 6.28); x.fill();
        } else if (tipo === 'folhas') {
          x.fillStyle = mh(cor, '#000000', .1); x.beginPath(); x.ellipse(0, 0, k * 1.1, k * .42, 0, 0, 6.28); x.fill();
          x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = Math.max(.6, k * .08); x.beginPath(); x.moveTo(-k, 0); x.lineTo(k, 0); x.stroke();
        } else {
          var cd = tipo === 'fruta' ? cor : doces[pc[4] % doces.length]; x.fillStyle = mh(cd, '#000000', .25); x.beginPath(); x.arc(0, k * .08, k * .62, 0, 6.28); x.fill();
          x.fillStyle = cd; x.beginPath(); x.arc(0, 0, k * .58, 0, 6.28); x.fill();
          x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(-k * .2, -k * .22, k * .16, 0, 6.28); x.fill();
        }
        x.restore();
      });
    } else {
      var n = Math.round(px * px / (tipo === 'graos' ? 14 : 6)), gr = Math.max(.7, px / (tipo === 'graos' ? 110 : 260));
      for (var i = 0; i < n; i++) {
        var gx2 = cx - irx + r() * irx * 2, gy2 = pico + r() * (topo + iry - pico);
        x.globalAlpha = .55 + r() * .45; x.fillStyle = pal[Math.floor(r() * pal.length)];
        if (tipo === 'graos') { x.beginPath(); x.ellipse(gx2, gy2, gr * (1 + r()), gr * .6, r() * 3, 0, 6.28); x.fill(); }
        else x.fillRect(gx2, gy2, gr * (1 + r()), gr * (1 + r()));
      }
    }
    x.globalAlpha = 1;
    var sombraMonte = x.createLinearGradient(cx - irx, 0, cx + irx, 0);
    sombraMonte.addColorStop(0, 'rgba(255,255,255,.10)'); sombraMonte.addColorStop(.6, 'rgba(0,0,0,0)'); sombraMonte.addColorStop(1, 'rgba(0,0,0,.28)');
    x.fillStyle = sombraMonte; x.fillRect(0, 0, px, px);
    x.restore();
    // borda da frente por cima do montinho
    x.strokeStyle = 'rgba(205,150,95,.9)'; x.lineWidth = Math.max(1, px / 70); x.beginPath(); x.ellipse(cx, topo, rx * .985, ry * .95, 0, 0.08, Math.PI - 0.08); x.stroke();
    // grãos soltos no balcão
    for (var k = 0; k < Math.round(px / 14); k++) { var a = r() * 6.28, d = rx * (1.02 + r() * .25); x.fillStyle = pal[Math.floor(r() * 3)]; x.beginPath(); x.arc(cx + Math.cos(a) * d, fundoY - px * .02 + Math.sin(a) * ry * .55, Math.max(.8, px / 220) * (1 + r()), 0, 6.28); x.fill(); }
    return (cachePote[chave] = c.toDataURL('image/png'));
  }

  /** Frasco de molho, pote de mel ou garrafa (vidro com o líquido na cor do produto). */
  function frasco(c, x, tom, px, tipo, mh) {
    var cx = px / 2, base = px * .88;
    var sg = x.createRadialGradient(cx, base, 0, cx, base, px * .32);
    sg.addColorStop(0, 'rgba(40,25,15,.35)'); sg.addColorStop(1, 'rgba(40,25,15,0)');
    x.fillStyle = sg; x.beginPath(); x.ellipse(cx, base, px * .32, px * .05, 0, 0, 6.28); x.fill();
    function rr(x0, y0, w, h, rad) { x.beginPath(); x.roundRect(x0, y0, w, h, rad); }
    var liquido = x.createLinearGradient(cx - px * .3, 0, cx + px * .3, 0);
    liquido.addColorStop(0, mh(tom, '#000000', .35)); liquido.addColorStop(.35, mh(tom, '#ffffff', .18)); liquido.addColorStop(.6, tom); liquido.addColorStop(1, mh(tom, '#000000', .45));
    if (tipo === 'mel') {
      var w = px * .5, t = px * .34;
      x.fillStyle = 'rgba(255,255,255,.35)'; rr(cx - w / 2, t, w, base - t, px * .07); x.fill();
      x.fillStyle = liquido; rr(cx - w / 2 + px * .015, t + px * .05, w - px * .03, base - t - px * .065, px * .06); x.fill();
      // favo no rótulo
      x.fillStyle = '#F4E3C3'; rr(cx - w * .36, t + (base - t) * .38, w * .72, (base - t) * .34, px * .02); x.fill();
      x.strokeStyle = mh(tom, '#000000', .3); x.lineWidth = Math.max(1, px / 160);
      for (var hx = -1; hx <= 1; hx++) { var hcx = cx + hx * w * .17, hcy = t + (base - t) * .55, hr = w * .085; x.beginPath(); for (var a = 0; a < 6; a++) { var aa = Math.PI / 3 * a + Math.PI / 6; x.lineTo(hcx + Math.cos(aa) * hr, hcy + Math.sin(aa) * hr); } x.closePath(); x.stroke(); }
      // tampa de tecido e laço
      x.fillStyle = '#B5793A'; rr(cx - w * .55, t - px * .07, w * 1.1, px * .09, px * .03); x.fill();
      x.fillStyle = '#E9D2A6'; for (var d = 0; d < 7; d++) { x.beginPath(); x.arc(cx - w * .45 + d * w * .15, t - px * .025, px * .012, 0, 6.28); x.fill(); }
      // colher de mel
      x.save(); x.translate(cx + w * .38, t - px * .02); x.rotate(.5);
      x.fillStyle = '#8A5528'; x.fillRect(-px * .012, -px * .26, px * .024, px * .26);
      x.fillStyle = '#A86A3A'; for (var g = 0; g < 4; g++) { x.beginPath(); x.ellipse(0, -px * .27 - g * px * .025, px * .04 - g * px * .004, px * .012, 0, 0, 6.28); x.fill(); }
      x.restore();
      x.fillStyle = 'rgba(255,255,255,.4)'; rr(cx - w / 2 + px * .04, t + px * .07, px * .03, (base - t) * .7, px * .015); x.fill();
    } else {
      var garrafa = tipo === 'garrafa';
      var bw = px * (garrafa ? .24 : .3), topoCorpo = px * (garrafa ? .36 : .4), pesc = px * (garrafa ? .07 : .09), alturaPesc = px * (garrafa ? .14 : .1);
      // corpo e gargalo de vidro
      x.fillStyle = 'rgba(255,255,255,.3)'; rr(cx - bw / 2, topoCorpo, bw, base - topoCorpo, px * .05); x.fill();
      x.fillStyle = liquido; rr(cx - bw / 2 + px * .012, topoCorpo + px * .02, bw - px * .024, base - topoCorpo - px * .032, px * .045); x.fill();
      x.fillStyle = mh(tom, '#000000', .25); x.fillRect(cx - pesc / 2, topoCorpo - alturaPesc, pesc, alturaPesc + px * .02);
      // tampa
      x.fillStyle = garrafa ? '#2B2B2B' : '#F2EDE4'; rr(cx - pesc * .75, topoCorpo - alturaPesc - px * .07, pesc * 1.5, px * .08, px * .015); x.fill();
      if (!garrafa) { x.fillStyle = '#C0392B'; rr(cx - pesc * .75, topoCorpo - alturaPesc - px * .03, pesc * 1.5, px * .03, px * .01); x.fill(); }
      // rótulo
      var ly = topoCorpo + (base - topoCorpo) * .28, lh = (base - topoCorpo) * .42;
      x.fillStyle = '#F4E8D3'; x.fillRect(cx - bw / 2 + px * .012, ly, bw - px * .024, lh);
      x.fillStyle = mh(tom, '#000000', .1);
      if (!garrafa) { x.save(); x.translate(cx, ly + lh * .55); x.rotate(-.5); x.beginPath(); x.ellipse(0, 0, bw * .26, bw * .08, 0, 0, 6.28); x.fill(); x.fillStyle = '#4E7A2E'; x.fillRect(bw * .22, -bw * .03, bw * .1, bw * .06); x.restore(); }
      else { x.beginPath(); x.ellipse(cx, ly + lh * .55, bw * .14, bw * .2, 0, 0, 6.28); x.fill(); }
      x.fillStyle = mh(tom, '#000000', .3); x.fillRect(cx - bw * .3, ly + lh * .14, bw * .6, Math.max(1, lh * .07));
      // brilho do vidro
      x.fillStyle = 'rgba(255,255,255,.45)'; rr(cx - bw / 2 + px * .025, topoCorpo + px * .04, px * .022, (base - topoCorpo) * .75, px * .01); x.fill();
    }
    return c.toDataURL('image/png');
  }

  /** Como desenhar cada produto: frasco, pote de mel, garrafa, castanhas, amendoins, folhas, doces, grãos ou pó. */
  // O nome principal manda: "Amendoim mel e mostarda" é amendoim (sabor), "Mel com limão" e "Pimenta com mel" são mel.
  var SOLIDOS = [
    [/amendoim/, 'amendoim'],
    [/castanha|caju|nozes|\bnoz\b|amendoa|macadamia|pistache|pecan|baru|avela/, 'castanha'],
    [/granola|chia|linhaca|gergelim|semente|\bgraos?\b|quinoa|aveia|girassol|abobora|mix de/, 'graos'],
  ];
  var LIQUIDOS = [
    [/\bmel\b|melado/, 'mel'],
    [/molho|pimenta liquida|tabasco|sriracha/, 'molho'],
    [/azeite|oleo|vinagre|extrato|essencia|xarope|shoyu|melaco/, 'garrafa'],
  ];
  var OUTROS = [
    [/passa|damasco|tamara|cranberry|goji|banana desidratada|fruta desidratada|ameixa/, 'fruta'],
    [/doce|bala|confeito|goma|jujuba|chocolate|drageado|chips|coco queimado|cocada|pacoca/, 'doce'],
    [/\bcha\b|cha |hortela|camomila|boldo|cidreira|capim|folha|louro|oregano|alecrim|manjericao|salsa|cebolinha|chimichurri|tomilho|\bervas?\b|hibisco|melissa|carqueja|espinheira/, 'folhas'],
    [/cravo|erva doce|anis|coentro|mostarda em grao|pimenta do reino em grao/, 'graos'],
  ];
  /** Categoria de castanhas, sementes, amêndoas, grãos ou petiscos nunca vira pote nem frasco. */
  var CAT_SOLIDA = /castanha|semente|amendoa|amendoim|grao|graos|oleaginosa|nuts|petisco|granola|cereais|cereal|frutas secas/;
  function procura(lista, n) { for (var i = 0; i < lista.length; i++) if (lista[i][0].test(n)) return lista[i][1]; return ''; }
  function tipoDe(nome, cat) {
    var n = semAcento(nome), solidaCat = CAT_SOLIDA.test(semAcento(cat || ''));
    var t = procura(SOLIDOS, n);
    if (t) return t;
    if (!solidaCat) { t = procura(LIQUIDOS, n); if (t) return t; }
    t = procura(OUTROS, n);
    if (t) return t;
    if (solidaCat) return /amendoa|castanha/.test(semAcento(cat)) ? 'castanha' : /amendoim/.test(semAcento(cat)) ? 'amendoim' : 'graos';
    return '';
  }
  function tomPara(it) {
    // numa categoria sólida, o mel do nome não pinta o produto de mel
    if (CAT_SOLIDA.test(semAcento(it.cat || '')) && !procura(SOLIDOS, semAcento(it.n))) {
      var t = tipoDe(it.n, it.cat);
      if (t === 'castanha') return '#D8B98C';
      if (t === 'amendoim') return '#B9824A';
    }
    return tomDe(it.n);
  }
  // ---------- peças ----------
  function foto(it, cls, grande) {
    if (it.f) return h('img', { class: cls, src: it.f, alt: '', loading: 'lazy' });
    return h('img', { class: cls + ' monte', src: poteURL(tomPara(it), grande ? 480 : 200, null, tipoDe(it.n, it.cat)), alt: '' });
  }
  function por100(pk) { return L.brl(Math.round(pk / 10)); }
  function precoBloco(it) {
    return h('span', { class: 'preco' + (it.pa ? ' promo' : '') }, h('b', { text: por100(it.pk) }), it.pa ? h('s', { text: por100(it.pa) }) : null, h('small', { text: '/ 100 g' }));
  }
  function botaoLink(icon, texto, href) {
    var a = h('a', { class: 'acao', href: href, target: '_blank', rel: 'noopener noreferrer' }, icone(icon, 20), h('span', { text: texto }));
    if (/^tel:/i.test(href)) { a.removeAttribute('target'); a.removeAttribute('rel'); }
    return a;
  }
  function acoes() {
    var lj = dados.loja;
    var nav = h('nav', { class: 'acoes', 'aria-label': 'Fale com a loja' });
    var tem = {};
    (Array.isArray(lj.botoes) ? lj.botoes : []).forEach(function (b) {
      if (!b || b.t === 'cardapio' || typeof b.u !== 'string' || !/^(https?:|tel:)/i.test(b.u)) return;
      tem[b.t] = 1;
      nav.appendChild(botaoLink(ICONES[b.t] ? b.t : 'site', b.r, b.u));
    });
    if (!tem.whatsapp && lj.whatsapp) nav.insertBefore(botaoLink('whatsapp', 'WhatsApp', L.urlWhatsapp(lj.whatsapp, 'Olá, ' + lj.nome + '! Vim pelo cardápio.')), nav.firstChild);
    if (!tem.instagram && lj.instagram) nav.appendChild(botaoLink('instagram', 'Instagram', lj.instagram));
    if (!tem.maps && lj.endereco) nav.appendChild(botaoLink('maps', 'Como chegar', 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lj.endereco)));
    return nav.childNodes.length ? nav : null;
  }
  function linhaEntrega() {
    var e = entrega(); var p = [];
    if (e.retirada) p.push(h('span', null, icone('loja', 16), 'Retirada na loja'));
    if (e.ativa) p.push(h('span', null, icone('moto', 16), e.taxa === 'fixa' && e.valor > 0 ? 'Entrega · ' + L.brl(e.valor) : 'Entrega · taxa a combinar'));
    return p.length ? h('p', { class: 'entrega-info' }, p[0], p[1] || null) : null;
  }

  // ---------- tela inicial ----------
  function telaInicio() {
    var lj = dados.loja;
    var st = L.statusHorario(lj.horarios, new Date());
    var logo = h('img', { class: 'logo', src: lj.logo || '../logo.jpg', alt: 'Logomarca de ' + lj.nome });
    logo.addEventListener('error', function () { logo.style.display = 'none'; });
    var graosCv = h('canvas', { class: 'capa-graos', 'aria-hidden': 'true' });
    var capa = h('header', { class: 'capa' }, graosCv,
      h('div', { class: 'capa-in' }, logo,
        h('div', null, h('h1', { text: lj.nome }), lj.slogan ? h('p', { class: 'slogan', text: lj.slogan }) : null,
          st ? h('span', { class: 'status' + (st.aberto ? ' aberto' : '') }, h('i'), st.texto) : null)));

    var busca = h('input', { class: 'busca', type: 'search', placeholder: 'Buscar tempero, mix ou kit…', value: ui.busca, id: 'busca', autocomplete: 'off', enterkeyhint: 'search' });
    busca.addEventListener('input', function () { ui.busca = busca.value; desenharConteudo(); });
    return h('div', { class: 'wrap' }, capa, acoes(), linhaEntrega(),
      h('div', { class: 'gruda' }, h('div', { class: 'busca-caixa' }, icone('busca', 18), h('label', { class: 'sr', for: 'busca', text: 'Buscar produto' }), busca)),
      h('main', { id: 'conteudo' }),
      h('footer', { class: 'rodape' }, h('strong', { text: lj.nome }), lj.endereco ? h('span', { text: lj.endereco }) : null, horariosTexto()));
  }

  function horariosTexto() {
    var hs = dados.loja.horarios; if (!Array.isArray(hs) || hs.length !== 7) return null;
    var dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    var ul = h('ul', { class: 'horarios' });
    [1, 2, 3, 4, 5, 6, 0].forEach(function (d) {
      ul.appendChild(h('li', null, h('span', { text: dias[d] }), h('span', { text: hs[d] ? L.fmtHora(hs[d][0]) + ' às ' + L.fmtHora(hs[d][1]) : 'Fechado' })));
    });
    return ul;
  }

  function cartao(it) {
    var g = pesoPadrao(it.chave);
    return h('div', { class: 'cartao' },
      h('a', { class: 'cartao-link', href: '#/p/' + encodeURIComponent(it.chave) },
        h('span', { class: 'cartao-foto' }, foto(it, 'img'), it.s ? h('em', { class: 'selo', text: it.s }) : it.mv ? h('em', { class: 'selo d', text: '🔥 Mais vendido' }) : null),
        h('strong', { class: 'cartao-nome', text: it.n })),
      h('div', { class: 'cartao-pe' }, precoBloco(it),
        h('button', { class: 'mais mini', type: 'button', 'aria-label': 'Adicionar ' + L.fmtGramas(g) + ' de ' + it.n, onclick: function () { add(it.chave, g); if (rota().tela === 'inicio') desenharConteudo(true); desenharBarra(); } }, icone('mais', 18))));
  }

  // banner que passa sozinho: ofertas e mixes
  var animBanner = 0;
  function banner() {
    var slides = [];
    var ofertas = dados.categorias.filter(function (c) { return c.nome === 'Ofertas'; })[0];
    (ofertas ? ofertas.itens : []).slice(0, 3).forEach(function (it) {
      var x = mapa[item('Ofertas', it).chave] || item('Ofertas', it);
      slides.push({ selo: x.s || 'Oferta', titulo: x.n, linha: por100(x.pk) + ' / 100 g' + (x.pa ? ' · antes ' + por100(x.pa) : ''), tom: tomPara(x), img: x.f || poteURL(tomPara(x), 300, 'transparente', tipoDe(x.n, x.cat)), href: '#/p/' + encodeURIComponent(x.chave), bt: 'Quero' });
    });
    (dados.mixes || []).slice(0, 2).forEach(function (m, i) {
      var its = m.i.map(function (id) { return mapa['i:' + id]; }).filter(Boolean); if (its.length < 2) return;
      var tot = 0; its.forEach(function (y) { tot += L.precoItem(m.g, y.pk); });
      slides.push({ selo: 'Mix pronto', titulo: m.n, linha: its.length + ' temperos · ' + L.brl(tot), tom: tomPara(its[0]), img: poteURL(tomPara(its[0]), 300, 'transparente', tipoDe(its[0].n, its[0].cat)), mix: m, bt: 'Levar o mix' });
    });
    if (!slides.length) {
      slides.push({ selo: 'Pesado na hora', titulo: dados.loja.slogan || 'Temperos fresquinhos', linha: 'Escolha a quantidade que precisa', tom: getComputedStyle(document.documentElement).getPropertyValue('--p').trim() || '#b03818', img: poteURL('#B5401A', 300, 'transparente'), href: '#categorias', bt: 'Ver categorias' });
    }
    var trilho = h('div', { class: 'banner-trilho' });
    var pontos = h('div', { class: 'banner-pontos', 'aria-hidden': 'true' });
    slides.forEach(function (sl, i) {
      var bt = sl.mix
        ? h('button', { class: 'banner-bt', type: 'button', onclick: function () { var its = sl.mix.i.map(function (id) { return mapa['i:' + id]; }).filter(Boolean); its.forEach(function (y) { add(y.chave, sl.mix.g, true); }); avisar(sl.mix.n + ' no pedido'); desenharConteudo(true); desenharBarra(); } }, sl.bt, ' →')
        : h('a', { class: 'banner-bt', href: sl.href }, sl.bt, ' →');
      trilho.appendChild(h('div', { class: 'banner-slide', style: '--tom:' + sl.tom },
        h('div', { class: 'banner-tx' }, h('em', { text: sl.selo }), h('strong', { text: sl.titulo }), h('span', { text: sl.linha }), bt),
        h('img', { class: 'banner-img', src: sl.img, alt: '' })));
      pontos.appendChild(h('i', { class: i ? '' : 'on' }));
    });
    trilho.addEventListener('scroll', function () {
      var i = Math.round(trilho.scrollLeft / Math.max(1, trilho.clientWidth));
      Array.prototype.forEach.call(pontos.children, function (p, k) { p.className = k === i ? 'on' : ''; });
    }, { passive: true });
    clearInterval(animBanner);
    var reduzir = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (slides.length > 1 && !reduzir) {
      var parado = false;
      trilho.addEventListener('touchstart', function () { parado = true; }, { passive: true });
      animBanner = setInterval(function () {
        if (parado || !trilho.isConnected) return;
        var i = Math.round(trilho.scrollLeft / trilho.clientWidth);
        trilho.scrollTo({ left: ((i + 1) % slides.length) * trilho.clientWidth, behavior: 'smooth' });
      }, 5000);
    }
    return h('section', { class: 'banner' }, trilho, slides.length > 1 ? pontos : null);
  }

  // categorias em tigelas redondas, deslizando para o lado
  function rodaCategorias() {
    var nav = h('nav', { class: 'roda', 'aria-label': 'Categorias', id: 'categorias' });
    categoriasReais().forEach(function (x) {
      var tom = tomCategoria(x.c);
      nav.appendChild(h('a', { class: 'roda-it', href: '#/c/' + x.idx },
        h('img', { src: poteURL(tom, 160, '#ffffff', tipoCategoria(x.c)), alt: '' }),
        h('span', { text: x.c.nome })));
    });
    return nav;
  }

  function linha(it) {
    var g = carrinho[it.chave];
    var escolhido = pesoPadrao(it.chave);
    var pesosEl = h('div', { class: 'pesos', role: 'radiogroup', 'aria-label': 'Quantidade de ' + it.n });
    pesos().forEach(function (p) {
      pesosEl.appendChild(h('button', { type: 'button', role: 'radio', 'aria-checked': p === escolhido ? 'true' : 'false', class: 'peso' + (p === escolhido ? ' on' : ''),
        onclick: function () { ui.peso[it.chave] = p; refazer(); } }, L.fmtGramas(p)));
    });
    // outra quantidade: abre o produto, que tem o campo para digitar as gramas
    pesosEl.appendChild(h('a', { class: 'peso peso-outro', href: '#/p/' + encodeURIComponent(it.chave), 'aria-label': 'Outra quantidade de ' + it.n }, 'Outro'));
    // redesenha só esta linha (funciona no início, na categoria e na busca)
    function refazer() {
      var novo = linha(it);
      if (li.parentNode) li.parentNode.replaceChild(novo, li);
      var b = novo.querySelector('.peso.on'); if (b) b.focus();
    }
    var li = h('li', { class: 'linha' + (g ? ' no-pedido' : '') },
      h('a', { class: 'linha-foto', href: '#/p/' + encodeURIComponent(it.chave), 'aria-label': 'Ver ' + it.n }, foto(it, 'img')),
      h('div', { class: 'linha-meio' },
        h('a', { class: 'linha-nome', href: '#/p/' + encodeURIComponent(it.chave) }, it.n, it.s ? h('em', { class: 'selo', text: it.s }) : null),
        it.u ? h('span', { class: 'linha-uso', text: it.u }) : null,
        g ? h('span', { class: 'no-ped' }, icone('check', 14), L.fmtGramas(g) + ' no pedido') : null),
      h('div', { class: 'linha-dir' }, h('span', { class: 'linha-preco' + (it.pa ? ' promo' : '') }, h('b', { text: L.brl(L.precoItem(escolhido, it.pk)) }), h('small', { text: L.fmtGramas(escolhido) })),
        h('button', { class: 'mais', type: 'button', 'aria-label': 'Adicionar ' + L.fmtGramas(escolhido) + ' de ' + it.n, onclick: function () { add(it.chave, escolhido); refazer(); desenharBarra(); } }, icone('mais', 22))),
      pesosEl);
    return li;
  }

  function mixCard(m) {
    var its = m.i.map(function (id) { return mapa['i:' + id]; }).filter(Boolean);
    if (its.length < 2) return null;
    var total = 0; its.forEach(function (x) { total += L.precoItem(m.g, x.pk); });
    return h('article', { class: 'mix' },
      h('div', { class: 'mix-fotos', 'aria-hidden': 'true' }, its.slice(0, 4).map(function (x) { return foto(x, 'img'); }).reduce(function (f, el) { f.appendChild(el); return f; }, document.createDocumentFragment())),
      h('div', { class: 'mix-tx' },
        h('h3', { text: m.n }), h('p', { text: m.d }),
        h('p', { class: 'mix-itens', text: its.map(function (x) { return x.n; }).join(' · ') + ' · ' + L.fmtGramas(m.g) + ' cada' }),
        h('button', { class: 'mix-bt', type: 'button', onclick: function () { its.forEach(function (x) { add(x.chave, m.g, true); }); avisar(m.n + ' no pedido'); desenharConteudo(true); desenharBarra(); } }, 'Levar o mix · ' + L.brl(total))));
  }

  function desenharConteudo(manter) {
    var main = document.getElementById('conteudo'); if (!main) return;
    var y = window.scrollY;
    main.textContent = '';
    var semAcento = function (t) { return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
    var q = semAcento(ui.busca.trim());
    if (q) {
      var achou = todosItens().filter(function (i) { return semAcento(i.n).indexOf(q) >= 0 || semAcento(i.cat).indexOf(q) >= 0; });
      var ul = h('ul', { class: 'lista' });
      achou.forEach(function (i) { ul.appendChild(linha(i)); });
      main.appendChild(h('section', { class: 'secao' }, h('h2', { text: achou.length ? 'Resultados' : 'Nada encontrado' }),
        achou.length ? ul : h('p', { class: 'vazio', text: 'Tente outro nome ou fale com a gente no WhatsApp.' })));
    } else {
      main.appendChild(banner());
      main.appendChild(h('section', { class: 'secao secao-roda' }, h('h2', { class: 'secao-cab' }, 'Categorias'), rodaCategorias()));
      var titulos = { 'Mais vendidos': 'Mais pedidos', 'Ofertas': 'Ofertas da semana', 'Chegou agora': 'Chegou agora' };
      ['Mais vendidos', 'Ofertas', 'Chegou agora'].forEach(function (nome) {
        dados.categorias.forEach(function (c, idx) {
          if (c.nome !== nome || !c.itens.length) return;
          var trilho = h('div', { class: 'trilho' });
          c.itens.forEach(function (it) { trilho.appendChild(cartao(mapa[item(c.nome, it).chave] || item(c.nome, it))); });
          main.appendChild(h('section', { class: 'secao', id: 'cat-' + idx }, h('h2', { class: 'secao-cab' }, titulos[nome]), trilho));
        });
      });
      if (dados.mixes && dados.mixes.length) {
        var box = h('div', { class: 'mixes' });
        dados.mixes.forEach(function (m) { var el = mixCard(m); if (el) box.appendChild(el); });
        if (box.childNodes.length) main.appendChild(h('section', { class: 'secao', id: 'mixes' }, h('h2', { class: 'secao-cab' }, 'Mixes prontos'), h('p', { class: 'secao-sub', text: 'Os temperos da receita de uma vez só.' }), box));
      }
      if (!dados.categorias.length) main.appendChild(h('p', { class: 'vazio', text: 'O cardápio está sem produtos no momento.' }));
    }
    if (manter) window.scrollTo(0, y);
  }

  // ---------- categoria (tela própria, pintada na cor dela) ----------
  function categoriasReais() {
    var out = [];
    dados.categorias.forEach(function (c, idx) { if (!DESTAQUES[c.nome] && c.itens.length) out.push({ c: c, idx: idx }); });
    return out;
  }
  function tomCategoria(c) {
    var conta = {};
    c.itens.forEach(function (it) { var t = tomPara({ n: it.n, cat: c.nome }); conta[t] = (conta[t] || 0) + 1; });
    var melhor = null; Object.keys(conta).forEach(function (t) { if (!melhor || conta[t] > conta[melhor]) melhor = t; });
    return melhor || tomDe(c.nome);
  }
  function tipoCategoria(c) {
    var conta = {};
    c.itens.forEach(function (it) { var t = tipoDe(it.n, c.nome); conta[t] = (conta[t] || 0) + 1; });
    var melhor = ''; Object.keys(conta).forEach(function (t) { if (conta[t] > (conta[melhor] || 0)) melhor = t; });
    return melhor;
  }
  function telaCategoria(idx) {
    var reais = categoriasReais();
    var pos = 0; reais.forEach(function (x, i) { if (x.idx === idx) pos = i; });
    var atual = reais[pos];
    if (!atual) return h('div', { class: 'wrap' }, topo('Categoria', ''), h('p', { class: 'vazio', text: 'Esta categoria não está mais no cardápio.' }));
    var c = atual.c, tom = tomCategoria(c);
    var escuro = lumHex(tom) > 0.42;
    var abas = h('nav', { class: 'cat-abas', 'aria-label': 'Categorias' });
    reais.forEach(function (x) {
      abas.appendChild(h('a', { class: 'cat-aba' + (x.idx === atual.idx ? ' on' : ''), href: '#/c/' + x.idx, 'aria-current': x.idx === atual.idx ? 'page' : null, onclick: function (e) { e.preventDefault(); location.replace('#/c/' + x.idx); } }, x.c.nome));
    });
    var ul = h('ul', { class: 'lista' });
    c.itens.forEach(function (it) { ul.appendChild(linha(mapa[item(c.nome, it).chave] || item(c.nome, it))); });
    var corpo = h('div', { class: 'cat-corpo' }, ul,
      reais.length > 1 ? h('p', { class: 'cat-dica', text: '‹ arraste para o lado para trocar de categoria ›' }) : null);
    var raiz = h('div', { class: 'wrap cat-tela' + (escuro ? ' cat-clara' : ''), style: '--tom:' + tom },
      h('header', { class: 'cat-top' },
        h('button', { class: 'voltar-cat', type: 'button', onclick: function () { if (ui.veioDoInicio) history.back(); else ir(''); } }, icone('voltar', 18), 'Cardápio'),
        h('div', { class: 'cat-top-in' },
          h('div', null, h('h1', { text: c.nome }), h('p', { text: c.itens.length + (c.itens.length === 1 ? ' produto' : ' produtos') + ' · pesados na hora' })),
          h('img', { class: 'cat-monte', src: poteURL(tom, 260, 'transparente', tipoCategoria(c)), alt: '' })),
        abas),
      corpo);
    // arrastar para o lado troca de categoria
    var x0 = null, y0 = null;
    raiz.addEventListener('touchstart', function (e) { if (e.target.closest('.cat-abas')) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    raiz.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && reais.length > 1) {
        var prox = reais[(pos + (dx < 0 ? 1 : -1) + reais.length) % reais.length];
        ui.direcao = dx < 0 ? 'esq' : 'dir';
        location.replace('#/c/' + prox.idx);
      }
    });
    if (ui.direcao) { corpo.classList.add('entra-' + ui.direcao); ui.direcao = ''; }
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', tom);
    setTimeout(function () { var on = abas.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' }); }, 0);
    return raiz;
  }
  function lumHex(hex) { var n = parseInt(hex.slice(1), 16); var c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }

  // ---------- produto ----------
  function telaProduto(chave) {
    var it = mapa[chave];
    if (!it) return h('div', { class: 'wrap' }, topo('Produto', ''), h('p', { class: 'vazio', text: 'Este produto não está mais no cardápio.' }));
    var escolhido = pesoPadrao(chave);
    var tags = h('div', { class: 'tags' });
    if (it.s) tags.appendChild(h('span', { class: 'tag p', text: it.s }));
    if (it.mv) tags.appendChild(h('span', { class: 'tag', text: '🔥 Mais vendido' }));
    if (it.gl === 'n') tags.appendChild(h('span', { class: 'tag', text: 'Sem glúten' }));
    tags.appendChild(h('span', { class: 'tag', text: 'Pesado na hora' }));

    var grade = h('div', { class: 'grade-pesos', role: 'radiogroup', 'aria-label': 'Quantidade' });
    var outro = h('input', { id: 'outro', type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: 'Outra quantidade (g)', value: ui.outro });
    var erro = h('p', { class: 'erro', role: 'alert' });
    var botao = h('button', { class: 'b', type: 'button' });
    function valor() { var g = L.parseGramas(ui.outro); return ui.outro.trim() ? g : escolhido; }
    function atualizar() {
      var g = valor();
      var ok = g && g >= min();
      erro.textContent = ui.outro.trim() && !ok ? (g ? 'O mínimo é ' + L.fmtGramas(min()) + '.' : 'Digite só números, por exemplo 300.') : '';
      botao.disabled = !ok;
      botao.textContent = ok ? 'Adicionar ' + L.fmtGramas(g) + ' · ' + L.brl(L.precoItem(g, it.pk)) : 'Adicionar ao pedido';
      Array.prototype.forEach.call(grade.children, function (b) { var on = !ui.outro.trim() && Number(b.getAttribute('data-g')) === escolhido; b.className = 'peso-g' + (on ? ' on' : ''); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
    }
    pesos().forEach(function (p) {
      grade.appendChild(h('button', { type: 'button', role: 'radio', 'data-g': String(p), onclick: function () { escolhido = p; ui.peso[chave] = p; ui.outro = ''; outro.value = ''; atualizar(); } },
        h('span', { text: L.fmtGramas(p) }), h('b', { text: L.brl(L.precoItem(p, it.pk)) })));
    });
    outro.addEventListener('input', function () { ui.outro = outro.value; atualizar(); });
    botao.addEventListener('click', function () { var g = valor(); if (!g || g < min()) return; add(chave, g); ui.outro = ''; history.length > 1 ? history.back() : ir(''); });
    atualizar();

    var junto = (it.j || []).map(function (id) { return mapa['i:' + id]; }).filter(Boolean);
    var hero = h('div', { class: 'hero-prod' + (it.f ? '' : ' sem'), style: it.f ? null : 'background:radial-gradient(70% 70% at 50% 45%, ' + misturaHex(tomPara(it), '#ffffff', .55) + ', ' + misturaHex(tomPara(it), '#000000', .15) + ')' }, it.f ? h('img', { class: 'hero-fundo', src: it.f, alt: '' }) : null, foto(it, 'hero-img', true),
      h('button', { class: 'voltar-flut', type: 'button', 'aria-label': 'Voltar', onclick: function () { history.length > 1 ? history.back() : ir(''); } }, icone('voltar')));
    var info = [];
    if (it.u) info.push(h('h3', { text: 'Combina com' }), h('p', { text: it.u }));
    var rot = [];
    if (it.ig) rot.push(h('span', null, h('b', { text: 'Ingredientes: ' }), it.ig));
    if (it.gl) rot.push(h('b', { text: it.gl === 'c' ? 'CONTÉM GLÚTEN.' : 'NÃO CONTÉM GLÚTEN.' }));
    if (it.al) rot.push(h('span', { text: 'Alérgicos: ' + it.al }));
    var tem = carrinho[chave];
    return h('div', { class: 'wrap' }, hero,
      h('div', { class: 'det' },
        h('h1', { text: it.n }),
        h('p', { class: 'det-preco' + (it.pa ? ' promo' : '') }, h('b', { text: por100(it.pk) }), it.pa ? h('s', { text: por100(it.pa) }) : null, h('small', { text: ' / 100 g · ' + L.brl(it.pk) + ' / kg' })),
        tags,
        info.length ? h('div', { class: 'det-info' }, info[0], info[1]) : null,
        rot.length ? h('div', { class: 'rotulo' }, rot.reduce(function (f, el, i) { if (i) f.appendChild(h('br')); f.appendChild(el); return f; }, document.createDocumentFragment())) : null,
        h('h3', { text: 'Quanto você quer?' }), grade,
        h('label', { class: 'sr', for: 'outro', text: 'Outra quantidade em gramas' }), outro, erro,
        tem ? h('p', { class: 'no-ped' }, icone('check', 14), 'Você já tem ' + L.fmtGramas(tem) + ' no pedido. ', h('button', { class: 'link', type: 'button', onclick: function () { delete carrinho[chave]; guardar(); desenhar(); } }, 'Tirar')) : null,
        botao,
        junto.length ? h('section', { class: 'junto' }, h('h3', { text: 'Quem levou também levou' }),
          junto.reduce(function (d, x) { d.appendChild(cartao(x)); return d; }, h('div', { class: 'trilho' }))) : null));
  }

  function topo(titulo, voltarPara) {
    return h('header', { class: 'topo' },
      h('button', { class: 'voltar', type: 'button', onclick: function () { ir(voltarPara); } }, icone('voltar'), 'Cardápio'),
      h('h1', { text: titulo }));
  }

  // ---------- pedido ----------
  function seg(nome, opcoes, atual, mudar) {
    var g = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': nome });
    opcoes.forEach(function (o) {
      g.appendChild(h('button', { type: 'button', role: 'radio', 'aria-checked': o.id === atual ? 'true' : 'false', class: o.id === atual ? 'on' : '', onclick: function () { mudar(o.id); } }, o.icone ? icone(o.icone, 18) : null, o.rotulo));
    });
    return g;
  }

  function telaPedido() {
    var its = itensDoPedido();
    var raiz = h('div', { class: 'wrap' }, topo('Seu pedido', ''));
    if (!its.length) {
      raiz.appendChild(h('div', { class: 'pg' }, h('p', { class: 'vazio', text: 'Seu pedido está vazio. Volte ao cardápio e escolha os produtos.' }), h('button', { class: 'b', type: 'button', onclick: function () { ir(''); } }, 'Ver o cardápio')));
      return raiz;
    }
    var ms = modos(); if (ms.indexOf(form.modo) < 0) form.modo = ms[0];
    var ps = pagamentos(); if (ps.indexOf(form.pagamento) < 0) form.pagamento = ps[0];
    var sub = L.subtotal(its), tx = taxa();
    var e = entrega();
    var pg = h('div', { class: 'pg' });
    function bloco(titulo, conteudo) { return h('section', { class: 'bloco' }, h('h2', { text: titulo }), conteudo); }

    // 1. itens: foto, nome, preço por 100 g, − quantidade +, valor e "tirar"
    var passo = Math.max(50, min());
    var lista = h('ul', { class: 'ped-lista' });
    its.forEach(function (it) {
      var x = mapa[it.chave];
      function mudar(g) { if (g < min()) return; carrinho[it.chave] = g; guardar(); desenhar(true); }
      var campo = h('input', { class: 'qtd-campo', type: 'text', inputmode: 'numeric', value: String(it.g), 'aria-label': 'Gramas de ' + it.n });
      campo.addEventListener('change', function () {
        var g = L.parseGramas(campo.value);
        if (!g || g < min()) { campo.value = String(it.g); avisar('O mínimo é ' + L.fmtGramas(min())); return; }
        mudar(g);
      });
      campo.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') campo.blur(); });
      lista.appendChild(h('li', { class: 'ped-item' },
        foto(x, 'img'),
        h('div', { class: 'ped-meio' },
          h('strong', { text: it.n }),
          h('span', { class: 'ped-sub', text: por100(x.pk) + ' / 100 g' }),
          h('div', { class: 'qtd' },
            h('button', { type: 'button', class: 'qtd-bt', 'aria-label': 'Menos ' + L.fmtGramas(passo) + ' de ' + it.n, disabled: it.g - passo < min(), onclick: function () { mudar(it.g - passo); } }, '−'),
            h('label', { class: 'qtd-valor' }, campo, h('span', { text: 'g' })),
            h('button', { type: 'button', class: 'qtd-bt', 'aria-label': 'Mais ' + L.fmtGramas(passo) + ' de ' + it.n, onclick: function () { mudar(it.g + passo); } }, '+'))),
        h('div', { class: 'ped-dir' },
          h('b', { text: L.brl(it.total) }),
          h('button', { class: 'tirar', type: 'button', 'aria-label': 'Tirar ' + it.n + ' do pedido', onclick: function () { delete carrinho[it.chave]; guardar(); desenhar(true); } }, icone('x', 16), 'Tirar'))));
    });
    pg.appendChild(bloco('Itens (' + its.length + ')', h('div', null, lista,
      h('button', { class: 'link-add', type: 'button', onclick: function () { ir(''); } }, icone('mais', 16), 'Adicionar mais produtos'))));

    // 2. como receber
    var receber = h('div', { class: 'bloco-in' });
    if (ms.length > 1) receber.appendChild(seg('Como receber', [{ id: 'retirada', rotulo: 'Retirar na loja', icone: 'loja' }, { id: 'entrega', rotulo: 'Entrega', icone: 'moto' }], form.modo, function (m) { form.modo = m; guardar(); desenhar(true); }));
    var dicaReceber = form.modo === 'retirada' ? 'Avisamos pelo WhatsApp quando estiver pronto para retirar.' : (tx ? 'Taxa de entrega: ' + L.brl(tx) + '.' : 'A taxa de entrega é combinada com a gente pelo WhatsApp.');
    receber.appendChild(h('p', { class: 'dica-bloco', text: dicaReceber }));
    pg.appendChild(bloco('Como receber', receber));

    // 3. seus dados
    var erroEl = h('p', { class: 'erro', role: 'alert', text: ui.erro });
    function limpaErro() { if (ui.erro) { ui.erro = ''; erroEl.textContent = ''; } }
    function campoTexto(id, rotulo, chave, attrs, dica) {
      var el = attrs.tag === 'textarea' ? h('textarea', { id: id, rows: attrs.rows || 2, autocomplete: attrs.ac || null, placeholder: attrs.ph || null }) : h('input', { id: id, type: attrs.type || 'text', inputmode: attrs.im || null, autocomplete: attrs.ac || null, placeholder: attrs.ph || null });
      el.value = form[chave] || '';
      if (attrs.obrig && ui.tentou && !String(form[chave] || '').trim()) el.className = 'invalido';
      el.addEventListener('input', function () { form[chave] = el.value; guardar(); limpaErro(); });
      return h('label', { class: 'campo', for: id }, h('span', { text: rotulo }), dica ? h('small', { text: dica }) : null, el);
    }
    pg.appendChild(bloco('Seus dados', h('div', { class: 'bloco-in' },
      campoTexto('f-nome', 'Nome', 'nome', { ac: 'name', obrig: true }),
      campoTexto('f-tel', 'WhatsApp', 'telefone', { type: 'tel', im: 'tel', ac: 'tel', obrig: true, ph: '(86) 9 9999-9999' }),
      form.modo === 'entrega' ? campoTexto('f-end', 'Endereço de entrega', 'endereco', { tag: 'textarea', ac: 'street-address', obrig: true, ph: 'Rua, número, bairro e ponto de referência' }) : null)));

    // 4. pagamento
    var pag = h('div', { class: 'bloco-in' });
    var rot = { pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro' };
    pag.appendChild(seg('Pagamento', ps.map(function (p) { return { id: p, rotulo: rot[p] }; }), form.pagamento, function (p) { form.pagamento = p; guardar(); desenhar(true); }));
    if (form.pagamento === 'cartao') pag.appendChild(h('p', { class: 'dica-bloco', text: form.modo === 'retirada' ? 'Pague com cartão na hora de retirar.' : 'Levamos a maquininha na entrega.' }));
    if (form.pagamento === 'dinheiro') pag.appendChild(campoTexto('f-troco', 'Troco para quanto? (opcional)', 'troco', { im: 'decimal', ph: 'Ex.: 100' }));
    if (form.pagamento === 'pix') {
      var pix = L.pixCopiaECola(dados.loja.pix, sub + tx, 'CARDAPIO');
      if (pix) {
        var cod = h('code', { class: 'pix-cod', text: pix });
        pag.appendChild(h('div', { class: 'pix' },
          h('p', { text: (form.modo === 'entrega' && !tx ? 'Valor dos produtos (a entrega é combinada à parte). ' : '') + 'Pague no app do seu banco e mande o comprovante no WhatsApp.' }),
          cod,
          h('button', { class: 'b sec', type: 'button', onclick: function () {
            (navigator.clipboard ? navigator.clipboard.writeText(pix) : Promise.reject()).then(function () { avisar('Código Pix copiado'); }, function () {
              var r = document.createRange(); r.selectNodeContents(cod); var sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); avisar('Selecione e copie o código');
            });
          } }, icone('copiar', 18), 'Copiar código Pix · ' + L.brl(sub + tx))));
      } else pag.appendChild(h('p', { class: 'dica-bloco', text: 'Mandamos a chave Pix pelo WhatsApp junto da confirmação.' }));
    }
    pg.appendChild(bloco('Pagamento', pag));

    // 5. observações
    pg.appendChild(bloco('Observações', h('div', { class: 'bloco-in' }, campoTexto('f-obs', 'Algum recado? (opcional)', 'obs', { tag: 'textarea', ph: 'Ex.: moído bem fininho, entregar depois das 17h' }))));

    // 6. resumo e enviar
    var st = L.statusHorario(dados.loja.horarios, new Date());
    pg.appendChild(h('section', { class: 'bloco resumo-bloco' },
      h('div', { class: 'resumo' },
        h('div', null, h('span', { text: 'Produtos' }), h('span', { text: L.brl(sub) })),
        form.modo === 'entrega' ? h('div', null, h('span', { text: 'Entrega' }), h('span', { text: tx ? L.brl(tx) : 'a combinar' })) : h('div', null, h('span', { text: 'Retirada na loja' }), h('span', { text: 'grátis' })),
        h('div', { class: 'total' }, h('span', { text: 'Total' }), h('span', { text: L.brl(sub + tx) + (form.modo === 'entrega' && !tx ? ' + entrega' : '') }))),
      st && !st.aberto ? h('p', { class: 'aviso fechado', text: 'Estamos fechados agora (' + st.texto.replace(/^Fechado · /, '') + '). Pode mandar: respondemos assim que abrirmos.' }) : null,
      erroEl,
      h('button', { class: 'b enviar', type: 'button', onclick: finalizar }, icone('whatsapp'), 'Enviar pedido pelo WhatsApp'),
      h('p', { class: 'nota', text: 'Você confirma tudo com a gente pelo WhatsApp.' })));
    raiz.appendChild(pg);
    return raiz;
  }

  var NUVEM_PEDIDOS = 'https://firestore.googleapis.com/v1/projects/temperei/databases/(default)/documents/pedidos?key=AIzaSyBIe_OH9xytji9DKWT_5-Pd-p8PyNk0lUE';
  function finalizar() {
    var its = itensDoPedido();
    ui.tentou = true;
    if (!its.length) return;
    var falta = [];
    if (!form.nome.trim()) falta.push('seu nome');
    if (!form.telefone.trim()) falta.push('seu WhatsApp');
    if (form.modo === 'entrega' && !form.endereco.trim()) falta.push('o endereço');
    if (falta.length) { ui.erro = 'Preencha ' + falta.join(', ').replace(/, ([^,]*)$/, ' e $1') + '.'; desenhar(true); return; }
    if (!dados.loja.whatsapp) { ui.erro = 'O WhatsApp da loja ainda não foi configurado.'; desenhar(true); return; }
    var base = { itens: its, nome: form.nome, telefone: form.telefone, endereco: form.endereco, obs: form.obs, origem: ORIGEM, modo: form.modo, taxa: taxa(), pagamento: form.pagamento, troco: form.troco };
    var texto = L.montarMensagem(Object.assign({ loja: dados.loja.nome, abertura: dados.loja.abertura, fechamento: dados.loja.fechamento }, base));
    // o pedido também cai na tela "Pedidos" da loja; não segura o WhatsApp se falhar
    if (!PREVIEW) try {
      fetch(NUVEM_PEDIDOS, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(L.pedidoNuvem(base)) }).catch(function () {});
    } catch (e) { /* navegador antigo: segue só pelo WhatsApp */ }
    var a = h('a', { href: L.urlWhatsapp(dados.loja.whatsapp, texto), target: '_blank', rel: 'noopener noreferrer' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- barra do pedido ----------
  function desenharBarra() {
    var velha = document.getElementById('barra'); if (velha) velha.remove();
    var tl = rota().tela; if (tl !== 'inicio' && tl !== 'categoria') return;
    var its = itensDoPedido();
    var reais = categoriasReais();
    var lj = dados.loja;
    function item(rotulo, ic, ativo, acao, extra) {
      return h('button', { class: 'nav-it' + (ativo ? ' on' : ''), type: 'button', onclick: acao, 'aria-current': ativo ? 'page' : null }, icone(ic, 22), h('span', { text: rotulo }), extra || null);
    }
    var carrinhoBt = h('button', { class: 'nav-carrinho', type: 'button', 'aria-label': its.length ? 'Ver pedido: ' + its.length + ' itens, ' + L.brl(L.subtotal(its)) : 'Pedido vazio', onclick: function () { ir('pedido'); } },
      icone('cesta', 26), its.length ? h('b', { class: 'nav-qtd', text: String(its.length) }) : null);
    app.appendChild(h('nav', { class: 'nav', id: 'barra', 'aria-label': 'Navegação' }, h('div', { class: 'nav-in' },
      item('Início', 'loja', tl === 'inicio', function () { if (tl === 'inicio') window.scrollTo({ top: 0, behavior: 'smooth' }); else ir(''); }),
      item('Categorias', 'menu', tl === 'categoria', function () { if (reais.length) ir('c/' + reais[0].idx); }),
      h('div', { class: 'nav-meio' }, carrinhoBt, h('small', { text: its.length ? L.brl(L.subtotal(its)) : 'Pedido' })),
      item('Ofertas', 'tag', false, function () { if (tl !== 'inicio') { ir(''); setTimeout(function () { var o = document.querySelector('.banner'); if (o) o.scrollIntoView({ behavior: 'smooth' }); }, 60); } else { var o = document.querySelector('.banner'); if (o) o.scrollIntoView({ behavior: 'smooth' }); } }),
      lj.whatsapp ? h('a', { class: 'nav-it', href: L.urlWhatsapp(lj.whatsapp, 'Olá, ' + lj.nome + '! Vim pelo cardápio.'), target: '_blank', rel: 'noopener noreferrer' }, icone('whatsapp', 22), h('span', { text: 'Contato' })) : null)));
  }

  // ---------- grãos flutuando na capa ----------
  var animGraos = 0;
  function iniciarGraos() {
    cancelAnimationFrame(animGraos);
    var cv = document.querySelector('.capa-graos'); if (!cv) return;
    var reduzir = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var tons = ['#C9461A', '#E6A52A', '#7D8C3A', '#F1D9B5'];
    var gs = []; for (var i = 0; i < Math.round(Math.min(70, W * H / 2600)); i++) gs.push({ x: Math.random() * W, y: Math.random() * H, r: .8 + Math.random() * 2.6, vy: .12 + Math.random() * .35, a: Math.random() * 6.28, t: i % 4 });
    function q() {
      if (!cv.isConnected) return;
      ctx.clearRect(0, 0, W, H);
      gs.forEach(function (g) {
        if (!reduzir) { g.y += g.vy; g.x += Math.sin(g.a += .012) * .25; if (g.y > H + 4) { g.y = -4; g.x = Math.random() * W; } }
        ctx.globalAlpha = .5 + g.r / 6; ctx.fillStyle = tons[g.t];
        ctx.beginPath(); if (g.t === 2) ctx.ellipse(g.x, g.y, g.r * 1.8, g.r * .8, g.a, 0, 6.28); else ctx.arc(g.x, g.y, g.r, 0, 6.28); ctx.fill();
      });
      if (!reduzir) animGraos = requestAnimationFrame(q);
    }
    q();
  }

  // ---------- desenho ----------
  function desenhar(manterRolagem) {
    if (!dados) return;
    var y = window.scrollY;
    var r = rota();
    var foco = document.activeElement && document.activeElement.id;
    app.textContent = '';
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--k').trim() || '#2b1d17');
    app.appendChild(r.tela === 'pedido' ? telaPedido() : r.tela === 'produto' ? telaProduto(r.chave) : r.tela === 'categoria' ? telaCategoria(r.idx) : telaInicio());
    if (r.tela === 'inicio') { desenharConteudo(); iniciarGraos(); }
    desenharBarra();
    if (foco) { var el = document.getElementById(foco); if (el && el.focus) { el.focus(); if (el.setSelectionRange && el.value != null) try { var l = el.value.length; el.setSelectionRange(l, l); } catch (e) { /* ignora */ } } }
    if (manterRolagem) window.scrollTo(0, y);
  }
  // guarda a rolagem do início antes de abrir um produto
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href^="#/p/"]');
    if (a && rota().tela === 'inicio') rolagemInicio = window.scrollY;
  }, true);

  function indisponivel(msg) {
    app.textContent = '';
    app.appendChild(h('div', { class: 'wrap' }, h('p', { class: 'vazio', text: msg })));
  }

  function validar(j) {
    return j && j.v === 1 && j.loja && typeof j.loja.nome === 'string' && Array.isArray(j.categorias);
  }

  function iniciar(j) {
    if (!validar(j)) return indisponivel('O cardápio não está disponível agora. Tente de novo em instantes.');
    dados = j;
    if (!Array.isArray(dados.mixes)) dados.mixes = [];
    indexar();
    document.title = 'Cardápio · ' + j.loja.nome;
    aplicarCores(j.loja.cores);
    recuperar();
    desenhar();
  }

  if (PREVIEW) {
    indisponivel('Montando a prévia…');
    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.tipo !== 'cardapio-previa') return;
      iniciar(e.data.dados);
    });
    if (window.parent !== window) window.parent.postMessage({ tipo: 'cardapio-pronto' }, location.origin);
  } else {
    // 1º: o cardápio ao vivo, publicado pelo sistema na nuvem; 2º: o arquivo cardapio.json (publicação manual)
    var NUVEM = 'https://firestore.googleapis.com/v1/projects/temperei/databases/(default)/documents/publico/cardapio?key=AIzaSyBIe_OH9xytji9DKWT_5-Pd-p8PyNk0lUE';
    var json = function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); };
    fetch(NUVEM, { cache: 'no-store' })
      .then(json)
      .then(function (d) { return JSON.parse(d.fields.json.stringValue); })
      .catch(function () { return fetch('./cardapio.json?t=' + Date.now(), { cache: 'no-store' }).then(json); })
      .then(iniciar)
      .catch(function () { indisponivel('O cardápio ainda não foi publicado. Volte em instantes.'); });
  }
})();
