import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Field, Notice, PageHeader, downloadBlob } from '../ui/ui';
import {
  ORIGENS,
  VITRINE_PADRAO,
  DIAS,
  ENTREGA_PADRAO,
  HORARIOS_PADRAO,
  PAGAMENTOS_PADRAO,
  PESOS_PADRAO,
  linkCardapio,
  montarCardapio,
  FUNDO_CARDAPIO,
  LETRAS_CARDAPIO,
  normalizarFacebook,
  normalizarInstagram,
  normalizarWhatsapp,
  vitrineDe,
  type MotivoFora,
  type Origem,
} from '../core/vitrine';
import type { BotaoCartao, HorarioDia, Product, TipoBotao, Vitrine as VitrineCfg, VisualCardapio } from '../types';
import { LOGO_COLORS } from '../core/defaults';
import { botoesPadrao, linkBotao, novoBotao, TIPOS_BOTAO } from '../core/vitrine';
import { Icon } from '../ui/icons';
import { useNuvem } from '../nuvem/NuvemProvider';
import { cfgOrcamento, contatosLoja, dadosPix } from '../core/orcamentos';
import { logoSrc } from '../ui/logo';
import { EntradaEditor } from '../components/EntradaEditor';

const MOTIVO: Record<MotivoFora, string> = {
  oculto: 'oculto por você',
  'sem-estoque': 'acabou o estoque',
  'sem-preco': 'sem preço de venda',
  'nao-peso': 'não é vendido por peso',
};

