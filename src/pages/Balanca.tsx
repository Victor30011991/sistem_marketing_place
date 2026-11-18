import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Field, Notice, PageHeader, downloadBlob } from '../ui/ui';
import { atribuirPlus, balancaDe, casa, FORMATOS_ETIQUETA, gerarItensMgv, lerEtiquetaBalanca, precoBalanca, textoBalanca, vaiParaBalanca } from '../core/balanca';
import { formatBRL } from '../core/money';
import type { ConfigBalanca, Product } from '../types';

export default function Balanca() {
  useDocumentTitle('Balança');
  const { state, act } = useApp();
  const { toast } = useFeedback();
  const { lista, config } = state;
  const cfg = balancaDe(config.balanca);
  const setCfg = (patch: Partial<ConfigBalanca>) => act.config((s) => ({ ...s, balanca: { ...balancaDe(s.balanca), ...patch } }));
  const [busca, setBusca] = useState('');
  const [teste, setTeste] = useState('');

  const arquivo = useMemo(() => gerarItensMgv(lista.produtos, cfg), [lista.produtos, cfg]);
  const semCodigo = lista.produtos.filter((p) => vaiParaBalanca(p) && !p.plu).length;
  const naBalanca = lista.produtos.filter((p) => p.plu).sort((a, b) => (a.plu ?? 0) - (b.plu ?? 0));
  const visiveis = naBalanca.filter((p) => casa(p, busca));
  const leitura = teste.replace(/\D/g, '').length >= 13 ? lerEtiquetaBalanca(teste, cfg, lista.produtos) : null;

  function gerarCodigos() {
    const r = atribuirPlus(lista.produtos);
    act.produtos(r.produtos);
    toast(r.novos ? `${r.novos} produto(s) ganharam código de balança. Os códigos antigos não mudam.` : 'Todos os produtos com preço já têm código.');
  }

  function mudarPlu(p: Product, v: string) {
    const n = Number(v.replace(/\D/g, ''));
    if (!n) return;
    if (n > 999999) return toast('O código da balança vai até 999999.', 'erro');
    const dono = lista.produtos.find((x) => x.plu === n && x.id !== p.id);
    if (dono) return toast(`O código ${n} já é de “${dono.nome}”.`, 'erro');
    act.produtos(lista.produtos.map((x) => (x.id === p.id ? { ...x, plu: n } : x)));
  }

  function baixar() {
    if (!arquivo.incluidos) return toast('Nenhum produto pronto para a balança. Gere os códigos primeiro.', 'erro');
    const bytes = new TextEncoder().encode(arquivo.texto); // só ASCII: igual em qualquer codificação
    downloadBlob(new Blob([bytes], { type: 'text/plain' }), 'ITENSMGV.TXT', 'text/plain');
    toast(`ITENSMGV.TXT gerado com ${arquivo.incluidos} produto(s). Importe no UPX Thunder.`);
  }

  return (
    <div className="page">
      <PageHeader
        titulo="Balança"
        subtitulo="Mande seus produtos e preços para a balança etiquetadora (UPX Thunder, Toledo MGV e compatíveis) e leia as etiquetas dela no PDV."
      />

      <div className="two-col">
        <section className="card">
          <h2>1. Códigos da balança</h2>
          <p className="muted small">Cada produto vendido por peso ou unidade precisa de um código fixo (PLU). É o número que você digita na balança.</p>
          {semCodigo > 0 ? (
            <Notice tone="warn">{semCodigo} produto(s) com preço ainda sem código.</Notice>
          ) : (
            <Notice tone="ok">Todos os produtos com preço têm código.</Notice>
          )}
          <div className="row-gap">
            <Button icon="plus" onClick={gerarCodigos} disabled={semCodigo === 0}>
              Gerar códigos que faltam
            </Button>
          </div>
        </section>

        <section className="card">
          <h2>2. Enviar para a balança</h2>
          <div className="form-grid">
            <Field label="Validade na etiqueta (dias)" hint="0 = não imprime validade.">
              {(id) => <input id={id} type="number" min={0} max={999} value={cfg.validadeDias} onChange={(e) => setCfg({ validadeDias: Math.max(0, Math.min(999, Math.round(Number(e.target.value) || 0))) })} />}
            </Field>
            <Field label="Setor da balança" hint="Normalmente 1.">
              {(id) => <input id={id} type="number" min={1} max={99} value={cfg.setor} onChange={(e) => setCfg({ setor: Math.max(1, Math.min(99, Math.round(Number(e.target.value) || 1))) })} />}
            </Field>
          </div>
          <div className="row-gap wrap">
            <Button icon="download" onClick={baixar} disabled={!arquivo.incluidos}>
              Baixar ITENSMGV.TXT ({arquivo.incluidos})
            </Button>
          </div>
          {arquivo.fora.filter((f) => f.motivo !== 'sem preço de venda').length > 0 && (
            <p className="muted small">Fora do arquivo: {arquivo.fora.filter((f) => f.motivo !== 'sem preço de venda').map((f) => `${f.produto.nome} (${f.motivo})`).join(', ')}.</p>
          )}
          <ol className="vit-passos">
            <li>Abra o <strong>UPX Thunder</strong> no computador ligado à balança.</li>
            <li>Use a opção de <strong>importar arquivo de produtos</strong> e escolha o <code>ITENSMGV.TXT</code> (formato Toledo MGV).</li>
            <li>Envie para a balança pelo Wi-Fi. Mudou preço? Baixe e importe de novo.</li>
          </ol>
          <p className="muted small">Os nomes vão em maiúsculas e sem acento, em até duas linhas de 25 letras, porque a balança não imprime acentos.</p>
        </section>
      </div>

      <section className="card">
        <h2>3. Etiqueta da balança no PDV</h2>
        <p className="muted small">Configure no Thunder o código de barras com prefixo 2 e escolha aqui o mesmo formato. Assim, no PDV, é só passar a etiqueta no leitor.</p>
        <div className="form-grid">
          <Field label="Formato do código de barras">
            {(id) => (
              <select id={id} value={cfg.etiqueta} onChange={(e) => setCfg({ etiqueta: e.target.value as ConfigBalanca['etiqueta'] })}>
                {FORMATOS_ETIQUETA.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.rotulo} · {f.exemplo}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Testar uma etiqueta" hint="Passe o leitor aqui ou digite os 13 números.">
            {(id) => <input id={id} inputMode="numeric" value={teste} onChange={(e) => setTeste(e.target.value)} placeholder="2101355009842" />}
          </Field>
        </div>
        {leitura &&
          (leitura.ok ? (
            <Notice tone="ok">
              {leitura.produto.nome} (código {leitura.plu}) · {leitura.valor != null ? `valor ${formatBRL(leitura.valor)}` : `${leitura.gramas} g`}
            </Notice>
          ) : (
            <Notice tone="warn">{leitura.motivo}</Notice>
          ))}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Produtos na balança</h2>
          <input type="search" aria-label="Buscar produto na balança" placeholder="Buscar nome ou código" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 260 }} />
        </div>
        {naBalanca.length === 0 ? (
          <p className="muted">Gere os códigos para ver a lista.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Como sai na balança</th>
                  <th>Tipo</th>
                  <th className="num">Preço</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((p) => (
                  <tr key={p.id}>
                    <td style={{ width: 120 }}>
                      <input aria-label={`Código de balança de ${p.nome}`} inputMode="numeric" defaultValue={p.plu ?? ''} key={p.plu ?? 0} onBlur={(e) => e.target.value !== String(p.plu) && mudarPlu(p, e.target.value)} style={{ maxWidth: 100 }} />
                    </td>
                    <td className="strong mono">{textoBalanca(p.nome)}</td>
                    <td className="muted">{p.unidade === 'kg' || p.unidade === 'g' ? 'por kg' : 'por unidade'}</td>
                    <td className="num">{formatBRL(precoBalanca(p))}{p.unidade === 'kg' || p.unidade === 'g' ? ' / kg' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
