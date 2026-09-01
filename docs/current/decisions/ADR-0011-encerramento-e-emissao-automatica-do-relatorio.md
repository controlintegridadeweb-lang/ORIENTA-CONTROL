# ADR-0011 — Encerramento e emissão automática do relatório

- **Status:** aceito
- **Data:** 2026-08-21

## Contexto

O estado `completed` representa o encerramento institucional da avaliação, mas a emissão do PDF oficial depende de duas etapas técnicas distintas: persistência transacional no PostgreSQL e gravação do arquivo no Storage. Tratar o encerramento e a emissão como operações manuais independentes permitia um ciclo encerrado permanecer sem documento oficial e, se fosse reaberto nesse intervalo, comprometia a preservação documental daquele encerramento.

## Decisão

O comando **Encerrar avaliação** valida o período de referência e os bloqueios do plano de integridade e compliance, altera o ciclo para `completed` e inicia imediatamente a primeira emissão oficial. A primeira emissão não exige ação manual adicional.

Como PostgreSQL e Storage não compartilham uma transação atômica, a plataforma não mascara falhas de arquivo. O estado da emissão é derivado e pode assumir:

- `not_ready` — o diagnóstico ainda não está apto à emissão;
- `ready_to_emit` — avaliação encerrada e pronta para iniciar ou retomar a primeira emissão;
- `emitting` — existe uma reserva de emissão em preparação;
- `available` — existe relatório oficial preservado para o encerramento atual;
- `emission_failed` — a avaliação foi encerrada, mas a tentativa de emissão falhou e precisa ser retomada;
- `outdated` — existe relatório oficial de um encerramento anterior, preservado como histórico após reabertura.

Falhas de emissão são registradas de forma auditável e podem ser retomadas pela área de Relatórios. O ciclo pode permanecer `completed` com `emission_failed`; esse estado é explícito e recuperável, não um sucesso artificial.

A reabertura de um ciclo `completed` só é permitida quando o relatório oficial do encerramento atual estiver preservado. A reabertura nunca altera ou sobrescreve esse documento.

A primeira emissão pertence ao encerramento. Emissões posteriores do mesmo processamento são **reemissões** e continuam manuais, versionadas e obrigatoriamente justificadas.

Operações automáticas de encerramento e geração de pacotes reutilizam a mesma regra de emissão e recuperação; não existe caminho paralelo que grave um relatório oficial contornando o ciclo de vida da emissão.

## Alternativas consideradas

- **Manter o encerramento e a primeira emissão como comandos independentes:** descartado porque permitiria `completed` sem documento oficial preservado.
- **Reverter `completed` se o upload no Storage falhar:** descartado porque a transição de domínio pode ter sido confirmada no banco enquanto o Storage é um sistema externo sem transação distribuída.
- **Permitir reabertura antes da primeira emissão:** descartado porque eliminaria a garantia de que cada encerramento possui um documento oficial imutável.
- **Sobrescrever o PDF após reabertura ou correção:** descartado por destruir a rastreabilidade histórica.

## Regra preservada

- O FAMI oficial continua sendo o resultado do diagnóstico validado e não é recalculado pelo encerramento ou pelo plano de integridade e compliance.
- O encerramento continua exigindo todas as condições de supervisão definidas no ADR-0008.
- Relatórios concluídos continuam imutáveis e versionados conforme o ADR-0006.
- Reabertura continua criando nova revisão/processamento conforme o ADR-0007.

## Consequências

O usuário recebe a notificação de disponibilidade somente depois da finalização real do PDF. Uma falha entre o fechamento do ciclo e a persistência do arquivo permanece visível ao administrador e bloqueia a reabertura até ser resolvida. Relatórios históricos permanecem disponíveis após novas revisões, enquanto a emissão atual é identificada separadamente.
