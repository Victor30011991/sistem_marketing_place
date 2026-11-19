import { useState } from 'react';

export interface Barra {
  rotulo: string;
  /** rótulo curto do eixo (vazio = não mostra) */
  eixo: string;
  valor: number;
  /** texto do balão ao passar o mouse/tocar */
  dica: string;
}

/** Gráfico de barras de uma série só (sem legenda: o título diz o que é). Barras finas, cantos de 4px no topo, balão ao tocar. */
export function Barras({ dados, titulo, formatar }: { dados: Barra[]; titulo: string; formatar: (n: number) => string }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const max = Math.max(...dados.map((d) => d.valor), 1);
  const W = 640;
  const H = 180;
  const topo = 14;
  const base = H - 22;
  const passo = W / dados.length;
  const larg = Math.max(2, Math.min(28, passo - 2));
  const r = Math.min(4, larg / 2);
  const melhor = dados.reduce((m, d, i) => (d.valor > dados[m].valor ? i : m), 0);
  const marcas = [0, 0.5, 1].map((f) => ({ y: base - f * (base - topo), v: max * f }));

  return (
    <figure className="barras">
      <figcaption>{titulo}</figcaption>
      <div className="barras-area">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${titulo}. Maior valor: ${dados[melhor]?.dica ?? ''}`} onMouseLeave={() => setAtivo(null)}>
          {marcas.map((m) => (
            <line key={m.y} x1="0" x2={W} y1={m.y} y2={m.y} className="barras-grade" />
          ))}
          {dados.map((d, i) => {
            const h = d.valor > 0 ? Math.max(2, (d.valor / max) * (base - topo)) : 0;
            const x = i * passo + (passo - larg) / 2;
            const y = base - h;
            const rr = Math.min(r, h);
            return (
              <g key={i}>
                {h > 0 && (
                  <path
                    className={`barras-barra ${ativo === i ? 'on' : ''}`}
                    d={`M${x},${base} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + larg - rr} Q${x + larg},${y} ${x + larg},${y + rr} V${base} Z`}
                  />
                )}
                <rect x={i * passo} y={0} width={passo} height={H} fill="transparent" onMouseEnter={() => setAtivo(i)} onClick={() => setAtivo(i)}>
                  <title>{d.dica}</title>
                </rect>
              </g>
            );
          })}
          <line x1="0" x2={W} y1={base} y2={base} className="barras-base" />
        </svg>
        <div className="barras-eixo" aria-hidden="true">
          {dados.map((d, i) => (
            <span key={i} style={{ left: `${((i + 0.5) / dados.length) * 100}%` }}>
              {d.eixo}
            </span>
          ))}
        </div>
        <div className="barras-escala" aria-hidden="true">
          <span>{formatar(max)}</span>
        </div>
        {ativo != null && (
          <div className="barras-dica" style={{ left: `${Math.min(Math.max(((ativo + 0.5) / dados.length) * 100, 12), 88)}%` }} role="status">
            {dados[ativo].dica}
          </div>
        )}
      </div>
    </figure>
  );
}
