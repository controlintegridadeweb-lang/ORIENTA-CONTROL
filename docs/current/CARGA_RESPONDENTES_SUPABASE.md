# Carga em massa de respondentes no Supabase

## Decisão técnica

A criação das contas **não é feita por migration SQL**. O schema e as RPCs de
perfil continuam nas migrations, mas usuários do Supabase Auth são provisionados
pela Admin API com `SUPABASE_SERVICE_ROLE_KEY`.

Motivos:

- não inserir diretamente em `auth.users`;
- respeitar o hashing e os invariantes do Supabase Auth;
- criar o `profiles` pela RPC oficial `create_respondent_profile`;
- registrar auditoria com o administrador global como ator;
- compensar a conta Auth se a criação do profile falhar;
- permitir reexecução idempotente sem duplicar contas.

O arquivo versionado `supabase/seeds/respondent_accounts.csv` é exclusivamente um seed mínimo de desenvolvimento, com duas organizações, dois nomes e dois e-mails fictícios. Ele usa o domínio reservado `@example.invalid`. Relações reais de respondentes, e-mails e nomes pessoais devem permanecer fora do Git e ser informadas por `--file`. **Senhas nunca são versionadas.**

## Pré-requisitos

1. Migrations aplicadas.
2. `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` em `.env.local`.
3. Exatamente um administrador global criado:

```bash
npm run bootstrap:admin -- --email admin@orgao.gov.br --password 'SenhaForte' --name 'Administrador'
```

## Conferência sem alterar dados

Em desenvolvimento local, o seed fictício pode ser conferido diretamente:

```bash
npm run bootstrap:respondents -- --dry-run
```

Em homologação ou produção, informe a fonte externa:

```bash
npm run bootstrap:respondents -- --file /caminho-seguro/respondentes.csv --dry-run
```

O dry-run consulta Auth, organizações e perfis, informa o que seria criado ou ajustado e não grava nada.

## Modo recomendado: senhas temporárias únicas

```bash
npm run bootstrap:respondents -- --file /caminho-seguro/respondentes.csv
```

O script:

- cria organizações ausentes pela RPC administrativa;
- cria somente contas Auth inexistentes;
- cria profiles ausentes;
- corrige vínculo institucional de respondentes já existentes;
- preserva a senha de contas já existentes;
- gera uma senha temporária forte e diferente para cada conta nova;
- grava as credenciais em:

```text
var/bootstrap/respondent-credentials.csv
```

Esse diretório está ignorado pelo Git e o arquivo é criado com permissão `0600`.
Transmita as credenciais por canal seguro e apague o arquivo após a entrega.

## Relação provisória com senhas já definidas

Quando a implantação precisa usar uma relação previamente conferida de e-mails e
senhas distintas, mantenha dois arquivos locais e ignorados pelo Git:

```text
var/bootstrap/respondent-accounts.provisional.csv
var/bootstrap/respondent-credentials.provisional.csv
```

A fonte de contas continua sem senha. O segundo arquivo usa o cabeçalho:

```csv
organization_acronym,email,temporary_password
PC/RN,pcrn@gmail.com,SenhaTemporariaForte123!
```

Execute primeiro a conferência e depois a carga exata:

```bash
npm run bootstrap:respondents -- \
  --file var/bootstrap/respondent-accounts.provisional.csv \
  --password-mode file \
  --credentials-in var/bootstrap/respondent-credentials.provisional.csv \
  --dry-run

npm run bootstrap:respondents -- \
  --file var/bootstrap/respondent-accounts.provisional.csv \
  --password-mode file \
  --credentials-in var/bootstrap/respondent-credentials.provisional.csv
```

O script recusa senha com menos de 12 caracteres ou sem maiúscula, minúscula,
número e símbolo. Também recusa credencial ausente, duplicada, excedente ou
vinculada a sigla diferente da fonte de contas.

**E-mails provisórios em provedores públicos exigem cuidado.** Um endereço como
`orgao@gmail.com` pode já pertencer a terceiro. Não disponibilize a aplicação em
produção com um endereço cuja titularidade não foi confirmada. Quando o e-mail
oficial chegar, altere o mesmo usuário em `/admin/usuarios`; isso preserva o UUID,
o perfil, o vínculo institucional e todo o histórico. Não crie outra conta para
o mesmo órgão apenas porque o e-mail mudou.

## Senha fixa para homologação controlada

Senha compartilhada não é recomendada. Quando a homologação exigir, use variável
de ambiente — nunca grave a senha no CSV, no código ou na documentação:

```bash
export ORIENTA_RESPONDENT_INITIAL_PASSWORD='defina-aqui'
npm run bootstrap:respondents -- --password-mode fixed
```

Se a senha não atender ao mínimo de 12 caracteres com maiúscula, minúscula,
número e símbolo, o script recusa a carga. Não existe opção de bypass para
senha fraca. O modo de senha fixa deve ficar restrito a ambiente temporário de
homologação.

## Contas já existentes

Por padrão, uma nova execução:

- não duplica usuários;
- não redefine senhas;
- cria o profile se estiver ausente;
- reconcilia o vínculo com a organização indicada no CSV;
- falha se o e-mail pertencer ao administrador.

Para redefinir também as senhas existentes:

```bash
npm run bootstrap:respondents -- --reset-existing-passwords
```

As novas credenciais serão incluídas no arquivo local de saída.

## Verificação pós-carga

Depois do provisionamento, confirme que não há diferença entre a fonte e o
Supabase:

```bash
npm run verify:respondents -- --file /caminho-seguro/respondentes.csv
```

O comando não altera dados e termina com erro quando falta uma organização,
conta Auth, profile ou vínculo institucional. Senhas existentes não são lidas
nem comparadas.

## Entregabilidade dos e-mails

O seed versionado não representa caixas reais e não deve ser usado fora do desenvolvimento local. Antes de uma carga institucional, valide a fonte externa e confirme operacionalmente que cada caixa é controlada pelo órgão correspondente.

```bash
npm run bootstrap:respondents -- --file /caminho-seguro/respondentes.csv --dry-run --strict-email-deliverability
```

A validação sintática não comprova existência ou recebimento. Essa confirmação permanece responsabilidade do processo de implantação.

## Reexecução e falhas parciais

A carga é idempotente. Cada nova conta possui compensação automática: se o
profile não puder ser criado, a conta Auth recém-criada é removida.

Se uma linha falhar, o script registra o erro, continua as demais e termina com
código diferente de zero. Corrija a fonte ou o estado do banco e execute de
novo; itens concluídos serão reconhecidos e preservados.

## Opções disponíveis

```bash
npm run bootstrap:respondents -- --help
```

Principais opções:

- `--file <csv>`: usa outra fonte;
- `--dry-run`: não altera dados;
- `--password-mode unique|fixed|file`;
- `--credentials-in <arquivo>` para senhas individuais previamente definidas;
- `--password-env <nome>`;
- `--credentials-out <arquivo>`;
- `--reset-existing-passwords`;
- `--strict-email-deliverability`.
