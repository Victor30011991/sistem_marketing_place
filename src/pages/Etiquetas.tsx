import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Field, Notice, NumberInput, PageHeader } from '../ui/ui';
import { Icon } from '../ui/icons';
import { logoSrc } from '../ui/logo';
import { Etiqueta, EtiquetaImpressa, type EdicaoEtiqueta } from '../components/Etiqueta';
import { FAMILIAS, PECAS_MULTIPLAS, SELOS, areaDe } from '../core/etiquetas';
import { ROTULOS_PRONTOS, conferirRotulo } from '../core/rotulos';
import { fotoProduto } from '../ui/foto';
import '@fontsource-variable/caveat';
import '@fontsource/bebas-neue';
import '@fontsource-variable/playfair-display';
import { CORES_PECA, MOLDURAS, NUTRI_VAZIA, PECAS, TAMANHOS, codigoEtiqueta, daquiA, limitar, modelosPadrao, novoModelo, novoTexto, porPeso, type DadosImpressao } from '../core/etiquetas';
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
  const [face, setFace] = useState<'frente' | 'verso'>('frente');
  const daFace = (p: PecaEtiqueta) => !modelo.solapa || (p.lado ?? 'frente') === face;
  const area = areaDe(modelo);

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
  const [zoom, setZoom] = useState<'ajustar' | number>('ajustar');
  const [cheia, setCheia] = useState(false);
  useEffect(() => {
    if (!cheia) return;
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setCheia(false);
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [cheia]);
  const ajuste = Math.min(Math.max((larguraCaixa - 8) / (modelo.largura * PX_MM), 0.5), cheia ? 10 : 6);
  const escala = zoom === 'ajustar' ? ajuste : zoom;
  // medidas em mm (guardadas) ou cm (mostradas), à escolha
  const [un, setUn] = useState<'mm' | 'cm'>(() => {
    try {
      return localStorage.getItem('temperei.etq.un') === 'cm' ? 'cm' : 'mm';
    } catch {
      return 'mm';
    }
  });
  const trocarUn = (u: 'mm' | 'cm') => {
    setUn(u);
    try {
      localStorage.setItem('temperei.etq.un', u);
    } catch {
      /* sem armazenamento: só não lembra */
    }
  };
  const mostra = (mm: number) => (un === 'cm' ? Math.round(mm) / 10 : mm);
  const guarda = (v: number) => (un === 'cm' ? Math.round(v * 100) / 10 : v);
  const salvarComMargem = (margem: number) => {
    const m = { ...modelo, margem };
    salvar({ ...m, pecas: m.pecas.map((p) => limitar(p, m)) });
  };

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
    salvar({ ...modelo, largura, altura, pecas: modelo.pecas.map((p) => limitar(p, { largura, altura, margem: modelo.margem })) });
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
  function addPeca(p: PecaEtiqueta) {
    const nova = limitar({ ...p, ...(modelo.solapa ? { lado: face } : {}) }, modelo);
    salvar({ ...modelo, pecas: [...modelo.pecas, nova] });
    setSelId(nova.id);
  }
  const addTexto = () => addPeca(novoTexto(modelo));
  const addForma = () => addPeca({ ...novoTexto(modelo), tipo: 'forma', texto: undefined, w: Math.min(30, area.largura), h: 8, fundo: 'primaria', raio: 2 });
  async function addImagem(f: File | undefined) {
    if (!f) return;
    try {
      const img = await fotoProduto(f, 700, false);
      addPeca({ ...novoTexto(modelo), tipo: 'imagem', texto: undefined, imagem: img, w: Math.min(24, area.largura), h: Math.min(24, area.altura) });
    } catch {
      toast('Não consegui ler esta imagem.', 'erro');
    }
  }
  const [galeria] = useState(() => Object.fromEntries(ROTULOS_PRONTOS.map((r) => [r.id, r.criar()])) as Record<string, ModeloEtiqueta>);
  function usarPronto(id: string) {
    const r = ROTULOS_PRONTOS.find((x) => x.id === id)!;
    const m = r.criar();
    gravarModelos([...modelos, m]);
    setModeloId(m.id);
    setSelId(null);
    setFace('frente');
    toast(`Modelo “${m.nome}” criado. Ajuste à vontade.`);
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
    if (papel === 'a4') return imprimirA4(itens);
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
    st.textContent = `*{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:${modelo.largura}mm ${modelo.altura}mm;margin:0}html,body{margin:0;padding:0;background:#fff}.etq-pg{width:${modelo.largura}mm;height:${modelo.altura}mm;overflow:hidden;break-after:page;page-break-after:always}.etq-pg:last-child{break-after:auto;page-break-after:auto}`;
    doc.head.appendChild(st);
    const raiz = doc.createElement('div');
    doc.body.appendChild(raiz);
    const root = createRoot(raiz);
    flushSync(() =>
      root.render(
        <>
          {itens.map((it, i) => (
            <div className="etq-pg" key={i}>
              <EtiquetaImpressa modelo={modelo} produto={it.produto} loja={loja} logo={logo} dados={dados(it.pesoG)} balanca={balanca} />
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

  // ---------- folha A4 com várias etiquetas ----------
  const [papel, setPapel] = useState<'rolo' | 'a4'>('rolo');
  const [espaco, setEspaco] = useState(3);
  const [cortes, setCortes] = useState(true);
  const MARGEM_A4 = 8;
  const porFolha = (() => {
    const cols = Math.floor((210 - 2 * MARGEM_A4 + espaco) / (modelo.largura + espaco));
    const rows = Math.floor((297 - 2 * MARGEM_A4 + espaco) / (modelo.altura + espaco));
    return cols >= 1 && rows >= 1 ? { cols, rows } : null;
  })();
  async function imprimirA4(itens: { produto: Product | null; pesoG: number | null }[]) {
    if (!porFolha) return toast('Esta etiqueta é maior que a folha A4.', 'erro');
    const n = porFolha.cols * porFolha.rows;
    const folhas = Array.from({ length: Math.ceil(itens.length / n) }, (_, i) => itens.slice(i * n, i * n + n));
    const raio = modelo.forma === 'redondo' || modelo.forma === 'oval' ? '50%' : modelo.forma === 'arredondado' ? '4mm' : '0';
    await abrirImpressao(
      `@page{size:210mm 297mm;margin:0}html,body{margin:0;padding:0;background:#fff}.a4{position:relative;width:210mm;height:297mm;overflow:hidden;break-after:page;page-break-after:always}.a4:last-child{break-after:auto;page-break-after:auto}.a4 .cel{position:absolute}${cortes ? `.a4 .cel{outline:0.1mm solid #bbb;border-radius:${modelo.solapa ? '0' : raio}}` : ''}`,
      <>
        {folhas.map((f, fi) => (
          <div className="a4" key={fi}>
            {f.map((it, i) => (
              <div className="cel" key={i} style={{ left: `${MARGEM_A4 + (i % porFolha.cols) * (modelo.largura + espaco)}mm`, top: `${MARGEM_A4 + Math.floor(i / porFolha.cols) * (modelo.altura + espaco)}mm` }}>
                <EtiquetaImpressa modelo={modelo} produto={it.produto} loja={loja} logo={logo} dados={dados(it.pesoG)} balanca={balanca} />
              </div>
            ))}
          </div>
        ))}
      </>,
    );
  }
  async function abrirImpressao(css: string, conteudo: React.ReactNode) {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Rótulos</title></head><body></body></html>');
    doc.close();
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((nd) => doc.head.appendChild(nd.cloneNode(true)));
    const st = doc.createElement('style');
    st.textContent = css + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}';
    doc.head.appendChild(st);
    const raiz = doc.createElement('div');
    doc.body.appendChild(raiz);
    const root = createRoot(raiz);
    flushSync(() => root.render(conteudo));
    await Promise.all([...doc.images].map((img) => img.decode().catch(() => undefined)));
    await doc.fonts?.ready;
    frame.contentWindow!.addEventListener('afterprint', () => setTimeout(() => { root.unmount(); frame.remove(); }, 500));
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
        subtitulo="Monte etiquetas, rótulos de pote, solapas e cartazes de prateleira: escolha o tamanho, ligue as peças que quiser e arraste cada uma para o lugar."
      />

      <section className="card">
        <details className="etq-prontos" open={!config.etiquetas?.some((m) => m.cor === 'cor')}>
          <summary>
            <h2>Rótulos prontos</h2>
            <span className="muted small">Solapa de saquinho, pote redondo, envolvente, pacote em pé e traseira. Escolha um e personalize.</span>
          </summary>
          <div className="etq-galeria">
            {ROTULOS_PRONTOS.map((r) => {
              const m = galeria[r.id];
              const k = Math.min(200 / (m.largura * PX_MM), 150 / (m.altura * PX_MM));
              return (
                <article key={r.id} className="etq-pronto">
                  <div className="etq-miniatura" style={{ height: 150 }}>
                    <div style={{ width: m.largura * PX_MM * k, height: m.altura * PX_MM * k }}>
                      <div style={{ transform: `scale(${k})`, transformOrigin: 'top left', width: 'max-content' }}>
                        <EtiquetaImpressa modelo={m} produto={previa} loja={loja} logo={logo} dados={dados(pesoPrevia)} balanca={balanca} />
                      </div>
                    </div>
                  </div>
                  <h3>{r.nome}</h3>
                  <p className="muted small">{r.descricao}</p>
                  <Button variant="secondary" icon="plus" onClick={() => usarPronto(r.id)}>
                    Usar este
                  </Button>
                </article>
              );
            })}
          </div>
        </details>
      </section>

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
          <Field label="Largura">{(id) => <NumberInput key={un} id={id} value={mostra(modelo.largura)} min={mostra(15)} max={mostra(300)} suffix={un} onChange={(v) => trocarTamanho(guarda(v), modelo.altura)} />}</Field>
          <Field label="Altura">{(id) => <NumberInput key={un} id={id} value={mostra(modelo.altura)} min={mostra(10)} max={mostra(300)} suffix={un} onChange={(v) => trocarTamanho(modelo.largura, guarda(v))} />}</Field>
          <Field label="Margem da área de impressão" hint="Borda que a impressora não alcança. As peças ficam dentro (linha vermelha no editor).">
            {(id) => <NumberInput key={un} id={id} value={mostra(modelo.margem ?? 0)} min={0} max={mostra(20)} suffix={un} onChange={(v) => salvarComMargem(guarda(v))} />}
          </Field>
          <Field label="Impressão" hint={modelo.cor === 'cor' ? 'Para impressora de tinta ou laser colorida.' : 'Para impressora térmica (só imprime preto).'}>
            {(id) => (
              <select id={id} value={modelo.cor ?? 'pb'} onChange={(e) => salvar({ ...modelo, cor: e.target.value === 'cor' ? 'cor' : 'pb' })}>
                <option value="pb">Preto e branco</option>
                <option value="cor">Colorida</option>
              </select>
            )}
          </Field>
          <Field label="Formato">
            {(id) => (
              <select id={id} value={modelo.forma ?? 'retangulo'} onChange={(e) => salvar({ ...modelo, forma: e.target.value as ModeloEtiqueta['forma'] })}>
                <option value="retangulo">Retangular</option>
                <option value="arredondado">Cantos arredondados</option>
                <option value="redondo">Redondo</option>
                <option value="oval">Oval</option>
              </select>
            )}
          </Field>
          {modelo.cor === 'cor' && (
            <Field label="Fundo da etiqueta">
              {(id) => (
                <span className="row-gap">
                  <select id={id} value={modelo.fundo?.startsWith('#') ? 'livre' : modelo.fundo ?? 'branco'} onChange={(e) => salvar({ ...modelo, fundo: e.target.value === 'livre' ? '#f4ead8' : e.target.value })}>
                    <option value="branco">Branco</option>
                    <option value="fundo">Cor de fundo da loja</option>
                    <option value="primaria">Cor principal</option>
                    <option value="destaque">Cor de destaque</option>
                    <option value="livre">Outra cor…</option>
                  </select>
                  {modelo.fundo?.startsWith('#') && <input type="color" aria-label="Cor do fundo" value={modelo.fundo} onChange={(e) => salvar({ ...modelo, fundo: e.target.value })} />}
                </span>
              )}
            </Field>
          )}
          <label className="check etq-solapa-check">
            <input type="checkbox" checked={!!modelo.solapa} onChange={(e) => salvar({ ...modelo, solapa: e.target.checked || undefined })} /> Solapa (dobra no meio: frente e verso)
          </label>
          <Field label="Medidas em">
            {(id) => (
              <select id={id} value={un} onChange={(e) => trocarUn(e.target.value === 'cm' ? 'cm' : 'mm')}>
                <option value="mm">milímetros (mm)</option>
                <option value="cm">centímetros (cm)</option>
              </select>
            )}
          </Field>
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

      <section className={`card ${cheia ? 'etq-cheia' : ''}`} aria-label="Montar a etiqueta">
        <div className="card-head">
          <h2>Montar{cheia ? ` · ${modelo.nome}` : ''}</h2>
          <div className="row-gap wrap">
            <label className="row-gap">
              <span className="muted small">Zoom</span>
              <select aria-label="Zoom da prévia" value={String(zoom)} onChange={(e) => setZoom(e.target.value === 'ajustar' ? 'ajustar' : Number(e.target.value))}>
                <option value="ajustar">Ajustar à tela</option>
                <option value="1">Tamanho real</option>
                <option value="2">2×</option>
                <option value="3">3×</option>
                <option value="4">4×</option>
              </select>
            </label>
            <Button variant="secondary" icon={cheia ? 'x' : 'columns'} onClick={() => setCheia((c) => !c)}>
              {cheia ? 'Sair da tela cheia' : 'Tela cheia'}
            </Button>
          </div>
        </div>
        <div className="etq-editor">
          <div className="etq-lado">
            {modelo.solapa && (
              <div className="etq-face" role="group" aria-label="Lado da solapa">
                {(['frente', 'verso'] as const).map((f) => (
                  <button key={f} type="button" className={`chip-btn ${face === f ? 'on' : ''}`} aria-pressed={face === f} onClick={() => { setFace(f); setSelId(null); }}>
                    {f === 'frente' ? 'Frente' : 'Verso'}
                  </button>
                ))}
              </div>
            )}
            <h3 className="etq-sub">Peças{modelo.solapa ? ` · ${face}` : ''}</h3>
            <ul className="etq-pecas">
              {modelo.pecas.filter((p) => daFace(p) || (!p.ativo && !PECAS_MULTIPLAS.includes(p.tipo))).map((p) => {
                const info = PECAS.find((x) => x.tipo === p.tipo)!;
                return (
                  <li key={p.id} className={p.id === selId ? 'sel' : ''}>
                    <label>
                      <input type="checkbox" checked={p.ativo && daFace(p)} onChange={(e) => { mudarPeca(p.id, { ativo: e.target.checked, ...(modelo.solapa && e.target.checked ? { lado: face } : {}) }); setSelId(p.id); }} />
                      <span>
                        {p.tipo === 'texto' ? `Texto: ${p.texto || '…'}` : p.tipo === 'forma' ? 'Faixa / forma de cor' : info.rotulo}
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
            <div className="etq-add">
              <Button variant="ghost" icon="plus" onClick={addTexto}>
                Texto
              </Button>
              <Button variant="ghost" icon="plus" onClick={addForma}>
                Faixa / forma
              </Button>
              <label className="btn btn-ghost">
                <Icon name="plus" /> Imagem
                <input type="file" accept="image/*" hidden onChange={(e) => { void addImagem(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>
            <details className="etq-conf">
              <summary>Conferir rótulo de alimento</summary>
              <ul>
                {conferirRotulo(modelo, previa, loja, pesoPrevia).map((c) => (
                  <li key={c.item} className={c.ok ? 'ok' : 'falta'}>
                    <Icon name={c.ok ? 'check' : 'alert'} size={16} />
                    <span>
                      <strong>{c.item}</strong>
                      <small>{c.dica}</small>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="muted small">Lembrete do que costuma ser exigido (RDC 727/2022, RDC 429/2020, Lei 10.674/2003, Inmetro 249/2021). Confirme com a vigilância sanitária da sua cidade.</p>
            </details>
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
              <div style={{ width: area.largura * PX_MM * escala, height: area.altura * PX_MM * escala }}>
                <div style={{ transform: `scale(${escala})`, transformOrigin: 'top left', width: 'max-content' }}>
                  <Etiqueta modelo={modelo} produto={previa} loja={loja} logo={logo} dados={dados(pesoPrevia)} balanca={balanca} edicao={edicao} lado={face} />
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
                  <Field label="Largura">{(id) => <NumberInput key={un + sel.id} id={id} value={mostra(sel.w)} min={mostra(3)} max={mostra(modelo.largura)} suffix={un} onChange={(v) => mudarPeca(sel.id, { w: guarda(v) })} />}</Field>
                  <Field label="Altura">{(id) => <NumberInput key={un + sel.id} id={id} value={mostra(sel.h)} min={mostra(2)} max={mostra(modelo.altura)} suffix={un} onChange={(v) => mudarPeca(sel.id, { h: guarda(v) })} />}</Field>
                  {!['logo', 'codigo', 'imagem', 'forma', 'selos', 'nutricao'].includes(sel.tipo) && (
                    <Field label="Letra">
                      {(id) => (
                        <select id={id} value={sel.familia ?? 'sans'} onChange={(e) => mudarPeca(sel.id, { familia: e.target.value as PecaEtiqueta['familia'] })}>
                          {FAMILIAS.map((f) => (
                            <option key={f.id} value={f.id} style={{ fontFamily: f.css }}>
                              {f.rotulo}
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                  )}
                  {modelo.cor === 'cor' && (sel.tipo === 'forma' || !['logo', 'codigo', 'imagem'].includes(sel.tipo)) && (
                    <Field label={sel.tipo === 'forma' ? 'Cor da forma' : 'Fundo da peça'}>
                      {(id) => (
                        <span className="row-gap">
                          <select id={id} value={sel.fundo && sel.fundo.startsWith('#') ? 'livre' : sel.fundo ?? ''} onChange={(e) => mudarPeca(sel.id, { fundo: e.target.value === 'livre' ? '#c0392b' : e.target.value || undefined })}>
                            {sel.tipo !== 'forma' && <option value="">Sem fundo</option>}
                            <option value="primaria">Cor principal</option>
                            <option value="destaque">Cor de destaque</option>
                            <option value="fundo">Cor de fundo da loja</option>
                            <option value="branco">Branco</option>
                            <option value="livre">Outra cor…</option>
                          </select>
                          {sel.fundo?.startsWith('#') && <input type="color" aria-label="Escolher a cor" value={sel.fundo} onChange={(e) => mudarPeca(sel.id, { fundo: e.target.value })} />}
                        </span>
                      )}
                    </Field>
                  )}
                  {(sel.tipo === 'forma' || sel.tipo === 'imagem' || sel.tipo === 'logo' || !!sel.fundo) && (
                    <Field label="Cantos">
                      {(id) => (
                        <select id={id} value={String(sel.raio ?? 0)} onChange={(e) => mudarPeca(sel.id, { raio: Number(e.target.value) || undefined })}>
                          <option value="0">Retos</option>
                          <option value="1">Pouco arredondados</option>
                          <option value="3">Arredondados</option>
                          <option value="6">Bem arredondados</option>
                          <option value="999">Redondo (círculo)</option>
                        </select>
                      )}
                    </Field>
                  )}
                  {modelo.cor === 'cor' && !['logo', 'codigo', 'imagem', 'forma'].includes(sel.tipo) && (
                    <Field label="Cor">
                      {(id) => (
                        <select id={id} value={sel.cor ?? 'preto'} onChange={(e) => mudarPeca(sel.id, { cor: e.target.value as PecaEtiqueta['cor'] })}>
                          {CORES_PECA.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.rotulo}
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                  )}
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
                  {!['logo', 'codigo', 'imagem', 'forma', 'selos', 'nutricao'].includes(sel.tipo) && (
                    <label className="check">
                      <input type="checkbox" checked={!!sel.maiusculas} onChange={(e) => mudarPeca(sel.id, { maiusculas: e.target.checked || undefined })} /> MAIÚSCULAS
                    </label>
                  )}
                  {PECAS_MULTIPLAS.includes(sel.tipo) && (
                    <Button variant="ghost" icon="trash" onClick={() => { salvar({ ...modelo, pecas: modelo.pecas.filter((p) => p.id !== sel.id) }); setSelId(null); }}>
                      Apagar
                    </Button>
                  )}
                </div>
                {sel.tipo === 'selos' && (
                  <fieldset className="etq-selos">
                    <legend>Selos</legend>
                    {SELOS.map((s) => (
                      <label key={s.id} className="check">
                        <input
                          type="checkbox"
                          checked={(sel.selos ?? []).includes(s.id)}
                          onChange={(e) => mudarPeca(sel.id, { selos: e.target.checked ? [...(sel.selos ?? []), s.id] : (sel.selos ?? []).filter((x) => x !== s.id) })}
                        />{' '}
                        {s.rotulo}
                      </label>
                    ))}
                    <small className="muted">Evite frases como “sem conservantes” ou “100% natural”: costumam ser proibidas ou precisar de comprovação. Os selos acima falam do jeito de fazer.</small>
                  </fieldset>
                )}
                {(sel.tipo === 'fabricante' || sel.tipo === 'conservacao') && (
                  <Field label={sel.tipo === 'fabricante' ? 'Texto do fabricante (vazio = dados de “Minha loja”)' : 'Texto de conservação'}>
                    {(id) => <textarea id={id} rows={2} value={sel.texto ?? ''} onChange={(e) => mudarPeca(sel.id, { texto: e.target.value })} />}
                  </Field>
                )}
                {sel.tipo === 'imagem' && (
                  <label className="btn btn-secondary">
                    Trocar imagem
                    <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) mudarPeca(sel.id, { imagem: await fotoProduto(f, 700, false) }); }} />
                  </label>
                )}
                <div className="row-gap wrap">
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
          <Field label="Papel" hint={papel === 'a4' ? (porFolha ? `${porFolha.cols} × ${porFolha.rows} = ${porFolha.cols * porFolha.rows} por folha A4` : 'Não cabe numa folha A4') : 'Uma etiqueta por página (rolo da impressora de etiquetas)'}>
            {(id) => (
              <select id={id} value={papel} onChange={(e) => setPapel(e.target.value === 'a4' ? 'a4' : 'rolo')}>
                <option value="rolo">Rolo de etiquetas</option>
                <option value="a4">Folha A4 adesiva (várias por folha)</option>
              </select>
            )}
          </Field>
          {papel === 'a4' && (
            <>
              <Field label="Espaço entre as etiquetas">{(id) => <NumberInput id={id} value={espaco} min={0} max={20} suffix="mm" onChange={setEspaco} />}</Field>
              <label className="check">
                <input type="checkbox" checked={cortes} onChange={(e) => setCortes(e.target.checked)} /> Linha fina de corte
              </label>
            </>
          )}
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
          <label className="check">
            <input type="checkbox" checked={!!previa.especiariaPura} onChange={(e) => salvarProduto({ especiariaPura: e.target.checked || undefined })} /> Especiaria pura, sem mistura (dispensada da tabela nutricional)
          </label>
          <div className="form-grid">
            <Field label="Glúten" hint="Obrigatório no rótulo.">
              {(id) => (
                <select id={id} value={previa.gluten ?? ''} onChange={(e) => salvarProduto({ gluten: (e.target.value || undefined) as Product['gluten'] })}>
                  <option value="">Escolha…</option>
                  <option value="nao-contem">NÃO CONTÉM GLÚTEN</option>
                  <option value="contem">CONTÉM GLÚTEN</option>
                </select>
              )}
            </Field>
            <Field label="Alérgicos (opcional)" hint="Ex.: “PODE CONTER AMENDOIM E CASTANHAS”.">
              {(id) => <input id={id} value={previa.alergenicos ?? ''} onChange={(e) => salvarProduto({ alergenicos: e.target.value })} />}
            </Field>
            <Field label="Modo de usar (opcional)" className="span-2">
              {(id) => <input id={id} value={previa.modoUso ?? ''} onChange={(e) => salvarProduto({ modoUso: e.target.value })} placeholder="Ex.: Use 1 colher de chá para cada 500 g de carne." />}
            </Field>
          </div>
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
