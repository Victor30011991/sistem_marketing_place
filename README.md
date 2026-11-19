# Sistema da loja · Temperei

Preços com margem certa, estoque, vendas no balcão (PDV), pedidos do cardápio, orçamentos, clientes, fiado, caixa e relatórios. Roda no navegador do computador ou do celular, publicado no **GitHub Pages**. Os dados ficam na **nuvem (Firebase)** para Victor e Samara usarem juntos.

- Sistema: https://victor30011991.github.io/sistem_marketing_place/
- Cardápio do cliente: https://victor30011991.github.io/sistem_marketing_place/cardapio/

---

## Manual de uso

### Começando

1. Abra o sistema e clique em **Entrar na nuvem** (no menu), com o Gmail da loja. Só os dois e-mails cadastrados entram.
2. Embaixo do menu aparece **"Salvo na nuvem"**. Tudo o que um faz, o outro vê em segundos.
3. No celular, instale como aplicativo:
   - **Android (Chrome):** menu ⋮ → **Instalar app**.
   - **iPhone:** **Compartilhar** → **Adicionar à Tela de Início**.
4. **Sem internet** o sistema continua funcionando e envia tudo quando a conexão voltar.

### Dia a dia no balcão

| Quero… | Onde |
|---|---|
| Abrir o caixa com o troco | **Vendas (PDV)** → Abrir caixa |
| Vender | **PDV**: busque o produto ou passe o código da balança, escolha a quantidade, receba e finalize. Dá para dividir o pagamento (ex.: Pix + dinheiro). O troco é calculado. |
| Vender fiado | **PDV** → forma **Fiado** (precisa do nome do cliente) |
| Pausar uma venda para atender outro | **PDV** → Pausar venda / Retomar |
| Tirar dinheiro da gaveta | **PDV** → Sangria (com motivo) |
| Fechar o caixa | **PDV** → Fechar caixa → conte o dinheiro → o sistema diz se **sobrou ou faltou** → Copiar resumo |

### Pedidos do cardápio

1. O cliente monta o pedido no cardápio e finaliza: abre o WhatsApp da loja **e** o pedido cai em **Pedidos**, com um bip.
2. **Começar a separar** → **Marcar como pronto** → **Avisar que está pronto** (WhatsApp do cliente).
3. **Levar para o PDV**: o pedido entra em "Vendas pausadas". Retome, receba e finalize.

### Orçamentos

1. **Orçamento**: escolha o cliente (ou digite), os itens, o desconto e a validade.
2. Mande do jeito que o cliente preferir:
   - **Enviar imagem**: no celular, abre a lista para escolher o WhatsApp.
   - **Enviar texto no WhatsApp**: vai em bloco de código, com os preços alinhados.
   - **PDF A4**, **E-mail** ou **Imprimir cupom** (58/80 mm).
3. Com a **chave Pix** configurada (Orçamento → Configurar), o orçamento leva o QR e o Pix copia e cola **já com o valor**.
4. Na lista de orçamentos salvos, o botão do carrinho (**Virar venda**) leva o orçamento para o PDV.

### Clientes e fiado

- **Clientes**: histórico de compras, total gasto, o que mais compra. O filtro **Sumidos** mostra quem não compra há 60 dias, com o botão **Mandar mensagem de saudade**.
- **Contas e fiado → A receber**: quem deve, quanto e desde quando.
  - **Receber** aceita parte do valor e abate das contas mais antigas.
  - **Lembrar no WhatsApp** manda a mensagem com o Pix.
- **Contas e fiado → A pagar**: aluguel, luz, fornecedores. Com **Repetir todo mês**, ao pagar uma conta a do mês seguinte já fica lançada. O menu mostra quantas estão vencidas.

### Compras e estoque

- **Lotes de compra**: jogue o PDF ou o XML da nota fiscal. O sistema lê os itens e divide o frete, juros e impostos. Mostra o **custo real por kg** e sugere o preço (ex.: custo × 2 arredondado).
  - Cada item pode ter **validade**: o sistema avisa 30 dias antes de vencer.
  - Ao aplicar, o estoque soma e o custo é atualizado.
- **Lista de compras**: monte o pedido e mande ao fornecedor em PDF para cotação.
- **Etiquetas**: escolha o tamanho do rolo, ligue as peças (logo, nome, preço, código de barras, validade, tabela nutricional…) e arraste cada uma para o lugar. O código de barras é lido pelo PDV.
- **Balança** (UPX/Toledo): gere o arquivo `ITENSMGV.TXT` e importe no Thunder. Gere de novo sempre que mudar preço ou promoção.

### Cardápio e divulgação

