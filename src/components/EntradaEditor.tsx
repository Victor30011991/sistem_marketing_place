import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { useFeedback } from '../ui/feedback';
import { Button, Field, Notice } from '../ui/ui';
import { fotoProduto } from '../ui/foto';
import { newId } from '../core/normalize';
import { CAPITULOS_PADRAO, ENTRADA_PADRAO, MAX_CAPITULOS, MAX_FOTOS_LOJA, PALETAS, entradaDe, linkEntrada, montarEntrada } from '../core/entrada';
import { vitrineDe, type CardapioArquivo } from '../core/vitrine';
import type { CapituloEntrada, ConfigEntrada, ImagemSalva } from '../types';

/** Editor da página de entrada (link da bio): frase, cores, capítulos de tempero e fotos da loja, com prévia ao vivo. */
export function EntradaEditor({ cardapio }: { cardapio: CardapioArquivo }) {
  const { state, act } = useApp();
  const { toast, confirm } = useFeedback();
  const { loja } = state;
  const v = vitrineDe(loja);
  const e: ConfigEntrada = entradaDe(v.entrada) ?? ENTRADA_PADRAO;
  const imagens: ImagemSalva[] = useMemo(() => state.config.imagens ?? [], [state.config.imagens]);
  const porId = useMemo(() => new Map(imagens.map((i) => [i.id, i.dados])), [imagens]);
  const setE = (patch: Partial<ConfigEntrada>) => act.loja({ vitrine: { ...v, entrada: { ...e, ...patch } } });
  const setCap = (i: number, patch: Partial<CapituloEntrada>) => setE({ capitulos: e.capitulos.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const { arquivo, semFoto } = useMemo(() => montarEntrada(loja, imagens), [loja, imagens]);

  async function guardarImagem(file: File | undefined): Promise<string | null> {
    if (!file) return null;
    try {
      const dados = await fotoProduto(file, 900, false);
      const img: ImagemSalva = { id: newId(), nome: file.name.slice(0, 60), dados };
      act.config((c) => ({ ...c, imagens: [...(c.imagens ?? []), img] }));
      return img.id;
    } catch (err) {
      toast((err as Error).message || 'Não foi possível abrir a foto.', 'erro');
      return null;
    }
  }
  const apagarImagem = (id: string | undefined) => id && act.config((c) => ({ ...c, imagens: (c.imagens ?? []).filter((x) => x.id !== id) }));

  function mover(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= e.capitulos.length) return;
    const cs = [...e.capitulos];
    [cs[i], cs[j]] = [cs[j], cs[i]];
    setE({ capitulos: cs });
  }
  async function tirarCapitulo(i: number) {
    const c = e.capitulos[i];
    if (!(await confirm({ titulo: 'Tirar capítulo', mensagem: `Tirar o capítulo “${c.nome}” da página de entrada?`, confirmar: 'Tirar capítulo', perigo: true }))) return;
    apagarImagem(c.foto);
    setE({ capitulos: e.capitulos.filter((_, j) => j !== i) });
  }

  // prévia ao vivo
  const frame = useRef<HTMLIFrameElement>(null);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const h = (ev: MessageEvent) => {
      if (ev.origin === window.location.origin && ev.data?.tipo === 'entrada-pronta') setPronto(true);
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);
  useEffect(() => {
    if (pronto) frame.current?.contentWindow?.postMessage({ tipo: 'entrada-previa', cardapio, entrada: arquivo }, window.location.origin);
  }, [pronto, cardapio, arquivo]);

  const link = linkEntrada(typeof window !== 'undefined' ? window.location.href : '');
  const escuro = e.escuro;
  const paletaAtual = PALETAS.find((p) => p.primaria === loja.cores.primaria && p.destaque === loja.cores.destaque && p.fundo === loja.cores.fundo && p.escuro === escuro)?.nome;

  return (
    <section className="card en-card">
      <h2>Página de entrada</h2>
      <p className="muted small">
        A primeira impressão para quem chega pelo link da bio: abertura com a logo, capítulos de tempero que pintam a tela ao rolar, como pedir, destaques do cardápio e a loja. O botão leva ao cardápio.
      </p>
      <div className="en-link">
        <code>{link}</code>
        <Button
          variant="secondary"
          icon="copy"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              toast('Link copiado. Coloque na bio do Instagram.');
            } catch {
              toast('Não foi possível copiar. Selecione o link e copie à mão.', 'erro');
            }
          }}
        >
          Copiar link
        </Button>
      </div>

      <div className="en-grade">
        <div className="en-campos">
          <fieldset className="vt-grupo">
            <legend>Abertura</legend>
            <Field label="Frase principal" hint="Curta, de até 2 linhas no celular.">
              {(id) => <input id={id} maxLength={90} value={e.frase} onChange={(x) => setE({ frase: x.target.value })} />}
            </Field>
            <Field label="Texto embaixo da frase">
              {(id) => <textarea id={id} rows={2} maxLength={300} value={e.texto} onChange={(x) => setE({ texto: x.target.value })} />}
            </Field>
          </fieldset>

          <fieldset className="vt-grupo">
            <legend>Cores</legend>
            <div className="en-paletas" role="radiogroup" aria-label="Paletas prontas">
              {PALETAS.map((p) => (
                <button
                  key={p.nome}
                  type="button"
                  role="radio"
                  aria-checked={paletaAtual === p.nome}
                  className={paletaAtual === p.nome ? 'on' : ''}
                  onClick={() => act.loja({ cores: { primaria: p.primaria, destaque: p.destaque, fundo: p.fundo }, vitrine: { ...v, entrada: { ...e, escuro: p.escuro } } })}
                >
                  <span className="en-bolas" aria-hidden>
                    {[p.primaria, p.destaque, p.fundo, p.escuro].map((c) => (
                      <i key={c} style={{ background: c }} />
                    ))}
                  </span>
                  {p.nome}
                </button>
              ))}
            </div>
            <div className="en-cores">
              {(
                [
                  ['primaria', 'Principal'],
                  ['destaque', 'Destaque'],
                  ['fundo', 'Clara'],
                ] as const
              ).map(([k, r]) => (
                <label key={k} className="en-cor">
                  <input type="color" value={loja.cores[k]} onChange={(x) => act.loja({ cores: { ...loja.cores, [k]: x.target.value.toUpperCase() } })} />
                  {r}
                </label>
              ))}
              <label className="en-cor">
                <input type="color" value={escuro} onChange={(x) => setE({ escuro: x.target.value.toUpperCase() })} />
                Escura
              </label>
            </div>
            <p className="muted small">As cores principal, destaque e clara são as da loja: mudam também o cardápio, os rótulos e as artes.</p>
          </fieldset>

          <fieldset className="vt-grupo">
            <legend>Capítulos de tempero ({e.capitulos.length})</legend>
            <p className="muted small">Cada capítulo pinta a tela com a cor dele quando o cliente rola. Sem foto, aparece um montinho do tempero desenhado.</p>
            {e.capitulos.map((c, i) => (
              <details key={i} className="en-cap" open={i === 0 && e.capitulos.length === 1}>
                <summary>
                  <i style={{ background: c.tom }} aria-hidden />
                  <strong>{c.nome}</strong>
                  <span className="muted small">{c.sub}</span>
                </summary>
                <div className="en-cap-in">
                  <div className="en-linha">
                    <Field label="Nome">{(id) => <input id={id} maxLength={40} value={c.nome} onChange={(x) => setCap(i, { nome: x.target.value })} />}</Field>
                    <label className="en-cor">
                      <input type="color" value={c.tom} onChange={(x) => setCap(i, { tom: x.target.value.toUpperCase() })} />
                      Cor
                    </label>
                  </div>
                  <Field label="Frase escrita à mão">{(id) => <input id={id} maxLength={80} value={c.sub} onChange={(x) => setCap(i, { sub: x.target.value })} />}</Field>
                  <Field label="Texto">{(id) => <textarea id={id} rows={3} maxLength={400} value={c.texto} onChange={(x) => setCap(i, { texto: x.target.value })} />}</Field>
                  <Field label="Você sabia?">{(id) => <textarea id={id} rows={2} maxLength={300} value={c.sabia} onChange={(x) => setCap(i, { sabia: x.target.value })} />}</Field>
                  <Field label="Combina com" hint="Separe por vírgula. Até 6.">
                    {(id) => (
                      <input
                        id={id}
                        defaultValue={c.combina.join(', ')}
                        onBlur={(x) => setCap(i, { combina: x.target.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6) })}
                      />
                    )}
                  </Field>
                  <div className="en-foto">
                    {c.foto && porId.get(c.foto) ? <img src={porId.get(c.foto)} alt="" /> : <span className="muted small">Sem foto: aparece o montinho desenhado.</span>}
                    <label className="btn btn-secondary">
                      {c.foto ? 'Trocar foto' : 'Pôr foto'}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={async (x) => {
                          const f = x.target.files?.[0];
                          x.target.value = '';
                          const id = await guardarImagem(f);
                          if (id) {
                            apagarImagem(c.foto);
                            setCap(i, { foto: id });
                          }
                        }}
                      />
                    </label>
                    {c.foto && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          apagarImagem(c.foto);
                          setCap(i, { foto: undefined });
                        }}
                      >
                        Tirar foto
                      </Button>
                    )}
                  </div>
                  <div className="en-linha">
                    <Button variant="ghost" disabled={i === 0} onClick={() => mover(i, -1)}>
                      Subir
                    </Button>
                    <Button variant="ghost" disabled={i === e.capitulos.length - 1} onClick={() => mover(i, 1)}>
                      Descer
                    </Button>
                    <Button variant="ghost" icon="trash" onClick={() => void tirarCapitulo(i)}>
                      Tirar capítulo
                    </Button>
                  </div>
                </div>
              </details>
            ))}
            <div className="en-linha">
              <Button
                variant="secondary"
                icon="plus"
                disabled={e.capitulos.length >= MAX_CAPITULOS}
                onClick={() => setE({ capitulos: [...e.capitulos, { nome: 'Novo tempero', sub: '', texto: '', sabia: '', combina: [], tom: loja.cores.destaque }] })}
              >
                Adicionar capítulo
              </Button>
              <Button variant="ghost" onClick={() => setE({ capitulos: CAPITULOS_PADRAO })}>
                Voltar aos 3 do começo
              </Button>
            </div>
          </fieldset>

          <fieldset className="vt-grupo">
            <legend>Fotos da loja</legend>
            <p className="muted small">Fachada, balcão, prateleiras. Aparecem em “Vem conhecer”. Até {MAX_FOTOS_LOJA}.</p>
            <div className="en-fotos">
              {e.fotos.map((id) => (
                <div key={id} className="en-foto-loja">
                  {porId.get(id) ? <img src={porId.get(id)} alt="" /> : <span className="muted small">Foto não encontrada</span>}
                  <button
                    type="button"
                    aria-label="Tirar esta foto"
                    onClick={() => {
                      apagarImagem(id);
                      setE({ fotos: e.fotos.filter((x) => x !== id) });
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {e.fotos.length < MAX_FOTOS_LOJA && (
                <label className="en-add-foto">
                  + Foto
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={async (x) => {
                      const f = x.target.files?.[0];
                      x.target.value = '';
                      const id = await guardarImagem(f);
                      if (id) setE({ fotos: [...e.fotos, id] });
                    }}
                  />
                </label>
              )}
            </div>
          </fieldset>
          {semFoto > 0 && <Notice tone="warn">{semFoto} foto(s) ficaram de fora para a página continuar leve. Tire alguma ou use fotos menores.</Notice>}
        </div>

        <aside className="vit-preview en-previa" aria-label="Prévia da página de entrada">
          <div className="vit-phone">
            <iframe ref={frame} title="Prévia da página de entrada" src={`${import.meta.env.BASE_URL}loja/?preview=1`} />
          </div>
          <p className="muted small">Prévia ao vivo. Role dentro do celular para ver os capítulos.</p>
        </aside>
      </div>
    </section>
  );
}
