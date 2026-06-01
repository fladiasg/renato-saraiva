# Dashboard Renato Saraiva

Site estático para GitHub Pages usando o Google Sheets como base de dados.

## Fonte de dados

O site lê a aba:

- Planilha: `[RS] Base Dash - NÃO MEXER`
- Aba: `RAW_Meta_Trafego`

As campanhas são separadas por `Campaign Name`:

- `IG`: Distribuição de Conteúdo
- `CLUBE`: Funil Clube
- `LIVE`: Live 12/05
- `Formulário Evento presencial 10/06`: Evento presencial 10/06

## Publicação no GitHub Pages

1. Suba estes arquivos para um repositório GitHub:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
2. No GitHub, vá em `Settings > Pages`.
3. Em `Build and deployment`, selecione `Deploy from a branch`.
4. Escolha a branch principal e a pasta `/root`.
5. Salve e aguarde o link do GitHub Pages.

## Atenção

Para o site conseguir ler o Sheets fora da sua conta Google, a planilha precisa estar com leitura liberada por link ou publicada na web.
