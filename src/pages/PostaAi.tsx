import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Field, Notice, PageHeader, downloadBlob } from '../ui/ui';
import { Icon } from '../ui/icons';
import { logoSrc } from '../ui/logo';
import { fotoProduto } from '../ui/foto';
import { newId } from '../core/normalize';
import { contatosLoja } from '../core/orcamentos';
import { ANGULOS, TEMAS, entender, sugerirLegendas, type Sugestao, type Tema } from '../core/legendas';
import { FORMATOS_IDEIA, TIPOS_IDEIA, frasesArriscadas, gerarIdeias, ideiaLivre, legendaCompleta, type Ideia } from '../core/postaai';
import { CORES_ARTE, ENFEITES, ESTILOS_PRONTOS, FAMILIAS_ARTE, FORMATOS_ARTE, VARIACOES, corArte, novaCamada, type FormatoArte } from '../core/estilosArte';
import { AJUSTE_PADRAO, FILTROS_FOTO, arteEmImagem, camadaEm, carregarImagem, carrosselEmImagens, desenharArte, garantirFontes, videoDasFotos, type AjusteFoto, type ConteudoArte, type OpcoesArte } from '../export/arte';
import type { CamadaArte, ConfigPostaAi, EstiloArte, FonteSalva } from '../types';
import '@fontsource-variable/caveat';
import '@fontsource/bebas-neue';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/dancing-script';

type Filtro = 'todas' | 'receitas' | 'ofertas' | 'sabia' | 'datas' | 'postadas';
const FILTROS: { id: Filtro; rotulo: string; tipos?: Ideia['tipo'][] }[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'receitas', rotulo: 'Receitas e mixes', tipos: ['receita', 'mix', 'lista'] },
  { id: 'ofertas', rotulo: 'Ofertas e novidades', tipos: ['oferta', 'novidade', 'queridinho'] },
  { id: 'sabia', rotulo: 'Dicas', tipos: ['sabia', 'loja'] },
  { id: 'datas', rotulo: 'Datas', tipos: ['data'] },
  { id: 'postadas', rotulo: 'Já postadas' },
];

const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const ROTULO_TIPO: Record<CamadaArte['tipo'], string> = { foto: 'Foto', texto: 'Texto', forma: 'Faixa / forma', logo: 'Logo', enfeite: 'Enfeite', lista: 'Lista em faixas', selo: 'Selo' };
const SELOS_PRONTOS = ['Novidade', 'Mais vendido', 'Promoção', 'Feito com carinho'];
const CAMPOS: { id: NonNullable<CamadaArte['campo']>; rotulo: string }[] = [
  { id: 'titulo', rotulo: 'Título' },
  { id: 'subtitulo', rotulo: 'Subtítulo' },
  { id: 'chamada', rotulo: 'Chamada' },
  { id: 'preco', rotulo: 'Preço' },
  { id: 'livre', rotulo: 'Texto próprio' },
];
const MASCARAS: { id: NonNullable<CamadaArte['mascara']>; rotulo: string }[] = [
  { id: 'retangulo', rotulo: 'Retângulo' },
  { id: 'arredondado', rotulo: 'Cantos arredondados' },
  { id: 'pote', rotulo: 'Pote' },
  { id: 'circulo', rotulo: 'Círculo' },
  { id: 'arco', rotulo: 'Arco' },
];
const LIMITE_FONTE = 600_000;

function conteudoDe(i: Ideia): ConteudoArte {
  return { titulo: i.titulo, subtitulo: i.subtitulo, chamada: i.chamada, preco: i.preco ?? '', itens: i.itens };
}

