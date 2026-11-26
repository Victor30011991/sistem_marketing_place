/* Página pública do catálogo. Não conhece o sistema de precificação: só lê o catálogo publicado (nome, categoria e preço). */
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
  var form = { nome: '', telefone: '', endereco: '', obs: '', modo: '', pagamento: '', troco: '', cupom: '', enviadoEm: 0 };
  var ui = { busca: '', peso: {}, erro: '', tentou: false, outro: '', cat: '', cupomTxt: '', cupomErro: '', qtdUn: {} };

  // ---------- guarda o pedido neste aparelho por 3 dias (volta igual se o cliente sair e voltar) ----------
  var GUARDA = 'cardapio-pedido', VALIDADE = 3 * 864e5, ENVIADO_VALE = 2 * 36e5;
  function guardar() {
    var s = JSON.stringify({ carrinho: carrinho, form: form, em: Date.now() });
    try { localStorage.setItem(GUARDA, s); } catch (e) { try { sessionStorage.setItem(GUARDA, s); } catch (e2) { /* sem armazenamento: tudo bem */ } }
  }
  function recuperar() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(GUARDA) || 'null'); } catch (e) { /* ignora */ }
    if (!s) try { s = JSON.parse(sessionStorage.getItem(GUARDA) || 'null'); } catch (e) { /* ignora */ }
    if (!s || !s.carrinho) return;
    form = Object.assign(form, s.form || {});
    var velho = s.em && Date.now() - s.em > VALIDADE;
    // pedido já enviado há mais de 2 horas: começa um novo (os dados do cliente continuam)
    var jaFoi = form.enviadoEm && Date.now() - form.enviadoEm > ENVIADO_VALE;
    if (velho || jaFoi) { form.enviadoEm = 0; guardar(); return; }
    carrinho = s.carrinho;
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
    casa: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
    grade: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    cartao: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
  };
  function icone(nome, tam) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', String(tam || 22)); s.setAttribute('height', String(tam || 22)); s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.9');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONES[nome] || ''; // textos fixos do próprio arquivo, nunca dados do catálogo
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
    if (f) { r.setProperty('--f', toHex(f)); r.setProperty('--bg', toHex(mistura(f, [255, 255, 255], 0.65))); r.setProperty('--on-f', lum(f) > 0.4 ? '#2b1d17' : '#ffffff'); }
    var b = rgb(c && c.b);
    if (b) {
      var escuro = lum(b) < 0.25;
      r.setProperty('--bg', toHex(b));
      r.setProperty('--card', escuro ? toHex(mistura(b, [255, 255, 255], 0.08)) : '#ffffff');
      r.setProperty('--line', escuro ? toHex(mistura(b, [255, 255, 255], 0.2)) : toHex(mistura(b, [0, 0, 0], 0.1)));
      if (escuro) { r.setProperty('--ink', '#f4efe8'); r.setProperty('--muted', '#c9bfb4'); }
    }
    var k = rgb(c && c.k); if (k) r.setProperty('--k', toHex(k));
  }
  var LETRAS = { slab: "'Zilla Slab', 'Rockwell', Georgia, serif", classica: "'Playfair', Georgia, 'Times New Roman', serif", simples: "'Figtree', system-ui, sans-serif" };
  function aplicarLetra(l) { document.documentElement.style.setProperty('--serif', LETRAS[l] || LETRAS.slab); }

  // ---------- dados ----------
  var mapa = {};
  function item(cat, it) {
    var un = !(it.pk > 0) && it.pu > 0 && typeof it.ud === 'string' && it.ud ? { pu: it.pu, ud: it.ud.slice(0, 40) } : null;
    return { chave: it.i ? 'i:' + it.i : cat + '|' + it.n, cat: cat, i: it.i, n: it.n, pk: un ? 0 : it.pk, pu: un ? un.pu : 0, ud: un ? un.ud : '', pa: it.pa, s: it.s,
      f: /^data:image\/(jpeg|png|webp);base64,/.test(it.f || '') ? it.f : null,
      u: it.u, ig: it.ig, gl: it.gl, al: it.al, mv: it.mv, j: Array.isArray(it.j) ? it.j : [],
      c: /^#[0-9a-f]{6}$/i.test(it.c || '') ? it.c : null };
  }
  function indexar() {
    mapa = {};
    dados.categorias.forEach(function (cat) { cat.itens.forEach(function (it) {
      var x = item(cat.nome, it);
      if (!(x.pk > 0) && !(x.pu > 0)) return;
      if (!mapa[x.chave] || DESTAQUES[mapa[x.chave].cat]) mapa[x.chave] = x; // guarda a categoria "de verdade"
    }); });
  }
  var kits = [];
  function indexarKits() {
    kits = (Array.isArray(dados.kits) ? dados.kits : []).filter(function (k) {
      return k && typeof k.k === 'string' && typeof k.n === 'string' && k.p > 0 && Array.isArray(k.i) && k.i.length &&
        k.i.every(function (x) { return Array.isArray(x) && mapa['i:' + x[0]] && x[1] > 0; });
    }).map(function (k) {
      return { chave: 'k:' + k.k, n: k.n, t: k.t, d: k.d || '', ch: k.ch || '', p: k.p, s: k.s > k.p ? k.s : 0, r: !!k.r,
        f: /^data:image\/(jpeg|png|webp);base64,/.test(k.f || '') ? k.f : null,
        c: k.c === 'p' || k.c === 'd' || /^#[0-9a-f]{6}$/i.test(k.c || '') ? k.c : '',
        partes: k.i.map(function (x) { return { it: mapa['i:' + x[0]], g: x[1] }; }) };
    });
  }
  function kitDe(chave) { for (var i = 0; i < kits.length; i++) if (kits[i].chave === chave) return kits[i]; return null; }
  var ROTULO_KIT = { combo: 'Combo', kit: 'Kit', oferta: 'Oferta', novidade: 'Novidade' };
  function descKit(k) { return k.partes.map(function (x) { return x.it.n + ' ' + L.fmtGramas(x.g); }).join(' · '); }
  /** Vendido inteiro (frasco, litro, pacote…): a quantidade é de unidades, não de gramas. */
  function porUn(it) { return !!(it && it.pu > 0); }
  function precoDe(it, q) { return porUn(it) ? it.pu * q : L.precoItem(q, it.pk); }
  function qtdTxt(it, q) { return porUn(it) ? L.fmtQtd({ g: q, ud: it.ud }) : L.fmtGramas(q); }
  function qtdInicial(it) { return porUn(it) ? 1 : pesoPadrao(it.chave); }
  function todosItens() { return Object.keys(mapa).map(function (k) { return mapa[k]; }); }
  function itensDoPedido() {
    var out = [];
    Object.keys(carrinho).forEach(function (k) {
      if (k.indexOf('k:') === 0) {
        var kt = kitDe(k), q = Math.round(carrinho[k]);
        if (kt && q > 0) out.push({ chave: k, kit: true, n: kt.n, g: q, total: kt.p * q, desc: descKit(kt) });
        else delete carrinho[k]; // kit que saiu do catálogo
        return;
      }
      var it = mapa[k];
      // o produto mudou de "por peso" para "por unidade" (ou o contrário) desde que entrou no pedido
      if (it && porUn(it) && !(carrinho[k] >= 1 && carrinho[k] <= 99)) carrinho[k] = 1;
      else if (it && !porUn(it) && carrinho[k] < min()) carrinho[k] = pesoPadrao(k);
      if (it) out.push({ chave: k, i: it.i, n: it.n, g: carrinho[k], total: precoDe(it, carrinho[k]), ud: it.ud || undefined });
      else delete carrinho[k]; // item que saiu do catálogo
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
  /** Entrega grátis: vale quando os produtos chegam no valor que a loja escolheu. */
  function gratisAcima() { var e = entrega(); return e.ativa && e.gratisAcima > 0 ? e.gratisAcima : 0; }
  // pedido mínimo para entrega (em produtos); 0 = sem mínimo
  function minimoEntrega() { var e = entrega(); return e.ativa && e.minimo > 0 ? e.minimo : 0; }
  function faltaMinimo(sub) { var m = minimoEntrega(); return form.modo === 'entrega' && m > 0 && sub < m ? m - sub : 0; }
  function entregaGratis(sub) { var g = gratisAcima(); return form.modo === 'entrega' && g > 0 && sub >= g; }
  function taxa(sub) { var e = entrega(); if (sub != null && entregaGratis(sub)) return 0; return form.modo === 'entrega' && e.taxa === 'fixa' && e.valor > 0 ? e.valor : 0; }
  function addKit(kt) { carrinho[kt.chave] = (carrinho[kt.chave] || 0) + 1; guardar(); avisar(kt.n + ' no pedido'); }
  function add(chave, g, silencioso) {
    carrinho[chave] = (carrinho[chave] || 0) + g; guardar();
    if (!silencioso) avisar(porUn(mapa[chave]) ? qtdTxt(mapa[chave], g) + ' · ' + mapa[chave].n + ' no pedido' : L.fmtGramas(g) + ' de ' + mapa[chave].n + ' no pedido');
  }

  // ---------- rotas por # ----------
  function rota() {
    var r = (location.hash || '').replace(/^#\/?/, '');
    if (r === 'pedido') return { tela: 'pedido' };
    if (r === 'loja') return { tela: 'loja' };
    if (r === 'fidelidade') return { tela: 'fidelidade' };
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
    var n = Math.round(Math.min(px * px / 28, 6000)), gr = Math.max(1.2, px / 110) * Math.sqrt(px * px / 28 / n);
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
    var n = Math.round(Math.min(px * px / 9, 6000)), gr = Math.max(1.3, px / 90) * Math.sqrt(px * px / 9 / n);
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
      // limite de grãos: acima disso o desenho trava celular fraco; os grãos crescem para cobrir igual
    var nIdeal = px * px / (tipo === 'graos' ? 14 : 6), n = Math.round(Math.min(nIdeal, 9000)), gr = Math.max(.7, px / (tipo === 'graos' ? 110 : 260)) * Math.sqrt(nIdeal / n);
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
  /** Cor do produto: a escolhida pela loja ou a do tempero pelo nome. */
  function corDe(it) { return it.c || tomPara(it); }
  // ---------- peças ----------
  function foto(it, cls, grande) {
    if (it.f) return h('img', { class: cls, src: it.f, alt: '', loading: 'lazy' });
    return h('img', { class: cls + ' monte', src: poteURL(corDe(it), grande ? 480 : 200, null, tipoDe(it.n, it.cat)), alt: '' });
  }
  /** Bolinha da lista: a foto redonda ou a cor do tempero. */
  function bolinha(it, cls) {
    if (it.f) return h('img', { class: 'bola ' + (cls || ''), src: it.f, alt: '', loading: 'lazy' });
    return h('span', { class: 'bola ' + (cls || ''), style: '--cor:' + corDe(it), 'aria-hidden': 'true' });
  }
  function por100(pk) { return L.brl(Math.round(pk / 10)); }
  /** Preço da lista: "R$ 5,99 / 100 g" ou "R$ 25,00 / frasco 500 ml". */
  function precoPartes(it, sep) {
    if (porUn(it)) return [h('b', { text: L.brl(it.pu) }), it.pa ? h('s', { text: L.brl(it.pa) }) : null, h('small', { text: sep + '/ ' + it.ud })];
    return [h('b', { text: por100(it.pk) }), it.pa ? h('s', { text: por100(it.pa) }) : null, h('small', { text: sep + '/ 100 g' })];
  }
  function precoBloco(it) {
    return h.apply(null, ['span', { class: 'preco' + (it.pa ? ' promo' : '') }].concat(precoPartes(it, '')));
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
    if (!tem.whatsapp && lj.whatsapp) nav.insertBefore(botaoLink('whatsapp', 'WhatsApp', L.urlWhatsapp(lj.whatsapp, 'Olá, ' + lj.nome + '! Vim pelo catálogo.')), nav.firstChild);
    if (!tem.instagram && lj.instagram) nav.appendChild(botaoLink('instagram', 'Instagram', lj.instagram));
    if (!tem.maps && lj.endereco) nav.appendChild(botaoLink('maps', 'Como chegar', 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lj.endereco)));
    return nav.childNodes.length ? nav : null;
  }
  function linhaEntrega() {
    var e = entrega(); var p = [];
    if (e.retirada) p.push(h('span', null, icone('loja', 16), 'Retirada na loja'));
    if (e.ativa) p.push(h('span', null, icone('moto', 16), (e.taxa === 'fixa' && e.valor > 0 ? 'Entrega · ' + L.brl(e.valor) : 'Entrega · taxa a combinar') + (e.minimo > 0 ? ' · mínimo ' + L.brl(e.minimo) : '') + (e.gratisAcima > 0 ? ' · grátis acima de ' + L.brl(e.gratisAcima) : '')));
    return p.length ? h('p', { class: 'entrega-info' }, p[0], p[1] || null) : null;
  }

  // ---------- tela inicial: topo, busca, carrossel, categorias e a lista logo abaixo ----------
  function logoEl(cls) {
    var lj = dados.loja;
    var ini = h('span', { class: cls + ' logo-ini', 'aria-hidden': 'true', text: (lj.nome || 'L').trim().charAt(0).toUpperCase() });
    var img = h('img', { class: cls, src: lj.logo || '../logo.jpg', alt: 'Logomarca de ' + lj.nome });
    img.addEventListener('error', function () { if (img.parentNode) img.parentNode.replaceChild(ini, img); });
    return img;
  }
  function telaInicio() {
    var lj = dados.loja;
    var st = L.statusHorario(lj.horarios, new Date());
    var topoLoja = h('header', { class: 'topo-loja' },
      h('a', { class: 'topo-logo', href: '#/loja', 'aria-label': 'Sobre a ' + lj.nome }, logoEl('logo-mini')),
      h('div', { class: 'topo-tx' }, h('h1', { text: lj.nome }), st ? h('p', { class: 'topo-st' + (st.aberto ? ' aberto' : '') }, h('i'), st.texto) : lj.slogan ? h('p', { class: 'topo-st', text: lj.slogan }) : null),
      lj.whatsapp ? h('a', { class: 'topo-wa', href: L.urlWhatsapp(lj.whatsapp, 'Olá, ' + lj.nome + '! Vim pelo catálogo.'), target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Falar no WhatsApp' }, icone('whatsapp', 22)) : null);
    var busca = h('input', { class: 'busca', type: 'search', placeholder: 'Buscar tempero, chá, kit…', value: ui.busca, id: 'busca', autocomplete: 'off', enterkeyhint: 'search' });
    busca.addEventListener('input', function () { ui.busca = busca.value; desenharConteudo(); });
    return h('div', { class: 'wrap' }, topoLoja,
      h('div', { class: 'busca-caixa' }, icone('busca', 18), h('label', { class: 'sr', for: 'busca', text: 'Buscar produto' }), busca),
      h('main', { id: 'conteudo' }),
      h('footer', { class: 'rodape' }, h('strong', { text: lj.nome }), lj.endereco ? h('span', { text: lj.endereco }) : null, h('a', { href: '#/loja', text: 'Horários, contatos e como chegar' })));
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
  /** "Seg a sex 7h30–17h30 · Sáb 8h–12h": junta os dias seguidos com o mesmo horário. */
  function resumoHorario() {
    var hs = dados.loja.horarios; if (!Array.isArray(hs) || hs.length !== 7) return '';
    var nomes = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    var ordem = [1, 2, 3, 4, 5, 6, 0], grupos = [];
    ordem.forEach(function (d) {
      var x = hs[d]; if (!x) return;
      var txt = L.fmtHora(x[0]) + '–' + L.fmtHora(x[1]);
      var ult = grupos[grupos.length - 1];
      if (ult && ult.txt === txt && ordem.indexOf(ult.fim) === ordem.indexOf(d) - 1) ult.fim = d; else grupos.push({ ini: d, fim: d, txt: txt });
    });
    return grupos.map(function (g) {
      var dias = g.ini === g.fim ? nomes[g.ini] : nomes[g.ini] + (ordem.indexOf(g.fim) - ordem.indexOf(g.ini) === 1 ? ' e ' : ' a ') + nomes[g.fim];
      return dias.charAt(0).toUpperCase() + dias.slice(1) + ' ' + g.txt;
    }).join(' · ');
  }

  // cartão pequeno (usado em "quem levou também levou")
  function cartao(it) {
    var g = qtdInicial(it);
    return h('div', { class: 'cartao' },
      h('a', { class: 'cartao-link', href: '#/p/' + encodeURIComponent(it.chave) },
        h('span', { class: 'cartao-foto' }, foto(it, 'img'), it.s ? h('em', { class: 'selo', text: it.s }) : it.mv ? h('em', { class: 'selo d', text: 'Mais vendido' }) : null),
        h('strong', { class: 'cartao-nome', text: it.n })),
      h('div', { class: 'cartao-pe' }, precoBloco(it),
        h('button', { class: 'mais mini', type: 'button', 'aria-label': 'Adicionar ' + qtdTxt(it, g) + ' de ' + it.n, onclick: function () { add(it.chave, g); desenhar(true); } }, icone('mais', 18))));
  }

  // carrossel que passa sozinho: ofertas e mixes (o próximo cartão aparece na borda)
  var animBanner = 0;
  function bolinhasSlide(cores) {
    var box = h('span', { class: 'slide-bolas', 'aria-hidden': 'true' });
    cores.slice(0, 3).forEach(function (c, i) { box.appendChild(h('i', { class: 'sb' + i, style: '--cor:' + c })); });
    return box;
  }
  function banner() {
    var slides = [];
    kits.filter(function (k) { return k.r; }).forEach(function (kt) {
      slides.push({ selo: ROTULO_KIT[kt.t] || 'Kit', titulo: kt.n, linha: kt.ch || kt.d || descKit(kt), de: kt.s ? L.brl(kt.s) : '', por: L.brl(kt.p), cor: kt.c || 'p',
        arte: kt.f ? h('img', { class: 'slide-foto', src: kt.f, alt: '' }) : bolinhasSlide(kt.partes.map(function (x) { return corDe(x.it); })), kit: kt, bt: kt.t === 'combo' ? 'Adicionar combo' : kt.t === 'oferta' ? 'Adicionar oferta' : 'Adicionar kit' });
    });
    var ofertas = dados.categorias.filter(function (c) { return c.nome === 'Ofertas'; })[0];
    (ofertas ? ofertas.itens : []).slice(0, 4).forEach(function (it) {
      var x = mapa[item('Ofertas', it).chave] || item('Ofertas', it);
      slides.push({ selo: x.s || 'Oferta', titulo: x.n, de: x.pa ? (porUn(x) ? L.brl(x.pa) : por100(x.pa)) : '', por: porUn(x) ? L.brl(x.pu) + ' / ' + x.ud : por100(x.pk) + ' / 100 g', cor: 'd', arte: x.f ? h('img', { class: 'slide-foto', src: x.f, alt: '' }) : bolinhasSlide([corDe(x)]), href: '#/p/' + encodeURIComponent(x.chave), bt: 'Quero' });
    });
    (dados.mixes || []).slice(0, 3).forEach(function (m) {
      var its = m.i.map(function (id) { return mapa['i:' + id]; }).filter(Boolean); if (its.length < 2) return;
      var tot = 0; its.forEach(function (y) { tot += L.precoItem(m.g, y.pk); });
      // diz o que vem no mix: o cliente entende que leva os temperos, não o prato
      var nomesT = (m.t && m.t.length ? m.t : its.map(function (y) { return y.n; }));
      var leva = nomesT.length > 1 ? nomesT.slice(0, -1).join(', ') + ' e ' + nomesT[nomesT.length - 1] : nomesT[0];
      slides.push({ selo: 'Mix de temperos', titulo: m.n, linha: 'Leva ' + leva, sub: L.fmtGramas(m.g) + ' de cada' + (m.d ? ' · ' + m.d : ''), por: L.brl(tot), cor: 'p', arte: bolinhasSlide(its.map(corDe)), mix: m, bt: 'Adicionar combo', compacto: true });
    });
    if (!slides.length) return null;
    var trilho = h('div', { class: 'banner-trilho', role: 'region', 'aria-label': 'Ofertas e mixes' });
    var pontos = h('div', { class: 'banner-pontos', 'aria-hidden': 'true' });
    slides.forEach(function (sl, i) {
      var bt = sl.kit
        ? h('button', { class: 'banner-bt', type: 'button', onclick: function () { addKit(sl.kit); desenhar(true); } }, sl.bt)
        : sl.mix
        ? h('button', { class: 'banner-bt', type: 'button', onclick: function () { var its = sl.mix.i.map(function (id) { return mapa['i:' + id]; }).filter(Boolean); its.forEach(function (y) { add(y.chave, sl.mix.g, true); }); avisar('Temperos de ' + sl.mix.n.replace(/^temperos para /i, '') + ' no pedido'); desenhar(true); } }, sl.bt)
        : h('a', { class: 'banner-bt', href: sl.href }, sl.bt);
      var corHex = /^#/.test(sl.cor) ? sl.cor : '';
      trilho.appendChild(h('article', { class: 'banner-slide c-' + (corHex ? 'x' : sl.cor) + (sl.compacto ? ' compacto' : ''), style: corHex ? 'background:' + corHex + ';color:' + (lumHex(corHex) > 0.4 ? '#2b1d17' : '#ffffff') : null },
        h('div', { class: 'banner-tx' }, h('em', { text: sl.selo }), h('strong', { text: sl.titulo }), sl.linha ? h('span', { text: sl.linha }) : null, sl.sub ? h('small', { class: 'banner-sub', text: sl.sub }) : null,
          h('span', { class: 'banner-preco' }, sl.de ? h('s', { text: sl.de }) : null, h('b', { text: sl.por })), bt),
        sl.arte));
      pontos.appendChild(h('i', { class: i ? '' : 'on' }));
    });
    trilho.addEventListener('scroll', function () {
      var w = trilho.firstChild ? trilho.firstChild.getBoundingClientRect().width + 10 : trilho.clientWidth;
      var i = Math.round(trilho.scrollLeft / Math.max(1, w));
      Array.prototype.forEach.call(pontos.children, function (p, k) { p.className = k === i ? 'on' : ''; });
    }, { passive: true });
    clearInterval(animBanner);
    var reduzir = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (slides.length > 1 && !reduzir) {
      var parado = false;
      trilho.addEventListener('touchstart', function () { parado = true; }, { passive: true });
      animBanner = setInterval(function () {
        if (parado || !trilho.isConnected) return;
        var w = trilho.firstChild.getBoundingClientRect().width + 10;
        var i = Math.round(trilho.scrollLeft / w);
        trilho.scrollTo({ left: ((i + 1) % slides.length) * w, behavior: 'smooth' });
      }, 5000);
    }
    return h('section', { class: 'banner' }, trilho, slides.length > 1 ? pontos : null);
  }

  // ícones de traço das categorias (escolhidos pelo nome)
  var ICONES_CAT = [
    [/^mais vendidos$/, '<path d="M12 3c2 4 6 6 6 11a6 6 0 01-12 0c0-3 2-5 3-7 .5 2 1.5 3 3 3.5C12 8 11 6 12 3z"/>'],
    [/^kits/, '<rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M3 7h18v3H3zM12 7v13M12 7C10 3 6 3.5 6.5 5.5S10 7 12 7zM12 7c2-4 6-3.5 5.5-1.5S14 7 12 7z"/>'],
    [/^ofertas$/, '<path d="M3.5 12.5V4.5a1 1 0 011-1h8l8 8-9 9z"/><circle cx="8" cy="8" r="1.4"/>'],
    [/^chegou agora$/, '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5L15 9M9 15l-2.5 2.5"/>'],
    [/\bchas?\b|infus|ervas/, '<path d="M5 9h12v4a6 6 0 01-6 6 6 6 0 01-6-6zM17 10h1.5a2.5 2.5 0 010 5H17M9 3c-1 1.5 1 2.5 0 4M13 3c-1 1.5 1 2.5 0 4"/>'],
    [/farinha|fecula|amido|polvilho/, '<path d="M12 21V7M12 9c-2.5-.5-4-2.5-4-5 2.5.5 4 2.5 4 5zM12 9c2.5-.5 4-2.5 4-5-2.5.5-4 2.5-4 5zM12 14c-2.5-.5-4-2.5-4-5 2.5.5 4 2.5 4 5zM12 14c2.5-.5 4-2.5 4-5-2.5.5-4 2.5-4 5z"/>'],
    [/semente|castanha|grao|graos|amendoim|oleaginosa|granola|cereal/, '<path d="M7 9c2-3 6-2 6 2s-4 8-6 6-2-5 0-8zM15 6c3-2 6 0 5 4s-4 6-6 4-1-6 1-8z"/>'],
    [/argila|cosmet|beleza|banho|sabonete/, '<path d="M8 4h8M9 4v3c-3 1.5-4 4-4 7 0 4 3 6 7 6s7-2 7-6c0-3-1-5.5-4-7V4M6.5 13c3.5 1.2 7.5 1.2 11 0"/>'],
    [/\bmel\b|doce|chocolate/, '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>'],
    [/tempero|especiaria|condimento|pimenta|sal\b|molho/, '<path d="M5 19C5 10 11 5 20 4c0 9-5 15-15 15zM5 19l9-9"/>'],
  ];
  function iconeCat(nome) {
    var n = semAcento(nome), p = '<path d="M5 9h14l-1.5 11h-11zM9 9V7a3 3 0 016 0v2"/>';
    for (var i = 0; i < ICONES_CAT.length; i++) if (ICONES_CAT[i][0].test(n)) { p = ICONES_CAT[i][1]; break; }
    var s = icone('mais', 26); s.innerHTML = p; return s; // caminhos fixos deste arquivo
  }
  /** Quadradinhos lado a lado: Mais vendidos primeiro, depois ofertas, novidades e as categorias da loja. */
  function abasInicio() {
    var out = [];
    ['Mais vendidos', 'Ofertas', 'Chegou agora'].forEach(function (nome) {
      dados.categorias.forEach(function (c, idx) { if (c.nome === nome && c.itens.length) out.push({ chave: 'c' + idx, c: c }); });
      if (nome === 'Mais vendidos' && kits.length) out.push({ chave: 'kits', c: { nome: 'Kits e combos', itens: [] }, kits: true });
    });
    categoriasReais().forEach(function (x) { out.push({ chave: 'c' + x.idx, c: x.c }); });
    return out;
  }
  function quadradinhos(abas, atual) {
    var nav = h('nav', { class: 'quads', 'aria-label': 'Categorias', id: 'categorias' });
    abas.forEach(function (a) {
      var on = a.chave === atual;
      nav.appendChild(h('button', { class: 'quad' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false',
        onclick: function () { ui.cat = a.chave; desenharConteudo(true); var el = document.querySelector('.quad.on'); if (el && el.scrollIntoView) el.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } },
        iconeCat(a.c.nome), h('span', { text: a.c.nome })));
    });
    return nav;
  }

  function linha(it) {
    if (porUn(it)) return linhaUn(it);
    var g = carrinho[it.chave];
    var passo = Math.max(50, min());
    var href = '#/p/' + encodeURIComponent(it.chave);
    function refazer() {
      var novo = linha(it);
      if (li.parentNode) li.parentNode.replaceChild(novo, li);
      var b = novo.querySelector('.stp-bt:last-child, .mais'); if (b) b.focus();
      desenharBarra();
    }
    var dir;
    if (g) {
      var tira = g - passo < min();
      dir = h('div', { class: 'stp', role: 'group', 'aria-label': it.n + ' no pedido' },
        h('button', { type: 'button', class: 'stp-bt', 'aria-label': tira ? 'Tirar ' + it.n + ' do pedido' : 'Menos ' + L.fmtGramas(passo) + ' de ' + it.n,
          onclick: function () { if (tira) delete carrinho[it.chave]; else carrinho[it.chave] = g - passo; guardar(); refazer(); } }, tira ? icone('x', 16) : '−'),
        h('span', { class: 'stp-v', text: L.fmtGramas(g) }),
        h('button', { type: 'button', class: 'stp-bt', 'aria-label': 'Mais ' + L.fmtGramas(passo) + ' de ' + it.n, onclick: function () { carrinho[it.chave] = g + passo; guardar(); refazer(); } }, '+'));
    } else {
      var ini = pesoPadrao(it.chave);
      dir = h('button', { class: 'mais', type: 'button', 'aria-label': 'Adicionar ' + L.fmtGramas(ini) + ' de ' + it.n, onclick: function () { add(it.chave, ini); refazer(); } }, icone('mais', 20));
    }
    var li = h('li', { class: 'linha' + (g ? ' no-pedido' : '') },
      h('a', { class: 'linha-foto', href: href, tabindex: '-1', 'aria-hidden': 'true' }, bolinha(it)),
      h('a', { class: 'linha-meio', href: href },
        h('span', { class: 'linha-nome' }, it.n, it.s ? h('em', { class: 'selo', text: it.s }) : null),
        h('span', { class: 'linha-preco' + (it.pa ? ' promo' : '') }, h('b', { text: por100(it.pk) }), it.pa ? h('s', { text: por100(it.pa) }) : null, h('small', { text: ' / 100 g' }))),
      dir);
    return li;
  }
  /** Linha de quem é vendido inteiro: "R$ 25,00 / frasco 500 ml" e − 2 +. */
  function linhaUn(it) {
    var q = carrinho[it.chave];
    var href = '#/p/' + encodeURIComponent(it.chave);
    function refazer() {
      var novo = linhaUn(it);
      if (li.parentNode) li.parentNode.replaceChild(novo, li);
      var b = novo.querySelector('.stp-bt:last-child, .mais'); if (b) b.focus();
      desenharBarra();
    }
    var dir = q ? stepperQtd(it, refazer)
      : h('button', { class: 'mais', type: 'button', 'aria-label': 'Adicionar 1 ' + it.ud + ' de ' + it.n, onclick: function () { add(it.chave, 1); refazer(); } }, icone('mais', 20));
    var li = h('li', { class: 'linha' + (q ? ' no-pedido' : '') },
      h('a', { class: 'linha-foto', href: href, tabindex: '-1', 'aria-hidden': 'true' }, bolinha(it)),
      h.apply(null, ['a', { class: 'linha-meio', href: href },
        h('span', { class: 'linha-nome' }, it.n, it.s ? h('em', { class: 'selo', text: it.s }) : null),
        h.apply(null, ['span', { class: 'linha-preco' + (it.pa ? ' promo' : '') }].concat(precoPartes(it, ' ')))]),
      dir);
    return li;
  }
  /** − n + de um item vendido por unidade. */
  function stepperQtd(it, refazer) {
    var q = carrinho[it.chave];
    return h('div', { class: 'stp', role: 'group', 'aria-label': it.n + ' no pedido' },
      h('button', { type: 'button', class: 'stp-bt', 'aria-label': q <= 1 ? 'Tirar ' + it.n + ' do pedido' : 'Um a menos de ' + it.n, onclick: function () { if (q <= 1) delete carrinho[it.chave]; else carrinho[it.chave] = q - 1; guardar(); refazer(); } }, q <= 1 ? icone('x', 16) : '−'),
      h('span', { class: 'stp-v', text: String(q) }),
      h('button', { type: 'button', class: 'stp-bt', 'aria-label': 'Mais um de ' + it.n, disabled: q >= 99, onclick: function () { carrinho[it.chave] = Math.min(99, q + 1); guardar(); refazer(); } }, '+'));
  }

  function bolasMini(kt) {
    if (kt.f) return h('img', { class: 'bola', src: kt.f, alt: '' });
    var b = h('span', { class: 'bolas-mini', 'aria-hidden': 'true' });
    kt.partes.slice(0, 3).forEach(function (x) { b.appendChild(h('i', { style: '--cor:' + corDe(x.it) })); });
    return b;
  }
  function stepperUn(chave, nome, refazer) {
    var q = carrinho[chave];
    return h('div', { class: 'stp', role: 'group', 'aria-label': nome + ' no pedido' },
      h('button', { type: 'button', class: 'stp-bt', 'aria-label': q <= 1 ? 'Tirar ' + nome + ' do pedido' : 'Um ' + nome + ' a menos', onclick: function () { if (q <= 1) delete carrinho[chave]; else carrinho[chave] = q - 1; guardar(); refazer(); } }, q <= 1 ? icone('x', 16) : '−'),
      h('span', { class: 'stp-v', text: q + (q === 1 ? ' kit' : ' kits') }),
      h('button', { type: 'button', class: 'stp-bt', 'aria-label': 'Mais um ' + nome, onclick: function () { carrinho[chave] = q + 1; guardar(); refazer(); } }, '+'));
  }
  function linhaKit(kt) {
    function refazer() { var novo = linhaKit(kt); if (li.parentNode) li.parentNode.replaceChild(novo, li); var b = novo.querySelector('.stp-bt:last-child, .mais'); if (b) b.focus(); desenharBarra(); }
    var dir = carrinho[kt.chave] ? stepperUn(kt.chave, kt.n, refazer)
      : h('button', { class: 'mais', type: 'button', 'aria-label': 'Adicionar ' + kt.n, onclick: function () { addKit(kt); refazer(); } }, icone('mais', 20));
    var li = h('li', { class: 'linha linha-kit' + (carrinho[kt.chave] ? ' no-pedido' : '') },
      h('span', { class: 'linha-foto' }, bolasMini(kt)),
      h('div', { class: 'linha-meio' },
        h('span', { class: 'linha-nome' }, kt.n, h('em', { class: 'selo d', text: ROTULO_KIT[kt.t] || 'Kit' })),
        h('span', { class: 'linha-kit-itens', text: descKit(kt) }),
        h('span', { class: 'linha-preco' }, kt.s ? h('s', { text: L.brl(kt.s) }) : null, h('b', { text: ' ' + L.brl(kt.p) }))),
      dir);
    return li;
  }

  function desenharConteudo(manter) {
    var main = document.getElementById('conteudo'); if (!main) return;
    var y = window.scrollY;
    main.textContent = '';
    var q = semAcento(ui.busca.trim());
    if (q) {
      var achou = todosItens().filter(function (i) { return semAcento(i.n).indexOf(q) >= 0 || semAcento(i.cat).indexOf(q) >= 0; });
      var ul = h('ul', { class: 'lista' });
      achou.forEach(function (i) { ul.appendChild(linha(i)); });
      main.appendChild(h('section', { class: 'secao' }, h('h2', { class: 'secao-cab', text: achou.length ? 'Resultados' : 'Nada encontrado' }),
        achou.length ? ul : h('p', { class: 'vazio', text: 'Tente outro nome ou fale com a gente no WhatsApp.' })));
    } else {
      var b = banner(); if (b) main.appendChild(b);
      var abas = abasInicio();
      if (!abas.length) { main.appendChild(h('p', { class: 'vazio', text: 'O catálogo está sem produtos no momento.' })); if (manter) window.scrollTo(0, y); return; }
      if (!abas.some(function (a) { return a.chave === ui.cat; })) ui.cat = abas[0].chave;
      var atual = abas.filter(function (a) { return a.chave === ui.cat; })[0];
      main.appendChild(quadradinhos(abas, ui.cat));
      var lista = h('ul', { class: 'lista' });
      if (atual.kits) kits.forEach(function (kt) { lista.appendChild(linhaKit(kt)); });
      else atual.c.itens.forEach(function (it) { lista.appendChild(linha(mapa[item(atual.c.nome, it).chave] || item(atual.c.nome, it))); });
      main.appendChild(h('section', { class: 'secao', 'aria-live': 'polite' },
        h('div', { class: 'secao-topo' }, h('h2', { class: 'secao-cab', text: atual.c.nome }), h('span', { text: atual.kits ? 'preço do kit' : atual.c.itens.some(function (x) { return x.pu > 0 && !(x.pk > 0); }) ? '' : 'preço por 100 g' })),
        lista));
    }
    if (manter) window.scrollTo(0, y);
  }

  // ---------- cartão de visitas da loja (#/loja): o link da bio ----------
  function telaLoja() {
    var lj = dados.loja;
    var st = L.statusHorario(lj.horarios, new Date());
    var resumo = resumoHorario();
    var nav = h('nav', { class: 'cv-botoes', 'aria-label': 'Fale com a loja' });
    var tem = {}, ordem = Array.isArray(lj.botoes) && lj.botoes.length ? lj.botoes : [{ t: 'cardapio', r: 'Ver catálogo e pedir', u: '#cardapio' }];
    function bt(tipo, texto, href, cls) {
      var a = h('a', { class: 'cv-bt ' + cls, href: href }, icone(ICONES[tipo] ? tipo : tipo === 'cardapio' ? 'cesta' : 'site', 20), h('span', { text: texto }));
      if (/^https?:/i.test(href)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
      return a;
    }
    var primeiro = true;
    ordem.forEach(function (b) {
      if (!b || typeof b.u !== 'string') return;
      if (b.t === 'cardapio') { nav.appendChild(bt('cardapio', !b.r || b.r === 'Catálogo' || b.r === 'Cardápio' ? 'Ver catálogo e pedir' : b.r, '#/', 'cv-p')); tem.cardapio = 1; return; }
      if (!/^(https?:|tel:)/i.test(b.u)) return;
      tem[b.t] = 1;
      nav.appendChild(bt(b.t, b.r, b.u, b.t === 'whatsapp' && primeiro ? 'cv-d' : 'cv-o'));
      if (b.t === 'whatsapp') primeiro = false;
    });
    if (!tem.cardapio) nav.insertBefore(bt('cardapio', 'Ver catálogo e pedir', '#/', 'cv-p'), nav.firstChild);
    if (!tem.whatsapp && lj.whatsapp) nav.appendChild(bt('whatsapp', 'WhatsApp', L.urlWhatsapp(lj.whatsapp, 'Olá, ' + lj.nome + '! Vim pelo cartão da loja.'), 'cv-d'));
    if (!tem.instagram && lj.instagram) nav.appendChild(bt('instagram', 'Instagram', lj.instagram, 'cv-o'));
    if (!tem.maps && lj.endereco) nav.appendChild(bt('maps', 'Como chegar', 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lj.endereco), 'cv-o'));
    return h('div', { class: 'wrap cv' },
      h('header', { class: 'cv-topo' }, logoEl('cv-logo'),
        h('h1', { text: lj.nome }), lj.slogan ? h('p', { class: 'cv-frase', text: lj.slogan }) : null,
        st ? h('span', { class: 'cv-st' + (st.aberto ? ' aberto' : '') }, h('i'), st.aberto ? 'Aberto agora' : 'Fechado agora') : null,
        resumo ? h('p', { class: 'cv-hora', text: resumo }) : null),
      nav,
      linhaEntrega(),
      lj.endereco ? h('p', { class: 'cv-end', text: lj.endereco }) : null,
      horariosTexto() ? h('details', { class: 'cv-horarios' }, h('summary', { text: 'Ver todos os horários' }), horariosTexto()) : null);
  }

  // ---------- cartão fidelidade (#/fidelidade): só a regra, nada do cliente ----------
  function telaFidelidade() {
    var lj = dados.loja, f = lj.fid;
    var raiz = h('div', { class: 'wrap' }, topo('Cartão fidelidade', ''));
    if (!f) { raiz.appendChild(h('p', { class: 'vazio', text: 'A loja ainda não tem cartão fidelidade.' })); return raiz; }
    var bolas = h('div', { class: 'fid-bolas', 'aria-hidden': 'true' });
    for (var i = 0; i < Math.min(f.n, 12); i++) bolas.appendChild(h('i', { class: i === Math.min(f.n, 12) - 1 ? 'premio' : '' }));
    raiz.appendChild(h('div', { class: 'pg' }, h('section', { class: 'bloco fid' },
      h('h2', { text: 'Cartão ' + lj.nome }),
      bolas,
      h('p', { class: 'fid-regra' }, 'A cada ', h('b', { text: f.n + ' compras' }), f.m > 0 ? ' a partir de ' + L.brl(f.m) : '', ', você ganha ', h('b', { text: f.p }), '.'),
      h('p', { class: 'dica-bloco', text: 'As compras são marcadas pela loja no seu nome. Para saber quantas você já tem, é só perguntar.' }),
      lj.whatsapp ? h('a', { class: 'b', href: L.urlWhatsapp(lj.whatsapp, 'Olá, ' + lj.nome + '! Quantas compras eu já tenho no cartão fidelidade?'), target: '_blank', rel: 'noopener noreferrer' }, icone('whatsapp'), 'Perguntar no WhatsApp') : null)));
    return raiz;
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
    if (!atual) return h('div', { class: 'wrap' }, topo('Categoria', ''), h('p', { class: 'vazio', text: 'Esta categoria não está mais no catálogo.' }));
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
        h('button', { class: 'voltar-cat', type: 'button', onclick: function () { if (ui.veioDoInicio) history.back(); else ir(''); } }, icone('voltar', 18), 'Catálogo'),
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
    if (!it) return h('div', { class: 'wrap' }, topo('Produto', ''), h('p', { class: 'vazio', text: 'Este produto não está mais no catálogo.' }));
    if (porUn(it)) return telaProdutoUn(it, chave);
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

    // pedir por valor: "quero 10 reais de páprica"
    var modoSeg = seg('Como escolher', [{ id: 'peso', rotulo: 'Por peso' }, { id: 'valor', rotulo: 'Por valor' }], ui.porValor ? 'valor' : 'peso', function (m) { ui.porValor = m === 'valor'; desenhar(true); });
    var gradeV = h('div', { class: 'grade-pesos', role: 'radiogroup', 'aria-label': 'Valor' });
    var campoV = h('input', { id: 'valor', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: 'Outro valor (R$)', value: ui.valorTxt || '' });
    var infoV = h('p', { class: 'por-valor', role: 'status' });
    var botaoV = h('button', { class: 'b', type: 'button' });
    function centsV() {
      var t = String(ui.valorTxt || '').trim();
      if (t) { var n = Number(t.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(n) && n > 0 ? Math.round(n * 100) : 0; }
      return ui.valorEsc || 1000;
    }
    function gramasV(c) { return Math.floor((c * 1000) / it.pk); }
    function atualizarV() {
      var c = centsV(), g = gramasV(c), ok = c > 0 && g >= min();
      infoV.textContent = ok ? L.brl(c) + ' dá ' + L.fmtGramas(g) + ' de ' + it.n.charAt(0).toLowerCase() + it.n.slice(1) + '.' : c ? 'O mínimo é ' + L.fmtGramas(min()) + ' (' + L.brl(L.precoItem(min(), it.pk)) + ').' : 'Digite um valor, por exemplo 10.';
      botaoV.disabled = !ok;
      botaoV.textContent = ok ? 'Pôr no pedido · ' + L.fmtGramas(g) + ' · ' + L.brl(L.precoItem(g, it.pk)) : 'Pôr no pedido';
      Array.prototype.forEach.call(gradeV.children, function (b) { var on = !String(ui.valorTxt || '').trim() && Number(b.getAttribute('data-c')) === (ui.valorEsc || 1000); b.className = 'peso-g' + (on ? ' on' : ''); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
    }
    [500, 1000, 1500, 2000].forEach(function (c) {
      gradeV.appendChild(h('button', { type: 'button', role: 'radio', 'data-c': String(c), onclick: function () { ui.valorEsc = c; ui.valorTxt = ''; campoV.value = ''; atualizarV(); } },
        h('b', { text: L.brl(c).replace(',00', '') }), h('span', { text: L.fmtGramas(gramasV(c)) })));
    });
    campoV.addEventListener('input', function () { ui.valorTxt = campoV.value; atualizarV(); });
    botaoV.addEventListener('click', function () { var g = gramasV(centsV()); if (!g || g < min()) return; add(chave, g); ui.valorTxt = ''; history.length > 1 ? history.back() : ir(''); });
    atualizarV();

    var junto = (it.j || []).map(function (id) { return mapa['i:' + id]; }).filter(Boolean);
    var hero = h('div', { class: 'hero-prod' + (it.f ? '' : ' sem'), style: it.f ? null : 'background:radial-gradient(70% 70% at 50% 45%, ' + misturaHex(corDe(it), '#ffffff', .55) + ', ' + misturaHex(corDe(it), '#000000', .15) + ')' }, it.f ? h('img', { class: 'hero-fundo', src: it.f, alt: '' }) : null, foto(it, 'hero-img', true),
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
        h('h3', { text: 'Quanto você quer?' }), modoSeg,
        ui.porValor ? h('div', { class: 'escolha' }, gradeV, h('label', { class: 'sr', for: 'valor', text: 'Outro valor em reais' }), campoV, infoV)
          : h('div', { class: 'escolha' }, grade, h('label', { class: 'sr', for: 'outro', text: 'Outra quantidade em gramas' }), outro, erro),
        tem ? h('p', { class: 'no-ped' }, icone('check', 14), 'Você já tem ' + L.fmtGramas(tem) + ' no pedido. ', h('button', { class: 'link', type: 'button', onclick: function () { delete carrinho[chave]; guardar(); desenhar(); } }, 'Tirar')) : null,
        ui.porValor ? botaoV : botao,
        junto.length ? h('section', { class: 'junto' }, h('h3', { text: 'Quem levou também levou' }),
          junto.reduce(function (d, x) { d.appendChild(cartao(x)); return d; }, h('div', { class: 'trilho' }))) : null));
  }

  /** Produto vendido inteiro: escolhe quantos (frascos, litros, pacotes). */
  function telaProdutoUn(it, chave) {
    var q = ui.qtdUn[chave] || 1;
    var botao = h('button', { class: 'b', type: 'button' });
    var valor = h('span', { class: 'stp-v', text: String(q), 'aria-live': 'polite' });
    var menos = h('button', { type: 'button', class: 'stp-bt', 'aria-label': 'Um a menos' }, '−');
    var mais = h('button', { type: 'button', class: 'stp-bt', 'aria-label': 'Mais um' }, '+');
    function atualizar() {
      valor.textContent = String(q); menos.disabled = q <= 1; mais.disabled = q >= 99;
      botao.textContent = 'Adicionar ' + qtdTxt(it, q) + ' · ' + L.brl(precoDe(it, q));
    }
    menos.addEventListener('click', function () { q = Math.max(1, q - 1); ui.qtdUn[chave] = q; atualizar(); });
    mais.addEventListener('click', function () { q = Math.min(99, q + 1); ui.qtdUn[chave] = q; atualizar(); });
    botao.addEventListener('click', function () { carrinho[chave] = Math.min(99, (carrinho[chave] || 0) + q); guardar(); avisar(qtdTxt(it, q) + ' · ' + it.n + ' no pedido'); ui.qtdUn[chave] = 1; history.length > 1 ? history.back() : ir(''); });
    atualizar();
    var tags = h('div', { class: 'tags' });
    if (it.s) tags.appendChild(h('span', { class: 'tag p', text: it.s }));
    if (it.mv) tags.appendChild(h('span', { class: 'tag', text: '🔥 Mais vendido' }));
    if (it.gl === 'n') tags.appendChild(h('span', { class: 'tag', text: 'Sem glúten' }));
    var junto = (it.j || []).map(function (id) { return mapa['i:' + id]; }).filter(Boolean);
    var hero = h('div', { class: 'hero-prod' + (it.f ? '' : ' sem'), style: it.f ? null : 'background:radial-gradient(70% 70% at 50% 45%, ' + misturaHex(corDe(it), '#ffffff', .55) + ', ' + misturaHex(corDe(it), '#000000', .15) + ')' }, it.f ? h('img', { class: 'hero-fundo', src: it.f, alt: '' }) : null, foto(it, 'hero-img', true),
      h('button', { class: 'voltar-flut', type: 'button', 'aria-label': 'Voltar', onclick: function () { history.length > 1 ? history.back() : ir(''); } }, icone('voltar')));
    var rot = [];
    if (it.ig) rot.push(h('span', null, h('b', { text: 'Ingredientes: ' }), it.ig));
    if (it.gl) rot.push(h('b', { text: it.gl === 'c' ? 'CONTÉM GLÚTEN.' : 'NÃO CONTÉM GLÚTEN.' }));
    if (it.al) rot.push(h('span', { text: 'Alérgicos: ' + it.al }));
    var tem = carrinho[chave];
    return h('div', { class: 'wrap' }, hero,
      h('div', { class: 'det' },
        h('h1', { text: it.n }),
        h.apply(null, ['p', { class: 'det-preco' + (it.pa ? ' promo' : '') }].concat(precoPartes(it, ' '))),
        tags.childNodes.length ? tags : null,
        it.u ? h('div', { class: 'det-info' }, h('h3', { text: 'Combina com' }), h('p', { text: it.u })) : null,
        rot.length ? h('div', { class: 'rotulo' }, rot.reduce(function (f, el, i) { if (i) f.appendChild(h('br')); f.appendChild(el); return f; }, document.createDocumentFragment())) : null,
        h('h3', { text: 'Quantos você quer?' }),
        h('div', { class: 'escolha escolha-un' }, h('div', { class: 'stp grande', role: 'group', 'aria-label': 'Quantidade de ' + it.n }, menos, valor, mais), h('span', { class: 'escolha-ud', text: it.ud })),
        tem ? h('p', { class: 'no-ped' }, icone('check', 14), 'Você já tem ' + qtdTxt(it, tem) + ' no pedido. ', h('button', { class: 'link', type: 'button', onclick: function () { delete carrinho[chave]; guardar(); desenhar(); } }, 'Tirar')) : null,
        botao,
        junto.length ? h('section', { class: 'junto' }, h('h3', { text: 'Quem levou também levou' }),
          junto.reduce(function (d, x) { d.appendChild(cartao(x)); return d; }, h('div', { class: 'trilho' }))) : null));
  }

  function topo(titulo, voltarPara) {
    return h('header', { class: 'topo' },
      h('button', { class: 'voltar', type: 'button', onclick: function () { ir(voltarPara); } }, icone('voltar'), 'Catálogo'),
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
      raiz.appendChild(h('div', { class: 'pg' }, h('p', { class: 'vazio', text: 'Seu pedido está vazio. Volte ao catálogo e escolha os produtos.' }), h('button', { class: 'b', type: 'button', onclick: function () { ir(''); } }, 'Ver o catálogo')));
      return raiz;
    }
    var ms = modos(); if (ms.indexOf(form.modo) < 0) form.modo = ms[0];
    var ps = pagamentos(); if (ps.indexOf(form.pagamento) < 0) form.pagamento = ps[0];
    var sub = L.subtotal(its), tx = taxa(sub), gratis = entregaGratis(sub);
    var cup = cupomAplicado(sub), desc = cup && cup.ok ? cup.desconto : 0, tot = sub - desc + tx;
    var e = entrega();
    var pg = h('div', { class: 'pg' });
    if (form.enviadoEm) {
      var hr = new Date(form.enviadoEm);
      pg.appendChild(h('section', { class: 'enviado', role: 'status' },
        h('p', null, h('b', { text: 'Pedido enviado às ' + String(hr.getHours()).padStart(2, '0') + 'h' + String(hr.getMinutes()).padStart(2, '0') + '.' }), ' Se o WhatsApp não abriu, toque em “Enviar pedido” de novo.'),
        h('button', { class: 'b sec', type: 'button', onclick: novoPedido }, 'Fazer um pedido novo')));
    }
    function bloco(titulo, conteudo) { return h('section', { class: 'bloco' }, h('h2', { text: titulo }), conteudo); }

    // 1. itens: foto, nome, preço por 100 g, − quantidade +, valor e "tirar"
    var passo = Math.max(50, min());
    var lista = h('ul', { class: 'ped-lista' });
    its.forEach(function (it) {
      if (it.kit) {
        var kt = kitDe(it.chave);
        lista.appendChild(h('li', { class: 'ped-item' },
          h('span', { class: 'ped-kit-arte' }, bolasMini(kt)),
          h('div', { class: 'ped-meio' }, h('strong', { text: it.n }), h('span', { class: 'ped-sub', text: it.desc }),
            h('div', { class: 'qtd-kit' }, stepperUn(it.chave, it.n, function () { desenhar(true); }))),
          h('div', { class: 'ped-dir' }, h('b', { text: L.brl(it.total) }),
            h('button', { class: 'tirar', type: 'button', 'aria-label': 'Tirar ' + it.n + ' do pedido', onclick: function () { delete carrinho[it.chave]; guardar(); desenhar(true); } }, icone('x', 16), 'Tirar'))));
        return;
      }
      var x = mapa[it.chave];
      if (porUn(x)) {
        lista.appendChild(h('li', { class: 'ped-item' },
          foto(x, 'img'),
          h('div', { class: 'ped-meio' }, h('strong', { text: it.n }), h('span', { class: 'ped-sub', text: L.brl(x.pu) + ' / ' + x.ud }),
            h('div', { class: 'qtd-kit' }, stepperQtd(x, function () { desenhar(true); }))),
          h('div', { class: 'ped-dir' }, h('b', { text: L.brl(it.total) }),
            h('button', { class: 'tirar', type: 'button', 'aria-label': 'Tirar ' + it.n + ' do pedido', onclick: function () { delete carrinho[it.chave]; guardar(); desenhar(true); } }, icone('x', 16), 'Tirar'))));
        return;
      }
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
    var sug = sugestoesCarrinho();
    if (sug) pg.appendChild(sug);

    // 2. como receber
    var receber = h('div', { class: 'bloco-in' });
    if (ms.length > 1) receber.appendChild(seg('Como receber', [{ id: 'retirada', rotulo: 'Retirada na loja', icone: 'loja' }, { id: 'entrega', rotulo: 'Pedido para entrega', icone: 'moto' }], form.modo, function (m) { form.modo = m; guardar(); desenhar(true); }));
    var dicaReceber = form.modo === 'retirada' ? 'Avisamos pelo WhatsApp quando estiver pronto para retirar.' : gratis ? 'Entrega grátis neste pedido.' : (tx ? 'Taxa de entrega: ' + L.brl(tx) + '.' : 'A taxa de entrega é combinada com a gente pelo WhatsApp.');
    receber.appendChild(h('p', { class: 'dica-bloco', text: dicaReceber }));
    if (faltaMinimo(sub)) receber.appendChild(barraMinimo(sub));
    else if (form.modo === 'entrega' && gratisAcima() && !gratis) receber.appendChild(barraGratis(sub));
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

    // cupom (só aparece quando a loja tem algum valendo), antes do pagamento para o Pix já vir com desconto
    if (temCupom()) pg.appendChild(bloco('Cupom de desconto', blocoCupom(cup, desc)));

    // 4. pagamento
    var pag = h('div', { class: 'bloco-in' });
    var rot = { pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro' };
    pag.appendChild(seg('Pagamento', ps.map(function (p) { return { id: p, rotulo: rot[p] }; }), form.pagamento, function (p) { form.pagamento = p; guardar(); desenhar(true); }));
    if (form.pagamento === 'cartao') pag.appendChild(h('p', { class: 'dica-bloco', text: form.modo === 'retirada' ? 'Pague com cartão na hora de retirar.' : 'Levamos a maquininha na entrega.' }));
    if (form.pagamento === 'dinheiro') pag.appendChild(campoTexto('f-troco', 'Troco para quanto? (opcional)', 'troco', { im: 'decimal', ph: 'Ex.: 100' }));
    if (form.pagamento === 'pix') {
      var pix = L.pixCopiaECola(dados.loja.pix, tot, 'CARDAPIO');
      if (pix) {
        var cod = h('code', { class: 'pix-cod', text: pix });
        pag.appendChild(h('div', { class: 'pix' },
          h('p', { text: (form.modo === 'entrega' && !tx && !gratis ? 'Valor dos produtos (a entrega é combinada à parte). ' : '') + 'Pague no app do seu banco e mande o comprovante no WhatsApp.' }),
          cod,
          h('button', { class: 'b sec', type: 'button', onclick: function () {
            (navigator.clipboard ? navigator.clipboard.writeText(pix) : Promise.reject()).then(function () { avisar('Código Pix copiado'); }, function () {
              var r = document.createRange(); r.selectNodeContents(cod); var sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); avisar('Selecione e copie o código');
            });
          } }, icone('copiar', 18), 'Copiar código Pix · ' + L.brl(tot))));
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
        desc ? h('div', { class: 'desc' }, h('span', { text: 'Cupom ' + cup.codigo }), h('span', { text: '− ' + L.brl(desc) })) : null,
        form.modo === 'entrega' ? h('div', null, h('span', { text: 'Entrega' }), h('span', { text: gratis ? 'grátis' : tx ? L.brl(tx) : 'a combinar' })) : h('div', null, h('span', { text: 'Retirada na loja' }), h('span', { text: 'grátis' })),
        h('div', { class: 'total' }, h('span', { text: 'Total' }), h('span', { text: L.brl(tot) + (form.modo === 'entrega' && !tx && !gratis ? ' + entrega' : '') }))),
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
    var fm = faltaMinimo(L.subtotal(its));
    if (fm) { ui.erro = 'O pedido mínimo para entrega é ' + L.brl(minimoEntrega()) + '. Adicione mais ' + L.brl(fm) + (modos().indexOf('retirada') >= 0 ? ' ou escolha Retirada na loja.' : '.'); desenhar(true); return; }
    if (!dados.loja.whatsapp) { ui.erro = 'O WhatsApp da loja ainda não foi configurado.'; desenhar(true); return; }
    var sub0 = L.subtotal(its), cup0 = cupomAplicado(sub0);
    var base = { itens: its, nome: form.nome, telefone: form.telefone, endereco: form.endereco, obs: form.obs, origem: ORIGEM, modo: form.modo, taxa: taxa(sub0), gratis: entregaGratis(sub0), pagamento: form.pagamento, troco: form.troco, cupom: cup0 && cup0.ok ? cup0.codigo : '', desconto: cup0 && cup0.ok ? cup0.desconto : 0 };
    var texto = L.montarMensagem(Object.assign({ loja: dados.loja.nome, abertura: dados.loja.abertura, fechamento: dados.loja.fechamento }, base));
    // o pedido também cai na tela "Pedidos" da loja; não segura o WhatsApp se falhar
    if (!PREVIEW) try {
      fetch(NUVEM_PEDIDOS, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(L.pedidoNuvem(Object.assign({}, base, { itens: itensParaLoja(its) }))) }).catch(function () {});
    } catch (e) { /* navegador antigo: segue só pelo WhatsApp */ }
    var a = h('a', { href: L.urlWhatsapp(dados.loja.whatsapp, texto), target: '_blank', rel: 'noopener noreferrer' });
    document.body.appendChild(a); a.click(); a.remove();
    form.enviadoEm = Date.now(); guardar(); desenhar(true);
  }
  /** Para a tela Pedidos e o PDV: o kit vira os produtos dele, com o preço do kit dividido entre eles. */
  function itensParaLoja(its) {
    var out = [];
    its.forEach(function (it) {
      if (!it.kit) { out.push(it); return; }
      var kt = kitDe(it.chave); if (!kt) return;
      var seps = kt.partes.map(function (x) { return L.precoItem(x.g, x.it.pk) * it.g; });
      var partes = L.ratearKit(it.total, seps);
      kt.partes.forEach(function (x, i) { out.push({ i: x.it.i, n: x.it.n + ' (' + kt.n + ')', g: x.g * it.g, total: partes[i] }); });
    });
    return out;
  }
  /** Sugestões opcionais no pedido: completar um kit ou um produto que costuma ir junto. Nada é marcado sozinho. */
  function sugestoesCarrinho() {
    var cards = [];
    for (var a = 0; a < kits.length; a++) {
      var kt = kits[a]; if (carrinho[kt.chave] || kt.partes.length < 2) continue;
      var tem = kt.partes.filter(function (x) { return carrinho[x.it.chave]; });
      var falta = kt.partes.filter(function (x) { return !carrinho[x.it.chave]; });
      if (falta.length !== 1 || !tem.length) continue;
      (function (kt, tem, falta) {
        cards.push(h('div', { class: 'sug sug-kit' },
          h('p', null, h('b', { text: 'Falta só ' + falta.it.n.charAt(0).toLowerCase() + falta.it.n.slice(1) }), ' para virar o ' + kt.n + '. O kit sai por ' + L.brl(kt.p) + ' (' + descKit(kt) + ').'),
          h('button', { class: 'b sec', type: 'button', onclick: function () { tem.forEach(function (x) { delete carrinho[x.it.chave]; }); carrinho[kt.chave] = 1; guardar(); avisar(kt.n + ' no pedido'); desenhar(true); } }, 'Trocar pelo kit')));
      })(kt, tem, falta[0]);
      break;
    }
    var ids = Object.keys(carrinho).filter(function (k) { return k.indexOf('i:') === 0 && mapa[k]; });
    outer: for (var i = 0; i < ids.length; i++) {
      var de = mapa[ids[i]];
      for (var j = 0; j < (de.j || []).length; j++) {
        var x = mapa['i:' + de.j[j]];
        if (x && !carrinho[x.chave]) {
          (function (de, x) {
            var g = qtdInicial(x);
            cards.push(h('div', { class: 'sug' },
              h('span', { class: 'sug-arte' }, bolinha(x)),
              h('p', null, 'Quem levou ' + de.n.charAt(0).toLowerCase() + de.n.slice(1) + ' também levou ', h('b', { text: x.n.charAt(0).toLowerCase() + x.n.slice(1) }), '.'),
              h('button', { class: 'b sec', type: 'button', onclick: function () { add(x.chave, g); desenhar(true); } }, 'Pôr ' + qtdTxt(x, g) + ' · ' + L.brl(precoDe(x, g)))));
          })(de, x);
          break outer;
        }
      }
    }
    return cards.length ? h('section', { class: 'bloco sugestoes', 'aria-label': 'Sugestões' }, h('h2', { text: 'Para completar' }), cards[0], cards[1] || null) : null;
  }
  function barraMinimo(sub) {
    var m = minimoEntrega(), pct = Math.max(4, Math.min(100, Math.round((sub / m) * 100)));
    return h('div', { class: 'gratis minimo', role: 'status' },
      h('p', null, 'Pedido mínimo para entrega: ', h('b', { text: L.brl(m) }), '. Faltam ', h('b', { text: L.brl(m - sub) }), '.'),
      h('span', { class: 'gratis-trilho', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(m), 'aria-valuenow': String(sub), 'aria-label': 'Quanto falta para o pedido mínimo de entrega' }, h('i', { style: 'width:' + pct + '%' })),
      modos().indexOf('retirada') >= 0 ? h('small', { text: 'Ou escolha Retirada na loja, que não tem mínimo.' }) : null);
  }
  function barraGratis(sub) {
    var g = gratisAcima(), pct = Math.max(4, Math.min(100, Math.round((sub / g) * 100)));
    return h('div', { class: 'gratis' },
      h('p', null, 'Faltam ', h('b', { text: L.brl(g - sub) }), ' para a entrega grátis'),
      h('span', { class: 'gratis-trilho', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(g), 'aria-valuenow': String(sub), 'aria-label': 'Quanto falta para a entrega grátis' }, h('i', { style: 'width:' + pct + '%' })));
  }
  function novoPedido() { carrinho = {}; form.enviadoEm = 0; form.obs = ''; form.cupom = ''; ui.tentou = false; guardar(); ir(''); }

  // ---------- cupom ----------
  function hojeISO() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function temCupom() { return !!(dados.loja.cup && dados.loja.cup.length); }
  function cupomAplicado(sub) { return form.cupom && temCupom() ? L.avaliarCupom(dados.loja.cup, form.cupom, sub, hojeISO()) : null; }
  function blocoCupom(cup, desc) {
    var caixa = h('div', { class: 'bloco-in cupom' });
    if (cup && cup.ok) {
      caixa.appendChild(h('p', { class: 'cupom-ok', role: 'status' }, icone('check', 18), h('span', null, 'Cupom ', h('b', { text: cup.codigo }), ' aplicado: ', h('b', { class: 'nw', text: '− ' + L.brl(desc) }))));
      caixa.appendChild(h('button', { class: 'b sec', type: 'button', onclick: function () { form.cupom = ''; ui.cupomErro = ''; guardar(); desenhar(true); } }, 'Tirar o cupom'));
      return caixa;
    }
    var inp = h('input', { id: 'f-cupom', type: 'text', autocomplete: 'off', autocapitalize: 'characters', placeholder: 'Ex.: PRIMEIRA10' });
    inp.value = ui.cupomTxt || form.cupom || '';
    inp.addEventListener('input', function () { ui.cupomTxt = inp.value; });
    function aplicar() {
      var its = itensDoPedido(), r = L.avaliarCupom(dados.loja.cup, inp.value, L.subtotal(its), hojeISO());
      if (r.ok) { form.cupom = r.codigo; ui.cupomTxt = ''; ui.cupomErro = ''; } else { form.cupom = ''; ui.cupomErro = r.erro; }
      guardar(); desenhar(true);
      if (!r.ok) { var el = document.getElementById('f-cupom'); if (el) el.focus(); }
    }
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); aplicar(); } });
    var erro = cup && !cup.ok ? cup.erro : ui.cupomErro;
    if (erro) { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', 'f-cupom-erro'); }
    caixa.appendChild(h('label', { class: 'campo', for: 'f-cupom' }, h('span', { text: 'Tem um cupom?' }),
      h('div', { class: 'cupom-linha' }, inp, h('button', { class: 'b sec', type: 'button', onclick: aplicar }, 'Aplicar'))));
    if (erro) caixa.appendChild(h('p', { id: 'f-cupom-erro', class: 'cupom-erro', role: 'alert', text: erro }));
    return caixa;
  }

  // ---------- barra do pedido ----------
  function desenharBarra() {
    var velha = document.getElementById('barra'); if (velha) velha.remove();
    var tl = rota().tela; if (tl === 'pedido' || tl === 'produto') return;
    var its = itensDoPedido();
    var lj = dados.loja;
    function item(rotulo, ic, ativo, acao) {
      var b = h('button', { class: 'nav-it' + (ativo ? ' on' : ''), type: 'button', onclick: acao, 'aria-current': ativo ? 'page' : null }, icone(ic, 22), h('span', { text: rotulo }));
      return b;
    }
    function irCategorias() {
      function rola() { var o = document.getElementById('categorias'); if (o) o.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      if (tl !== 'inicio') { ir(''); setTimeout(rola, 80); } else rola();
    }
    var carrinhoBt = h('button', { class: 'nav-carrinho', type: 'button', 'aria-label': its.length ? 'Ver pedido: ' + its.length + ' itens, ' + L.brl(L.subtotal(its)) : 'Pedido vazio', onclick: function () { ir('pedido'); } },
      icone('cesta', 26), its.length ? h('b', { class: 'nav-qtd', text: String(its.length) }) : null);
    var quarto = lj.fid
      ? item('Cartão', 'cartao', tl === 'fidelidade', function () { ir('fidelidade'); })
      : lj.whatsapp ? h('a', { class: 'nav-it', href: L.urlWhatsapp(lj.whatsapp, 'Olá, ' + lj.nome + '! Vim pelo catálogo.'), target: '_blank', rel: 'noopener noreferrer' }, icone('whatsapp', 22), h('span', { text: 'Contato' })) : h('span');
    app.appendChild(h('nav', { class: 'nav', id: 'barra', 'aria-label': 'Navegação' }, h('div', { class: 'nav-in' },
      item('Início', 'casa', tl === 'inicio', function () { if (tl === 'inicio') window.scrollTo({ top: 0, behavior: 'smooth' }); else ir(''); }),
      item('Catálogo', 'grade', tl === 'categoria', irCategorias),
      h('div', { class: 'nav-meio' }, carrinhoBt, h('small', { text: its.length ? L.brl(L.subtotal(its)) : 'Pedido' })),
      quarto,
      item('Loja', 'maps', tl === 'loja', function () { ir('loja'); }))));
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
    app.appendChild(r.tela === 'pedido' ? telaPedido() : r.tela === 'produto' ? telaProduto(r.chave) : r.tela === 'categoria' ? telaCategoria(r.idx) : r.tela === 'loja' ? telaLoja() : r.tela === 'fidelidade' ? telaFidelidade() : telaInicio());
    if (r.tela === 'inicio') desenharConteudo();
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

  /** Dados da loja no formato que o Google e os assistentes de IA leem (schema.org). */
  function dadosEstruturados() {
    if (PREVIEW) return;
    var lj = dados.loja;
    var ld = { '@context': 'https://schema.org', '@type': 'Store', name: lj.nome, url: location.origin + location.pathname };
    if (lj.slogan) ld.description = lj.slogan;
    try { ld.image = /^https?:/.test(lj.logo || '') ? lj.logo : new URL('../logo.jpg', location.href).href; } catch (e) { /* ignora */ }
    if (lj.endereco) ld.address = { '@type': 'PostalAddress', streetAddress: lj.endereco, addressCountry: 'BR' };
    if (lj.whatsapp) ld.telephone = '+' + lj.whatsapp;
    var mesmo = [lj.instagram, lj.facebook].filter(function (u) { return /^https:\/\//.test(u || ''); });
    if (mesmo.length) ld.sameAs = mesmo;
    var dias = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (Array.isArray(lj.horarios) && lj.horarios.length === 7) {
      ld.openingHoursSpecification = lj.horarios.map(function (x, i) { return x ? { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/' + dias[i], opens: x[0], closes: x[1] } : null; }).filter(Boolean);
    }
    ld.hasOfferCatalog = { '@type': 'OfferCatalog', name: 'Catálogo', itemListElement: todosItens().slice(0, 80).map(function (it) {
      return { '@type': 'Offer', itemOffered: { '@type': 'Product', name: it.n, category: it.cat }, price: ((porUn(it) ? it.pu : Math.round(it.pk / 10)) / 100).toFixed(2), priceCurrency: 'BRL', eligibleQuantity: porUn(it) ? { '@type': 'QuantitativeValue', value: 1, unitText: it.ud } : { '@type': 'QuantitativeValue', value: 100, unitCode: 'GRM' } };
    }) };
    var el = document.getElementById('ld-loja') || document.head.appendChild(h('script', { id: 'ld-loja', type: 'application/ld+json' }));
    el.textContent = JSON.stringify(ld);
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', (lj.slogan ? lj.slogan + '. ' : '') + 'Catálogo de ' + lj.nome + (lj.endereco ? ', ' + lj.endereco : '') + '. Peça pelo WhatsApp.');
  }

  function iniciar(j) {
    if (!validar(j)) return indisponivel('O catálogo não está disponível agora. Tente de novo em instantes.');
    dados = j;
    if (!Array.isArray(dados.mixes)) dados.mixes = [];
    indexar();
    indexarKits();
    document.title = 'Catálogo e pedidos · ' + j.loja.nome;
    aplicarCores(j.loja.cores);
    aplicarLetra(j.loja.letra);
    recuperar();
    dadosEstruturados();
    desenhar();
  }

  if (PREVIEW) {
    indisponivel('Montando a prévia…');
    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.tipo !== 'cardapio-previa') return;
      // várias mudanças seguidas (digitando no sistema) viram um desenho só
      var novos = e.data.dados;
      clearTimeout(iniciar.t);
      iniciar.t = setTimeout(function () { iniciar.feito = true; iniciar(novos); }, iniciar.feito ? 250 : 0);
    });
    if (window.parent !== window) window.parent.postMessage({ tipo: 'cardapio-pronto' }, location.origin);
  } else {
    // 1º: o catálogo ao vivo, publicado pelo sistema na nuvem; 2º: o arquivo cardapio.json (publicação manual)
    var NUVEM = 'https://firestore.googleapis.com/v1/projects/temperei/databases/(default)/documents/publico/cardapio?key=AIzaSyBIe_OH9xytji9DKWT_5-Pd-p8PyNk0lUE';
    var json = function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); };
    fetch(NUVEM, { cache: 'no-store' })
      .then(json)
      .then(function (d) { return JSON.parse(d.fields.json.stringValue); })
      .catch(function () { return fetch('./cardapio.json?t=' + Date.now(), { cache: 'no-store' }).then(json); })
      .then(iniciar)
      .catch(function () { indisponivel('O catálogo ainda não foi publicado. Volte em instantes.'); });
  }
})();
