import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { useDocumentTitle, useFeedback } from '../ui/feedback';
import { Button, Field, Notice, PageHeader, downloadBlob } from '../ui/ui';
import { atribuirPlus, balancaDe, casa, CODIGO_MAX, codigo4, faixaCategoria, FORMATOS_ETIQUETA, gerarItensMgv, lerEtiquetaBalanca, LETRAS_BALANCA, listaBalanca, nomeCortado, precoBalanca, renumerar, tabelaBalanca, textoBalanca, vaiParaBalanca } from '../core/balanca';
import { formatBRL } from '../core/money';
import { gerarCargaCompleta, montarZip } from '../core/balancaCompleta';
import { aplicarRotulos, casarRotulos, lerRotulosCsv, type CasamentoRotulos } from '../core/importRotulos';
import type { ConfigBalanca, Product } from '../types';

export default function Balanca() {
  useDocumentTitle('Balança');
  const { state, act } = useApp();
  const { toast, confirm } = useFeedback();
  const { lista, config } = state;
  const cfg = balancaDe(config.balanca);
  const wind = cfg.modelo === 'wind';
  const setCfg = (patch: Partial<ConfigBalanca>) => act.config((s) => ({ ...s, balanca: { ...balancaDe(s.balanca), ...patch } }));
  const [busca, setBusca] = useState('');
  const [teste, setTeste] = useState('');
  const [rotulos, setRotulos] = useState<CasamentoRotulos | null>(null);

  const arquivo = useMemo(() => gerarItensMgv(lista.produtos, cfg), [lista.produtos, cfg]);
  const carga = useMemo(() => gerarCargaCompleta(lista.produtos, cfg, state.loja), [lista.produtos, cfg, state.loja]);
  const semCodigo = lista.produtos.filter((p) => vaiParaBalanca(p) && !p.plu).length;
  const comPreco = lista.produtos.filter(vaiParaBalanca).length;
  const naBalanca = lista.produtos.filter((p) => p.plu).sort((a, b) => (a.plu ?? 0) - (b.plu ?? 0));
  const visiveis = naBalanca.filter((p) => casa(p, busca));
  const tabela = useMemo(() => tabelaBalanca(lista.produtos, lista.categorias), [lista.produtos, lista.categorias]);
  const hoje = new Date().toLocaleDateString('pt-BR');
  const leitura = teste.replace(/\D/g, '').length >= 13 ? lerEtiquetaBalanca(teste, cfg, lista.produtos) : null;

  function gerarCodigos() {
    const r = atribuirPlus(lista.produtos, lista.categorias, cfg.numeracao);
    act.produtos(r.produtos);
    toast(r.novos ? `${r.novos} produto(s) ganharam código. Os códigos antigos não mudam.` : 'Todos os produtos com preço já têm código.');
  }

  async function refazerCodigos() {
    const ok = await confirm({
      titulo: 'Renumerar todos os códigos?',
      mensagem:
        cfg.numeracao === 'sequencial'
          ? 'Os produtos ficam 0001, 0002, 0003… em ordem alfabética. Os códigos já cadastrados na balança deixam de bater: mande a lista nova para ela.'
          : 'Cada produto ganha um número novo, pela categoria e em ordem alfabética. Os códigos já cadastrados na balança deixam de bater: mande a lista nova para ela.',
      confirmar: 'Renumerar códigos',
      perigo: true,
    });
    if (!ok) return;
    act.produtos(renumerar(lista.produtos, lista.categorias, cfg.numeracao));
    toast('Códigos renumerados. Mande a lista nova para a balança.');
  }

  function imprimirTabela() {
    if (!tabela.length) return toast('Gere os códigos primeiro.', 'erro');
    document.body.classList.add('imprime-tabela');
    const fim = () => {
      document.body.classList.remove('imprime-tabela');
      window.removeEventListener('afterprint', fim);
    };
    window.addEventListener('afterprint', fim);
    window.print();
    setTimeout(fim, 1000);
  }

  function mudarPlu(p: Product, v: string) {
    const n = Number(v.replace(/\D/g, ''));
    if (!n) return;
    if (n > CODIGO_MAX) return toast(`O código da balança vai de 1 a ${CODIGO_MAX}.`, 'erro');
    const dono = lista.produtos.find((x) => x.plu === n && x.id !== p.id);
    if (dono) return toast(`O código ${n} já é de “${dono.nome}”.`, 'erro');
    act.produtos(lista.produtos.map((x) => (x.id === p.id ? { ...x, plu: n } : x)));
  }

  function baixarCarga() {
    if (!carga.produtos) return toast('Gere os códigos primeiro.', 'erro');
    downloadBlob(new Blob([montarZip(carga.arquivos)], { type: 'application/zip' }), 'carga-balanca.zip', 'application/zip');
    toast(`carga-balanca.zip com ${carga.arquivos.length} arquivo(s): ${carga.arquivos.map((a) => a.nome).join(', ')}.`);
  }

  async function baixarPlanilha() {
    const linhas = listaBalanca(lista.produtos);
    if (!linhas.length) return toast('Gere os códigos primeiro.', 'erro');
    const { planilhaBalanca } = await import('../export/listaBalanca');
    downloadBlob(new Blob([await planilhaBalanca(linhas)]), 'produtos-balanca.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    toast(`Planilha com ${linhas.length} produto(s), de ${linhas[0].codigo} a ${linhas[linhas.length - 1].codigo}.`);
  }

  async function baixarCsv() {
    const linhas = listaBalanca(lista.produtos);
    if (!linhas.length) return toast('Gere os códigos primeiro.', 'erro');
    const { csvBalanca } = await import('../export/listaBalanca');
    downloadBlob(new Blob(['\ufeff' + csvBalanca(linhas)], { type: 'text/csv' }), 'produtos-balanca.csv', 'text/csv');
  }

  async function lerRotulos(f: File | undefined) {
    if (!f) return;
    const linhas = lerRotulosCsv(await f.text());
    if (!linhas.length) return toast('Não achei a coluna "Produto" nessa planilha. Salve como CSV (separado por ponto e vírgula).', 'erro');
    setRotulos(casarRotulos(linhas, lista.produtos));
  }

  function aplicarImportacao() {
    if (!rotulos?.pares.length) return;
    act.produtos(aplicarRotulos(lista.produtos, rotulos.pares));
    toast(`Informações de rótulo aplicadas em ${rotulos.pares.length} produto(s).`);
    setRotulos(null);
  }

  function mudarNomeCurto(p: Product, v: string) {
    const t = v.trim().slice(0, LETRAS_BALANCA);
    act.produtos(lista.produtos.map((x) => (x.id === p.id ? { ...x, nomeBalanca: t && t !== x.nome ? t : undefined } : x)));
  }
  const cortados = naBalanca.filter(nomeCortado).length;

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
        subtitulo="Código e preço de cada produto para a balança, a tabela para deixar ao lado dela e a leitura das etiquetas no PDV."
      />

      <section className="card">
        <h2>Sua balança</h2>
        <div className="form-grid">
          <Field label="Modelo" hint={wind ? 'Você digita o preço do kg e usa a tabela impressa.' : 'Os produtos são cadastrados no programa do computador e transmitidos para a balança.'}>
            {(id) => (
              <select id={id} value={cfg.modelo} onChange={(e) => setCfg({ modelo: e.target.value as ConfigBalanca['modelo'] })}>
                <option value="thunder">Com software da balança (UPX Wind Mega, Thunder, Toledo MGV)</option>
                <option value="wind">Sem software (digita o preço e usa a tabela)</option>
              </select>
            )}
          </Field>
          <Field label="Numeração dos códigos">
            {(id) => (
              <select id={id} value={cfg.numeracao} onChange={(e) => setCfg({ numeracao: e.target.value as ConfigBalanca['numeracao'] })}>
                <option value="sequencial">Sequencial: 0001, 0002… em ordem alfabética</option>
                <option value="categoria">Por categoria: 101–199, 201–299…</option>
              </select>
            )}
          </Field>
        </div>
      </section>

      <div className="two-col">
        <section className="card">
          <h2>1. Códigos dos produtos</h2>
          <p className="muted small">
            Cada produto vendido por peso ou unidade ganha um número de 0001 a {CODIGO_MAX}.{' '}
            {cfg.numeracao === 'sequencial' ? 'Em ordem alfabética: 0001, 0002, 0003…' : 'Pela categoria: a 1ª usa 101 a 199, a 2ª 201 a 299, e assim por diante.'} Produtos novos ganham o próximo número livre, sem mudar os antigos.
          </p>
          {lista.produtos.length === 0 ? (
            <Notice tone="warn">Nenhum produto neste aparelho. Entre na nuvem pelo Menu (com o e-mail da loja) para carregar os produtos, e volte aqui.</Notice>
          ) : comPreco === 0 ? (
            <Notice tone="warn">Nenhum dos {lista.produtos.length} produtos tem preço de venda. Defina os preços em Produtos ou Precificação.</Notice>
          ) : semCodigo > 0 ? (
            <Notice tone="warn">{semCodigo} produto(s) com preço ainda sem código.</Notice>
          ) : (
            <Notice tone="ok">Todos os {comPreco} produtos com preço têm código.</Notice>
          )}
          <div className="row-gap wrap">
            <Button icon="plus" onClick={gerarCodigos} disabled={semCodigo === 0}>
              Gerar códigos que faltam
            </Button>
            <Button variant="secondary" onClick={refazerCodigos} disabled={naBalanca.length === 0}>
              Renumerar todos
            </Button>
          </div>
          {cfg.numeracao === 'categoria' && lista.categorias.length > 0 && (
            <details className="small">
              <summary>Faixa de cada categoria</summary>
              <ul className="faixas-bal">
                {lista.categorias.slice(0, 98).map((c) => {
                  const [de, ate] = faixaCategoria(c, lista.categorias);
                  return <li key={c}><span className="mono">{de}–{ate}</span> {c}</li>;
                })}
                <li><span className="mono">9901–9999</span> Sem categoria</li>
              </ul>
            </details>
          )}
        </section>

        {wind ? (
          <section className="card">
            <h2>2. Tabela ao lado da balança</h2>
            <p className="muted small">Uma folha A4 com código, nome e preço do kg de cada produto, separada por categoria. Plastifique e deixe ao lado da balança. Mudou preço no sistema? Imprima de novo.</p>
            <div className="row-gap wrap">
              <Button icon="file" onClick={imprimirTabela} disabled={!tabela.length}>
                Imprimir tabela ({naBalanca.length})
              </Button>
            </div>
            <h3 className="small">Na Wind D3</h3>
            <ol className="vit-passos">
              <li>Coloque o produto, ache o código na tabela e <strong>digite o preço do kg</strong>. A balança calcula o total.</li>
              <li>Vai embalar vários pacotes do mesmo produto? Digite o preço e aperte <strong>C</strong>: o preço fica fixo até apertar C de novo.</li>
              <li>Para o código sair na etiqueta, ative o código do produto na configuração (com a balança em zero, <strong>IMPRIME</strong>, senha, <strong>IMPRIME</strong>). Depois, a tecla <strong>D</strong> pede o código antes de pesar.</li>
            </ol>
          </section>
        ) : (
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
          <ul className="carga-resumo small">
            <li><strong>{carga.produtos}</strong> produto(s) com código e preço</li>
            <li><strong>{carga.comNutricao}</strong> com tabela nutricional</li>
            <li><strong>{carga.comInfo}</strong> com ingredientes, alérgenos ou glúten</li>
            <li>{carga.fracionador ? 'Fracionado e embalado por: dados da loja' : 'Sem dados da loja (preencha em Minha loja)'}</li>
          </ul>
          <div className="row-gap wrap">
            <Button icon="download" onClick={baixarCarga} disabled={!carga.produtos}>
              Baixar carga completa (.zip)
            </Button>
            <Button variant="secondary" icon="sheet" onClick={baixarPlanilha} disabled={!naBalanca.length}>
              Planilha
            </Button>
            <Button variant="ghost" onClick={baixar} disabled={!arquivo.incluidos}>
              Só ITENSMGV.TXT
            </Button>
            <Button variant="ghost" onClick={baixarCsv} disabled={!naBalanca.length}>
              CSV
            </Button>
          </div>
          {cortados > 0 && (
            <Notice tone="warn">
              {cortados} nome(s) passam de {LETRAS_BALANCA} letras e sairiam cortados na etiqueta. Escreva um nome curto na lista abaixo.
            </Notice>
          )}
          {carga.infoLonga.length > 0 && (
            <Notice tone="warn">A Wind Mega imprime até 7 linhas de informação. Texto longo em: {carga.infoLonga.join(', ')}.</Notice>
          )}
          <p className="muted small">A carga traz produtos (ITENSMGV), tabela nutricional (INFNUTRI), ingredientes, alérgenos e conservação (TXINFO), glúten (CAMPEXT1) e quem fracionou (FRACIONA), no mesmo formato dos exemplos da Wind Mega. A planilha serve para conferir.</p>
          {arquivo.fora.filter((f) => f.motivo !== 'sem preço de venda').length > 0 && (
            <p className="muted small">Fora do arquivo: {arquivo.fora.filter((f) => f.motivo !== 'sem preço de venda').map((f) => `${f.produto.nome} (${f.motivo})`).join(', ')}.</p>
          )}
          <ol className="vit-passos">
            <li>Abra o programa da balança (<strong>UPX Wind Mega – Software Gerenciador</strong> ou Thunder).</li>
            <li>Extraia o <code>carga-balanca.zip</code> na pasta de importação escolhida em <strong>Configurar</strong> (substitua os arquivos antigos).</li>
            <li>Em <strong>Importação › Importar</strong>, o programa lê o arquivo e mostra um resumo. Confira os produtos na lista.</li>
            <li>Em <strong>Transmitir</strong>, envie. Na balança, aperte <strong>TARA</strong> e <strong>IMPRIME</strong> juntas: aparece “PC” e, no fim, “Fin”. Mudou preço? Baixe de novo, importe e transmita.</li>
          </ol>
          <p className="muted small">Os nomes vão em maiúsculas e sem acento, com até 25 letras: a balança não imprime acentos nem nomes maiores.</p>
        </section>
        )}
      </div>

      {!wind && (
        <section className="card">
          <h2>Informações dos rótulos</h2>
          <p className="muted small">
            Traga de uma planilha (CSV) a tabela nutricional por 100 g, ingredientes, alérgicos e glúten de cada produto. A coluna “Produto” liga pelo nome. Campos vazios não apagam o que já está cadastrado.
          </p>
          <div className="row-gap wrap">
            <label className="btn btn-secondary">
              Escolher planilha (.csv)
              <input type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => { void lerRotulos(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
          {rotulos && (
            <>
              <Notice tone={rotulos.pares.length ? 'ok' : 'warn'}>
                {rotulos.pares.length} produto(s) encontrados: {rotulos.pares.filter((x) => x.linha.nutricao).length} com tabela nutricional.
                {rotulos.semProduto.length > 0 && ` Sem produto com esse nome: ${rotulos.semProduto.map((l) => l.nome).join(', ')}.`}
              </Notice>
              <div className="row-gap wrap">
                <Button icon="check" onClick={aplicarImportacao} disabled={!rotulos.pares.length}>
                  Aplicar em {rotulos.pares.length} produto(s)
                </Button>
                <Button variant="ghost" onClick={() => setRotulos(null)}>
                  Cancelar
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      {!wind && (
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
      )}

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
                  <th>Produto</th>
                  {!wind && <th>Nome na balança ({LETRAS_BALANCA} letras)</th>}
                  <th>Tipo</th>
                  <th className="num">Preço</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((p) => (
                  <tr key={p.id}>
                    <td style={{ width: 120 }} title={p.plu ? codigo4(p.plu) : ''}>
                      <input aria-label={`Código de balança de ${p.nome}`} inputMode="numeric" maxLength={4} defaultValue={p.plu ? codigo4(p.plu) : ''} key={p.plu ?? 0} onBlur={(e) => Number(e.target.value.replace(/\D/g, '')) !== p.plu && mudarPlu(p, e.target.value)} style={{ maxWidth: 100 }} />
                    </td>
                    <td className="strong">{p.nome}</td>
                    {!wind && (
                      <td>
                        <input
                          aria-label={`Nome na balança de ${p.nome}`}
                          maxLength={LETRAS_BALANCA}
                          defaultValue={p.nomeBalanca ?? (p.nome.length <= LETRAS_BALANCA ? p.nome : '')}
                          key={p.nomeBalanca ?? ''}
                          placeholder={nomeCortado(p) ? 'Nome curto (obrigatório)' : p.nome}
                          aria-invalid={nomeCortado(p) || undefined}
                          className={nomeCortado(p) ? 'campo-alerta' : undefined}
                          onBlur={(e) => e.target.value.trim() !== (p.nomeBalanca ?? (p.nome.length <= LETRAS_BALANCA ? p.nome : '')) && mudarNomeCurto(p, e.target.value)}
                        />
                        <span className="muted small mono"> {textoBalanca(p.nomeBalanca || p.nome).slice(0, LETRAS_BALANCA)}</span>
                      </td>
                    )}
                    <td className="muted">{p.unidade === 'kg' || p.unidade === 'g' ? 'por kg' : 'por unidade'}</td>
                    <td className="num">{formatBRL(precoBalanca(p))}{p.unidade === 'kg' || p.unidade === 'g' ? ' / kg' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="tabela-bal" aria-hidden="true">
        <header>
          <strong>{state.loja.nomeFantasia || 'Tabela da balança'}</strong>
          <span>Preços do kg · {hoje}</span>
        </header>
        <div className="tabela-bal-cols">
          {tabela.map((g) => (
            <section key={g.categoria}>
              <h4>{g.categoria}</h4>
              {g.itens.map((i) => (
                <div className="tb-linha" key={i.codigo}>
                  <b>{codigo4(i.codigo)}</b>
                  <span>{i.nome}</span>
                  <em>{formatBRL(i.preco)}{i.porKg ? '' : ' un'}</em>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
