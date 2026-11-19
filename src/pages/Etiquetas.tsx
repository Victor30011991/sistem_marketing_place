import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Field, Notice, NumberInput, PageHeader } from '../ui/ui';
import { Icon } from '../ui/icons';
import { logoSrc } from '../ui/logo';
import { Etiqueta, type EdicaoEtiqueta } from '../components/Etiqueta';
import { MOLDURAS, NUTRI_VAZIA, PECAS, TAMANHOS, codigoEtiqueta, daquiA, limitar, modelosPadrao, novoModelo, novoTexto, porPeso, type DadosImpressao } from '../core/etiquetas';
import { balancaDe, casa } from '../core/balanca';
import type { InfoNutricional, ModeloEtiqueta, PecaEtiqueta, Product } from '../types';

const PX_MM = 96 / 25.4;
const PESOS = [50, 100, 250, 500, 1000];

interface Linha {
  qtd: number;
  pesoG: number;
}

export default function Etiquetas() {
  useDocumentTitle('Etiquetas');
  const { state, act } = useApp();
  const { toast, confirm } = useFeedback();
  const { lista, loja, config } = state;
  const balanca = balancaDe(config.balanca);

  // modelos: os salvos, ou os de exemplo até a primeira mudança
  const [exemplo] = useState(modelosPadrao);
  const modelos = config.etiquetas?.length ? config.etiquetas : exemplo;
  const [modeloId, setModeloId] = useState(modelos[0].id);
  const salvo = modelos.find((m) => m.id === modeloId) ?? modelos[0];
  const [rascunho, setRascunho] = useState<ModeloEtiqueta | null>(null);
  const modelo = rascunho?.id === salvo.id ? rascunho : salvo;
  const [selId, setSelId] = useState<string | null>(null);
  const sel = modelo.pecas.find((p) => p.id === selId) ?? null;

  const gravarModelos = (lista: ModeloEtiqueta[]) => act.config((c) => ({ ...c, etiquetas: lista }));
  const salvar = (m: ModeloEtiqueta) => gravarModelos(modelos.map((x) => (x.id === m.id ? m : x)));
  const mudarPeca = (id: string, patch: Partial<PecaEtiqueta>) => salvar({ ...modelo, pecas: modelo.pecas.map((p) => (p.id === id ? limitar({ ...p, ...patch }, modelo) : p)) });

  // produto da prévia e dados da impressão
  const comPreco = lista.produtos.filter((p) => p.venda != null && p.venda > 0);
  const [previaId, setPreviaId] = useState<string>(() => comPreco[0]?.id ?? '');
  const previa = lista.produtos.find((p) => p.id === previaId) ?? null;
  const [pesoPrevia, setPesoPrevia] = useState(100);
  const [validadeDias, setValidadeDias] = useState(() => balanca.validadeDias || 180);
  const [lote, setLote] = useState('');
  const dados = (pesoG: number | null): DadosImpressao => ({ pesoG, validade: validadeDias > 0 ? daquiA(validadeDias) : '', lote });
  const logo = logoSrc(loja);

  // ---------- tamanho da prévia ----------
  const caixa = useRef<HTMLDivElement>(null);
  const [larguraCaixa, setLarguraCaixa] = useState(600);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLarguraCaixa(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const escala = Math.min(Math.max((larguraCaixa - 8) / (modelo.largura * PX_MM), 0.5), 6);

  // ---------- arrastar ----------
  const arrasto = useRef<{ id: string; modo: 'mover' | 'tamanho'; x0: number; y0: number; orig: PecaEtiqueta; m: ModeloEtiqueta } | null>(null);
  const edicao: EdicaoEtiqueta = {
    selecionada: selId,
    onFoco: setSelId,
    onPeca(id, e: PointerEvent<HTMLElement>, modo) {
      e.preventDefault();
      setSelId(id);
      const orig = modelo.pecas.find((p) => p.id === id)!;
      arrasto.current = { id, modo, x0: e.clientX, y0: e.clientY, orig, m: modelo };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      (e.currentTarget as HTMLElement).closest<HTMLElement>('.etq-peca')?.focus({ preventScroll: true });
    },
    onTecla(id, e: KeyboardEvent<HTMLElement>) {
      const passo = e.shiftKey ? 2 : 0.5;
      const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[e.key];
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        return mudarPeca(id, { ativo: false });
      }
      if (!d) return;
      e.preventDefault();
      const p = modelo.pecas.find((x) => x.id === id)!;
      mudarPeca(id, { x: p.x + d[0], y: p.y + d[1] });
    },
  };
  useEffect(() => {
    const mover = (e: globalThis.PointerEvent) => {
      const a = arrasto.current;
      if (!a) return;
      const k = PX_MM * escala;
      const dx = (e.clientX - a.x0) / k;
      const dy = (e.clientY - a.y0) / k;
      const p = a.modo === 'mover' ? { ...a.orig, x: a.orig.x + dx, y: a.orig.y + dy } : { ...a.orig, w: a.orig.w + dx, h: a.orig.h + dy };
      setRascunho({ ...a.m, pecas: a.m.pecas.map((x) => (x.id === a.id ? limitar(p, a.m) : x)) });
    };
    const soltar = () => {
      if (!arrasto.current) return;
      arrasto.current = null;
      setRascunho((r) => {
        if (r) salvarRef.current(r);
        return null;
      });
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
    };
  }, [escala]);
  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;

  // ---------- modelos ----------
  function trocarTamanho(largura: number, altura: number) {
    salvar({ ...modelo, largura, altura, pecas: modelo.pecas.map((p) => limitar(p, { largura, altura })) });
  }
  function novo() {
    const m = novoModelo(modelo.largura, modelo.altura);
    gravarModelos([...modelos, m]);
    setModeloId(m.id);
    setSelId(null);
  }
  function duplicar() {
    const m: ModeloEtiqueta = { ...structuredClone(modelo), id: crypto.randomUUID(), nome: `${modelo.nome} (cópia)` };
    gravarModelos([...modelos, m]);
    setModeloId(m.id);
  }
  async function excluir() {
    if (modelos.length === 1) return toast('Precisa ficar pelo menos um modelo.', 'erro');
    const ok = await confirm({ titulo: `Excluir o modelo “${modelo.nome}”?`, mensagem: <p>As etiquetas já impressas não mudam.</p>, confirmar: 'Excluir modelo', perigo: true });
    if (!ok) return;
    const resto = modelos.filter((m) => m.id !== modelo.id);
    gravarModelos(resto);
    setModeloId(resto[0].id);
  }
  function addTexto() {
    const t = novoTexto(modelo);
    salvar({ ...modelo, pecas: [...modelo.pecas, t] });
    setSelId(t.id);
  }

  // ---------- impressão ----------
  const [busca, setBusca] = useState('');
  const [linhas, setLinhas] = useState<Record<string, Linha>>({});
  const marcados = Object.entries(linhas).filter(([id]) => lista.produtos.some((p) => p.id === id));
  const totalEtiquetas = marcados.reduce((s, [, l]) => s + l.qtd, 0);
  const visiveis = comPreco.filter((p) => casa(p, busca)).slice(0, 60);
  const usaCodigo = modelo.pecas.some((p) => p.ativo && p.tipo === 'codigo');
  const semCodigo = marcados.filter(([id, l]) => {
    const p = lista.produtos.find((x) => x.id === id)!;
    return usaCodigo && !codigoEtiqueta(p, porPeso(p) ? l.pesoG : null, balanca);
  }).length;

  const marcar = (p: Product, on: boolean) =>
    setLinhas((l) => {
      const n = { ...l };
      if (on) n[p.id] = { qtd: 1, pesoG: pesoPrevia };
      else delete n[p.id];
      return n;
    });
  const mudarLinha = (id: string, patch: Partial<Linha>) => setLinhas((l) => ({ ...l, [id]: { ...l[id], ...patch } }));

  async function imprimir(itens: { produto: Product | null; pesoG: number | null }[]) {
    if (!itens.length) return toast('Marque pelo menos um produto para imprimir.', 'erro');
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas</title></head><body></body></html>');
    doc.close();
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => doc.head.appendChild(n.cloneNode(true)));
    const st = doc.createElement('style');
    st.textContent = `@page{size:${modelo.largura}mm ${modelo.altura}mm;margin:0}html,body{margin:0;padding:0;background:#fff}.etq-pg{width:${modelo.largura}mm;height:${modelo.altura}mm;overflow:hidden;break-after:page;page-break-after:always}.etq-pg:last-child{break-after:auto;page-break-after:auto}`;
    doc.head.appendChild(st);
    const raiz = doc.createElement('div');
    doc.body.appendChild(raiz);
    const root = createRoot(raiz);
    flushSync(() =>
      root.render(
        <>
          {itens.map((it, i) => (
            <div className="etq-pg" key={i}>
              <Etiqueta modelo={modelo} produto={it.produto} loja={loja} logo={logo} dados={dados(it.pesoG)} balanca={balanca} />
            </div>
          ))}
        </>,
      ),
    );
    await Promise.all([...doc.images].map((img) => img.decode().catch(() => undefined)));
    await doc.fonts?.ready;
    const limpar = () => setTimeout(() => {
      root.unmount();
      frame.remove();
    }, 500);
    frame.contentWindow!.addEventListener('afterprint', limpar);
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
  }

  function imprimirMarcados() {
    const itens = marcados.flatMap(([id, l]) => {
      const p = lista.produtos.find((x) => x.id === id)!;
      return Array.from({ length: Math.max(1, Math.min(500, Math.round(l.qtd))) }, () => ({ produto: p, pesoG: porPeso(p) ? l.pesoG : null }));
    });
    void imprimir(itens);
  }

  // ---------- dados do rótulo ----------
  const salvarProduto = (patch: Partial<Product>) => previa && act.salvarProduto({ ...previa, ...patch });
  const nutri = previa?.nutricao ?? null;
  const setNutri = (k: keyof InfoNutricional, v: number) => salvarProduto({ nutricao: { ...(nutri ?? NUTRI_VAZIA), [k]: v } });

  const tamanhoAtual = TAMANHOS.find((t) => t.largura === modelo.largura && t.altura === modelo.altura);

  return (
    <div className="page etq-page">
      <PageHeader
        titulo="Etiquetas"
        subtitulo="Monte etiquetas e cartazes de prateleira para a impressora térmica: escolha o tamanho, ligue as peças que quiser e arraste cada uma para o lugar."
      />

      <section className="card">
        <h2>Modelo</h2>
        <div className="etq-modelos" role="tablist" aria-label="Modelos de etiqueta">
          {modelos.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={m.id === modelo.id} className={`chip-btn ${m.id === modelo.id ? 'on' : ''}`} onClick={() => { setModeloId(m.id); setSelId(null); }}>
              {m.nome}
            </button>
          ))}
          <Button variant="ghost" icon="plus" onClick={novo}>
            Novo modelo
          </Button>
        </div>
        <div className="form-grid etq-cfg">
          <Field label="Nome do modelo">{(id) => <input id={id} value={modelo.nome} onChange={(e) => salvar({ ...modelo, nome: e.target.value })} />}</Field>
          <Field label="Tamanho da etiqueta" hint="O mesmo do rolo que está na impressora.">
            {(id) => (
              <select
                id={id}
                value={tamanhoAtual ? `${modelo.largura}x${modelo.altura}` : 'outro'}
                onChange={(e) => {
                  if (e.target.value === 'outro') return;
                  const [w, h] = e.target.value.split('x').map(Number);
                  trocarTamanho(w, h);
                }}
              >
                {TAMANHOS.map((t) => (
                  <option key={t.rotulo} value={`${t.largura}x${t.altura}`}>
                    {t.rotulo}
                  </option>
                ))}
                <option value="outro">Outro tamanho</option>
              </select>
            )}
          </Field>
          <Field label="Largura">{(id) => <NumberInput id={id} value={modelo.largura} min={15} max={300} suffix="mm" onChange={(v) => trocarTamanho(v, modelo.altura)} />}</Field>
          <Field label="Altura">{(id) => <NumberInput id={id} value={modelo.altura} min={10} max={300} suffix="mm" onChange={(v) => trocarTamanho(modelo.largura, v)} />}</Field>
          <Field label="Moldura">
            {(id) => (
              <select id={id} value={modelo.moldura} onChange={(e) => salvar({ ...modelo, moldura: e.target.value as ModeloEtiqueta['moldura'] })}>
                {MOLDURAS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <div className="row-gap wrap">
          <Button variant="secondary" icon="copy" onClick={duplicar}>
            Duplicar modelo
          </Button>
          <Button variant="ghost" icon="trash" onClick={excluir}>
            Excluir modelo
          </Button>
        </div>
      </section>

      <section className="card">
        <h2>Montar</h2>
        <div className="etq-editor">
          <div className="etq-lado">
            <h3 className="etq-sub">Peças</h3>
            <ul className="etq-pecas">
              {modelo.pecas.map((p) => {
                const info = PECAS.find((x) => x.tipo === p.tipo)!;
                return (
                  <li key={p.id} className={p.id === selId ? 'sel' : ''}>
                    <label>
                      <input type="checkbox" checked={p.ativo} onChange={(e) => { mudarPeca(p.id, { ativo: e.target.checked }); setSelId(p.id); }} />
                      <span>
                        {p.tipo === 'texto' ? `Texto: ${p.texto || '…'}` : info.rotulo}
                        {info.dica && <small>{info.dica}</small>}
                      </span>
                    </label>
                    {p.ativo && (
                      <button type="button" className="icon-btn" aria-label={`Ajustar ${info.rotulo}`} onClick={() => setSelId(p.id)}>
                        <Icon name="edit" size={16} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <Button variant="ghost" icon="plus" onClick={addTexto}>
              Adicionar texto
            </Button>
          </div>

          <div className="etq-centro">
            <div className="form-grid etq-previa-cfg">
              <Field label="Ver com o produto">
                {(id) => (
                  <select id={id} value={previaId} onChange={(e) => setPreviaId(e.target.value)}>
                    {comPreco.length === 0 && <option value="">Exemplo</option>}
                    {comPreco.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Peso do pacote">{(id) => <NumberInput id={id} value={pesoPrevia} min={1} max={99999} suffix="g" onChange={setPesoPrevia} />}</Field>
            </div>
            <div className="etq-palco" ref={caixa}>
              <div style={{ width: modelo.largura * PX_MM * escala, height: modelo.altura * PX_MM * escala }}>
                <div style={{ transform: `scale(${escala})`, transformOrigin: 'top left', width: 'max-content' }}>
                  <Etiqueta modelo={modelo} produto={previa} loja={loja} logo={logo} dados={dados(pesoPrevia)} balanca={balanca} edicao={edicao} />
                </div>
              </div>
            </div>
            <p className="muted small">Arraste as peças. O quadradinho no canto muda o tamanho. Com a peça escolhida, as setas do teclado movem 0,5 mm (com Shift, 2 mm).</p>

            {sel && (
              <div className="etq-ajuste" aria-label="Ajustes da peça escolhida">
                <h3 className="etq-sub">{sel.tipo === 'texto' ? 'Texto livre' : PECAS.find((x) => x.tipo === sel.tipo)!.rotulo}</h3>
                {sel.tipo === 'texto' && <Field label="Texto">{(id) => <input id={id} value={sel.texto ?? ''} onChange={(e) => mudarPeca(sel.id, { texto: e.target.value })} />}</Field>}
                <div className="form-grid">
                  {sel.tipo !== 'logo' && (
                    <Field label="Tamanho da letra">{(id) => <NumberInput id={id} value={sel.fonte} min={4} max={72} suffix="pt" onChange={(v) => mudarPeca(sel.id, { fonte: v })} />}</Field>
                  )}
                  {sel.tipo !== 'logo' && sel.tipo !== 'codigo' && sel.tipo !== 'nutricao' && (
                    <Field label="Alinhamento">
                      {(id) => (
                        <select id={id} value={sel.alinhar} onChange={(e) => mudarPeca(sel.id, { alinhar: e.target.value as PecaEtiqueta['alinhar'] })}>
                          <option value="esq">À esquerda</option>
                          <option value="centro">No centro</option>
                          <option value="dir">À direita</option>
                        </select>
                      )}
                    </Field>
                  )}
                  <Field label="Largura">{(id) => <NumberInput id={id} value={sel.w} min={3} max={modelo.largura} suffix="mm" onChange={(v) => mudarPeca(sel.id, { w: v })} />}</Field>
                  <Field label="Altura">{(id) => <NumberInput id={id} value={sel.h} min={2} max={modelo.altura} suffix="mm" onChange={(v) => mudarPeca(sel.id, { h: v })} />}</Field>
                </div>
                <div className="row-gap wrap">
                  {sel.tipo !== 'logo' && sel.tipo !== 'codigo' && (
                    <label className="check">
                      <input type="checkbox" checked={sel.negrito} onChange={(e) => mudarPeca(sel.id, { negrito: e.target.checked })} /> Negrito
                    </label>
                  )}
                  <Button variant="ghost" icon="x" onClick={() => mudarPeca(sel.id, { ativo: false })}>
                    Tirar da etiqueta
                  </Button>
                  {sel.tipo === 'texto' && (
                    <Button variant="ghost" icon="trash" onClick={() => { salvar({ ...modelo, pecas: modelo.pecas.filter((p) => p.id !== sel.id) }); setSelId(null); }}>
                      Apagar texto
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Imprimir</h2>
        <div className="form-grid">
          <Field label="Validade" hint={validadeDias > 0 ? `Sai na etiqueta: ${daquiA(validadeDias).split('-').reverse().join('/')}` : 'Sem validade'}>
            {(id) => <NumberInput id={id} value={validadeDias} min={0} max={3650} integer suffix="dias" onChange={setValidadeDias} />}
          </Field>
          <Field label="Lote (opcional)">{(id) => <input id={id} value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Ex.: 598" />}</Field>
          <Field label="Buscar produto">{(id) => <input id={id} type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou código" />}</Field>
        </div>
        {usaCodigo && semCodigo > 0 && (
          <Notice tone="warn">
            {semCodigo} produto(s) marcados vão sair <strong>sem código de barras</strong>: falta o código de balança (veja a página Balança) ou o peso do pacote.
          </Notice>
        )}
        <ul className="etq-impr">
          {visiveis.map((p) => {
            const l = linhas[p.id];
            return (
              <li key={p.id} className={l ? 'on' : ''}>
                <label className="etq-impr-nome">
                  <input type="checkbox" checked={!!l} onChange={(e) => marcar(p, e.target.checked)} />
                  <span>{p.nome}</span>
                </label>
                {l && (
                  <div className="etq-impr-cfg">
                    {porPeso(p) && (
                      <span className="etq-pesos" role="group" aria-label={`Peso do pacote de ${p.nome}`}>
                        {PESOS.map((g) => (
                          <button key={g} type="button" className={`chip-btn ${l.pesoG === g ? 'on' : ''}`} onClick={() => mudarLinha(p.id, { pesoG: g })}>
                            {g >= 1000 ? `${g / 1000} kg` : `${g} g`}
                          </button>
                        ))}
                        <NumberInput value={l.pesoG} min={1} max={99999} suffix="g" ariaLabel={`Outro peso para ${p.nome}`} onChange={(v) => mudarLinha(p.id, { pesoG: v })} className="etq-peso-outro" />
                      </span>
                    )}
                    <NumberInput value={l.qtd} min={1} max={500} integer suffix="un." ariaLabel={`Quantidade de etiquetas de ${p.nome}`} onChange={(v) => mudarLinha(p.id, { qtd: v })} className="etq-qtd" />
                  </div>
                )}
              </li>
            );
          })}
          {visiveis.length === 0 && <li className="muted">Nenhum produto com preço encontrado.</li>}
        </ul>
        <div className="row-gap wrap">
          <Button icon="pdf" onClick={imprimirMarcados} disabled={!totalEtiquetas}>
            {totalEtiquetas ? `Imprimir ${totalEtiquetas} etiqueta${totalEtiquetas > 1 ? 's' : ''}` : 'Imprimir etiquetas'}
          </Button>
          <Button variant="secondary" onClick={() => void imprimir([{ produto: previa, pesoG: previa && porPeso(previa) ? pesoPrevia : null }])}>
            Imprimir 1 de teste
          </Button>
        </div>
        <p className="muted small">
          Na janela de impressão, escolha a impressora térmica, o papel do mesmo tamanho da etiqueta e <strong>margens: nenhuma</strong>. A ligação direta por Bluetooth ou cabo vem na próxima etapa.
        </p>
      </section>

      {previa && (
        <section className="card">
          <h2>Dados do rótulo: {previa.nome}</h2>
          <p className="muted small">Ficam guardados no produto e aparecem quando as peças Ingredientes e Tabela nutricional estão ligadas.</p>
          <Field label="Ingredientes">{(id) => <textarea id={id} rows={2} value={previa.ingredientes ?? ''} onChange={(e) => salvarProduto({ ingredientes: e.target.value })} placeholder="Ex.: cúrcuma moída." />}</Field>
          <label className="check">
            <input type="checkbox" checked={!!nutri} onChange={(e) => salvarProduto({ nutricao: e.target.checked ? { ...NUTRI_VAZIA } : null })} /> Tem tabela nutricional
          </label>
          {nutri && (
            <>
              <p className="muted small">Valores em 100 g, como vêm na embalagem do fornecedor. A coluna da porção é calculada sozinha.</p>
              <div className="form-grid etq-nutri">
                {(
                  [
                    ['porcao', 'Porção', 'g'],
                    ['kcal', 'Valor energético', 'kcal'],
                    ['carboidratos', 'Carboidratos', 'g'],
                    ['acucares', 'Açúcares totais', 'g'],
                    ['proteinas', 'Proteínas', 'g'],
                    ['gorduras', 'Gorduras totais', 'g'],
                    ['saturadas', 'Gorduras saturadas', 'g'],
                    ['fibras', 'Fibras alimentares', 'g'],
                    ['sodio', 'Sódio', 'mg'],
                  ] as [keyof InfoNutricional, string, string][]
                ).map(([k, r, u]) => (
                  <Field key={k} label={r}>
                    {(id) => <NumberInput id={id} value={nutri[k]} min={k === 'porcao' ? 0.1 : 0} max={100000} suffix={u} onChange={(v) => setNutri(k, v)} />}
                  </Field>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