export default function PostaAi() {
  useDocumentTitle('Posta Aí');
  const { state, act } = useApp();
  const { toast, confirm } = useFeedback();
  const { lista, loja, config } = state;
  const pa: ConfigPostaAi = config.postaAi ?? {};
  const fontes: FonteSalva[] = useMemo(() => config.fontes ?? [], [config.fontes]);
  const hoje = hojeLocal();
  const insta = contatosLoja(loja).insta;
  const setPa = (patch: Partial<ConfigPostaAi>) => act.config((c) => ({ ...c, postaAi: { ...(c.postaAi ?? {}), ...patch } }));

  // ---------------------------------------------------------------- ideias
  const ideias = useMemo(() => gerarIdeias({ produtos: lista.produtos, loja, config, hoje }), [lista.produtos, loja, config, hoje]);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const visiveis = ideias.filter((i) => {
    const postada = !!pa.postados?.[i.id];
    if (filtro === 'postadas') return postada;
    if (postada && filtro === 'todas') return false;
    const f = FILTROS.find((x) => x.id === filtro);
    return !f?.tipos || f.tipos.includes(i.tipo);
  });
  const [ideia, setIdeia] = useState<Ideia>(() => ideias.find((i) => !pa.postados?.[i.id]) ?? ideiaLivre());
  const [conteudo, setConteudo] = useState<ConteudoArte>(() => conteudoDe(ideia));
  const [legenda, setLegenda] = useState(() => legendaCompleta(ideia, loja, pa.cidade ?? '', insta));
  const [formato, setFormato] = useState<FormatoArte>(ideia.formato === 'story' || ideia.formato === 'reel' ? 'story' : 'feed');
  const estilos = useMemo(() => [...ESTILOS_PRONTOS, ...(pa.estilos ?? [])], [pa.estilos]);
  const [estiloId, setEstiloId] = useState(ideia.estilo);
  const [rascunho, setRascunho] = useState<EstiloArte | null>(null);
  const estiloBase = estilos.find((e) => e.id === estiloId) ?? estilos[0];
  const estilo = rascunho?.id === estiloBase.id ? rascunho : estiloBase;
  const [variacao, setVariacao] = useState(0);

  function escolher(i: Ideia) {
    setIdeia(i);
    setConteudo(conteudoDe(i));
    setLegenda(legendaCompleta(i, loja, pa.cidade ?? '', insta));
    setFormato(i.formato === 'story' || i.formato === 'reel' ? 'story' : 'feed');
    setEstiloId(i.estilo);
    setRascunho(null);
    setSelId(null);
    setTimeout(() => document.getElementById('pa-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  // ---------------------------------------------------------------- fotos e letras
  const [fotos, setFotos] = useState<string[]>([]);
  const [fotoIdx, setFotoIdx] = useState(0);
  const [imgs, setImgs] = useState<Map<string, HTMLImageElement>>(new Map());
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [ajuste, setAjuste] = useState<AjusteFoto>(AJUSTE_PADRAO);
  const [prontas, setProntas] = useState(0);
  useEffect(() => {
    void carregarImagem(logoSrc(loja)).then(setLogo);
  }, [loja]);
  useEffect(() => {
    void garantirFontes(fontes).then(() => setProntas((n) => n + 1));
  }, [fontes]);
  useEffect(() => {
    let vivo = true;
    void Promise.all(fotos.map(async (f) => [f, imgs.get(f) ?? (await carregarImagem(f))] as const)).then((pares) => {
      if (vivo) setImgs(new Map(pares.filter((p): p is [string, HTMLImageElement] => !!p[1])));
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotos]);
  const foto = imgs.get(fotos[fotoIdx]) ?? null;

  async function subirFotos(files: FileList | null) {
    if (!files?.length) return;
    try {
      const novas = await Promise.all([...files].slice(0, 8).map((f) => fotoProduto(f, 1600, false)));
      setFotos((a) => [...a, ...novas].slice(0, 8));
      if (!fotos.length) setFotoIdx(0);
      setAjuste(AJUSTE_PADRAO);
    } catch (e) {
      toast((e as Error).message || 'Não foi possível abrir a foto.', 'erro');
    }
  }

  async function subirFonte(file: File | undefined) {
    if (!file) return;
    if (file.size > LIMITE_FONTE) return toast('Essa letra é grande demais (máximo 600 KB). Prefira o arquivo .woff2.', 'erro');
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) return toast('Use um arquivo de letra (.ttf, .otf, .woff ou .woff2).', 'erro');
    const dados = await new Promise<string>((ok) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.readAsDataURL(file);
    });
    const nome = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 40);
    const f: FonteSalva = { id: newId(), nome, dados };
    try {
      const ff = new FontFace('teste', `url(${dados})`);
      await ff.load();
    } catch {
      return toast('Não consegui ler essa letra. Tente outro arquivo.', 'erro');
    }
    act.config((c) => ({ ...c, fontes: [...(c.fontes ?? []), f] }));
    toast(`Letra “${nome}” adicionada.`);
  }

  // ---------------------------------------------------------------- prévia
  const opcoes: OpcoesArte = { formato, variacao, loja, logo, fontes, foto, ajuste };
  const canvas = useRef<HTMLCanvasElement>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const sel = estilo.camadas.find((c) => c.id === selId) ?? null;
  const [modo, setModo] = useState<'foto' | 'pecas'>('foto');
  const LARG = 420;
  const { w: FW, h: FH } = FORMATOS_ARTE[formato];
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    cv.width = LARG * dpr;
    cv.height = (LARG * FH * dpr) / FW;
    desenharArte(cv.getContext('2d')!, estilo, conteudo, { ...opcoes, previa: true, selecionada: modo === 'pecas' ? selId : null }, (LARG * dpr) / FW);
  });

  const arrasto = useRef<{ x: number; y: number; c?: CamadaArte; a: AjusteFoto; alca?: boolean; movido?: boolean } | null>(null);
  // desfazer / refazer: guarda o visual antes de cada mudança (até 60 passos)
  const hist = useRef<{ id: string; passado: EstiloArte[]; futuro: EstiloArte[] }>({ id: '', passado: [], futuro: [] });
  const [, setVersao] = useState(0);
  if (hist.current.id !== estilo.id) hist.current = { id: estilo.id, passado: [], futuro: [] };
  const editar = (fn: (e: EstiloArte) => EstiloArte, registrar = true) => {
    if (registrar) {
      hist.current.passado = [...hist.current.passado, estilo].slice(-60);
      hist.current.futuro = [];
      setVersao((v) => v + 1);
    }
    setRascunho(fn(estilo));
  };
  const mudarCamada = (id: string, patch: Partial<CamadaArte>, registrar = true) => editar((e) => ({ ...e, camadas: e.camadas.map((c) => (c.id === id ? { ...c, ...patch } : c)) }), registrar);
  function desfazer() {
    const h = hist.current;
    const antes = h.passado.pop();
    if (!antes) return;
    h.futuro = [estilo, ...h.futuro];
    setRascunho(antes);
    setVersao((v) => v + 1);
  }
  function refazer() {
    const h = hist.current;
    const [depois, ...resto] = h.futuro;
    if (!depois) return;
    h.passado = [...h.passado, estilo];
    h.futuro = resto;
    setRascunho(depois);
    setVersao((v) => v + 1);
  }
  function duplicar(c: CamadaArte) {
    const nova = { ...c, id: novaCamada(c.tipo).id, x: +(c.x + 0.04).toFixed(4), y: +(c.y + 0.04).toFixed(4) };
    editar((e) => ({ ...e, camadas: [...e.camadas, nova] }));
    setSelId(nova.id);
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) (e.preventDefault(), desfazer());
      else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) (e.preventDefault(), refazer());
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  function ponto(e: PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }
  const dedos = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinca = useRef<{ dist: number; c: CamadaArte; feito: boolean } | null>(null);
  const distancia = () => {
    const [a, b] = [...dedos.current.values()];
    return Math.hypot((a.x - b.x) * FW, (a.y - b.y) * FH);
  };
  /** perto da alça do canto de baixo, à direita, da peça escolhida */
  const naAlca = (c: CamadaArte | null, p: { x: number; y: number }) => !!c && Math.abs(p.x - (c.x + c.w)) < 0.045 && Math.abs(p.y - (c.y + c.h)) < (0.045 * FW) / FH;
  function down(e: PointerEvent<HTMLCanvasElement>) {
    const p = ponto(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    dedos.current.set(e.pointerId, p);
    if (modo === 'pecas' && dedos.current.size === 2 && sel) {
      // dois dedos: aumenta ou diminui a peça escolhida
      pinca.current = { dist: distancia(), c: sel, feito: false };
      arrasto.current = null;
      return;
    }
    if (modo === 'pecas') {
      if (naAlca(sel, p)) {
        arrasto.current = { ...p, c: sel!, a: ajuste, alca: true };
        return;
      }
      const c = camadaEm(estilo, p.x, p.y);
      setSelId(c?.id ?? null);
      arrasto.current = { ...p, c: c ?? undefined, a: ajuste };
    } else arrasto.current = { ...p, a: ajuste };
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (dedos.current.has(e.pointerId)) dedos.current.set(e.pointerId, ponto(e));
    const pc = pinca.current;
    if (pc && dedos.current.size === 2) {
      const f = Math.max(0.2, Math.min(5, distancia() / Math.max(1, pc.dist)));
      const c = pc.c;
      const w = Math.max(0.03, c.w * f), h = Math.max(0.03, c.h * f);
      mudarCamada(c.id, { w: +w.toFixed(4), h: +h.toFixed(4), x: +(c.x - (w - c.w) / 2).toFixed(4), y: +(c.y - (h - c.h) / 2).toFixed(4) }, !pc.feito);
      pc.feito = true;
      return;
    }
    const d = arrasto.current;
    if (!d) return;
    const p = ponto(e);
    const dx = p.x - d.x, dy = p.y - d.y;
    if (modo === 'pecas' && d.c && d.alca) {
      mudarCamada(d.c.id, { w: +Math.max(0.03, d.c.w + dx).toFixed(4), h: +Math.max(0.03, d.c.h + dy).toFixed(4) }, !d.movido);
      d.movido = true;
    } else if (modo === 'pecas' && d.c) {
      if (!d.movido && Math.abs(dx) + Math.abs(dy) < 0.004) return;
      mudarCamada(d.c.id, { x: +(d.c.x + dx).toFixed(4), y: +(d.c.y + dy).toFixed(4) }, !d.movido);
      d.movido = true;
    } else if (modo === 'foto') {
      const lim = (v: number) => Math.max(-1, Math.min(1, v));
      const k = 2 / Math.max(0.15, ajuste.zoom - 0.85);
      setAjuste({ ...d.a, fx: lim(d.a.fx - dx * k), fy: lim(d.a.fy - dy * k) });
    }
  }
  const up = (e: PointerEvent<HTMLCanvasElement>) => {
    dedos.current.delete(e.pointerId);
    if (dedos.current.size < 2) pinca.current = null;
    arrasto.current = null;
  };

  // miniaturas dos estilos
  const minis = useRef<Map<string, HTMLCanvasElement>>(new Map());
  useEffect(() => {
    for (const e of estilos) {
      const cv = minis.current.get(e.id);
      if (!cv) continue;
      cv.width = 96 * dpr;
      cv.height = (96 * dpr * FH) / FW;
      const base = rascunho?.id === e.id ? rascunho : e;
      desenharArte(cv.getContext('2d')!, base, conteudo, { ...opcoes, previa: true }, (96 * dpr) / FW);
    }
  });

  // ---------------------------------------------------------------- saídas
  const [ocupado, setOcupado] = useState<string | null>(null);
  const precisaFoto = estilo.camadas.some((c) => c.tipo === 'foto') && !foto;
  const riscos = frasesArriscadas([conteudo.titulo, conteudo.subtitulo, conteudo.chamada, conteudo.itens.join(' '), legenda].join(' '));
  const nomeArq = (sufixo: string, ext: string) => `posta-ai-${ideia.id}-${sufixo}.${ext}`.replace(/[^a-z0-9.-]+/gi, '-');

  async function copiarLegenda(aviso = true) {
    try {
      await navigator.clipboard.writeText(legenda);
      if (aviso) toast('Legenda copiada. Cole no Instagram.');
      return true;
    } catch {
      if (aviso) toast('Não consegui copiar. Selecione a legenda e copie à mão.', 'erro');
      return false;
    }
  }
  async function entregar(files: File[], acao: 'compartilhar' | 'baixar') {
    if (acao === 'compartilhar' && navigator.canShare?.({ files })) {
      const copiou = await copiarLegenda(false);
      try {
        await navigator.share({ files });
        toast(copiou ? 'Legenda copiada: é só colar no Instagram.' : 'Pronto!');
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') throw e;
      }
      return;
    }
    files.forEach((f) => downloadBlob(f, f.name, f.type));
    toast(files.length > 1 ? `${files.length} arquivos baixados.` : 'Arquivo baixado.');
  }
  async function rodar(nome: string, fn: () => Promise<void>) {
    if (precisaFoto) {
      toast('Suba uma foto primeiro (ou escolha um estilo sem foto).', 'erro');
      return;
    }
    setOcupado(nome);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message || 'Não foi possível gerar.', 'erro');
    } finally {
      setOcupado(null);
    }
  }
  const imagem = (acao: 'compartilhar' | 'baixar') =>
    rodar(acao, async () => {
      const b = await arteEmImagem(estilo, conteudo, opcoes);
      await entregar([new File([b], nomeArq(formato, 'jpg'), { type: 'image/jpeg' })], acao);
    });
  const carrossel = () =>
    rodar('carrossel', async () => {
      const bs = await carrosselEmImagens(estilo, conteudo, opcoes, { titulo: 'Gostou? Salve e compartilhe!', subtitulo: insta ? `Pedidos pelo link da bio · ${insta}` : 'Pedidos pelo link da bio' });
      await entregar(bs.map((b, i) => new File([b], nomeArq(`${i + 1}`, 'jpg'), { type: 'image/jpeg' })), 'compartilhar');
    });
  const [progresso, setProgresso] = useState(0);
  const video = () =>
    rodar('video', async () => {
      const lista = fotos.map((f) => imgs.get(f)).filter((x): x is HTMLImageElement => !!x);
      const temFoto = estilo.camadas.some((c) => c.tipo === 'foto');
      if (!temFoto) toast('Este estilo não tem foto: o vídeo sai no estilo “Pote recortado”.', 'info');
      const { blob, ext } = await videoDasFotos(temFoto ? estilo : ESTILOS_PRONTOS[0], conteudo, { ...opcoes, formato: 'story' }, lista, setProgresso);
      if (ext !== 'mp4') toast('Seu navegador gravou em WebM: o Instagram pode não aceitar. No celular (Chrome ou Safari atualizado) sai em MP4.', 'info');
      await entregar([new File([blob], nomeArq('video', ext), { type: blob.type })], 'compartilhar');
    });

  function marcarPostado() {
    const postados = { ...(pa.postados ?? {}) };
    if (postados[ideia.id]) delete postados[ideia.id];
    else postados[ideia.id] = hoje;
    setPa({ postados });
    toast(postados[ideia.id] ? 'Marcado como postado.' : 'Voltou para as ideias.');
  }

  // ---------------------------------------------------------------- estilos salvos
  const [nomeEstilo, setNomeEstilo] = useState('');
  const proprio = !ESTILOS_PRONTOS.some((e) => e.id === estilo.id);
  function salvarEstilo() {
    const nome = nomeEstilo.trim() || `${estilo.nome} (meu)`;
    if (proprio && !nomeEstilo.trim()) {
      setPa({ estilos: (pa.estilos ?? []).map((e) => (e.id === estilo.id ? estilo : e)) });
      setRascunho(null);
      return toast(`Estilo “${estilo.nome}” salvo.`);
    }
    const novo: EstiloArte = { ...estilo, id: newId(), nome };
    setPa({ estilos: [...(pa.estilos ?? []), novo] });
    setEstiloId(novo.id);
    setRascunho(null);
    setNomeEstilo('');
    toast(`Estilo “${nome}” salvo. Ele aparece para toda a equipe.`);
  }
  async function apagarEstilo() {
    if (!(await confirm({ titulo: 'Apagar estilo', mensagem: `Apagar o estilo “${estilo.nome}”? As artes já baixadas não mudam.`, confirmar: 'Apagar estilo', perigo: true }))) return;
    setPa({ estilos: (pa.estilos ?? []).filter((e) => e.id !== estilo.id) });
    setEstiloId(ESTILOS_PRONTOS[0].id);
    setRascunho(null);
  }
  function addCamada(tipo: CamadaArte['tipo'], extra: Partial<CamadaArte> = {}) {
    const c = novaCamada(tipo, extra);
    editar((e) => ({ ...e, camadas: [...e.camadas, c] }));
    setModo('pecas');
    setSelId(c.id);
  }
  function moverOrdem(id: string, d: -1 | 1) {
    editar((e) => {
      const i = e.camadas.findIndex((c) => c.id === id);
      const j = i + d;
      if (j < 0 || j >= e.camadas.length) return e;
      const cs = [...e.camadas];
      [cs[i], cs[j]] = [cs[j], cs[i]];
      return { ...e, camadas: cs };
    });
  }

  const familias = [...FAMILIAS_ARTE.map((f) => ({ id: f.id, rotulo: f.rotulo })), ...fontes.map((f) => ({ id: `f:${f.id}`, rotulo: `${f.nome} (sua)` }))];
  const set = (patch: Partial<ConteudoArte>) => setConteudo((k) => ({ ...k, ...patch }));

  // ---------------------------------------------------------------- legendas a partir do que vai ser postado
  const [pedido, setPedido] = useState('');
  const [temaEscolhido, setTemaEscolhido] = useState<Tema | 'auto'>('auto');
  const [semente, setSemente] = useState(1);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const temaAuto = useMemo(() => entender(pedido, lista.produtos).tema, [pedido, lista.produtos]);
  function sugerir(nova = false) {
    const sem = nova ? semente + 1 : semente;
    setSemente(sem);
    setSugestoes(sugerirLegendas({ texto: pedido, tema: temaEscolhido === 'auto' ? undefined : temaEscolhido, produtos: lista.produtos, loja, cidade: pa.cidade ?? '', insta, semente: sem }));
  }
  function usarLegenda(x: Sugestao) {
    setLegenda(x.legenda);
    toast('Legenda trocada. Dá para editar à vontade lá embaixo.');
  }
  function usarNaArte(x: Sugestao) {
    set({ titulo: x.textoArte, subtitulo: x.subtituloArte });
    toast('Frase colocada na arte.');
  }
  void prontas;

  return (
    <div className="page pa-page">
      <PageHeader titulo="Posta Aí" subtitulo="Ideias de post com os seus produtos. Escolha uma ideia, suba a foto e baixe a arte com legenda e hashtags." />

      <div className="pa-grade">
        <section className="card pa-ideias" aria-label="Ideias">
          <div className="pa-filtros" role="tablist" aria-label="Filtrar ideias">
            {FILTROS.map((f) => (
              <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} className={`pa-chip ${filtro === f.id ? 'on' : ''}`} onClick={() => setFiltro(f.id)}>
                {f.rotulo}
              </button>
            ))}
          </div>
          <ul className="pa-lista">
            {visiveis.map((i) => (
              <li key={i.id}>
                <button type="button" className={`pa-ideia ${ideia.id === i.id ? 'on' : ''}`} onClick={() => escolher(i)} aria-pressed={ideia.id === i.id}>
                  <span className="pa-tag">
                    {TIPOS_IDEIA[i.tipo]} · {FORMATOS_IDEIA[i.formato]}
                  </span>
                  <strong>{i.titulo}</strong>
                  <span className="muted small">{i.subtitulo}</span>
                  {i.motivo && <span className="pa-motivo">{i.motivo}</span>}
                  {pa.postados?.[i.id] && <span className="pa-motivo ok">Postada em {pa.postados[i.id].split('-').reverse().join('/')}</span>}
                </button>
              </li>
            ))}
            {!visiveis.length && <li className="muted small">Nenhuma ideia aqui por enquanto.</li>}
          </ul>
          <Button variant="secondary" icon="plus" onClick={() => escolher(ideiaLivre())}>
            Criar arte livre
          </Button>
          <Field label="Cidade (para legendas e hashtags)">
            {(id) => <input id={id} value={pa.cidade ?? ''} placeholder="Ex.: Parnaíba" onChange={(e) => setPa({ cidade: e.target.value })} />}
          </Field>
        </section>

        <section className="card pa-editor" id="pa-editor" aria-label="Arte">
          <div className="card-head">
            <h2>{conteudo.titulo || 'Arte'}</h2>
            <span className="pa-tag">
              {TIPOS_IDEIA[ideia.tipo]} · {FORMATOS_IDEIA[ideia.formato]}
            </span>
          </div>

          <fieldset className="pa-pedido">
            <legend>O que você vai postar?</legend>
            <Field label="Conte em poucas palavras" hint="Ex.: frango assado com a nossa páprica · chegou cúrcuma · embalando canela · kit de presente">
              {(id) => (
                <textarea
                  id={id}
                  rows={2}
                  value={pedido}
                  placeholder="Ex.: frango assado com a nossa páprica defumada"
                  onChange={(e) => setPedido(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sugerir(true);
                    }
                  }}
                />
              )}
            </Field>
            <div className="pa-filtros" role="radiogroup" aria-label="Assunto do post">
              <button type="button" role="radio" aria-checked={temaEscolhido === 'auto'} className={`pa-chip ${temaEscolhido === 'auto' ? 'on' : ''}`} onClick={() => setTemaEscolhido('auto')}>
                Automático{pedido.trim() ? `: ${TEMAS.find((t) => t.id === temaAuto)?.rotulo}` : ''}
              </button>
              {TEMAS.map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={temaEscolhido === t.id} title={t.dica} className={`pa-chip ${temaEscolhido === t.id ? 'on' : ''}`} onClick={() => setTemaEscolhido(t.id)}>
                  {t.rotulo}
                </button>
              ))}
            </div>
            <div className="pa-linha">
              <Button icon="sparkle" onClick={() => sugerir(sugestoes.length > 0)}>
                {sugestoes.length ? 'Outras sugestões' : 'Sugerir legendas'}
              </Button>
              {sugestoes.length > 0 && <span className="muted small">Cada uma num formato diferente. Toque de novo para variar.</span>}
            </div>
            {sugestoes.length > 0 && (
              <div className="pa-sugs">
                {sugestoes.map((x) => (
                  <article key={x.angulo + x.gancho} className="pa-sug">
                    <span className="pa-tag">{ANGULOS[x.angulo]}</span>
                    <p className="pa-sug-texto">{x.legenda}</p>
                    <div className="pa-linha">
                      <Button variant="secondary" icon="check" onClick={() => usarLegenda(x)}>
                        Usar legenda
                      </Button>
                      <Button variant="ghost" icon="edit" onClick={() => usarNaArte(x)}>
                        Frase na arte
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </fieldset>

          <div className="pa-fotos">
            <label className="pa-subir">
              <Icon name="upload" />
              <span>{fotos.length ? 'Adicionar mais fotos' : 'Subir foto'}</span>
              <input type="file" accept="image/*" multiple onChange={(e) => void subirFotos(e.target.files).finally(() => (e.target.value = ''))} />
            </label>
            {fotos.map((f, i) => (
              <div key={f.slice(-24) + i} className={`pa-foto ${i === fotoIdx ? 'on' : ''}`}>
                <button type="button" onClick={() => setFotoIdx(i)} aria-label={`Usar foto ${i + 1}`}>
                  <img src={f} alt="" />
                </button>
                <button
                  type="button"
                  className="pa-tirar"
                  aria-label={`Tirar foto ${i + 1}`}
                  onClick={() => {
                    setFotos((a) => a.filter((_, j) => j !== i));
                    setFotoIdx(0);
                  }}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="pa-estilos" role="radiogroup" aria-label="Estilo da arte">
            {estilos.map((e) => (
              <button key={e.id} type="button" role="radio" aria-checked={estilo.id === e.id} className={`pa-estilo ${estilo.id === e.id ? 'on' : ''}`} onClick={() => (setEstiloId(e.id), setSelId(null))}>
                <canvas
                  ref={(el) => {
                    if (el) minis.current.set(e.id, el);
                    else minis.current.delete(e.id);
                  }}
                  style={{ width: 96, height: (96 * FH) / FW }}
                  aria-hidden
                />
                <span>{e.nome}</span>
              </button>
            ))}
          </div>

          <div className="pa-montar">
            <div className="pa-previa-col">
              <div className="pa-barra">
                <div className="pa-seg" role="group" aria-label="Formato">
                  {(Object.keys(FORMATOS_ARTE) as FormatoArte[]).map((f) => (
                    <button key={f} type="button" aria-pressed={formato === f} className={formato === f ? 'on' : ''} onClick={() => setFormato(f)}>
                      {f === 'feed' ? 'Feed' : 'Story'}
                    </button>
                  ))}
                </div>
                <div className="pa-seg" role="group" aria-label="Arrastar na arte">
                  <button type="button" aria-pressed={modo === 'foto'} className={modo === 'foto' ? 'on' : ''} onClick={() => setModo('foto')}>
                    Mover foto
                  </button>
                  <button type="button" aria-pressed={modo === 'pecas'} className={modo === 'pecas' ? 'on' : ''} onClick={() => setModo('pecas')}>
                    Mover peças
                  </button>
                </div>
                <div className="pa-seg" role="group" aria-label="Desfazer e refazer">
                  <button type="button" onClick={desfazer} disabled={!hist.current.passado.length} title="Desfazer (Ctrl+Z)">
                    Desfazer
                  </button>
                  <button type="button" onClick={refazer} disabled={!hist.current.futuro.length} title="Refazer (Ctrl+Y)">
                    Refazer
                  </button>
                </div>
              </div>
              <canvas
                ref={canvas}
                className={`pa-previa ${modo}`}
                style={{ width: LARG, maxWidth: '100%', aspectRatio: `${FW} / ${FH}` }}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
                role="img"
                aria-label={`Prévia da arte: ${conteudo.titulo}`}
              />
              <p className="muted small">{modo === 'foto' ? 'Arraste a foto para escolher a parte que aparece. Aumente o zoom para ter mais folga.' : 'Toque numa peça para escolher e arraste para mudar de lugar. Puxe a bolinha do canto ou use dois dedos para aumentar e diminuir.'}</p>
              <label className="pa-range">
                <span>Zoom da foto</span>
                <input type="range" min={1} max={3} step={0.05} value={ajuste.zoom} onChange={(e) => setAjuste({ ...ajuste, zoom: Number(e.target.value) })} />
              </label>
              <details className="pa-ajustes">
                <summary>Filtros e ajustes da foto</summary>
                <div className="pa-filtros" role="radiogroup" aria-label="Filtro da foto">
                  {FILTROS_FOTO.map((f) => (
                    <button key={f.id} type="button" role="radio" aria-checked={(ajuste.filtro ?? 'natural') === f.id} className={(ajuste.filtro ?? 'natural') === f.id ? 'on' : ''} onClick={() => setAjuste({ ...ajuste, ...f.a, filtro: f.id })}>
                      {f.nome}
                    </button>
                  ))}
                </div>
                {(
                  [
                    ['brilho', 'Brilho'],
                    ['contraste', 'Contraste'],
                    ['saturacao', 'Cor'],
                    ['calor', 'Frio ↔ Quente'],
                  ] as const
                ).map(([k, r]) => (
                  <label key={k} className="pa-range">
                    <span>{r}</span>
                    <input type="range" min={-1} max={1} step={0.05} value={ajuste[k] ?? 0} onChange={(e) => setAjuste({ ...ajuste, [k]: Number(e.target.value), filtro: undefined })} />
                  </label>
                ))}
              </details>
              <div className="pa-cores" role="radiogroup" aria-label="Combinação de cores">
                {VARIACOES.map((v, i) => (
                  <button key={v} type="button" role="radio" aria-checked={variacao === i} className={variacao === i ? 'on' : ''} onClick={() => setVariacao(i)} title={v}>
                    <span style={{ background: corArte('primaria', loja, i) }} />
                    <span style={{ background: corArte('destaque', loja, i) }} />
                    <span style={{ background: corArte('creme', loja, i) }} />
                    <small>{v}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="pa-lado">
              {modo === 'pecas' && sel ? (
                <fieldset className="pa-peca">
                  <legend>{ROTULO_TIPO[sel.tipo]}</legend>
                  {sel.tipo === 'texto' && (
                    <>
                      <Field label="O que mostra">
                        {(id) => (
                          <select id={id} value={sel.campo ?? 'livre'} onChange={(e) => mudarCamada(sel.id, { campo: e.target.value as CamadaArte['campo'], texto: sel.texto ?? 'Seu texto' })}>
                            {CAMPOS.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.rotulo}
                              </option>
                            ))}
                          </select>
                        )}
                      </Field>
                      {(sel.campo ?? 'livre') === 'livre' && (
                        <Field label="Texto">{(id) => <textarea id={id} rows={2} value={sel.texto ?? ''} onChange={(e) => mudarCamada(sel.id, { texto: e.target.value })} />}</Field>
                      )}
                    </>
                  )}
                  {(sel.tipo === 'texto' || sel.tipo === 'lista' || sel.tipo === 'selo') && (
                    <>
                      <Field label="Letra">
                        {(id) => (
                          <select id={id} value={sel.familia ?? 'simples'} onChange={(e) => mudarCamada(sel.id, { familia: e.target.value })}>
                            {familias.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.rotulo}
                              </option>
                            ))}
                          </select>
                        )}
                      </Field>
                      <label className="pa-range">
                        <span>Tamanho da letra</span>
                        <input type="range" min={0.02} max={0.3} step={0.005} value={sel.tamanho ?? 0.06} onChange={(e) => mudarCamada(sel.id, { tamanho: Number(e.target.value) })} />
                      </label>
                    </>
                  )}
                  {sel.tipo === 'texto' && (
                    <div className="pa-linha">
                      <Field label="Alinhar">
                        {(id) => (
                          <select id={id} value={sel.alinhar ?? 'centro'} onChange={(e) => mudarCamada(sel.id, { alinhar: e.target.value as CamadaArte['alinhar'] })}>
                            <option value="esquerda">Esquerda</option>
                            <option value="centro">Centro</option>
                            <option value="direita">Direita</option>
                          </select>
                        )}
                      </Field>
                      <label className="check">
                        <input type="checkbox" checked={!!sel.maiusculas} onChange={(e) => mudarCamada(sel.id, { maiusculas: e.target.checked || undefined })} /> MAIÚSCULAS
                      </label>
                      <label className="check">
                        <input type="checkbox" checked={!!sel.sombra} onChange={(e) => mudarCamada(sel.id, { sombra: e.target.checked || undefined })} /> Sombra
                      </label>
                      <label className="check">
                        <input type="checkbox" checked={!!sel.contorno} onChange={(e) => mudarCamada(sel.id, { contorno: e.target.checked || undefined })} /> Contorno
                      </label>
                    </div>
                  )}
                  {sel.tipo === 'texto' && (
                    <Field label="Faixa atrás do texto" hint="Como o texto dos stories.">
                      {(id) => (
                        <select id={id} value={sel.fundoTexto ?? ''} onChange={(e) => mudarCamada(sel.id, { fundoTexto: (e.target.value || undefined) as CamadaArte['fundoTexto'] })}>
                          <option value="">Sem faixa</option>
                          {CORES_ARTE.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.rotulo}
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                  )}
                  {sel.tipo === 'selo' && (
                    <>
                      <Field label="Formato do selo">
                        {(id) => (
                          <select id={id} value={sel.formaSelo ?? 'circulo'} onChange={(e) => mudarCamada(sel.id, { formaSelo: e.target.value as CamadaArte['formaSelo'] })}>
                            <option value="estrela">Estrela</option>
                            <option value="circulo">Círculo</option>
                            <option value="etiqueta">Etiqueta</option>
                          </select>
                        )}
                      </Field>
                      <div className="pa-filtros" role="group" aria-label="Textos prontos do selo">
                        <button type="button" className={sel.campo === 'preco' ? 'on' : ''} onClick={() => mudarCamada(sel.id, { campo: 'preco' })}>
                          Preço
                        </button>
                        {SELOS_PRONTOS.map((t) => (
                          <button key={t} type="button" className={sel.campo === 'livre' && sel.texto === t ? 'on' : ''} onClick={() => mudarCamada(sel.id, { campo: 'livre', texto: t })}>
                            {t}
                          </button>
                        ))}
                      </div>
                      {sel.campo === 'livre' && <Field label="Texto do selo">{(id) => <input id={id} value={sel.texto ?? ''} onChange={(e) => mudarCamada(sel.id, { texto: e.target.value })} />}</Field>}
                    </>
                  )}
                  {sel.tipo === 'foto' && (
                    <>
                      <Field label="Formato da foto">
                        {(id) => (
                          <select id={id} value={sel.mascara ?? 'retangulo'} onChange={(e) => mudarCamada(sel.id, { mascara: e.target.value as CamadaArte['mascara'] })}>
                            {MASCARAS.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.rotulo}
                              </option>
                            ))}
                          </select>
                        )}
                      </Field>
                      <label className="pa-range">
                        <span>Escurecer (para o texto aparecer)</span>
                        <input type="range" min={0} max={0.7} step={0.05} value={sel.escurecer ?? 0} onChange={(e) => mudarCamada(sel.id, { escurecer: Number(e.target.value) })} />
                      </label>
                    </>
                  )}
                  {sel.tipo === 'enfeite' && (
                    <Field label="Desenho">
                      {(id) => (
                        <select id={id} value={sel.enfeite} onChange={(e) => mudarCamada(sel.id, { enfeite: e.target.value })}>
                          {ENFEITES.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.rotulo}
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                  )}
                  {sel.tipo === 'forma' && (
                    <label className="pa-range">
                      <span>Cantos</span>
                      <input type="range" min={0} max={1} step={0.01} value={sel.raio ?? 0} onChange={(e) => mudarCamada(sel.id, { raio: Number(e.target.value) })} />
                    </label>
                  )}
                  {sel.tipo !== 'foto' && sel.tipo !== 'logo' && (
                    <Field label={sel.tipo === 'lista' ? 'Cor do texto' : 'Cor'}>
                      {(id) => (
                        <select id={id} value={sel.cor ?? 'escuro'} onChange={(e) => mudarCamada(sel.id, { cor: e.target.value as CamadaArte['cor'] })}>
                          {CORES_ARTE.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.rotulo}
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                  )}
                  {sel.tipo === 'lista' && (
                    <Field label="Cor das faixas">
                      {(id) => (
                        <select id={id} value={sel.faixa ?? 'escuro'} onChange={(e) => mudarCamada(sel.id, { faixa: e.target.value as CamadaArte['cor'] })}>
                          {CORES_ARTE.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.rotulo}
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                  )}
                  {(
                    [
                      ['w', 'Largura', 0.05, 1.2],
                      ['h', 'Altura', 0.03, 1.2],
                      ['girar', 'Girar', -45, 45],
                      ['opacidade', 'Transparência', 0.1, 1],
                    ] as const
                  ).map(([k, r, min, max]) => (
                    <label key={k} className="pa-range">
                      <span>{r}</span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={k === 'girar' ? 1 : 0.01}
                        value={(sel[k] as number | undefined) ?? (k === 'opacidade' ? 1 : 0)}
                        onChange={(e) => mudarCamada(sel.id, { [k]: Number(e.target.value) })}
                      />
                    </label>
                  ))}
                  <div className="pa-linha">
                    <Button variant="ghost" icon="copy" onClick={() => duplicar(sel)}>
                      Duplicar
                    </Button>
                    <Button variant="ghost" onClick={() => moverOrdem(sel.id, 1)}>
                      Para a frente
                    </Button>
                    <Button variant="ghost" onClick={() => moverOrdem(sel.id, -1)}>
                      Para trás
                    </Button>
                    <Button
                      variant="ghost"
                      icon="trash"
                      onClick={() => {
                        editar((e) => ({ ...e, camadas: e.camadas.filter((c) => c.id !== sel.id) }));
                        setSelId(null);
                      }}
                    >
                      Apagar peça
                    </Button>
                  </div>
                </fieldset>
              ) : (
                <fieldset className="pa-textos">
                  <legend>Textos da arte</legend>
                  <Field label="Título">{(id) => <input id={id} value={conteudo.titulo} onChange={(e) => set({ titulo: e.target.value })} />}</Field>
                  <Field label="Subtítulo">{(id) => <input id={id} value={conteudo.subtitulo} onChange={(e) => set({ subtitulo: e.target.value })} />}</Field>
                  <Field label="Chamada">{(id) => <input id={id} value={conteudo.chamada} onChange={(e) => set({ chamada: e.target.value })} />}</Field>
                  <Field label="Preço">{(id) => <input id={id} value={conteudo.preco} placeholder="Ex.: R$ 4,40 / 100 g" onChange={(e) => set({ preco: e.target.value })} />}</Field>
                  <Field label="Itens (um por linha)" hint="Viram a lista em faixas e os slides do carrossel.">
                    {(id) => <textarea id={id} rows={4} value={conteudo.itens.join('\n')} onChange={(e) => set({ itens: e.target.value.split('\n') })} onBlur={() => set({ itens: conteudo.itens.map((x) => x.trim()).filter(Boolean) })} />}
                  </Field>
                </fieldset>
              )}

              <div className="pa-add">
                <span className="muted small">Adicionar:</span>
                <Button variant="ghost" icon="plus" onClick={() => addCamada('texto')}>
                  Texto
                </Button>
                <Button variant="ghost" icon="plus" onClick={() => addCamada('selo')}>
                  Selo de preço
                </Button>
                <Button variant="ghost" icon="plus" onClick={() => addCamada('enfeite')}>
                  Enfeite
                </Button>
                <Button variant="ghost" icon="plus" onClick={() => addCamada('forma')}>
                  Faixa
                </Button>
                <Button variant="ghost" icon="plus" onClick={() => addCamada('foto')}>
                  Foto
                </Button>
                <Button variant="ghost" icon="plus" onClick={() => addCamada('logo')}>
                  Logo
                </Button>
              </div>

              <div className="pa-salvar">
                <Field label="Salvar este visual como estilo" hint={proprio ? 'Deixe em branco para atualizar este estilo.' : 'Fica disponível para você e a Samara.'}>
                  {(id) => <input id={id} value={nomeEstilo} placeholder={proprio ? estilo.nome : 'Ex.: Natal 2026'} onChange={(e) => setNomeEstilo(e.target.value)} />}
                </Field>
                <div className="pa-linha">
                  <Button variant="secondary" icon="save" onClick={salvarEstilo}>
                    Salvar estilo
                  </Button>
                  {rascunho && (
                    <Button variant="ghost" icon="undo" onClick={() => (setRascunho(null), setSelId(null))}>
                      Desfazer mudanças
                    </Button>
                  )}
                  {proprio && (
                    <Button variant="ghost" icon="trash" onClick={() => void apagarEstilo()}>
                      Apagar estilo
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {ideia.roteiro && (
            <div className="pa-roteiro">
              <h3>Roteiro do Reel</h3>
              <ol>
                {ideia.roteiro.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
              <p className="muted small">Grave as cenas no celular e edite no app de vídeo de sua preferência. Use esta arte, no formato Story, como capa.</p>
            </div>
          )}

          <Field label="Legenda com hashtags">{(id) => <textarea id={id} rows={7} value={legenda} onChange={(e) => setLegenda(e.target.value)} />}</Field>
          {riscos.length > 0 && (
            <Notice tone="warn">
              <strong>Cuidado com: {riscos.join(', ')}.</strong> Propaganda de alimento não pode prometer emagrecer, curar ou tratar. Fale de sabor, receita e praticidade.
            </Notice>
          )}

          <div className="pa-acoes">
            <Button icon="upload" disabled={!!ocupado} onClick={() => void imagem('compartilhar')}>
              {ocupado === 'compartilhar' ? 'Gerando…' : 'Compartilhar'}
            </Button>
            <Button variant="secondary" icon="download" disabled={!!ocupado} onClick={() => void imagem('baixar')}>
              Baixar arte
            </Button>
            {conteudo.itens.length > 0 && (
              <Button variant="secondary" icon="copy" disabled={!!ocupado} onClick={() => void carrossel()}>
                {ocupado === 'carrossel' ? 'Gerando…' : `Carrossel (${conteudo.itens.length + 2} imagens)`}
              </Button>
            )}
            <Button variant="secondary" icon="sparkle" disabled={!!ocupado || !fotos.length} title={fotos.length ? undefined : 'Suba uma ou mais fotos'} onClick={() => void video()}>
              {ocupado === 'video' ? `Gravando… ${Math.round(progresso * 100)}%` : `Vídeo com ${fotos.length > 1 ? `${fotos.length} fotos` : 'a foto'}`}
            </Button>
            <Button variant="ghost" icon="copy" onClick={() => void copiarLegenda()}>
              Copiar legenda
            </Button>
            <Button variant="ghost" icon="check" onClick={marcarPostado}>
              {pa.postados?.[ideia.id] ? 'Desmarcar postado' : 'Marcar como postado'}
            </Button>
          </div>
        </section>
      </div>

      <section className="card">
        <h2>Letras</h2>
        <p className="muted small">
          As artes já têm 6 letras. Para usar outra, baixe uma letra gratuita (por exemplo no Google Fonts, todas liberadas para uso comercial) e adicione aqui. Ela fica salva para a equipe.
        </p>
        <div className="pa-letras">
          {FAMILIAS_ARTE.map((f) => (
            <span key={f.id} className="pa-letra" style={{ fontFamily: f.css, fontWeight: f.peso }}>
              {f.rotulo}
            </span>
          ))}
          {fontes.map((f) => (
            <span key={f.id} className="pa-letra sua">
              <span style={{ fontFamily: `"PA ${f.id}"` }}>{f.nome}</span>
              <button
                type="button"
                aria-label={`Remover a letra ${f.nome}`}
                onClick={async () => {
                  if (await confirm({ titulo: 'Remover letra', mensagem: `Remover a letra “${f.nome}”? Os textos que usam ela voltam para a letra simples.`, confirmar: 'Remover letra', perigo: true }))
                    act.config((c) => ({ ...c, fontes: (c.fontes ?? []).filter((x) => x.id !== f.id) }));
                }}
              >
                <Icon name="x" size={14} />
              </button>
            </span>
          ))}
        </div>
        <label className="btn btn-secondary pa-add-letra">
          <Icon name="plus" />
          Adicionar letra
          <input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={(e) => void subirFonte(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
        </label>
      </section>
    </div>
  );
}
