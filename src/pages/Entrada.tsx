import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeedback } from '../ui/feedback';
import { Icon } from '../ui/icons';

type IconName = Parameters<typeof Icon>[0]['name'];
import { lancarManual, lancarNota } from './Lotes';
import { abrirNoImportar } from './Importar';
import { notaDoArquivo, pareceBackup } from '../import/notaArquivo';
import { useRestaurarBackup } from '../ui/useRestaurarBackup';

type Opcao = 'compra' | 'precos' | 'salvo' | 'zero';

const OPCOES: { id: Opcao; icon: IconName; titulo: string; texto: string }[] = [
  { id: 'compra', icon: 'truck', titulo: 'Lançar uma compra', texto: 'Mercadoria que chegou, com ou sem nota. Soma no estoque e calcula o custo real.' },
  { id: 'precos', icon: 'upload', titulo: 'Lista de preços do fornecedor', texto: 'Planilha para cadastrar ou atualizar produtos (Excel, CSV ou TXT).' },
  { id: 'salvo', icon: 'file', titulo: 'Abrir meu arquivo salvo', texto: 'O Excel ou o backup .txt que você salvou do sistema.' },
  { id: 'zero', icon: 'plus', titulo: 'Começar do zero', texto: 'Lista nova, cadastrando os produtos na mão.' },
];

/** Uma porta só para subir qualquer arquivo: pergunta o que é e leva para o lugar certo. */
export default function Entrada({ onNovaLista }: { onNovaLista: () => void }) {
  const nav = useNavigate();
  const { toast } = useFeedback();
  const restaurarTexto = useRestaurarBackup();
  const [opcao, setOpcao] = useState<Opcao | null>(null);
  const [temNota, setTemNota] = useState<boolean | null>(null);
  const [lendo, setLendo] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const aceitos: Record<Exclude<Opcao, 'zero'>, string> = {
    compra: '.pdf,application/pdf,.xml,text/xml,application/xml',
    precos: '.xlsx,.xlsm,.csv,.txt,.tsv',
    salvo: '.xlsx,.xlsm,.txt',
  };

  async function abrirNota(file: File) {
    const r = await notaDoArquivo(file);
    if (!r) return toast('Este arquivo não parece uma nota fiscal. Use o PDF ou o XML da nota.', 'erro');
    if (!r.ok) return toast(r.motivo, 'erro');
    lancarNota(r, file.name.toLowerCase().endsWith('.pdf') ? 'PDF da nota' : 'XML da nota');
    nav('/lotes');
  }

  /** Recebe o arquivo. Sem opção escolhida (arrastou direto), descobre pelo tipo do arquivo. */
  async function receber(file: File | undefined, escolhida: Opcao | null = opcao) {
    if (!file) return;
    setLendo(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const backup = await pareceBackup(file);
      if (backup) {
        if (await restaurarTexto(backup)) nav('/produtos');
        return;
      }
      if (ext === 'pdf' || ext === 'xml' || escolhida === 'compra') return await abrirNota(file);
      abrirNoImportar(file);
      nav('/importar');
    } catch {
      toast('Não foi possível ler o arquivo. Tente de novo.', 'erro');
    } finally {
      setLendo(false);
    }
  }

  function escolher(o: Opcao) {
    setOpcao(o);
    setTemNota(null);
    if (o === 'zero') onNovaLista();
  }

  const pedirArquivo = opcao === 'precos' || opcao === 'salvo' || (opcao === 'compra' && temNota === true);

  return (
    <section
      className={`card entrada ${arrastando ? 'arrastando' : ''}`}
      aria-labelledby="entrada-titulo"
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        receber(e.dataTransfer.files?.[0], opcao);
      }}
    >
      <h2 id="entrada-titulo">O que você quer fazer?</h2>
      <p className="muted small">Escolha uma opção ou arraste o arquivo para cá: nota fiscal (PDF ou XML), planilha ou o seu arquivo salvo.</p>

      <div className="entrada-opcoes" role="radiogroup" aria-label="O que você quer fazer">
        {OPCOES.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={opcao === o.id} className={`lote-opcao ${opcao === o.id ? 'on' : ''}`} onClick={() => escolher(o.id)}>
            <Icon name={o.icon} size={24} />
            <strong>{o.titulo}</strong>
            <span>{o.texto}</span>
          </button>
        ))}
      </div>

      {opcao === 'compra' && (
        <div className="entrada-passo">
          <h3>Você tem a nota fiscal desta compra?</h3>
          <div className="row-gap wrap">
            <button type="button" className={`btn ${temNota === true ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={temNota === true} onClick={() => setTemNota(true)}>
              Sim, tenho a nota (PDF ou XML)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                lancarManual();
                nav('/lotes');
              }}
            >
              Não, vou digitar os itens
            </button>
          </div>
          <p className="muted small">Depois eu pergunto o frete, se você pagou alguma guia de imposto por fora, os juros e como quer o preço de venda.</p>
        </div>
      )}

      {pedirArquivo && (
        <div className="entrada-passo">
          <button type="button" className="entrada-soltar" onClick={() => fileRef.current?.click()} disabled={lendo}>
            <Icon name="upload" size={28} />
            <strong>{lendo ? 'Lendo o arquivo…' : opcao === 'compra' ? 'Escolher o PDF ou o XML da nota' : opcao === 'salvo' ? 'Escolher o Excel ou o backup .txt' : 'Escolher a planilha'}</strong>
            <span>ou arraste o arquivo para cá</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept={opcao === 'compra' || opcao === 'precos' || opcao === 'salvo' ? aceitos[opcao] : undefined}
            onChange={(e) => {
              receber(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {opcao === 'compra' && <p className="muted small">PDF de foto ou escaneado não tem texto para ler: nesse caso use o XML ou digite os itens.</p>}
        </div>
      )}
    </section>
  );
}
