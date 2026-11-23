import './balancaCodigos.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { useFeedback } from '../ui/feedback';
import { Button, Notice } from '../ui/ui';
import { balancaDe, codigo4 } from '../core/balanca';
import { gruposPrateleira, listaCodigos, PRATELEIRA_PADRAO, textoCodigos } from '../core/prateleira';
import { linkWhatsapp } from '../core/pdvExtras';
import { vitrineDe } from '../core/vitrine';
import { formatBRL } from '../core/money';

type Modo = 'balanca' | 'conferencia';

function CaixaGrupo({ marcados, total, rotulo, onChange }: { marcados: number; total: number; rotulo: string; onChange: (v: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = marcados > 0 && marcados < total;
  }, [marcados, total]);
  return (
    <label className="check cb-grupo">
      <input ref={ref} type="checkbox" checked={marcados === total} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {rotulo} <small className="muted">({marcados}/{total})</small>
      </span>
    </label>
  );
}

/** Relatório bonito com os códigos da balança: marca o que entra, imprime, salva em PDF ou manda no WhatsApp. */
export default function CodigosBalanca() {
  const { state } = useApp();
  const { toast } = useFeedback();
  const { lista, loja, config } = state;
  const cfg = balancaDe(config.balanca);
  const porPrat = cfg.numeracao === 'prateleira';
  const grupos = useMemo(
    () => gruposPrateleira(lista.produtos, lista.categorias, porPrat ? cfg.prateleira ?? PRATELEIRA_PADRAO : PRATELEIRA_PADRAO).map((g) => ({ ...g, itens: g.itens.filter((x) => x.plu) })).filter((g) => g.itens.length),
    [lista.produtos, lista.categorias, porPrat, cfg.prateleira],
  );
  const todos = useMemo(() => grupos.flatMap((g) => g.itens.map((x) => x.id)), [grupos]);
  // guarda só o que foi desmarcado: produto que chega depois (nuvem, código novo) já entra marcado
  const [fora, setFora] = useState<Set<string>>(new Set());
  const marcados = useMemo(() => new Set(todos.filter((id) => !fora.has(id))), [todos, fora]);
  const [modo, setModo] = useState<Modo>('balanca');
  const [separar, setSeparar] = useState(true);
  const [preco, setPreco] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const comPreco = modo === 'conferencia' || preco;
  const secoes = useMemo(() => listaCodigos(grupos, marcados), [grupos, marcados]);
  const total = secoes.reduce((a, s) => a + s.linhas.length, 0);
  const folhas = modo === 'balanca' ? Math.max(1, Math.ceil((total + secoes.length * 2) / 52)) : Math.max(1, Math.ceil((total + secoes.length * 2) / 38));
  const nome = loja.nomeFantasia || 'Loja';
  const titulo = (i: number, cat: string) => (porPrat ? `Prateleira ${i + 1} · ${cat}` : cat);
  const logo = loja.logo || `${import.meta.env.BASE_URL}logo.jpg`;
  const hoje = new Date().toLocaleDateString('pt-BR');

  const marcar = (ids: string[], v: boolean) =>
    setFora((f) => {
      const n = new Set(f);
      ids.forEach((id) => (v ? n.delete(id) : n.add(id)));
      return n;
    });

  /** Imprime numa janela só com a folha (sem páginas em branco do resto do sistema). */
  function imprimir() {
    if (!total) return toast('Marque pelo menos um produto.', 'erro');
    const folha = document.querySelector('.folha-codigos');
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!folha || !w) return toast('O navegador bloqueou a janela de impressão. Permita janelas para este site e tente de novo.', 'erro');
    const estilos = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((e) => e.outerHTML).join('');
    w.document.write(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${nome.replace(/[<&>"]/g, '')} · Códigos da balança</title><base href="${document.baseURI}">${estilos}` +
        '<style>@page{size:A4;margin:12mm}html,body{background:#fff!important;margin:0}.folha-codigos{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head><body>' +
        folha.outerHTML +
        '</body></html>',
    );
    w.document.close();
    const ir = () => {
      w.focus();
      w.print();
    };
    const img = w.document.querySelector('img');
    if (img && !img.complete) img.addEventListener('load', ir, { once: true });
    else setTimeout(ir, 300);
    w.addEventListener('afterprint', () => w.close());
  }
  const texto = () => textoCodigos(secoes, nome, comPreco, separar);
  function mandarNosso() {
    if (!total) return toast('Marque pelo menos um produto.', 'erro');
    window.open(linkWhatsapp(vitrineDe(loja).whatsapp || loja.telefone, texto()), '_blank', 'noopener');
  }
  async function compartilhar() {
    if (!total) return toast('Marque pelo menos um produto.', 'erro');
    const t = texto();
    try {
      if (navigator.share) await navigator.share({ title: `${nome} · Códigos da balança`, text: t });
      else {
        await navigator.clipboard.writeText(t);
        toast('Lista copiada. Cole no WhatsApp ou onde quiser.');
      }
    } catch {
      /* cancelou */
    }
  }

  if (!grupos.length)
    return (
      <Notice tone="info">
        Nenhum produto tem código da balança ainda. Gere os códigos na aba <strong>Balança</strong>.
      </Notice>
    );

  const linhasTodas = secoes.flatMap((s) => s.linhas).sort((a, b) => a.codigo - b.codigo);

  return (
    <div className="cb-grid">
      <section className="card cb-opcoes" aria-label="Opções do relatório">
        <h2>Para quê?</h2>
        <div className="seg-mini cb-seg" role="group" aria-label="Tipo do relatório">
          {(
            [
              ['balanca', 'Colar na balança'],
              ['conferencia', 'Conferência'],
            ] as const
          ).map(([id, r]) => (
            <button key={id} type="button" className={modo === id ? 'on' : ''} aria-pressed={modo === id} onClick={() => setModo(id)}>
              {r}
            </button>
          ))}
        </div>
        <p className="muted small">{modo === 'balanca' ? 'Código grande, duas colunas. Para colar ao lado da balança.' : 'Com preço, o nome que aparece na balança e o tipo. Para conferir.'}</p>
        <label className="check">
          <input type="checkbox" checked={separar} onChange={(e) => setSeparar(e.target.checked)} /> <span>Separar por {porPrat ? 'prateleira' : 'categoria'}</span>
        </label>
        {modo === 'balanca' && (
          <label className="check">
            <input type="checkbox" checked={preco} onChange={(e) => setPreco(e.target.checked)} /> <span>Mostrar o preço</span>
          </label>
        )}

        <h2>O que entra</h2>
        <div className="row-gap wrap">
          <Button variant="secondary" onClick={() => setFora(new Set())}>
            Marcar todos
          </Button>
          <Button variant="ghost" onClick={() => setFora(new Set(todos))}>
            Desmarcar
          </Button>
        </div>
        <div className="cb-lista">
          {grupos.map((g, i) => {
            const ids = g.itens.map((x) => x.id);
            const n = ids.filter((id) => marcados.has(id)).length;
            const aberto = abertos.has(g.cat);
            return (
              <div key={g.cat} className="cb-bloco">
                <div className="cb-cab">
                  <CaixaGrupo marcados={n} total={ids.length} rotulo={titulo(i, g.cat)} onChange={(v) => marcar(ids, v)} />
                  <button
                    type="button"
                    className="link-btn"
                    aria-expanded={aberto}
                    onClick={() =>
                      setAbertos((a) => {
                        const x = new Set(a);
                        if (x.has(g.cat)) x.delete(g.cat);
                        else x.add(g.cat);
                        return x;
                      })
                    }
                  >
                    {aberto ? 'Fechar' : 'Escolher itens'}
                  </button>
                </div>
                {aberto && (
                  <div className="cb-itens">
                    {g.itens.map((x) => (
                      <label key={x.id} className="check">
                        <input type="checkbox" checked={marcados.has(x.id)} onChange={(e) => marcar([x.id], e.target.checked)} />
                        <span>
                          <span className="mono">{codigo4(x.plu as number)}</span> {x.nome}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="small">
          <strong>
            {total} produto{total === 1 ? '' : 's'} marcado{total === 1 ? '' : 's'}
          </strong>{' '}
          · {folhas === 1 ? 'cabe em 1 folha A4' : `cerca de ${folhas} folhas A4`}
        </p>
        <div className="row-gap wrap">
          <Button icon="file" onClick={imprimir}>
            Imprimir ou salvar PDF
          </Button>
          <Button variant="secondary" icon="send" onClick={mandarNosso}>
            Mandar no nosso WhatsApp
          </Button>
          <Button variant="secondary" onClick={compartilhar}>
            Compartilhar lista
          </Button>
        </div>
        <p className="muted small">“Mandar no nosso WhatsApp” abre a conversa com o número da loja, com a lista pronta, para conferir rápido.</p>
      </section>

      <div className="cb-papel" aria-label="Prévia da folha">
        <article className={`folha-codigos ${modo}`}>
          <header className="fc-cab">
            <img src={logo} alt="" />
            <div>
              <h3>{nome} · Códigos da balança</h3>
              <p>
                Atualizado em {hoje} · {total} produto{total === 1 ? '' : 's'}
              </p>
            </div>
          </header>
          {!total && <p className="fc-vazio">Marque os produtos que entram na lista.</p>}
          {modo === 'balanca' ? (
            separar ? (
              secoes.map((s) => (
                <section key={s.cat} className="fc-secao">
                  <h4>{titulo(grupos.findIndex((g) => g.cat === s.cat), s.cat)}</h4>
                  <div className="fc-cods">
                    {s.linhas.map((l) => (
                      <div key={l.codigo} className="fc-cod">
                        <b>{codigo4(l.codigo)}</b>
                        <span>{l.nome}</span>
                        {comPreco && <em>{formatBRL(l.preco)}</em>}
                      </div>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="fc-cods">
                {linhasTodas.map((l) => (
                  <div key={l.codigo} className="fc-cod">
                    <b>{codigo4(l.codigo)}</b>
                    <span>{l.nome}</span>
                    {comPreco && <em>{formatBRL(l.preco)}</em>}
                  </div>
                ))}
              </div>
            )
          ) : (
            <table className="fc-tab">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Produto</th>
                  <th>Nome na balança</th>
                  <th>Tipo</th>
                  <th className="num">Preço</th>
                </tr>
              </thead>
              <tbody>
                {(separar ? secoes : [{ cat: '', linhas: linhasTodas }]).flatMap((s) => [
                  ...(separar
                    ? [
                        <tr key={'c' + s.cat} className="fc-cat">
                          <td colSpan={5}>{titulo(grupos.findIndex((g) => g.cat === s.cat), s.cat)}</td>
                        </tr>,
                      ]
                    : []),
                  ...s.linhas.map((l) => (
                    <tr key={l.codigo}>
                      <td className="mono">
                        <b>{codigo4(l.codigo)}</b>
                      </td>
                      <td>{l.nome}</td>
                      <td className="mono small">{l.nomeBalanca.slice(0, 25)}</td>
                      <td>{l.porKg ? 'Peso' : 'Unidade'}</td>
                      <td className="num">
                        {formatBRL(l.preco)}
                        {l.porKg ? '/kg' : '/un'}
                      </td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          )}
          <footer className="fc-rod">{nome} · lista gerada pelo sistema</footer>
        </article>
      </div>
    </div>
  );
}
