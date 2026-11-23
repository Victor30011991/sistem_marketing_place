import { useEffect, useId, useRef, useState } from 'react';
import { ALTURA_LINHA_LETRA, GRUPOS_LETRA, LETRAS, cssLetra, indiceLetra, letraDe } from '../core/letras';
import { carregarLetras } from '../ui/letras';

/** Letra enviada pela loja (Posta Aí), mostrada pelo próprio nome. */
export interface LetraExtra {
  id: string;
  nome: string;
  css: string;
}

interface Props {
  id?: string;
  valor: string | undefined;
  onChange: (id: string) => void;
  extras?: LetraExtra[];
  /** id usado quando não há valor */
  padrao?: string;
}

const IMG = `${import.meta.env.BASE_URL}letras.webp`;

/** Nome da letra desenhado pela imagem da lista (sem baixar a letra). */
function NomeNaImagem({ id }: { id: string }) {
  const i = indiceLetra(id);
  return <span className="letra-img" aria-hidden="true" style={{ backgroundImage: `url(${IMG})`, backgroundPosition: `0 ${-i * ALTURA_LINHA_LETRA}px` }} />;
}

/**
 * Escolha de letra com o nome de cada uma escrito nela, em três grupos. A lista usa uma imagem pequena;
 * só a letra escolhida é baixada.
 */
export function SeletorLetra({ id, valor, onChange, extras = [], padrao = 'simples' }: Props) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const lista = useId();
  const atual = letraDe(valor ?? padrao);
  const extra = extras.find((x) => x.id === valor);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false);
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    caixa.current?.querySelector<HTMLButtonElement>('.letra-op.on')?.scrollIntoView({ block: 'nearest' });
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  function escolher(novo: string) {
    void carregarLetras([novo]);
    onChange(novo);
    setAberto(false);
  }

  return (
    <div className="letra-sel" ref={caixa}>
      <button id={id} type="button" className="letra-atual" aria-haspopup="listbox" aria-expanded={aberto} aria-controls={lista} onClick={() => setAberto((v) => !v)}>
        {extra ? <span style={{ fontFamily: extra.css }}>{extra.nome}</span> : atual ? <span style={{ fontFamily: cssLetra(atual), fontWeight: atual.peso }}>{atual.nome}</span> : 'Escolher letra'}
        <span aria-hidden="true" className="letra-seta">▾</span>
      </button>
      {aberto && (
        <div className="letra-lista" id={lista} role="listbox" aria-label="Letras">
          {extras.length > 0 && (
            <div role="group" aria-label="Suas letras">
              <p className="letra-grupo">Suas letras</p>
              {extras.map((x) => (
                <button key={x.id} type="button" role="option" aria-selected={valor === x.id} className={`letra-op ${valor === x.id ? 'on' : ''}`} onClick={() => escolher(x.id)}>
                  <span style={{ fontFamily: x.css, fontSize: 20 }}>{x.nome}</span>
                </button>
              ))}
            </div>
          )}
          {GRUPOS_LETRA.map((g) => (
            <div key={g.id} role="group" aria-label={g.rotulo}>
              <p className="letra-grupo">{g.rotulo}</p>
              {LETRAS.filter((x) => x.grupo === g.id).map((x) => {
                const on = atual?.id === x.id && !extra;
                return (
                  <button key={x.id} type="button" role="option" aria-selected={on} aria-label={x.nome} className={`letra-op ${on ? 'on' : ''}`} onClick={() => escolher(x.id)}>
                    <NomeNaImagem id={x.id} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
