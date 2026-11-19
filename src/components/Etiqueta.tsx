import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import type { ConfigBalanca, ModeloEtiqueta, PecaEtiqueta, Product, StoreInfo } from '../types';
import { PECAS, codigoEtiqueta, linhasNutricao, textoPeca, type DadosImpressao } from '../core/etiquetas';
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

/** Desenha a etiqueta no tamanho real (milímetros). Com `edicao`, as peças podem ser arrastadas. */
export function Etiqueta({
  modelo,
  produto,
  loja,
  logo,
  dados,
  balanca,
  edicao,
}: {
  modelo: ModeloEtiqueta;
  produto: Product | null;
  loja: StoreInfo;
  logo: string;
  dados: DadosImpressao;
  balanca?: ConfigBalanca;
  edicao?: EdicaoEtiqueta;
}) {
  const moldura = MOLDURA[modelo.moldura];
  const colorida = modelo.cor === 'cor';
  return (
    <div
      className="etq"
      style={{
        position: 'relative',
        width: `${modelo.largura}mm`,
        height: `${modelo.altura}mm`,
        background: '#fff',
        color: '#000',
        overflow: 'hidden',
        fontFamily: '"DM Sans Variable", "DM Sans", Arial, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      {moldura && <div aria-hidden="true" style={{ position: 'absolute', inset: '0.8mm', boxSizing: 'border-box', pointerEvents: 'none', ...moldura, ...(colorida ? { borderColor: loja.cores.primaria } : {}) }} />}
      {edicao && (modelo.margem ?? 0) > 0 && (
        <div aria-hidden="true" className="etq-margem" style={{ position: 'absolute', inset: `${modelo.margem}mm`, boxSizing: 'border-box', pointerEvents: 'none' }} />
      )}
      {modelo.pecas
        .filter((p) => p.ativo)
        .map((p) => (
          <Peca key={p.id} p={p} produto={produto} loja={loja} logo={logo} dados={dados} balanca={balanca} edicao={edicao} colorida={colorida} />
        ))}
    </div>
  );
}

function Peca({ p, produto, loja, logo, dados, balanca, edicao, colorida }: { p: PecaEtiqueta; produto: Product | null; loja: StoreInfo; logo: string; dados: DadosImpressao; balanca?: ConfigBalanca; edicao?: EdicaoEtiqueta; colorida: boolean }) {
  const rotulo = PECAS.find((x) => x.tipo === p.tipo)!.rotulo;
  let conteudo: ReactNode = null;
  let vazio = false;

  if (p.tipo === 'logo') {
    conteudo = <img src={logo} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: colorida ? undefined : 'grayscale(1) contrast(1.25)' }} />;
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
    color: colorida && p.cor === 'primaria' ? loja.cores.primaria : colorida && p.cor === 'destaque' ? loja.cores.destaque : '#000',
    lineHeight: 1.1,
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
      </div>
      {sel && <span className="etq-alca" aria-hidden="true" onPointerDown={(e) => { e.stopPropagation(); edicao.onPeca(p.id, e, 'tamanho'); }} />}
    </div>
  );
}
