/* Página pública do cardápio. Não conhece o sistema de precificação: só lê cardapio.json (nome, categoria e preço). */
(function () {
  'use strict';
  var L = window.CardapioLib;
  var app = document.getElementById('app');
  var params = new URLSearchParams(location.search);
  var PREVIEW = params.get('preview') === '1';
  var ORIGEM = L.normalizarOrigem(params.get('o'));

  var dados = null;
  var carrinho = {}; // chave "categoria|nome" -> gramas
  var form = { nome: '', endereco: '', obs: '' };
  var ui = { aba: 0, busca: '', aberto: null, erro: '', tentou: false };

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
  };
  function icone(nome) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '22'); s.setAttribute('height', '22'); s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONES[nome] || ''; // textos fixos do próprio arquivo, nunca dados do cardápio
    return s;
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
    if (d) r.setProperty('--d', toHex(mistura(d, [0, 0, 0], 0.15)));
    if (f) { r.setProperty('--f', toHex(f)); r.setProperty('--bg', toHex(mistura(f, [255, 255, 255], 0.65))); }
  }

  // ---------- dados ----------
  function todosItens() {
    var out = [];
    dados.categorias.forEach(function (cat) { cat.itens.forEach(function (it) { out.push({ chave: cat.nome + '|' + it.n, cat: cat.nome, n: it.n, pk: it.pk }); }); });
    return out;
  }
  function itensDoPedido() {
    var mapa = {};
    todosItens().forEach(function (i) { mapa[i.chave] = i; });
    var out = [];
    Object.keys(carrinho).forEach(function (k) {
      if (mapa[k]) out.push({ chave: k, n: mapa[k].n, g: carrinho[k], total: L.precoItem(carrinho[k], mapa[k].pk) });
      else delete carrinho[k]; // item que saiu do cardápio depois de uma versão antiga
    });
    return out;
  }
  function min() { return (dados.loja && dados.loja.min) || 50; }
  function msgMinimo() { return 'O mínimo por item é ' + L.fmtGramas(min()) + '.'; }

  // ---------- rotas por # ----------
  function rota() { var r = (location.hash || '').replace(/^#\/?/, ''); return r === 'cardapio' || r === 'pedido' ? r : 'cartao'; }
  function ir(r) { location.hash = r === 'cartao' ? '' : '#/' + r; }
  window.addEventListener('hashchange', function () { ui.erro = ''; ui.aberto = null; desenhar(); window.scrollTo(0, 0); });

  // ---------- telas ----------
  function botaoLink(icon, texto, href, primario) {
    return h('a', { class: 'btn' + (primario ? ' primario' : ''), href: href, target: '_blank', rel: 'noopener noreferrer' }, icone(icon), h('span', { class: 'grow', text: texto }));
  }

  function telaCartao() {
    var lj = dados.loja;
    var n = itensDoPedido().length;
    var logo = h('img', { class: 'logo', src: lj.logo || '../logo.jpg', alt: 'Logomarca de ' + lj.nome });
    logo.addEventListener('error', function () { logo.style.display = 'none'; });
    var links = h('nav', { class: 'links', 'aria-label': 'Escolha uma opção' });
    function botaoCardapio(rotulo, primario) {
      return h('button', { class: 'btn' + (primario ? ' primario' : ''), type: 'button', onclick: function () { ir('cardapio'); } }, icone('menu'),
        h('span', { class: 'grow', text: rotulo }), n ? h('small', { text: n + (n === 1 ? ' item no pedido' : ' itens no pedido') }) : null);
    }
    if (Array.isArray(lj.botoes)) {
      // botões escolhidos na Página da loja, na ordem dela; o primeiro botão de cardápio ganha destaque
      var destaque = false;
      lj.botoes.forEach(function (b) {
        if (!b || typeof b.u !== 'string' || typeof b.r !== 'string') return;
        if (b.t === 'cardapio') { links.appendChild(botaoCardapio(b.r, !destaque)); destaque = true; return; }
        if (!/^(https?:|tel:)/i.test(b.u)) return; // só links seguros
        var a = botaoLink(ICONES[b.t] ? b.t : 'site', b.r, b.u);
        if (/^tel:/i.test(b.u)) { a.removeAttribute('target'); a.removeAttribute('rel'); }
        links.appendChild(a);
      });
    } else {
      links.appendChild(botaoCardapio('Cardápio', true));
      if (lj.instagram) links.appendChild(botaoLink('instagram', 'Instagram', lj.instagram));
      if (lj.facebook) links.appendChild(botaoLink('facebook', 'Facebook', lj.facebook));
      if (lj.whatsapp) links.appendChild(botaoLink('whatsapp', 'WhatsApp', L.urlWhatsapp(lj.whatsapp, 'Olá, ' + lj.nome + '! Vim pelo cardápio e gostaria de falar com vocês.')));
    }
    return h('div', { class: 'wrap' },
      h('header', { class: 'hero' }, logo, h('h1', { text: lj.nome }), lj.slogan ? h('p', { text: lj.slogan }) : null),
      links,
      h('p', { class: 'foot', text: lj.nome }));
  }

  function topo(titulo, voltarPara, voltarTexto, extra) {
    return h('header', { class: 'topo' },
      h('div', { class: 'topo-linha' },
        h('button', { class: 'voltar', type: 'button', onclick: function () { ir(voltarPara); } }, icone('voltar'), voltarTexto),
        h('h2', { text: titulo })),
      extra);
  }

  function linhaItem(it) {
    var g = carrinho[it.chave];
    var aberto = ui.aberto === it.chave;
    var por100 = L.brl(Math.round(it.pk / 10)) + ' / 100 g';
    var li = h('li', { class: 'item' + (g ? ' no-pedido' : '') });
    li.appendChild(h('button', { class: 'item-topo', type: 'button', 'aria-expanded': aberto ? 'true' : 'false', onclick: function () {
      ui.aberto = aberto ? null : it.chave; ui.erro = ''; desenhar(true);
    } },
      h('span', { class: 'item-nome' }, it.n, g ? h('small', { text: L.fmtGramas(g) + ' no pedido' }) : null),
      h('span', { class: 'item-preco' }, por100, h('small', { text: L.brl(it.pk) + ' / kg' }))));
    if (aberto) li.appendChild(painelItem(it));
    return li;
  }

  function painelItem(it) {
    var atual = carrinho[it.chave] || 0;
    var entrada = h('input', { id: 'g-' + btoa(unescape(encodeURIComponent(it.chave))).replace(/=/g, ''), type: 'text', inputmode: 'numeric', autocomplete: 'off', value: atual ? String(atual) : '', placeholder: String(min()) });
    var total = h('span', { class: 'total-vivo', 'aria-live': 'polite' });
    var erro = h('p', { class: 'erro', role: 'alert' });
    var botao = h('button', { class: 'b', type: 'button' }, atual ? 'Atualizar pedido' : 'Adicionar ao pedido');
    function ler() { return L.parseGramas(entrada.value); }
    function atualizar() {
      var g = ler();
      total.textContent = g ? L.brl(L.precoItem(g, it.pk)) : '';
      erro.textContent = entrada.value.trim() && (!g || g < min()) ? (g ? msgMinimo() : 'Digite só números, por exemplo 250.') : '';
      botao.disabled = !g || g < min();
    }
    entrada.addEventListener('input', atualizar);
    entrada.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (!botao.disabled) botao.click(); } });
    botao.addEventListener('click', function () {
      var g = ler(); if (!g || g < min()) return;
      carrinho[it.chave] = g; guardar(); ui.aberto = null; desenhar(true);
    });
    var atalhos = h('div', { class: 'atalhos', role: 'group', 'aria-label': 'Atalhos de quantidade' });
    [[100, '100 g'], [250, '250 g'], [500, '500 g'], [1000, '1 kg']].forEach(function (a) {
      if (a[0] < min()) return;
      atalhos.appendChild(h('button', { class: 'atalho', type: 'button', onclick: function () { entrada.value = String(a[0]); atualizar(); entrada.focus(); } }, a[1]));
    });
    var acoes = h('div', { class: 'acoes' });
    if (atual) acoes.appendChild(h('button', { class: 'b sec', type: 'button', onclick: function () { delete carrinho[it.chave]; guardar(); ui.aberto = null; desenhar(true); } }, 'Remover'));
    acoes.appendChild(botao);
    var painel = h('div', { class: 'painel' },
      h('div', { class: 'campo-g' }, h('label', { for: entrada.id, text: 'Quantas gramas?' }), h('div', { class: 'entrada' }, entrada, h('span', { text: 'g' }))),
      atalhos, erro,
      h('div', { class: 'painel-linha' }, total, acoes));
    atualizar();
    return painel;
  }

  function telaCardapio() {
    var cats = dados.categorias;
    if (ui.aba >= cats.length) ui.aba = 0;
    var busca = h('input', { class: 'busca', type: 'search', placeholder: 'Buscar produto', value: ui.busca, id: 'busca', autocomplete: 'off', enterkeyhint: 'search' });
    busca.addEventListener('input', function () { ui.busca = busca.value; ui.aberto = null; desenharLista(); });
    var abas = h('div', { class: 'abas', role: 'tablist', 'aria-label': 'Categorias' });
    cats.forEach(function (c, i) {
      abas.appendChild(h('button', { class: 'aba', type: 'button', role: 'tab', 'aria-selected': !ui.busca && i === ui.aba ? 'true' : 'false', onclick: function () { ui.aba = i; ui.busca = ''; ui.aberto = null; desenhar(true); } }, c.nome));
    });
    var raiz = h('div', { class: 'wrap' },
      topo('Cardápio', 'cartao', 'Início', h('div', null, h('label', { class: 'sr', for: 'busca', text: 'Buscar produto' }), busca, cats.length > 1 ? abas : null)),
      h('p', { class: 'dica', text: 'Toque num produto, digite as gramas ou escolha um atalho.' }),
      h('ul', { class: 'lista', id: 'lista' }));
    return raiz;
  }

  function desenharLista() {
    var ul = document.getElementById('lista'); if (!ul) return;
    ul.textContent = '';
    var q = ui.busca.trim().toLowerCase();
    var semAcento = function (t) { return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
    if (q) {
      var achou = todosItens().filter(function (i) { return semAcento(i.n).indexOf(semAcento(q)) >= 0; });
      if (!achou.length) ul.appendChild(h('li', { class: 'vazio', text: 'Nenhum produto encontrado.' }));
      achou.forEach(function (i) { ul.appendChild(linhaItem(i)); });
    } else {
      var cat = dados.categorias[ui.aba];
      if (!cat) ul.appendChild(h('li', { class: 'vazio', text: 'O cardápio está sem produtos no momento.' }));
      else cat.itens.forEach(function (it) { ul.appendChild(linhaItem({ chave: cat.nome + '|' + it.n, cat: cat.nome, n: it.n, pk: it.pk })); });
    }
    var f = ul.querySelector('input[type=text]'); if (f && ui.focar) { f.focus(); }
  }

  function barraPedido() {
    var its = itensDoPedido(); if (!its.length) return null;
    return h('div', { class: 'barra' }, h('div', { class: 'barra-in' },
      h('button', { class: 'btn primario', type: 'button', onclick: function () { ir('pedido'); } }, icone('cesta'),
        h('span', { class: 'grow', text: 'Ver pedido · ' + its.length + (its.length === 1 ? ' item' : ' itens') }), h('span', { text: L.brl(L.subtotal(its)) }))));
  }

  function telaPedido() {
    var its = itensDoPedido();
    var raiz = h('div', { class: 'wrap' }, topo('Seu pedido', 'cardapio', 'Cardápio'));
    if (!its.length) {
      raiz.appendChild(h('p', { class: 'vazio', text: 'Seu pedido está vazio. Volte ao cardápio e escolha os produtos.' }));
      return raiz;
    }
    var box = h('div', { class: 'pedido' });
    its.forEach(function (it) {
      var campo = h('input', { type: 'text', inputmode: 'numeric', value: String(it.g), 'aria-label': 'Gramas de ' + it.n });
      var val = h('span', { class: 'valor', text: L.brl(it.total) });
      var err = h('p', { class: 'erro', role: 'alert' });
      var mapa = todosItens().filter(function (x) { return x.chave === it.chave; })[0];
      campo.addEventListener('change', function () {
        var g = L.parseGramas(campo.value);
        if (!g || g < min()) { err.textContent = g ? msgMinimo() : 'Digite só números, por exemplo 250.'; return; }
        carrinho[it.chave] = g; guardar(); desenhar(true);
      });
      campo.addEventListener('input', function () { var g = L.parseGramas(campo.value); if (g && g >= min() && mapa) val.textContent = L.brl(L.precoItem(g, mapa.pk)); });
      box.appendChild(h('div', { class: 'linha-ped' }, h('strong', { text: it.n }), val,
        h('div', { class: 'editar' }, h('div', { class: 'entrada' }, campo, h('span', { text: 'g' })),
          h('button', { class: 'rem', type: 'button', onclick: function () { delete carrinho[it.chave]; guardar(); desenhar(true); } }, 'Remover')), err));
    });
    box.appendChild(h('div', { class: 'resumo' }, h('span', { text: 'Subtotal' }), h('span', { text: L.brl(L.subtotal(its)) })));
    box.appendChild(h('p', { class: 'aviso', text: 'A taxa de entrega será informada no fechamento da venda.' }));

    var erroEl = h('p', { class: 'erro', role: 'alert', text: ui.erro });
    var nome = h('input', { id: 'f-nome', type: 'text', autocomplete: 'name', value: form.nome, class: ui.tentou && !form.nome.trim() ? 'invalido' : null });
    var end = h('textarea', { id: 'f-end', autocomplete: 'street-address', class: ui.tentou && !form.endereco.trim() ? 'invalido' : null }); end.value = form.endereco;
    var obs = h('textarea', { id: 'f-obs' }); obs.value = form.obs;
    function limpaErro() { if (ui.erro) { ui.erro = ''; erroEl.textContent = ''; } }
    nome.addEventListener('input', function () { form.nome = nome.value; guardar(); limpaErro(); });
    end.addEventListener('input', function () { form.endereco = end.value; guardar(); limpaErro(); });
    obs.addEventListener('input', function () { form.obs = obs.value; guardar(); });
    box.appendChild(h('div', { class: 'form' },
      h('label', { for: 'f-nome' }, 'Seu nome', nome),
      h('label', { for: 'f-end' }, 'Endereço de entrega', h('small', { text: 'Rua, número, bairro e ponto de referência.' }), end),
      h('label', { for: 'f-obs' }, 'Observações (opcional)', obs)));

    box.appendChild(erroEl);
    box.appendChild(h('button', { class: 'b', type: 'button', onclick: finalizar }, 'Finalizar compra no WhatsApp'));
    raiz.appendChild(box);
    return raiz;
  }

  function finalizar() {
    var its = itensDoPedido();
    ui.tentou = true;
    if (!its.length) return;
    if (!form.nome.trim() || !form.endereco.trim()) { ui.erro = 'Preencha seu nome e o endereço de entrega.'; desenhar(true); return; }
    if (!dados.loja.whatsapp) { ui.erro = 'O WhatsApp da loja ainda não foi configurado.'; desenhar(true); return; }
    var texto = L.montarMensagem({ loja: dados.loja.nome, abertura: dados.loja.abertura, fechamento: dados.loja.fechamento,
      itens: its, nome: form.nome, endereco: form.endereco, obs: form.obs, origem: ORIGEM });
    var a = h('a', { href: L.urlWhatsapp(dados.loja.whatsapp, texto), target: '_blank', rel: 'noopener noreferrer' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- desenho ----------
  function desenhar(manterRolagem) {
    if (!dados) return;
    var y = window.scrollY;
    var r = rota();
    var foco = document.activeElement && document.activeElement.id;
    app.textContent = '';
    var tela = r === 'cardapio' ? telaCardapio() : r === 'pedido' ? telaPedido() : telaCartao();
    app.appendChild(tela);
    if (r === 'cardapio') { desenharLista(); var b = barraPedido(); if (b) app.appendChild(b); }
    if (foco && foco !== 'busca') { var el = document.getElementById(foco); if (el) el.focus(); }
    if (foco === 'busca') { var bb = document.getElementById('busca'); if (bb) { bb.focus(); var l = bb.value.length; try { bb.setSelectionRange(l, l); } catch (e) { /* ignora */ } } }
    if (manterRolagem) window.scrollTo(0, y);
  }

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
    fetch('./cardapio.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(iniciar)
      .catch(function () { indisponivel('O cardápio ainda não foi publicado. Volte em instantes.'); });
  }
})();
