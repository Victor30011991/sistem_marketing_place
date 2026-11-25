import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import CuponsCardapio from '../components/CuponsCardapio';
import MixesCatalogo from '../components/MixesCatalogo';
import { Button, Empty, Field, MoneyInput, Notice, PageHeader } from '../ui/ui';
import { Icon } from '../ui/icons';
import { fotoProduto } from '../ui/foto';
import type { KitCardapio, Product } from '../types';
import { contaKit, mensagemKit, novoKit, precoQuilo, sugerirChamadas, TIPOS_KIT, type Chamada } from '../core/kits';
import { linkCardapio, vitrineDe } from '../core/vitrine';
import { formatBRL } from '../core/money';
import { norm } from '../core/normalize';

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Aba para montar kits, combos e ofertas do carrossel do catálogo. */
export default function Kits() {
  useDocumentTitle('Kits e ofertas');
  const { state, act } = useApp();
  const { toast, confirm } = useFeedback();
  const { loja, lista } = state;
  const v = vitrineDe(loja);
  const kits = v.kits ?? [];
  const salvar = (n: KitCardapio[]) => act.loja({ vitrine: { ...v, kits: n } });
  const [selId, setSelId] = useState<string | null>(kits[0]?.id ?? null);
  const sel = kits.find((k) => k.id === selId) ?? null;
  const mudar = (patch: Partial<KitCardapio>) => sel && salvar(kits.map((k) => (k.id === sel.id ? { ...k, ...patch } : k)));
  const [busca, setBusca] = useState('');
  const [variacao, setVariacao] = useState(0);
  const [erroFoto, setErroFoto] = useState('');

  const porGrama = useMemo(() => lista.produtos.filter((p) => precoQuilo(p) != null), [lista.produtos]);
  const conta = sel ? contaKit(sel, lista.produtos) : null;
  const chamadas = sel && conta ? sugerirChamadas(sel, conta, variacao) : [];
  const link = linkCardapio(typeof window !== 'undefined' ? window.location.href : '');
  const escolhida: Chamada | null = chamadas.find((c) => c.titulo === sel?.chamada) ?? (sel?.chamada ? { jeito: '', titulo: sel.chamada, linha: '' } : chamadas[0] ?? null);
  const msg = sel && conta ? mensagemKit(sel, conta, escolhida, link) : '';

  const achados = useMemo(() => {
    const q = norm(busca.trim());
    if (!q || !sel) return [];
    const ja = new Set(sel.itens.map((i) => i.produtoId));
    return porGrama.filter((p) => !ja.has(p.id) && norm(p.nome).includes(q)).slice(0, 6);
  }, [busca, porGrama, sel]);

  function situacao(k: KitCardapio): { texto: string; tom: 'ok' | 'warn' | 'muted' } {
    const c = contaKit(k, lista.produtos);
    if (!k.ativo) return { texto: 'Desligado', tom: 'muted' };
    if (!k.itens.length) return { texto: 'Sem itens', tom: 'warn' };
    if (k.preco <= 0) return { texto: 'Falta o preço', tom: 'warn' };
    if (c.faltando.length) return { texto: 'Item fora do catálogo', tom: 'warn' };
    if (k.ate && k.ate < hoje()) return { texto: 'Venceu', tom: 'muted' };
    return { texto: k.carrossel ? 'No carrossel' : 'Só na lista de kits', tom: 'ok' };
  }

  function criar() {
    const k = novoKit();
    salvar([...kits, k]);
    setSelId(k.id);
    setVariacao(0);
  }
  function mover(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= kits.length) return;
    const n = [...kits];
    [n[i], n[j]] = [n[j], n[i]];
    salvar(n);
  }
  async function excluir(k: KitCardapio) {
    if (!(await confirm({ titulo: `Excluir ${k.nome}?`, mensagem: <p>Ele sai do catálogo na próxima atualização. Os pedidos já feitos não mudam.</p>, confirmar: 'Excluir kit', perigo: true }))) return;
    const n = kits.filter((x) => x.id !== k.id);
    salvar(n);
    setSelId(n[0]?.id ?? null);
  }
  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast('Mensagem copiada');
    } catch {
      toast('Não foi possível copiar. Selecione o texto e copie à mão.', 'erro');
    }
  }
  const prodDe = (id: string): Product | undefined => lista.produtos.find((p) => p.id === id);
  const corCartao = sel?.cor === 'destaque' ? 'destaque' : sel?.cor && sel.cor.startsWith('#') ? 'livre' : 'principal';

  return (
    <div className="page">
      <PageHeader
        titulo="Kits e ofertas"
        subtitulo="Monte kits e combos com preço próprio e crie cupons de desconto. Os kits aparecem no carrossel do catálogo; os cupons, na tela do pedido."
        acoes={
          <Button icon="plus" onClick={criar}>
            Novo kit
          </Button>
        }
      />
      {!kits.length ? (
        <Empty icon="tag" titulo="Nenhum kit ainda" acoes={<Button icon="plus" onClick={criar}>Montar o primeiro kit</Button>}>
          Escolha os produtos, os gramas de cada um e o preço do kit. O sistema mostra quanto o cliente economiza e sugere a chamada.
        </Empty>
      ) : (
        <div className="kits-grid">
          <section className="card kits-lista" aria-label="Kits">
            <p className="muted small">No carrossel, nesta ordem:</p>
            <ul>
              {kits.map((k, i) => {
                const st = situacao(k);
                return (
                  <li key={k.id} className={k.id === selId ? 'on' : ''}>
                    <button type="button" className="kit-item" aria-current={k.id === selId} onClick={() => { setSelId(k.id); setVariacao(0); setBusca(''); }}>
                      <span className="kit-tipo">{TIPOS_KIT.find((t) => t.id === k.tipo)?.nome}</span>
                      <strong>{k.nome}</strong>
                      <small className={`kit-st ${st.tom}`}>
                        {k.preco > 0 ? `${formatBRL(k.preco)} · ` : ''}
                        {st.texto}
                      </small>
                    </button>
                    <div className="kit-ordem">
                      <button type="button" className="icon-btn" aria-label={`Subir ${k.nome}`} disabled={i === 0} onClick={() => mover(i, -1)}>
                        <span aria-hidden="true">↑</span>
                      </button>
                      <button type="button" className="icon-btn" aria-label={`Descer ${k.nome}`} disabled={i === kits.length - 1} onClick={() => mover(i, 1)}>
                        <span aria-hidden="true">↓</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {sel && conta ? (
            <>
              <section className="card kit-editor" aria-label={`Editar ${sel.nome}`}>
                <div className="form-grid">
                  <Field label="Nome do kit">{(id) => <input id={id} value={sel.nome} maxLength={60} onChange={(e) => mudar({ nome: e.target.value })} />}</Field>
                  <Field label="Tipo">
                    {(id) => (
                      <select id={id} value={sel.tipo} onChange={(e) => mudar({ tipo: e.target.value as KitCardapio['tipo'] })}>
                        {TIPOS_KIT.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>

                <h3 className="kit-sub">Itens do kit</h3>
                {sel.itens.length ? (
                  <ul className="kit-itens">
                    {sel.itens.map((it) => {
                      const p = prodDe(it.produtoId);
                      const parte = conta.partes.find((x) => x.produto.id === it.produtoId);
                      return (
                        <li key={it.produtoId}>
                          <span className="kit-bola" style={{ background: p?.cor ?? '#d9cbb8' }} aria-hidden="true" />
                          <strong>{p?.nome ?? 'Produto apagado'}</strong>
                          <label className="kit-g">
                            <span className="sr-only">Gramas de {p?.nome}</span>
                            <input
                              type="number"
                              min={10}
                              step={10}
                              inputMode="numeric"
                              value={it.gramas}
                              onChange={(e) => {
                                const g = Math.round(Number(e.target.value));
                                if (Number.isFinite(g) && g > 0) mudar({ itens: sel.itens.map((x) => (x.produtoId === it.produtoId ? { ...x, gramas: Math.min(g, 100000) } : x)) });
                              }}
                            />
                            <span aria-hidden="true">g</span>
                          </label>
                          <span className="kit-sep">{parte ? formatBRL(parte.separado) : '—'}</span>
                          <button type="button" className="icon-btn danger" aria-label={`Tirar ${p?.nome ?? 'item'} do kit`} onClick={() => mudar({ itens: sel.itens.filter((x) => x.produtoId !== it.produtoId) })}>
                            <Icon name="x" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="muted small">Ainda sem itens. Busque abaixo.</p>
                )}
                <div className="kit-busca">
                  <Field label="Adicionar produto">
                    {(id) => <input id={id} type="search" value={busca} placeholder="Digite o nome" onChange={(e) => setBusca(e.target.value)} autoComplete="off" />}
                  </Field>
                  {achados.length > 0 && (
                    <ul className="kit-achados">
                      {achados.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              mudar({ itens: [...sel.itens, { produtoId: p.id, gramas: 100 }] });
                              setBusca('');
                            }}
                          >
                            <Icon name="plus" /> {p.nome}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {busca.trim() && !achados.length && <p className="muted small">Nenhum produto vendido por peso com esse nome.</p>}
                </div>
                {conta.faltando.length > 0 && <Notice tone="warn">Algum item não está mais no cadastro ou não vende por peso. O kit fica fora do catálogo até você tirar esse item.</Notice>}

                <div className="kit-precos">
                  <div>
                    <span>Separado sai</span>
                    <strong>{formatBRL(conta.separado)}</strong>
                  </div>
                  <Field label="Preço do kit">{(id) => <MoneyInput id={id} value={sel.preco || null} onChange={(n) => mudar({ preco: n ?? 0 })} />}</Field>
                  <div className={conta.economia > 0 ? 'eco' : ''}>
                    <span>Cliente economiza</span>
                    <strong>{conta.economia > 0 ? `${formatBRL(conta.economia)} (${conta.economiaPct}%)` : '—'}</strong>
                  </div>
                </div>
                {sel.preco > 0 && (
                  <p className={`kit-lucro ${conta.lucro != null && conta.lucro < 0 ? 'ruim' : ''}`}>
                    {conta.lucro == null
                      ? 'Para ver o lucro, cadastre o custo de todos os itens.'
                      : `Vocês lucram ${formatBRL(conta.lucro)} por kit (${conta.margem}%). Custo dos itens: ${formatBRL(conta.custo ?? 0)}. Só vocês veem isto.`}
                  </p>
                )}

                <Field label="Descrição" hint="Aparece na lista de kits do catálogo.">
                  {(id) => <textarea id={id} rows={2} maxLength={200} value={sel.descricao} onChange={(e) => mudar({ descricao: e.target.value })} />}
                </Field>
                <Field label="Frase do carrossel" hint="Use uma das sugestões ao lado ou escreva a sua.">
                  {(id) => <input id={id} maxLength={80} value={sel.chamada ?? ''} onChange={(e) => mudar({ chamada: e.target.value })} />}
                </Field>

                <fieldset className="vt-grupo">
                  <legend>Cartão do carrossel</legend>
                  <div className="kit-visual">
                    <div className="kit-foto">
                      {sel.foto ? <img src={sel.foto} alt={`Foto do ${sel.nome}`} /> : <span className="kit-foto-vazia">sem foto: mostra as cores dos itens</span>}
                      <div className="row-gap wrap">
                        <label className="btn btn-secondary">
                          {sel.foto ? 'Trocar foto' : 'Pôr foto'}
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (!f) return;
                              try {
                                setErroFoto('');
                                mudar({ foto: await fotoProduto(f, 240) });
                              } catch {
                                setErroFoto('Não consegui ler esta imagem. Tente outra (JPG ou PNG).');
                              }
                            }}
                          />
                        </label>
                        {sel.foto && (
                          <Button variant="ghost" onClick={() => mudar({ foto: undefined })}>
                            Tirar foto
                          </Button>
                        )}
                      </div>
                      {erroFoto && <span className="field-error">{erroFoto}</span>}
                    </div>
                    <div className="kit-cores" role="radiogroup" aria-label="Cor do cartão">
                      {(
                        [
                          ['principal', 'Cor principal'],
                          ['destaque', 'Cor de destaque'],
                          ['livre', 'Outra cor'],
                        ] as const
                      ).map(([id, nome]) => (
                        <label key={id} className="check">
                          <input type="radio" name="kit-cor" checked={corCartao === id} onChange={() => mudar({ cor: id === 'livre' ? (sel.cor?.startsWith('#') ? sel.cor : '#7A2B18') : id })} /> {nome}
                        </label>
                      ))}
                      {corCartao === 'livre' && (
                        <label className="vit-cor-amostra" style={{ background: sel.cor }}>
                          <span className="sr-only">Escolher a cor do cartão</span>
                          <input type="color" value={(sel.cor ?? '#7A2B18').toLowerCase()} onChange={(e) => mudar({ cor: e.target.value.toUpperCase() })} />
                        </label>
                      )}
                    </div>
                  </div>
                </fieldset>

                <div className="kit-opcoes">
                  <label className="check">
                    <input type="checkbox" checked={sel.ativo} onChange={(e) => mudar({ ativo: e.target.checked })} /> Ligado (aparece no catálogo)
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={sel.carrossel} onChange={(e) => mudar({ carrossel: e.target.checked })} /> Mostrar no carrossel
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={!!sel.ate} onChange={(e) => mudar({ ate: e.target.checked ? hoje() : undefined })} /> Vale até uma data
                  </label>
                  {sel.ate && (
                    <Field label="Último dia">{(id) => <input id={id} type="date" value={sel.ate} min={hoje()} onChange={(e) => mudar({ ate: e.target.value || undefined })} />}</Field>
                  )}
                </div>
                <p className="muted small">O kit sai do catálogo sozinho se algum item ficar sem estoque, sem preço ou for escondido.</p>
                <div className="row-gap">
                  <Button variant="danger" icon="trash" onClick={() => excluir(sel)}>
                    Excluir kit
                  </Button>
                </div>
              </section>

              <section className="card kit-chamadas" aria-label="Chamadas sugeridas">
                <div className="card-head">
                  <h2>Chamadas sugeridas</h2>
                  <Button variant="ghost" onClick={() => setVariacao((n) => n + 1)}>
                    Outras
                  </Button>
                </div>
                {chamadas.map((c) => {
                  const usando = sel.chamada === c.titulo;
                  return (
                    <div key={c.jeito} className={`kit-chamada ${usando ? 'on' : ''}`}>
                      <small>{c.jeito}</small>
                      <strong>{c.titulo}</strong>
                      <span>{c.linha}</span>
                      {usando ? (
                        <span className="kit-uso">
                          <Icon name="check" /> Em uso no carrossel
                        </span>
                      ) : (
                        <Button variant="secondary" onClick={() => mudar({ chamada: c.titulo })}>
                          Usar esta
                        </Button>
                      )}
                    </div>
                  );
                })}
                <h3 className="kit-sub">Para o status e o WhatsApp</h3>
                <pre className="kit-msg">{msg}</pre>
                <div className="row-gap wrap">
                  <Button variant="secondary" icon="copy" onClick={() => copiar(msg)}>
                    Copiar mensagem
                  </Button>
                  <a className="btn btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">
                    <Icon name="send" /> Mandar no WhatsApp
                  </a>
                </div>
                <p className="muted small">As frases são montadas com os itens, o preço e a economia do kit. Nada é enviado para nenhuma IA.</p>
              </section>
            </>
          ) : (
            <p className="muted">Escolha um kit na lista.</p>
          )}
        </div>
      )}
      <MixesCatalogo />
      <CuponsCardapio />
    </div>
  );
}
