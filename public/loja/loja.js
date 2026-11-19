/* Página de entrada da loja (link da bio). Lê o cardápio público e a configuração da entrada publicados pelo sistema. */
(function () {
  'use strict';
  var L = window.CardapioLib;
  var app = document.getElementById('app');
  var params = new URLSearchParams(location.search);
  var PREVIEW = params.get('preview') === '1';
  var ORIGEM = L.normalizarOrigem(params.get('o'));
  var CARDAPIO = '../cardapio/' + (ORIGEM ? '?o=' + ORIGEM : '');
  var reduzir = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr = Math.min(2, window.devicePixelRatio || 1);

  var PADRAO = {
    v: 1,
    frase: 'Do nosso pote para a sua panela.',
    texto: 'Temperos selecionados e produtos naturais, pesados na hora. Peça pelo celular e retire ou receba em casa.',
    escuro: '#2B1D17',
    fotos: [],
    capitulos: [
      { n: 'Páprica', s: 'cor de brasa, cheiro de churrasco', t: 'Doce, defumada ou picante: cada uma tem seu lugar. A defumada dá aquele sabor de fogo de chão sem acender a churrasqueira.', sb: 'A páprica é feita de pimentões secos e moídos. A defumada passa dias secando na fumaça de lenha.', c: ['Frango', 'Batata', 'Feijão', 'Molhos'], tom: '#B03818' },
      { n: 'Cúrcuma', s: 'o sol do arroz amarelinho', t: 'Uma colher de chá muda a cor e o sabor do arroz, do caldo e do frango. É o "açafrão" que a gente usa no dia a dia.', sb: 'O açafrão verdadeiro vem de uma flor e é bem mais caro. O da cozinha brasileira é a cúrcuma, uma raiz.', c: ['Arroz', 'Caldos', 'Frango', 'Legumes'], tom: '#E3A21A' },
      { n: 'Ervas', s: 'o perfume do fim da receita', t: 'Orégano, alecrim, manjericão e chimichurri. Secas, rendem mais: uma colher de erva seca vale por três de fresca.', sb: 'Erva seca entra no começo do preparo; a fresca, só no final, para não perder o aroma.', c: ['Massas', 'Pizza', 'Carnes', 'Pães'], tom: '#64703A' },
    ],
  };

  // ---------- utilidades ----------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] == null || attrs[k] === false) continue;
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k === 'style') el.setAttribute('style', attrs[k]);
      else el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(x); });
      else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function hexOk(v) { return /^#[0-9a-f]{6}$/i.test(v || '') ? v : null; }
  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lum(hex) { var c = rgb(hex).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function mistura(hex, alvo, t) { var a = rgb(hex), b = rgb(alvo); return '#' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0'); }).join(''); }
  function imgOk(s) { return /^data:image\/(jpeg|png|webp);base64,/.test(s || '') ? s : null; }

  var cores = { p: '#B03818', d: '#64703A', f: '#EFDFC6', k: '#2B1D17' };
  function pintar(fundo) {
    var r = document.documentElement.style;
    r.setProperty('--cap', fundo);
    r.setProperty('--cap-tx', lum(fundo) > 0.35 ? cores.k : '#FFF8EE');
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', fundo);
  }

  /** Tigela de madeira em 3/4 com o tempero amontoado (desenho realista, sem foto). */
  var cachePote = {};
  function poteURL(tom, px, fundoFixo, tipo) {
    var chave = tom + '|' + px + '|' + (fundoFixo || '') + '|' + (tipo || '');
    if (cachePote[chave]) return cachePote[chave];
    var c = document.createElement('canvas'); c.width = px; c.height = px;
    var x = c.getContext('2d');
    if (fundoFixo !== 'transparente') {
      x.fillStyle = fundoFixo || '#efdfc6';
      x.fillRect(0, 0, px, px);
    }
    function mh(a, b, t) { var p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16); return '#' + [16, 8, 0].map(function (s) { var u = (p >> s) & 255, v = (q >> s) & 255; return Math.round(u + (v - u) * t).toString(16).padStart(2, '0'); }).join(''); }
    var seed = 7; function r() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
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
    var n = Math.round(px * px / (tipo === 'graos' ? 14 : 6)), gr = Math.max(.7, px / (tipo === 'graos' ? 110 : 260));
    for (var i = 0; i < n; i++) {
      var gx = cx - irx + r() * irx * 2, gy = pico + r() * (topo + iry - pico);
      x.globalAlpha = .55 + r() * .45; x.fillStyle = pal[Math.floor(r() * pal.length)];
      if (tipo === 'graos') { x.beginPath(); x.ellipse(gx, gy, gr * (1 + r()), gr * .6, r() * 3, 0, 6.28); x.fill(); }
      else x.fillRect(gx, gy, gr * (1 + r()), gr * (1 + r()));
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

  // ---------- montinho de tempero (quando não há foto) ----------
  function monte(c, tom) {
    var w = c.clientWidth || 300, hh = c.clientHeight || 300;
    c.width = w * dpr; c.height = hh * dpr;
    var x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, hh);
    var paleta = [tom, mistura(tom, '#000000', 0.25), mistura(tom, '#ffffff', 0.25), mistura(tom, '#000000', 0.1)];
    var seed = 7; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(w / 2, hh * .74, w * .38, hh * .08, 0, 0, 6.28); x.fill();
    for (var i = 0; i < 2600; i++) {
      var ang = rnd() * Math.PI, rr = Math.sqrt(rnd());
      var px = w / 2 + Math.cos(ang) * rr * w * .36, py = hh * .72 - Math.sin(ang) * rr * hh * .42 * (1 - Math.abs(Math.cos(ang)) * .25);
      x.fillStyle = paleta[Math.floor(rnd() * paleta.length)];
      x.fillRect(px, py, 1.6 + rnd() * 2.2, 1.6 + rnd() * 2.2);
    }
  }
  var montes = [];
  function desenharMontes() { montes.forEach(function (m) { monte(m[0], m[1]); }); }

  // ---------- grãos flutuando na abertura ----------
  var anim = 0;
  function graos(cv, tons) {
    cancelAnimationFrame(anim);
    var ctx = cv.getContext('2d'), gs = [], W, H;
    function tam() { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function semear() {
      gs = [];
      var n = Math.round(Math.min(140, W * H / 5200));
      for (var i = 0; i < n; i++) gs.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 3.4, vy: .15 + Math.random() * .45, vx: (Math.random() - .5) * .25, a: Math.random() * 6.28, t: Math.floor(Math.random() * tons.length) });
    }
    function quadro() {
      ctx.clearRect(0, 0, W, H);
      gs.forEach(function (g) {
        if (!reduzir) { g.y += g.vy; g.x += g.vx + Math.sin(g.a += .01) * .2; if (g.y > H + 6) { g.y = -6; g.x = Math.random() * W; } }
        ctx.globalAlpha = .55 + (g.r / 4.4) * .4;
        ctx.fillStyle = tons[g.t];
        ctx.beginPath();
        if (g.t % 3 === 2) ctx.ellipse(g.x, g.y, g.r * 1.8, g.r * .8, g.a, 0, 6.28); else ctx.arc(g.x, g.y, g.r, 0, 6.28);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (!reduzir) anim = requestAnimationFrame(quadro);
    }
    tam(); semear(); quadro();
    window.addEventListener('resize', function () { tam(); semear(); if (reduzir) quadro(); });
  }

  // ---------- página ----------
  var obs = null;
  function desenhar(cardapio, entrada) {
    var lj = (cardapio && cardapio.loja) || {};
    var e = entrada && entrada.v === 1 ? entrada : PADRAO;
    cores = { p: hexOk(lj.cores && lj.cores.p) || cores.p, d: hexOk(lj.cores && lj.cores.d) || cores.d, f: hexOk(lj.cores && lj.cores.f) || cores.f, k: hexOk(e.escuro) || '#2B1D17' };
    var r = document.documentElement.style;
    r.setProperty('--p', cores.p); r.setProperty('--d', cores.d); r.setProperty('--f', cores.f); r.setProperty('--k', cores.k);
    document.title = lj.nome || 'Loja';
    app.textContent = '';
    montes = [];

    // abertura
    var st = L.statusHorario(lj.horarios, new Date());
    var logo = h('img', { class: 'logo', src: lj.logo || '../logo.jpg', alt: 'Logomarca de ' + (lj.nome || 'loja') });
    logo.addEventListener('error', function () { logo.hidden = true; });
    var cv = h('canvas', { id: 'graos', 'aria-hidden': 'true' });
    var capsBase = (Array.isArray(e.capitulos) ? e.capitulos : []).filter(function (c) { return c && c.n; }).slice(0, 5);
    var primeiro = capsBase.length ? 'cap-0' : 'como';
    app.appendChild(h('header', { class: 'abre', 'data-cor': cores.k },
      cv,
      h('div', { class: 'in abre-in' }, logo,
        st ? h('span', { class: 'status' + (st.aberto ? ' aberto' : '') }, h('i'), st.texto) : null,
        h('h1', { text: e.frase || PADRAO.frase }),
        e.texto ? h('p', { text: e.texto }) : null),
      h('a', { class: 'desce', href: '#' + primeiro }, h('span'), 'Role para descobrir')));

    // capítulos
    capsBase.forEach(function (c, i) {
      var tom = hexOk(c.tom) || cores.p;
      var foto = imgOk(c.f);
      var fig = h('figure', { class: 'monte' });
      if (foto) fig.appendChild(h('img', { src: foto, alt: c.n, loading: 'lazy' }));
      else fig.appendChild(h('img', { class: 'pote', src: poteURL(tom, 640, 'transparente'), alt: '' }));
      app.appendChild(h('section', { class: 'cap', id: 'cap-' + i, 'data-cor': tom },
        h('div', { class: 'in cap-grid' },
          h('div', null,
            h('h2', { class: 'cap-nome', text: c.n }),
            c.s ? h('div', { class: 'cap-sub', text: c.s }) : null,
            c.t ? h('p', { text: c.t }) : null,
            c.sb ? h('p', { class: 'sabia' }, h('b', { text: 'Você sabia?' }), c.sb) : null,
            Array.isArray(c.c) && c.c.length ? h('ul', { class: 'combina', 'aria-label': 'Combina com' }, c.c.map(function (x) { return h('li', { text: x }); })) : null),
          fig)));
    });

    // como pedir
    var en = lj.entrega || { ativa: true, retirada: true };
    var receber = en.ativa && en.retirada ? 'Passe na loja ou receba em casa.' : en.retirada ? 'Retire na loja quando estiver pronto.' : 'Receba em casa.';
    var pag = lj.pag || { pix: true, cartao: true, dinheiro: true };
    var formas = ['pix', 'cartao', 'dinheiro'].filter(function (k) { return pag[k]; }).map(function (k) { return { pix: 'Pix', cartao: 'cartão', dinheiro: 'dinheiro' }[k]; });
    var pesos = Array.isArray(lj.pesos) && lj.pesos.length ? lj.pesos : [50, 100, 250, 500];
    app.appendChild(h('section', { class: 'sec', id: 'como', 'data-cor': cores.f },
      h('div', { class: 'in' },
        h('h2', { class: 'titulo', text: 'Pedir é simples' }),
        h('p', { class: 'lead', text: 'Do jeito que você preferir: pelo celular ou no balcão.' }),
        h('ol', { class: 'passos' },
          h('li', null, h('h3', { text: 'Você escolhe' }), h('p', { text: 'No cardápio, a quantidade que precisa: a partir de ' + L.fmtGramas(Math.max(lj.min || 50, pesos[0])) + '. Ou um mix pronto da receita.' })),
          h('li', null, h('h3', { text: 'A gente pesa na hora' }), h('p', { text: 'Separamos e embalamos o seu pedido fresquinho, na quantidade certa.' })),
          h('li', null, h('h3', { text: en.ativa ? 'Retire ou receba' : 'Retire na loja' }), h('p', { text: receber + (formas.length ? ' Pague com ' + formas.join(', ').replace(/, ([^,]*)$/, ' ou $1') + '.' : '') }))))));

    // destaques do cardápio
    var vistos = {}, cards = [];
    (cardapio && Array.isArray(cardapio.categorias) ? cardapio.categorias : []).forEach(function (cat) {
      if (['Ofertas', 'Mais vendidos', 'Chegou agora'].indexOf(cat.nome) < 0) return;
      cat.itens.forEach(function (it) {
        if (!it || !it.i || vistos[it.i] || cards.length >= 8) return;
        vistos[it.i] = 1;
        cards.push({ rotulo: it.s || (cat.nome === 'Mais vendidos' ? 'Mais vendido' : cat.nome === 'Chegou agora' ? 'Chegou agora' : 'Oferta'), n: it.n, preco: L.brl(Math.round(it.pk / 10)), antes: it.pa ? L.brl(Math.round(it.pa / 10)) : '', f: imgOk(it.f), href: '../cardapio/' + (ORIGEM ? '?o=' + ORIGEM : '') + '#/p/' + encodeURIComponent('i:' + it.i) });
      });
    });
    (cardapio && Array.isArray(cardapio.mixes) ? cardapio.mixes : []).slice(0, 2).forEach(function (m) { cards.push({ rotulo: 'Mix pronto', n: m.n, preco: m.d || '', f: null, href: CARDAPIO, mix: true }); });
    if (cards.length) {
      var trilho = h('div', { class: 'trilho' });
      cards.forEach(function (c, i) {
        var ft = h('img', { class: 'ft', src: c.f || poteURL([cores.p, '#E3A21A', cores.d][i % 3], 300, cores.f), alt: '', loading: 'lazy' });
        trilho.appendChild(h('a', { class: 'prod', href: c.href }, ft,
          h('div', null, h('small', { text: c.rotulo }), h('b', { text: c.n }),
            h('span', null, c.mix ? c.preco : c.preco + ' / 100 g', c.antes ? h('s', { text: c.antes }) : null))));
      });
      app.appendChild(h('section', { class: 'sec', 'data-cor': cores.k },
        h('div', { class: 'in' }, h('h2', { class: 'titulo', text: 'Saindo agora' }), h('p', { class: 'lead', text: 'Ofertas e mais vendidos da semana.' }), trilho)));
    }

    // a loja
    var fotos = (Array.isArray(e.fotos) ? e.fotos : []).map(imgOk).filter(Boolean);
    var dl = h('dl');
    if (lj.endereco) { dl.appendChild(h('dt', { text: 'Endereço' })); dl.appendChild(h('dd', { text: lj.endereco })); }
    if (Array.isArray(lj.horarios) && lj.horarios.length === 7) {
      var nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      // junta dias seguidos com o mesmo horário: "Seg a Sex 8h às 18h"
      var ordem = [1, 2, 3, 4, 5, 6, 0], grupos = [];
      ordem.forEach(function (d) {
        var hr = lj.horarios[d], txt = hr ? L.fmtHora(hr[0]) + ' às ' + L.fmtHora(hr[1]) : 'Fechado';
        var g = grupos[grupos.length - 1];
        if (g && g.txt === txt) g.fim = d; else grupos.push({ ini: d, fim: d, txt: txt });
      });
      grupos.forEach(function (g) {
        var nome = g.ini === g.fim ? nomes[g.ini] : nomes[g.ini].slice(0, 3) + ' a ' + nomes[g.fim].slice(0, 3).toLowerCase();
        dl.appendChild(h('dt', { text: nome })); dl.appendChild(h('dd', { text: g.txt }));
      });
    }
    var insta = (lj.instagram || '').replace(/\/+$/, '').split('/').pop();
    if (insta) { dl.appendChild(h('dt', { text: 'Instagram' })); dl.appendChild(h('dd', { text: '@' + insta })); }
    var links = h('div', { class: 'links' });
    if (lj.endereco) links.appendChild(h('a', { class: 'btn cheio', href: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lj.endereco), target: '_blank', rel: 'noopener noreferrer' }, 'Como chegar'));
    if (lj.instagram && /^https:\/\//.test(lj.instagram)) links.appendChild(h('a', { class: 'btn', href: lj.instagram, target: '_blank', rel: 'noopener noreferrer' }, 'Instagram'));
    app.appendChild(h('section', { class: 'sec', 'data-cor': cores.f },
      h('div', { class: 'in loja-grid' + (fotos.length ? '' : ' so-info') },
        fotos.length ? h('div', { class: 'fotos' }, fotos.map(function (f) { return h('img', { src: f, alt: 'Foto da loja', loading: 'lazy' }); })) : null,
        h('div', { class: 'info' }, h('h2', { class: 'titulo', text: 'Vem conhecer' }), lj.slogan ? h('p', { class: 'lead', style: 'margin:0', text: lj.slogan }) : null, dl.childNodes.length ? dl : null, links.childNodes.length ? links : null))));
    app.appendChild(h('footer', { class: 'rodape', 'data-cor': cores.f }, h('div', { class: 'in', text: lj.nome || '' })));

    // barra fixa
    var barra = h('div', { class: 'barra-in' }, h('a', { href: CARDAPIO }, 'Ver cardápio e pedir'));
    if (lj.whatsapp) {
      var wa = h('a', { class: 'wa', href: L.urlWhatsapp(lj.whatsapp, 'Olá, ' + (lj.nome || '') + '! Vim pela página da loja.'), target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'WhatsApp' });
      wa.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1.3-4.2A8 8 0 1112 20a8 8 0 01-3.9-1z"/><path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 .7c-.8-.4-1.6-1.2-2-2l.7-1-1-2z"/></svg>'; // ícone fixo do próprio arquivo
      barra.appendChild(wa);
    }
    app.appendChild(h('nav', { class: 'barra', 'aria-label': 'Pedir' }, barra));

    // cor do capítulo pinta a página
    pintar(cores.k);
    if (obs) obs.disconnect();
    if ('IntersectionObserver' in window) {
      obs = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) pintar(x.target.getAttribute('data-cor')); }); }, { rootMargin: '-45% 0px -45% 0px' });
      app.querySelectorAll('[data-cor]').forEach(function (s) { obs.observe(s); });
    }
    graos(cv, capsBase.length ? capsBase.map(function (c) { return hexOk(c.tom) || cores.p; }).concat([cores.f]) : [cores.p, '#E3A21A', cores.d, cores.f]);
    requestAnimationFrame(desenharMontes);
  }

  if (PREVIEW) {
    window.addEventListener('message', function (ev) {
      if (ev.origin !== location.origin || !ev.data || ev.data.tipo !== 'entrada-previa') return;
      desenhar(ev.data.cardapio, ev.data.entrada);
    });
    if (window.parent !== window) window.parent.postMessage({ tipo: 'entrada-pronta' }, location.origin);
  } else {
    var BASE = 'https://firestore.googleapis.com/v1/projects/temperei/databases/(default)/documents/publico/';
    var CHAVE = '?key=AIzaSyBIe_OH9xytji9DKWT_5-Pd-p8PyNk0lUE';
    var ler = function (doc, arquivo) {
      return fetch(BASE + doc + CHAVE, { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
        .then(function (d) { return JSON.parse(d.fields.json.stringValue); })
        .catch(function () { return arquivo ? fetch(arquivo + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }) : null; })
        .catch(function () { return null; });
    };
    Promise.all([ler('cardapio', '../cardapio/cardapio.json'), ler('entrada', null)]).then(function (x) { desenhar(x[0], x[1]); });
    window.addEventListener('resize', function () { requestAnimationFrame(desenharMontes); });
  }
})();
