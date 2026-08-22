# Importação do Diagnóstico de Integridade 2026

## Fonte oficial analisada

A fonte operacional é a planilha histórica original, aba `Página1`. O gerador
não depende de um manifesto antigo nem de planilhas auxiliares de saneamento.
Na planilha recebida foram encontrados:

- 22 órgãos com respostas históricas;
- 126 critérios oficiais por órgão;
- 2.772 respostas normalizadas;
- 1.127 respostas `Sim` e 1.645 respostas `Não`;
- 288 células de resposta vazias, registradas como `Não` inferido e identificadas
  explicitamente nas notas;
- 453 links associados a respostas `Sim`, importáveis como evidências;
- 110 links associados a respostas `Não`, preservados nas notas históricas;
- 207 campos auxiliares com conteúdo textual;
- matrícula, lotação, cargo/função e declaração dos 22 respondentes.

A planilha não possui registro da SETUR. Portanto, a importação correta contém
22 órgãos, e não 23. Organizações sem linha na fonte não recebem respostas
inventadas.

## Regra de normalização

Somente respostas de atendimento integral são convertidas para `Sim`. Respostas
parciais, limitadas, pontuais, em implantação ou não formalizadas são
convertidas para `Não`. A resposta original e a justificativa da normalização
permanecem nas notas.

Células vazias são registradas como `Não` inferido com a observação de que a
fonte não continha resposta. O importador não tenta deduzir uma resposta positiva
nem cria evidência inexistente.

## Evidências e informações auxiliares

- URL associada a resposta `Sim`: cria evidência histórica do tipo link.
- URL associada a resposta `Não`: permanece como referência nas notas da
  resposta e não cria evidência ativa.
- Texto, ato normativo, número de documento ou descrição: permanece nas notas.
- Resposta `Sim` sem URL: permanece como resposta histórica válida no domínio
  comum. Ela vale 1,0 ponto e gera recomendação quando a comprovação era exigida.
- Evidência histórica existente é marcada como aprovada na carga, inclusive
  quando o critério não exige evidência, evitando uma validação artificial.

### Mapeamento explícito de campos complementares

Perguntas auxiliares do formulário legado (“Caso sim…”, “Evidencie…”,
“Informe o link…”, “Anexe…”, “Justifique…”) **não** viram critérios
independentes. Cada coluna auxiliar possui vínculo determinístico com o
`source_order` oficial em
`scripts/imports/lib/diagnostic-integrity-2026-supporting-map.mjs`.

A associação **não** usa proximidade de colunas. Isso evita o erro em que a
coluna 175 (evidência de diagnóstico) caía no critério 110 em vez do 109.

Campos órfãos do Google Forms sem critério no catálogo de 126 permanecem só
como metadado/notas (`orphan_audit`) e não geram evidência ativa.

Para reconciliar dados já importados:

```bash
npm run db:push
npm run reconcile:diagnostic-evidence -- \
  --file /caminho-seguro/diagnostico_integridade_2026.json \
  --dry-run

npm run reconcile:diagnostic-evidence -- \
  --file /caminho-seguro/diagnostico_integridade_2026.json
```

A reconciliação é idempotente (chave estável ciclo + critério + URL + coluna
legada), preserva `response_id` da resposta principal, não duplica links e
registra auditoria.

Não existem arquivos, endereços, pareceres ou comprovações fictícias.

## Dados cadastrais

A baseline mantém os dados funcionais complementares dos respondentes. O
manifesto v2 usa os nomes de campo consumidos pelo importador:

- `registration_number`;
- `organizational_unit`;
- `position_title`;
- `declaration`.

Esses campos não são misturados com autenticação nem preferências de interface.

## Geração do manifesto

```bash
npm run build:diagnostic-import-manifest -- \
  --file /caminho-seguro/informações.xlsx \
  --output /caminho-seguro/diagnostico_integridade_2026.json
```

O gerador valida a estrutura da aba, os 126 critérios, as respostas reconhecidas,
as siglas canônicas e a unicidade dos órgãos antes de gravar o arquivo.

## Execução segura

```bash
npm run db:push
npm run bootstrap:admin
npm run bootstrap:respondents -- --file /caminho-seguro/respondentes.csv
# Pré-requisito: formulário oficial já criado e publicado pela administração.
npm run check:diagnostic-import

npm run verify:diagnostic-import -- \
  --file /caminho-seguro/diagnostico_integridade_2026.json \
  --accounts-file /caminho-seguro/respondentes.csv

npm run import:diagnostic-responses -- \
  --file /caminho-seguro/diagnostico_integridade_2026.json \
  --accounts-file /caminho-seguro/respondentes.csv \
  --dry-run

npm run import:diagnostic-responses -- \
  --file /caminho-seguro/diagnostico_integridade_2026.json \
  --accounts-file /caminho-seguro/respondentes.csv

npm run verify:diagnostic-responses -- \
  --file /caminho-seguro/diagnostico_integridade_2026.json \
  --accounts-file /caminho-seguro/respondentes.csv
```

Por padrão, os ciclos históricos permanecem em `in_validation`. Para concluir
na própria execução, use `--finalize`; o importador só finaliza quando o fluxo
normal não possui evidências ou respostas “não se aplica” pendentes.

## Reexecução e idempotência

A carga reaproveita conta, atribuição, ciclo, resposta, dispensa e URL já
existentes. Se uma execução falhar, ela pode ser repetida com os mesmos arquivos.
Não há tabela auxiliar de saneamento a sincronizar ou resolver.

O manifesto e a relação operacional de respondentes podem conter dados pessoais
e devem permanecer fora do Git. Remova cópias temporárias após a conferência.
