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

  // ---------- peças ----------
  function foto(it, cls, grande) {
    if (it.f) return h('img', { class: cls, src: it.f, alt: '', loading: 'lazy' });
    return h('img', { class: cls + ' monte', src: monteURL(tomDe(it.n), grande ? 420 : 160), alt: '' });
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
    var a = h('a', { class: 'cartao', href: '#/p/' + encodeURIComponent(it.chave) },
      h('span', { class: 'cartao-foto' }, foto(it, 'img'), it.s ? h('em', { class: 'selo', text: it.s }) : it.mv ? h('em', { class: 'selo d', text: 'Mais vendido' }) : null),
      h('span', { class: 'cartao-tx' }, h('strong', { text: it.n }), precoBloco(it)));
    return a;
  }

  function linha(it) {
    var g = carrinho[it.chave];
    var escolhido = pesoPadrao(it.chave);
    var pesosEl = h('div', { class: 'pesos', role: 'radiogroup', 'aria-label': 'Quantidade de ' + it.n });
    pesos().forEach(function (p) {
      pesosEl.appendChild(h('button', { type: 'button', role: 'radio', 'aria-checked': p === escolhido ? 'true' : 'false', class: 'peso' + (p === escolhido ? ' on' : ''),
        onclick: function () { ui.peso[it.chave] = p; desenharConteudo(true); } }, L.fmtGramas(p)));
    });
    return h('li', { class: 'linha' + (g ? ' no-pedido' : '') },
      h('a', { class: 'linha-foto', href: '#/p/' + encodeURIComponent(it.chave), 'aria-label': 'Ver ' + it.n }, foto(it, 'img')),
      h('div', { class: 'linha-meio' },
        h('a', { class: 'linha-nome', href: '#/p/' + encodeURIComponent(it.chave) }, it.n, it.s ? h('em', { class: 'selo', text: it.s }) : null),
        it.u ? h('span', { class: 'linha-uso', text: it.u }) : null,
        g ? h('span', { class: 'no-ped' }, icone('check', 14), L.fmtGramas(g) + ' no pedido') : null),
      h('div', { class: 'linha-dir' }, h('span', { class: 'linha-preco' + (it.pa ? ' promo' : '') }, h('b', { text: L.brl(L.precoItem(escolhido, it.pk)) }), h('small', { text: L.fmtGramas(escolhido) })),
        h('button', { class: 'mais', type: 'button', 'aria-label': 'Adicionar ' + L.fmtGramas(escolhido) + ' de ' + it.n, onclick: function () { add(it.chave, escolhido); desenharConteudo(true); desenharBarra(); } }, icone('mais', 22))),
      pesosEl);
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
      var feitos = false;
      dados.categorias.forEach(function (c, idx) {
        if (!DESTAQUES[c.nome]) return;
        var trilho = h('div', { class: 'trilho' });
        c.itens.forEach(function (it) { trilho.appendChild(cartao(mapa[item(c.nome, it).chave] || item(c.nome, it))); });
        main.appendChild(h('section', { class: 'secao', id: 'cat-' + idx }, h('h2', { text: c.nome === 'Ofertas' ? 'Ofertas da semana' : c.nome }), trilho));
        feitos = true;
      });
      if (dados.mixes && dados.mixes.length) {
        var box = h('div', { class: 'mixes' });
        dados.mixes.forEach(function (m) { var el = mixCard(m); if (el) box.appendChild(el); });
        if (box.childNodes.length) main.appendChild(h('section', { class: 'secao', id: 'mixes' }, h('h2', { text: 'Mixes prontos' }), h('p', { class: 'secao-sub', text: 'Os temperos da receita de uma vez só.' }), box));
      }
      var grade = h('div', { class: 'grade-cat' });
      categoriasReais().forEach(function (x) {
        var tom = tomCategoria(x.c);
        grade.appendChild(h('a', { class: 'tile', href: '#/c/' + x.idx, style: 'background:' + tom },
          h('img', { src: monteURL(tom, 260, misturaHex(tom, '#ffffff', .55)), alt: '' }),
          h('span', null, h('b', { text: x.c.nome }), h('small', { text: x.c.itens.length + (x.c.itens.length === 1 ? ' produto' : ' produtos') }))));
      });
      if (grade.childNodes.length) main.appendChild(h('section', { class: 'secao', id: 'categorias' }, h('h2', { text: 'Categorias' }), grade));
      if (!dados.categorias.length) main.appendChild(h('p', { class: 'vazio', text: 'O cardápio está sem produtos no momento.' }));
      void feitos;
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
    c.itens.forEach(function (it) { var t = tomDe(it.n); conta[t] = (conta[t] || 0) + 1; });
    var melhor = null; Object.keys(conta).forEach(function (t) { if (!melhor || conta[t] > conta[melhor]) melhor = t; });
    return melhor || tomDe(c.nome);
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
          h('img', { class: 'cat-monte', src: monteURL(tom, 240, misturaHex(tom, '#ffffff', .55)), alt: '' })),
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
    var hero = h('div', { class: 'hero-prod' + (it.f ? '' : ' sem'), style: it.f ? null : 'background:radial-gradient(70% 70% at 50% 45%, ' + misturaHex(tomDe(it.n), '#ffffff', .55) + ', ' + misturaHex(tomDe(it.n), '#000000', .15) + ')' }, it.f ? h('img', { class: 'hero-fundo', src: it.f, alt: '' }) : null, foto(it, 'hero-img', true),
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
    var its = itensDoPedido(); if (!its.length) return;
    var n = its.length;
    app.appendChild(h('div', { class: 'barra', id: 'barra' }, h('button', { class: 'barra-bt', type: 'button', onclick: function () { rolagemInicio = window.scrollY; ir('pedido'); } },
      h('span', { class: 'qtd', text: String(n) }), h('span', { class: 'grow', text: 'Ver pedido' }), h('b', { text: L.brl(L.subtotal(its)) }))));
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