export default function Vitrine() {
  useDocumentTitle('Página da loja');
  const { state, act } = useApp();
  const { toast } = useFeedback();
  const { lista, loja } = state;
  const v = vitrineDe(loja);
  const set = (patch: Partial<VitrineCfg>) => act.loja({ vitrine: { ...v, ...patch } });
  const entrega = v.entrega ?? ENTREGA_PADRAO;
  const pagamentos = v.pagamentos ?? PAGAMENTOS_PADRAO;
  const pesos = v.pesos ?? PESOS_PADRAO;
  const temPix = !!dadosPix(cfgOrcamento(state.config.orcamentoCfg));
  const [gerandoLista, setGerandoLista] = useState(false);
  async function baixarLista() {
    setGerandoLista(true);
    try {
      const { listaEmImagens } = await import('../export/listaImagem');
      const ct = contatosLoja(loja);
      const blobs = await listaEmImagens(resultado.arquivo, logoSrc(loja), [ct.whats && `Pedidos: ${ct.whats}`, ct.insta].filter(Boolean).join('  ·  ') || loja.nomeFantasia);
      const files = blobs.map((b, i) => new File([b], `tabela-precos-${i + 1}.png`, { type: 'image/png' }));
      if (navigator.canShare?.({ files })) await navigator.share({ files });
      else files.forEach((f) => downloadBlob(f, f.name, f.type));
      toast(files.length > 1 ? `${files.length} imagens geradas.` : 'Imagem gerada.');
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast('Não foi possível gerar a imagem.', 'erro');
    } finally {
      setGerandoLista(false);
    }
  }

  // ---------- botões do cartão ----------
  const padrao = useMemo(botoesPadrao, []);
  const botoes = v.botoes ?? padrao;
  const setBotoes = (b: BotaoCartao[]) => set({ botoes: b });
  const mudarBotao = (id: string, patch: Partial<BotaoCartao>) => setBotoes(botoes.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= botoes.length) return;
    const n = [...botoes];
    [n[i], n[j]] = [n[j], n[i]];
    setBotoes(n);
  };
  const [tipoNovo, setTipoNovo] = useState<TipoBotao>('maps');

  const naNuvem = useNuvem().fase === 'conectado';
  const resultado = useMemo(() => montarCardapio(lista, loja, loja.logo, new Date(), { vendas: state.config.vendas, lotes: state.config.lotes, pix: dadosPix(cfgOrcamento(state.config.orcamentoCfg)), fidelidade: state.config.fidelidade }), [lista, loja, state.config.vendas, state.config.lotes, state.config.orcamentoCfg, state.config.fidelidade]);

  // ---------- prévia: a própria página do cliente, dentro de um quadro ----------
  const frame = useRef<HTMLIFrameElement>(null);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.tipo === 'cardapio-pronto') setPronto(true);
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);
  useEffect(() => {
    if (pronto) frame.current?.contentWindow?.postMessage({ tipo: 'cardapio-previa', dados: resultado.arquivo }, window.location.origin);
  }, [pronto, resultado]);
  const [telaPrev, setTelaPrev] = useState<'' | 'loja' | 'fidelidade'>('');
  function verNaPrevia(t: '' | 'loja' | 'fidelidade') {
    setTelaPrev(t);
    try {
      if (frame.current?.contentWindow) frame.current.contentWindow.location.hash = t ? `#/${t}` : '';
    } catch {
      /* prévia ainda carregando */
    }
  }

  // ---------- aparência do cardápio ----------
  const visual: VisualCardapio = v.visual ?? {};
  const coresLoja = loja.cores ?? LOGO_COLORS;
  const setVisual = (patch: Partial<VisualCardapio>) => {
    const n = { ...visual, ...patch };
    (Object.keys(n) as (keyof VisualCardapio)[]).forEach((k) => n[k] === undefined && delete n[k]);
    set({ visual: Object.keys(n).length ? n : undefined });
  };
  const CORES_VISUAL: { k: 'fundo' | 'principal' | 'destaque' | 'papel'; nome: string; dica: string; padrao: string }[] = [
    { k: 'fundo', nome: 'Fundo da página', dica: 'Atrás de tudo. Claro e neutro deixa os produtos aparecerem.', padrao: FUNDO_CARDAPIO },
    { k: 'principal', nome: 'Cor principal', dica: 'Botões, preços, carrinho e o nome da loja.', padrao: coresLoja.primaria },
    { k: 'destaque', nome: 'Cor de destaque', dica: 'Categoria escolhida, WhatsApp, ofertas e fidelidade.', padrao: coresLoja.destaque },
    { k: 'papel', nome: 'Cor do papel', dica: 'Fundo das fotos e dos desenhos dos produtos.', padrao: coresLoja.fundo },
  ];

  // ---------- itens por categoria ----------
  const grupos = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of lista.produtos) {
      const c = p.categoria.trim() || 'Sem categoria';
      if (!m.has(c)) m.set(c, []);
      m.get(c)!.push(p);
    }
    const ordem = [...lista.categorias.filter((c) => m.has(c)), ...[...m.keys()].filter((c) => !lista.categorias.includes(c))];
    return [...new Set(ordem)].map((nome) => ({ nome, itens: m.get(nome)!.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }));
  }, [lista]);
  const ocultos = new Set(v.ocultos);
  const foraPorMotivo = (m: MotivoFora) => resultado.fora.filter((f) => f.motivo === m).map((f) => f.produto.id);
  const problema = new Map(resultado.fora.filter((f) => f.motivo !== 'oculto').map((f) => [f.produto.id, f.motivo]));
  const semEstoque = foraPorMotivo('sem-estoque').length;

  function alternar(ids: string[], ocultar: boolean) {
    const s = new Set(v.ocultos);
    for (const id of ids) ocultar ? s.add(id) : s.delete(id);
    set({ ocultos: [...s] });
  }

  // ---------- links e arquivo ----------
  const baseSistema = typeof window !== 'undefined' ? window.location.href : '';
  const links: { rotulo: string; url: string }[] = [
    { rotulo: 'Link geral', url: linkCardapio(baseSistema) },
    { rotulo: 'Cartão de visitas (link da bio)', url: `${linkCardapio(baseSistema, 'instagram')}#/loja` },
    ...ORIGENS.map((o: { id: Origem; label: string }) => ({ rotulo: `Para o ${o.label}`, url: linkCardapio(baseSistema, o.id) })),
  ];

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copiado.');
    } catch {
      toast('Não foi possível copiar. Selecione o link e copie à mão.', 'erro');
    }
  }

  function baixar() {
    if (resultado.total === 0) return toast('Nenhum produto pode entrar no cardápio ainda. Veja os avisos abaixo.', 'erro');
    downloadBlob(new Blob([JSON.stringify(resultado.arquivo)], { type: 'application/json' }), 'cardapio.json', 'application/json');
    toast('Arquivo cardapio.json baixado. Agora envie para o GitHub (passo a passo abaixo).');
  }

  const wa = normalizarWhatsapp(v.whatsapp) || normalizarWhatsapp(loja.telefone);
  const erroWa = v.whatsapp.trim() && !normalizarWhatsapp(v.whatsapp) ? 'Número incompleto. Use DDD + número, ex.: (86) 99999-9999.' : null;
  const erroIg = v.instagram.trim() && !normalizarInstagram(v.instagram) ? 'Não entendi. Use @usuario ou o endereço do perfil.' : null;
  const erroFb = v.facebook.trim() && !normalizarFacebook(v.facebook) ? 'Não entendi. Use o nome da página ou o endereço dela.' : null;
  const faltaSemPreco = foraPorMotivo('sem-preco').length;
  const faltaNaoPeso = foraPorMotivo('nao-peso').length;

  return (
    <div className="page">
      <PageHeader
        titulo="Página da loja"
        subtitulo="O cardápio e a página de entrada que o seu cliente abre pelo link do Instagram, Facebook ou WhatsApp. Só nome, categoria e preço vão para o site: custos, margens e estoque ficam só com você."
      />

      <div className="vit-grid">
        <div className="vit-forms">
          <section className="card">
            <div className="card-head">
              <h2>Aparência do cardápio</h2>
              {v.visual && (
                <Button variant="ghost" onClick={() => set({ visual: undefined })}>
                  Voltar ao padrão
                </Button>
              )}
            </div>
            <p className="muted small">Cada cor muda o cardápio e o cartão de visitas na hora, na prévia ao lado. Sem escolher, valem as cores da Minha loja e o fundo claro.</p>
            <div className="vit-cores">
              {CORES_VISUAL.map((c) => {
                const atual = visual[c.k] ?? c.padrao;
                return (
                  <div key={c.k} className="vit-cor">
                    <label className="vit-cor-amostra" style={{ background: atual }}>
                      <span className="sr-only">{c.nome}</span>
                      <input type="color" value={atual.toLowerCase()} onChange={(e) => setVisual({ [c.k]: e.target.value.toUpperCase() })} />
                    </label>
                    <div>
                      <strong>{c.nome}</strong>
                      <small className="muted">{c.dica}</small>
                      <small className="muted">
                        {atual}
                        {visual[c.k] ? (
                          <>
                            {' · '}
                            <button type="button" className="link-btn" onClick={() => setVisual({ [c.k]: undefined })}>
                              usar o padrão
                            </button>
                          </>
                        ) : (
                          ' · padrão'
                        )}
                      </small>
                    </div>
                  </div>
                );
              })}
            </div>
            <Field label="Letra dos títulos">
              {(id) => (
                <select id={id} value={visual.letra ?? 'slab'} onChange={(e) => setVisual({ letra: e.target.value as VisualCardapio['letra'] })}>
                  {LETRAS_CARDAPIO.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <p className="muted small">A cor da bolinha de cada produto (quando ele não tem foto) se escolhe no cadastro do produto, em “Cardápio e promoção”.</p>
          </section>

          <section className="card">
            <h2>Cartão de visita e links</h2>
            <div className="form-grid">
              <Field label="Frase da loja" className="span-2" hint="Aparece abaixo do nome. Vazio = usa as “Informações adicionais” da Minha loja.">
                {(id) => <input id={id} value={v.slogan} onChange={(e) => set({ slogan: e.target.value })} placeholder={loja.informacoes || 'Ex.: Produtos naturais e especiarias'} maxLength={90} />}
              </Field>
              <Field label="WhatsApp de vendas" className="span-2" erro={erroWa} hint={wa ? `Os pedidos chegam em +${wa}.` : 'É para este número que o pedido do cliente é enviado.'}>
                {(id) => <input id={id} value={v.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} inputMode="tel" placeholder={loja.telefone || '(86) 99999-9999'} />}
              </Field>
              <Field label="Instagram da loja" erro={erroIg}>
                {(id) => <input id={id} value={v.instagram} onChange={(e) => set({ instagram: e.target.value })} placeholder="@temperei" autoCapitalize="none" />}
              </Field>
              <Field label="Facebook da loja" erro={erroFb}>
                {(id) => <input id={id} value={v.facebook} onChange={(e) => set({ facebook: e.target.value })} placeholder="facebook.com/temperei" autoCapitalize="none" />}
              </Field>
            </div>
            <p className="muted small">Estes são os contatos da loja. Os botões do cartão ficam logo abaixo. A logo e as cores são as da página “Minha loja”.</p>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Botões do cartão</h2>
              {v.botoes && (
                <Button variant="ghost" onClick={() => set({ botoes: undefined })}>
                  Voltar ao padrão
                </Button>
              )}
            </div>
            <p className="muted small">Escolha quais botões aparecem, o texto de cada um e a ordem. Botão sem link válido não aparece.</p>
            <ul className="vit-botoes">
              {botoes.map((b, i) => {
                const info = TIPOS_BOTAO.find((t) => t.tipo === b.tipo)!;
                const link = linkBotao(b, v, loja);
                return (
                  <li key={b.id} className={b.ativo ? '' : 'off'}>
                    <input type="checkbox" checked={b.ativo} aria-label={`Mostrar o botão ${b.rotulo || info.nome}`} onChange={(e) => mudarBotao(b.id, { ativo: e.target.checked })} />
                    <div className="vit-botao-campos">
                      <span className="vit-botao-tipo">{info.nome}</span>
                      <input aria-label={`Texto do botão ${info.nome}`} value={b.rotulo} placeholder={info.rotulo} maxLength={40} onChange={(e) => mudarBotao(b.id, { rotulo: e.target.value })} />
                      {b.tipo !== 'cardapio' && (
                        <input aria-label={`${info.campo} (${info.nome})`} value={b.valor} placeholder={info.campo} onChange={(e) => mudarBotao(b.id, { valor: e.target.value })} autoCapitalize="none" />
                      )}
                      <small className={link || !b.ativo ? 'muted' : 'vit-botao-erro'} title={link || undefined}>
                        {link ? (b.tipo === 'cardapio' ? info.dica : `Abre: ${link.replace(/\?text=.*$/, '')}`) : b.valor.trim() ? 'Não entendi este link. Confira o endereço.' : `${info.dica} Sem link, o botão não aparece.`}
                      </small>
                    </div>
                    <div className="vit-botao-acoes">
                      <button type="button" className="icon-btn" aria-label={`Subir ${info.nome}`} disabled={i === 0} onClick={() => mover(i, -1)}>
                        <span aria-hidden="true">↑</span>
                      </button>
                      <button type="button" className="icon-btn" aria-label={`Descer ${info.nome}`} disabled={i === botoes.length - 1} onClick={() => mover(i, 1)}>
                        <span aria-hidden="true">↓</span>
                      </button>
                      <button type="button" className="icon-btn danger" aria-label={`Remover ${info.nome}`} onClick={() => setBotoes(botoes.filter((x) => x.id !== b.id))}>
                        <Icon name="trash" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="row-gap wrap">
              <select aria-label="Tipo do novo botão" value={tipoNovo} onChange={(e) => setTipoNovo(e.target.value as TipoBotao)} style={{ maxWidth: 260 }}>
                {TIPOS_BOTAO.map((t) => (
                  <option key={t.tipo} value={t.tipo}>
                    {t.nome}
                  </option>
                ))}
              </select>
              <Button variant="secondary" icon="plus" onClick={() => setBotoes([...botoes, novoBotao(tipoNovo)])}>
                Adicionar botão
              </Button>
            </div>
          </section>

          <section className="card">
            <h2>Pedido no WhatsApp</h2>
            <div className="form-grid">
              <Field label="Menor quantidade por item (gramas)" hint="O cliente não consegue pedir menos que isso." className="span-2">
                {(id) => (
                  <input
                    id={id}
                    type="number"
                    min={10}
                    step={10}
                    inputMode="numeric"
                    value={v.minGramas}
                    onChange={(e) => {
                      const n = Math.round(Number(e.target.value));
                      if (Number.isFinite(n) && n > 0) set({ minGramas: Math.min(n, 100000) });
                    }}
                  />
                )}
              </Field>
              <Field label="Mensagem de abertura" className="span-2" hint="Vem antes da lista. {loja} vira o nome da sua loja.">
                {(id) => <textarea id={id} rows={2} value={v.abertura} onChange={(e) => set({ abertura: e.target.value })} />}
              </Field>
              <Field label="Mensagem de fechamento" className="span-2" hint="Vem depois do nome e do endereço do cliente.">
                {(id) => <textarea id={id} rows={3} value={v.fechamento} onChange={(e) => set({ fechamento: e.target.value })} />}
              </Field>
            </div>
            <div className="row-gap">
              <Button variant="ghost" onClick={() => set({ abertura: VITRINE_PADRAO.abertura, fechamento: VITRINE_PADRAO.fechamento })}>
                Restaurar textos padrão
              </Button>
            </div>
            <p className="muted small">
              A lista do pedido vai em bloco de código (letra de máquina), com produto, gramas e valor, junto do jeito de receber e de pagar que o cliente escolheu.
            </p>
          </section>

          <section className="card">
            <h2>Entrega, pagamento e horário</h2>
            <fieldset className="vt-grupo">
              <legend>Como o cliente recebe</legend>
              <label className="check">
                <input type="checkbox" checked={entrega.retirada} onChange={(e) => set({ entrega: { ...entrega, retirada: e.target.checked } })} /> Retirada na loja
              </label>
              <label className="check">
                <input type="checkbox" checked={entrega.ativa} onChange={(e) => set({ entrega: { ...entrega, ativa: e.target.checked } })} /> Entrega
              </label>
              {entrega.ativa && (
                <div className="vt-linha">
                  <label className="check">
                    <input type="radio" name="vt-taxa" checked={entrega.taxa === 'combinar'} onChange={() => set({ entrega: { ...entrega, taxa: 'combinar' } })} /> Taxa a combinar pelo WhatsApp
                  </label>
                  <label className="check">
                    <input type="radio" name="vt-taxa" checked={entrega.taxa === 'fixa'} onChange={() => set({ entrega: { ...entrega, taxa: 'fixa' } })} /> Taxa fixa
                  </label>
                  {entrega.taxa === 'fixa' && (
                    <Field label="Valor da taxa">
                      {(id) => (
                        <input
                          id={id}
                          inputMode="decimal"
                          defaultValue={entrega.valor ? (entrega.valor / 100).toFixed(2).replace('.', ',') : ''}
                          placeholder="Ex.: 5,00"
                          onBlur={(e) => {
                            const n = Math.round(Number(e.target.value.replace(/\./g, '').replace(',', '.')) * 100);
                            set({ entrega: { ...entrega, valor: Number.isFinite(n) && n > 0 ? n : 0 } });
                          }}
                        />
                      )}
                    </Field>
                  )}
                </div>
              )}
              {!entrega.ativa && !entrega.retirada && <Notice tone="warn">Marque pelo menos uma opção. Sem nenhuma, o cardápio mostra entrega.</Notice>}
            </fieldset>

            <fieldset className="vt-grupo">
              <legend>Formas de pagamento que aparecem</legend>
              {(
                [
                  ['pix', 'Pix'],
                  ['cartao', 'Cartão (na entrega ou na retirada)'],
                  ['dinheiro', 'Dinheiro (com campo de troco)'],
                ] as const
              ).map(([k, r]) => (
                <label key={k} className="check">
                  <input type="checkbox" checked={pagamentos[k]} onChange={(e) => set({ pagamentos: { ...pagamentos, [k]: e.target.checked } })} /> {r}
                </label>
              ))}
              {pagamentos.pix && (
                <p className="muted small">
                  {temPix ? 'O cliente recebe o Pix copia e cola com o valor do pedido. ' : 'Para o cliente receber o Pix copia e cola, preencha a chave Pix em Orçamentos → Pix. '}
                  Sem chave, o pedido avisa que vocês mandam a chave pelo WhatsApp.
                </p>
              )}
            </fieldset>

            <fieldset className="vt-grupo">
              <legend>Horário de funcionamento</legend>
              <label className="check">
                <input type="checkbox" checked={!!v.horarios} onChange={(e) => set({ horarios: e.target.checked ? HORARIOS_PADRAO : undefined })} /> Mostrar “Aberto agora” / “Fechado” no cardápio
              </label>
              {v.horarios && (
                <div className="vt-horarios">
                  {v.horarios.map((d, i) => {
                    const mudar = (patch: Partial<HorarioDia>) => set({ horarios: v.horarios!.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                    return (
                      <div key={DIAS[i]} className="vt-dia">
                        <label className="check">
                          <input type="checkbox" checked={d.aberto} onChange={(e) => mudar({ aberto: e.target.checked })} /> {DIAS[i]}
                        </label>
                        {d.aberto ? (
                          <span className="vt-horas">
                            <input type="time" aria-label={`${DIAS[i]}: abre`} value={d.abre} onChange={(e) => e.target.value && mudar({ abre: e.target.value })} />
                            <span>às</span>
                            <input type="time" aria-label={`${DIAS[i]}: fecha`} value={d.fecha} onChange={(e) => e.target.value && mudar({ fecha: e.target.value })} />
                          </span>
                        ) : (
                          <span className="muted small">Fechado</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <fieldset className="vt-grupo">
              <legend>Botões de quantidade nos produtos</legend>
              <div className="vt-linha">
                {[50, 100, 250, 500, 1000].map((g) => (
                  <label key={g} className="check">
                    <input
                      type="checkbox"
                      checked={pesos.includes(g)}
                      onChange={(e) => {
                        const n = e.target.checked ? [...pesos, g] : pesos.filter((x) => x !== g);
                        if (n.length) set({ pesos: n.sort((a, b) => a - b) });
                      }}
                    />{' '}
                    {g >= 1000 ? `${g / 1000} kg` : `${g} g`}
                  </label>
                ))}
              </div>
              <p className="muted small">O cliente também pode digitar outra quantidade na página do produto.</p>
            </fieldset>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Itens do cardápio</h2>
              <span className="muted small">
                {resultado.total} de {lista.produtos.length} aparecem
              </span>
            </div>
            {lista.produtos.length === 0 && <Notice tone="info">Cadastre ou importe produtos para montar o cardápio.</Notice>}
            {(faltaSemPreco > 0 || faltaNaoPeso > 0) && (
              <Notice tone="warn">
                {faltaSemPreco > 0 && <>{faltaSemPreco} produto(s) sem preço de venda ficam de fora. </>}
                {faltaNaoPeso > 0 && <>{faltaNaoPeso} produto(s) não são vendidos por peso (a venda do cardápio é por grama) e ficam de fora.</>}
              </Notice>
            )}
            <label className="check vit-auto">
              <input type="checkbox" checked={v.ocultarSemEstoque} onChange={(e) => set({ ocultarSemEstoque: e.target.checked })} />
              Esconder sozinho o produto que acabou no estoque{semEstoque > 0 && ` (${semEstoque} agora)`}
            </label>
            <div className="row-gap wrap">
              <Button variant="secondary" onClick={() => alternar(lista.produtos.map((p) => p.id), false)}>
                Mostrar todos
              </Button>
              <Button variant="ghost" onClick={() => alternar(lista.produtos.map((p) => p.id), true)}>
                Ocultar todos
              </Button>
            </div>
            <div className="vit-grupos">
              {grupos.map((g) => {
                const ids = g.itens.map((p) => p.id);
                const todosOcultos = ids.every((id) => ocultos.has(id));
                return (
                  <fieldset key={g.nome} className="vit-grupo">
                    <legend>
                      {g.nome}
                      <button type="button" className="mini" onClick={() => alternar(ids, !todosOcultos)}>
                        {todosOcultos ? 'mostrar categoria' : 'ocultar categoria'}
                      </button>
                    </legend>
                    {g.itens.map((p) => {
                      const prob = problema.get(p.id);
                      return (
                        <label key={p.id} className={`vit-item ${prob ? 'off' : ''}`}>
                          <input type="checkbox" checked={!ocultos.has(p.id)} disabled={!!prob} onChange={(e) => alternar([p.id], !e.target.checked)} />
                          <span>{p.nome}</span>
                          {prob && <em>{MOTIVO[prob]}</em>}
                        </label>
                      );
                    })}
                  </fieldset>
                );
              })}
            </div>
          </section>

          <section className="card">
            <h2>Destaques e divulgação</h2>
            <label className="check">
              <input type="checkbox" checked={v.destaques !== false} onChange={(e) => set({ destaques: e.target.checked })} />
              <span>
                Mostrar no cardápio: <strong>Ofertas</strong>, <strong>Mais vendidos</strong> (30 dias) e <strong>Chegou agora</strong> (lotes dos últimos 15 dias)
              </span>
            </label>
            <label className="check">
              <input type="checkbox" checked={v.mixes !== false} onChange={(e) => set({ mixes: e.target.checked })} />
              <span>
                Mostrar <strong>Mixes prontos</strong> no carrossel (receitas em que a loja tem todos os temperos, com o botão “Levar o mix”)
              </span>
            </label>
            {resultado.arquivo.mixes?.length ? <p className="muted small">Mixes agora: {resultado.arquivo.mixes.map((m) => m.n).join(', ')}.</p> : null}
            <p className="muted small">Fotos e promoções se colocam em cada produto (Produtos → editar → Cardápio e promoção).</p>
            {resultado.semFoto > 0 && <Notice tone="warn">{resultado.semFoto} foto(s) ficaram de fora do cardápio para ele continuar leve. Tire fotos de produtos que vendem menos.</Notice>}
            <div className="row-gap wrap">
              <Button icon="download" onClick={baixarLista} disabled={resultado.total === 0 || gerandoLista}>
                {gerandoLista ? 'Gerando…' : 'Lista de preços em imagem'}
              </Button>
              <span className="muted small">Para o status do WhatsApp e o feed do Instagram. Quando não cabe numa, sai em várias.</span>
            </div>
          </section>
          <section className="card">
            <h2>Publicar e divulgar</h2>
            {naNuvem ? (
              <Notice tone="ok">
                O cardápio <strong>se atualiza sozinho</strong>: mudou preço, estoque ou ocultou um item, em poucos segundos o cliente já vê. Só vão para lá nome, categoria e preço; os custos ficam protegidos.
              </Notice>
            ) : (
              <>
                <Notice tone="warn">
                  Para o cardápio se atualizar sozinho, clique em <strong>Entrar na nuvem</strong> (no menu) com o e-mail da loja. Sem a nuvem, é preciso baixar o arquivo e enviar ao GitHub a cada mudança. Nunca envie o Excel nem o backup .txt: eles têm os seus custos.
                </Notice>
                <details className="vit-manual">
                  <summary>Publicar sem a nuvem (arquivo manual)</summary>
                  <ol className="vit-passos">
                    <li>
                      Baixe o arquivo do cardápio: <Button icon="download" onClick={baixar} disabled={resultado.total === 0}>Baixar cardapio.json</Button>
                    </li>
                    <li>
                      No GitHub, abra o repositório, depois as pastas <code>public</code> e <code>cardapio</code>.
                    </li>
                    <li>
                      Clique em <strong>Add file → Upload files</strong>, arraste o <code>cardapio.json</code> e confirme em <strong>Commit changes</strong>.
                    </li>
                    <li>Espere cerca de 1 minuto (a aba Actions fica verde).</li>
                  </ol>
                </details>
              </>
            )}
            <h3 className="vit-sub">Links para colocar nas suas plataformas</h3>
            <ul className="vit-links">
              {links.map((l) => (
                <li key={l.rotulo}>
                  <div>
                    <strong>{l.rotulo}</strong>
                    <code>{l.url}</code>
                  </div>
                  <Button variant="secondary" icon="copy" onClick={() => copiar(l.url)}>
                    Copiar
                  </Button>
                </li>
              ))}
            </ul>
            <p className="muted small">
              Os links por origem funcionam igual ao geral. A diferença é que o pedido chega com a linha “Cheguei pelo: Instagram” (ou Facebook, WhatsApp), e você sabe de onde veio a venda.
            </p>
          </section>
        </div>

        <aside className="vit-preview" aria-label="Prévia da página do cliente">
          <div className="seg-mini" role="group" aria-label="Tela da prévia">
            {(
              [
                ['', 'Cardápio'],
                ['loja', 'Cartão de visitas'],
                ['fidelidade', 'Fidelidade'],
              ] as const
            ).map(([t, r]) => (
              <button key={t} type="button" aria-pressed={telaPrev === t} className={telaPrev === t ? 'on' : ''} onClick={() => verNaPrevia(t)}>
                {r}
              </button>
            ))}
          </div>
          <div className="vit-phone">
            <iframe ref={frame} title="Prévia da página do cliente" src={`${import.meta.env.BASE_URL}cardapio/?preview=1`} />
          </div>
          <p className="muted small">Esta é a página real do cliente, atualizada enquanto você edita.</p>
        </aside>
      </div>

      <EntradaEditor cardapio={resultado.arquivo} />
    </div>
  );
}