- **Página da loja**: botões do cartão (WhatsApp, Instagram, mapa…), produtos ocultos, gramas mínimas e destaques.
- O cardápio **se atualiza sozinho** quando vocês estão na nuvem. Só vão para ele nome, categoria, preço e foto; **custos nunca**.
- **Promoção** fica em Produtos → editar → "Cardápio e promoção": preço, até quando e selo. Ela vale no cardápio, no PDV e no orçamento.
- **Foto** fica no mesmo lugar ("Pôr foto"). A imagem é reduzida para ficar leve.
- **Lista de preços em imagem** (Página da loja): para o status do WhatsApp e o Instagram.

### Números

- **Relatórios** (escolha o período; tudo vem comparado com o período anterior):
  - **Painel**: faturamento, vendas, ticket médio, gráficos por dia, por dia da semana e por horário.
  - **Vendas**: o que mais vende e mais dá lucro, formas de pagamento e quem vendeu.
  - **Resultado**: vendas − custos − taxas − despesas fixas − pró-labore, e o **ponto de equilíbrio** (quanto falta vender no mês).
  - **Estoque**: dinheiro parado, o que está acabando (com botão para a lista de compras), o que está parado e a validade.
  - **Compras**: gasto por fornecedor, custo que subiu e produtos abaixo do preço sugerido.
  - **Alterações**: quem mudou preço, custo, estoque, produtos.
- **Precificação**: custos fixos e variáveis, taxas das maquininhas, margem. É daqui que sai o preço sugerido.

### Segurança dos dados

- **Na nuvem:** tudo é salvo sozinho, e toda semana o sistema guarda uma **cópia automática** (ficam as 8 mais novas). Para voltar: **Salvar em Excel → Cópias automáticas → Voltar para esta**.
- **Cópia no aparelho:** **Backup (.txt)** ou **Salvar em Excel**, de vez em quando.
- **Nunca suba o Excel ou o backup para o GitHub.** O repositório é público e esses arquivos têm os seus custos.

---

## Para quem mexe no código

### Como está montado

- **Site:** React + Vite + TypeScript, rotas por `#`, `base: './'`. Publicado pelo GitHub Actions (`.github/workflows`), que roda `npm ci`, `npm test`, `npm run build` e publica no Pages.
- **Nuvem:** Firebase (só **Firestore** e **login Google**; o site **não** usa a hospedagem do Firebase). A configuração do app fica em `src/nuvem/servico.ts`. Ela é pública por natureza: quem protege os dados são as **regras** em `firestore.rules`.
- **Regras do Firestore:** sempre que `firestore.rules` mudar, cole o conteúdo em **Firebase → Firestore Database → Regras → Publicar**.

```
lojas/temperei                  lista, categorias, ordem e configurações
lojas/temperei/meta/loja        dados da loja
lojas/temperei/produtos/{id}    um por produto (estoque gravado por incremento)
lojas/temperei/vendasDia/{dia}  vendas do dia, num mapa por id
lojas/temperei/{lotes|orcamentos|clientes|caixas|contas}/{id}
lojas/temperei/historico/{id}   quem mudou o quê
lojas/temperei/copias/{data}    cópia semanal compactada
pedidos/{id}                    pedidos do cardápio (qualquer um cria; só a equipe lê)
publico/cardapio                cardápio público (sem custos)
```

### Rodar no computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes automatizados
npm run build      # gera dist/
```

Para testar a sincronização sem o Firebase de verdade, rode `VITE_NUVEM_FALSA=1 npm run build`. Ele usa `src/nuvem/servicoFalso.ts`, que guarda tudo no localStorage e simula dois aparelhos em duas abas. Esse arquivo nunca entra no site publicado.

### Pastas

```
src/core/      regras puras e testadas: dinheiro, preço, lote, vendas, caixa, contas, relatórios…
src/nuvem/     Firebase, modelo de sincronização, pedidos
src/import/    leitura de planilhas, nota fiscal (XML/PDF)
src/export/    Excel, PDF, imagens (orçamento, lista de preços)
src/pages/     telas
src/components/ peças de tela (etiqueta, caixa, cupom…)
public/cardapio/ página pública do cardápio (JavaScript puro)
tests/         testes automatizados
```

### Regras de cálculo (resumo)

- Dinheiro sempre em **centavos inteiros** (decimal.js).
- **Margem ≠ markup.** Preço = custo efetivo ÷ (1 − margem − taxa − variáveis% − fixos%).
- No lote, o **frete** é dividido por peso ou valor. Juros, outras despesas e o desconto da nota são divididos por valor.
- O estoque na nuvem é gravado como **incremento**: duas vendas ao mesmo tempo nos dois aparelhos somam certo.
