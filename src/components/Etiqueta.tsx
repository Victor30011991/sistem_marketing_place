import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import type { ConfigBalanca, ModeloEtiqueta, PecaEtiqueta, Product, StoreInfo } from '../types';
import { FAMILIAS, PECAS, cssFamilia, SELOS, areaDe, codigoEtiqueta, corDe, linhasNutricao, textoPeca, type DadosImpressao } from '../core/etiquetas';
import { ean13, modulosEan13 } from '../core/ean';

export interface EdicaoEtiqueta {
  selecionada: string | null;
  onPeca: (id: string, e: PointerEvent<HTMLElement>, modo: 'mover' | 'tamanho') => void;
  onTecla: (id: string, e: KeyboardEvent<HTMLElement>) => void;
  onFoco: (id: string) => void;
}

const MOLDURA: Record<ModeloEtiqueta['moldura'], CSSProperties | null> = {
  nenhuma: null,
  simples: { border: '0.3mm solid #000' },
  dupla: { border: '0.9mm double #000' },
  arredondada: { border: '0.35mm solid #000', borderRadius: '2.5mm' },
};

const JUSTIFICA = { esq: 'flex-start', centro: 'center', dir: 'flex-end' } as const;

function Barras({ codigo, fonte }: { codigo: string; fonte: number }) {
  const m = modulosEan13(codigo);
  if (!m) return null;
  const barras: { x: number; w: number; guarda: boolean }[] = [];
  for (let i = 0; i < m.length; i++) {
    if (m[i] !== '1') continue;
    let j = i;
    while (m[j + 1] === '1') j++;
    const guarda = i < 3 || (i >= 45 && i < 50) || i >= 92;
    barras.push({ x: i, w: j - i + 1, guarda });
    i = j;
  }
  const comTexto = fonte >= 5;
  return (
    <svg viewBox={`0 0 113 ${comTexto ? 70 : 60}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label={`Código de barras ${codigo}`}>
      <rect width="113" height="70" fill="#fff" />
      {barras.map((b) => (
        <rect key={b.x} x={9 + b.x} y={0} width={b.w} height={comTexto ? (b.guarda ? 64 : 58) : 60} fill="#000" />
      ))}
      {comTexto && (
        <text x="56.5" y="69" textAnchor="middle" fontSize="10" fontFamily="Arial, sans-serif" letterSpacing="1.2" fill="#000">
          {codigo}
        </text>
      )}
    </svg>
  );
}

const RAIO_FORMA: Record<NonNullable<ModeloEtiqueta['forma']>, string> = { retangulo: '0', arredondado: '4mm', redondo: '50%', oval: '50%' };

interface Props {
  modelo: ModeloEtiqueta;
  produto: Product | null;
  loja: StoreInfo;
  logo: string;
  dados: DadosImpressao;
  balanca?: ConfigBalanca;
  edicao?: EdicaoEtiqueta;
  /** solapa: qual face desenhar (cada face é metade da altura) */
  lado?: 'frente' | 'verso';
}

/** Desenha a etiqueta (ou uma face da solapa) no tamanho real (milímetros). Com `edicao`, as peças podem ser arrastadas. */
export function Etiqueta({ modelo, produto, loja, logo, dados, balanca, edicao, lado = 'frente' }: Props) {
  const moldura = MOLDURA[modelo.moldura];
  const colorida = modelo.cor === 'cor';
  const area = areaDe(modelo);
  const raio = RAIO_FORMA[modelo.forma ?? 'retangulo'];
  const fundo = corDe(modelo.fundo, loja) ?? '#fff';
  const pecas = modelo.pecas.filter((p) => p.ativo && (!modelo.solapa || (p.lado ?? 'frente') === lado));
  return (
    <div
      className="etq"
      style={{
        position: 'relative',
        width: `${area.largura}mm`,
        height: `${area.altura}mm`,
        background: colorida ? fundo : '#fff',
        color: '#000',
        overflow: 'hidden',
        borderRadius: raio,
        fontFamily: FAMILIAS[0].css,
        boxSizing: 'border-box',
        filter: colorida ? undefined : 'grayscale(1)',
      }}
    >
      {moldura && <div aria-hidden="true" style={{ position: 'absolute', inset: '0.8mm', boxSizing: 'border-box', pointerEvents: 'none', ...moldura, borderRadius: modelo.forma && modelo.forma !== 'retangulo' ? raio : moldura.borderRadius, ...(colorida ? { borderColor: loja.cores.primaria } : {}), zIndex: 2 }} />}
      {modelo.solapa && <span aria-hidden="true" title="Furo para pendurar" style={{ position: 'absolute', left: `calc(${area.largura / 2}mm - 1.75mm)`, top: '2.5mm', width: '3.5mm', height: '3.5mm', borderRadius: '50%', border: '0.2mm dashed #888', boxSizing: 'border-box', zIndex: 3, pointerEvents: 'none' }} />}
      {edicao && (modelo.margem ?? 0) > 0 && (
        <div aria-hidden="true" className="etq-margem" style={{ position: 'absolute', inset: `${modelo.margem}mm`, boxSizing: 'border-box', pointerEvents: 'none', borderRadius: raio, zIndex: 4 }} />
      )}
      {pecas.map((p) => (
        <Peca key={p.id} p={p} produto={produto} loja={loja} logo={logo} dados={dados} balanca={balanca} edicao={edicao} colorida={colorida} />
      ))}
    </div>
  );
}

/** Para imprimir: a solapa sai aberta (verso de cabeça para baixo em cima, dobra no meio, frente embaixo). */
export function EtiquetaImpressa(props: Omit<Props, 'edicao' | 'lado'>) {
  if (!props.modelo.solapa) return <Etiqueta {...props} />;
  const { largura, altura } = props.modelo;
  return (
    <div style={{ position: 'relative', width: `${largura}mm`, height: `${altura}mm` }}>
      <div style={{ transform: 'rotate(180deg)' }}>
        <Etiqueta {...props} lado="verso" />
      </div>
      <Etiqueta {...props} lado="frente" />
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: `${altura / 2}mm`, borderTop: '0.2mm dashed #999' }} />
    </div>
  );
}

function Selo({ id, cor }: { id: string; cor: string }) {
  const s = SELOS.find((x) => x.id === id);
  if (!s) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25em', whiteSpace: 'nowrap' }}>
      <svg viewBox="0 0 24 24" style={{ width: '2em', height: '2em', flex: '0 0 auto' }} aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="none" stroke={cor} strokeWidth="1.2" />
        <g transform="translate(4.8 4.8) scale(0.6)">
          <path d={s.icone} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
      <span style={{ lineHeight: 1.05 }}>{s.rotulo}</span>
    </span>
  );
}

function Peca({ p, produto, loja, logo, dados, balanca, edicao, colorida }: { p: PecaEtiqueta; produto: Product | null; loja: StoreInfo; logo: string; dados: DadosImpressao; balanca?: ConfigBalanca; edicao?: EdicaoEtiqueta; colorida: boolean }) {
  const rotulo = PECAS.find((x) => x.tipo === p.tipo)?.rotulo ?? p.tipo;
  const corTexto = !colorida ? (p.cor === 'branco' ? '#fff' : '#000') : (p.cor === 'livre' ? corDe(p.corLivre, loja) : corDe(p.cor, loja)) ?? '#000';
  const fundoPeca = corDe(p.fundo, loja);
  const raioPeca = p.raio ? (p.raio >= 999 ? '50%' : `${p.raio}mm`) : undefined;
  let conteudo: ReactNode = null;
  let vazio = false;

  if (p.tipo === 'logo') {
    conteudo = <img src={logo} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: p.raio ? 'cover' : 'contain', borderRadius: raioPeca, filter: colorida ? undefined : 'grayscale(1) contrast(1.25)' }} />;
  } else if (p.tipo === 'imagem') {
    if (p.imagem) conteudo = <img src={p.imagem} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: p.raio ? (p.raio >= 999 ? '50%' : `${p.raio}mm`) : undefined }} />;
    else vazio = true;
  } else if (p.tipo === 'forma') {
    conteudo = null;
  } else if (p.tipo === 'selos') {
    const lista = p.selos ?? [];
    if (lista.length) conteudo = <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4em 0.9em', alignItems: 'center', justifyContent: 'inherit', width: '100%' }}>{lista.map((id) => <Selo key={id} id={id} cor={corTexto} />)}</span>;
    else vazio = true;
  } else if (p.tipo === 'codigo') {
    const cod = produto ? codigoEtiqueta(produto, dados.pesoG, balanca) : ean13('200123400440');
    if (cod) conteudo = <Barras codigo={cod} fonte={p.fonte} />;
    else vazio = true;
  } else if (p.tipo === 'nutricao') {
    const n = produto ? produto.nutricao : { porcao: 5, kcal: 300, carboidratos: 50, acucares: 2, proteinas: 10, gorduras: 5, saturadas: 1, fibras: 20, sodio: 30 };
    if (n) {
      const borda = '0.2mm solid #000';
      conteudo = (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: `${p.fonte}pt`, lineHeight: 1.15, border: borda }}>
          <thead>
            <tr>
              <th colSpan={3} style={{ textAlign: 'left', borderBottom: borda, padding: '0.3mm 0.6mm' }}>
                INFORMAÇÃO NUTRICIONAL
                <div style={{ fontWeight: 400 }}>Porção de {n.porcao.toLocaleString('pt-BR')} g</div>
              </th>
            </tr>
            <tr>
              <th style={{ textAlign: 'left', padding: '0 0.6mm', borderBottom: borda }} />
              <th style={{ textAlign: 'right', padding: '0 0.6mm', borderBottom: borda }}>100 g</th>
              <th style={{ textAlign: 'right', padding: '0 0.6mm', borderBottom: borda }}>{n.porcao.toLocaleString('pt-BR')} g</th>
            </tr>
          </thead>
          <tbody>
            {linhasNutricao(n).map((l) => (
              <tr key={l.nome}>
                <td style={{ padding: '0 0.6mm', borderBottom: '0.1mm solid #000' }}>{l.nome}</td>
                <td style={{ padding: '0 0.6mm', textAlign: 'right', borderBottom: '0.1mm solid #000', whiteSpace: 'nowrap' }}>{l.cem}</td>
                <td style={{ padding: '0 0.6mm', textAlign: 'right', borderBottom: '0.1mm solid #000', whiteSpace: 'nowrap' }}>{l.porcao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else vazio = true;
  } else {
    const t = textoPeca(p, produto, loja, dados);
    if (t) conteudo = <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', textAlign: p.alinhar === 'centro' ? 'center' : p.alinhar === 'dir' ? 'right' : 'left', width: '100%' }}>{t}</span>;
    else vazio = true;
  }

  if (vazio && !edicao) return null;

  const sel = edicao?.selecionada === p.id;
  const estilo: CSSProperties = {
    position: 'absolute',
    left: `${p.x}mm`,
    top: `${p.y}mm`,
    width: `${p.w}mm`,
    height: `${p.h}mm`,
    display: 'flex',
    alignItems: p.tipo === 'nutricao' ? 'flex-start' : 'center',
    justifyContent: JUSTIFICA[p.alinhar],
    fontSize: `${p.fonte}pt`,
    fontWeight: p.negrito ? 700 : 400,
    fontFamily: cssFamilia(p.familia),
    textTransform: p.maiusculas ? 'uppercase' : undefined,
    letterSpacing: p.familia === 'forte' ? '0.04em' : undefined,
    color: corTexto,
    background: p.tipo === 'forma' ? fundoPeca ?? loja.cores.primaria : fundoPeca,
    borderRadius: p.tipo === 'forma' || fundoPeca ? raioPeca : undefined,
    lineHeight: p.familia === 'manuscrita' ? 0.95 : 1.1,
    overflow: 'hidden',
    boxSizing: 'border-box',
  };
  if (!edicao) return <div style={estilo}>{conteudo}</div>;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${rotulo}: arraste para mover; setas do teclado movem 0,5 mm`}
      aria-pressed={sel}
      className={`etq-peca ${sel ? 'sel' : ''}`}
      style={{ ...estilo, overflow: 'visible', cursor: 'move', touchAction: 'none', userSelect: 'none' }}
      onPointerDown={(e) => edicao.onPeca(p.id, e, 'mover')}
      onKeyDown={(e) => edicao.onTecla(p.id, e)}
      onFocus={() => edicao.onFoco(p.id)}
    >
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', alignItems: 'inherit', justifyContent: 'inherit' }}>
        {vazio ? <span className="etq-vazio">{rotulo}</span> : conteudo}
        {p.tipo === 'forma' && <span className="etq-vazio" style={{ opacity: 0.5 }} />}
      </div>
      {sel && <span className="etq-alca" aria-hidden="true" onPointerDown={(e) => { e.stopPropagation(); edicao.onPeca(p.id, e, 'tamanho'); }} />}
    </div>
  );
}
