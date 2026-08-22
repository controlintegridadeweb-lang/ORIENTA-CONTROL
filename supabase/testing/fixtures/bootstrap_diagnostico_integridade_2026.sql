-- Fixture de teste/E2E. NÃO faz parte da baseline de produção.
create or replace function public.bootstrap_diagnostico_integridade_2026(
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $bootstrap$
declare
  v_form_id uuid;
  v_form_draft_id uuid;
  v_question_count integer;
  v_expected_count integer;
  v_linked_count integer;
begin
  -- A autoria é parte do contrato. Não há usuário técnico nem escolha implícita
  -- de administrador: o ator precisa ser o único admin global efetivo.
  if not exists (
    select 1
    from public.profiles
    where user_id = p_actor_user_id
      and role = 'admin'
      and organization_id is null
  ) then
    raise exception 'bootstrap_diagnostico_integridade_2026_requires_global_admin'
      using errcode = 'P0001',
            hint = 'Crie o administrador global com npm run bootstrap:admin antes de carregar o diagnóstico.';
  end if;

  if (select count(*) from public.profiles where role = 'admin') <> 1 then
    raise exception 'bootstrap_diagnostico_integridade_2026_requires_exactly_one_admin'
      using errcode = 'P0001',
            hint = 'A plataforma exige exatamente um administrador global.';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  -- O verify envia o arquivo inteiro numa query só (transação implícita).
  -- Sem o drop, a segunda invocação idempotente falha com "already exists".
  drop table if exists diagnostico_integridade_2026_context;
  drop table if exists diagnostico_integridade_2026_source;

  create temporary table diagnostico_integridade_2026_context (
    admin_user_id uuid not null,
    form_id uuid,
    form_draft_id uuid
  ) on commit drop;

  insert into diagnostico_integridade_2026_context (admin_user_id)
  values (p_actor_user_id);

create temporary table diagnostico_integridade_2026_source (
  source_order integer primary key,
  axis_name text not null check (axis_name in ('Governanca', 'Ambiental', 'Social')),
  section_code text not null,
  section_name text not null,
  section_order integer not null check (section_order >= 0),
  prompt text not null,
  finding text not null,
  requires_evidence boolean not null,
  recommendation_text text not null,
  unique (section_code, prompt)
) on commit drop;

insert into diagnostico_integridade_2026_source (
  source_order,
  axis_name,
  section_code,
  section_name,
  section_order,
  prompt,
  finding,
  requires_evidence,
  recommendation_text
) values
  (1, 'Governanca', 'DI2026-GOV-01', 'Governança e Estrutura de Integridade', 1, 'O órgão ou entidade possui Unidade de Controle Interno formalmente instituída?', 'O órgão/entidade não possui Unidade de Controle Interno formalmente instituída.', true, 'Instituir formalmente a Unidade de Controle Interno por meio de ato normativo específico (portaria), definindo claramente sua composição, atribuições e responsabilidades no âmbito da governança e do sistema de integridade do órgão ou entidade, conforme art.22 ao art.31, do Decreto Estadual N° 28.684, de 31 de dezembro de 2018.'),
  (2, 'Governanca', 'DI2026-GOV-01', 'Governança e Estrutura de Integridade', 1, 'As informações relativas à UCI estão devidamente divulgadas no sítio eletrônico oficial?', 'As informações sobre a UCI não estão divulgadas no site institucional.', true, 'Promover a divulgação, no sítio eletrônico oficial ou em outros meios institucionais, das informações relativas à Unidade de Controle Interno, incluindo composição, responsáveis e canais de contato, de modo a fortalecer a transparência institucional e facilitar o acesso às instâncias de controle e orientação administrativa.'),
  (3, 'Governanca', 'DI2026-GOV-01', 'Governança e Estrutura de Integridade', 1, 'O órgão ou entidade possui Comitê Interno de Integridade e Compliance formalmente instituído?', 'Verificou-se que o órgão/entidade não possui Comitê Interno de Integridade e Compliance formalmente instituído.', true, 'Instituir formalmente o Comitê Interno de Integridade e Compliance por meio de ato normativo específico (portaria), estabelecendo sua composição e competências, garantindo sua atuação como instância colegiada responsável pela governança e acompanhamento das ações do Programa de Integridade e Compliance Estadual, conforme disposições da Instrução Normativa Nº 06, de 30 de outubro de 2023 da Controladoria-Geral do Estado.'),
  (4, 'Governanca', 'DI2026-GOV-01', 'Governança e Estrutura de Integridade', 1, 'As informações relativas ao Comitê Interno de Integridade e Compliance – CIC (composição/membros e canais de contato institucional) estão devidamente divulgadas no sítio eletrônico oficial do órgão ou entidade ou em outros meios institucionais?', 'Constatou-se que as informações relativas ao Comitê Interno de Integridade e Compliance não estão devidamente divulgadas no sítio eletrônico institucional ou em outros meios oficiais.', true, 'Promover a divulgação das informações relativas ao Comitê Interno de Integridade e Compliance no sítio eletrônico institucional ou em outros meios oficiais, incluindo a composição do comitê, seus membros e os canais institucionais de contato, de forma a fortalecer a transparência e a visibilidade das estruturas de governança da integridade.'),
  (5, 'Governanca', 'DI2026-GOV-01', 'Governança e Estrutura de Integridade', 1, 'O órgão ou entidade possui Encarregado(s) pelo Tratamento de Dados Pessoais formalmente designado(s)?', 'Identificou-se que o órgão ou entidade não possui Encarregado pelo Tratamento de Dados Pessoais formalmente designado.', true, 'Designar formalmente o Encarregado pelo Tratamento de Dados Pessoais, e seu suplente, por meio de ato administrativo específico (portaria), definindo suas atribuições e responsabilidades, bem como divulgando os canais institucionais de contato para atendimento de demandas relacionadas à proteção de dados pessoais, em conformidade com o Decreto Estadual Nº 32.815, de 12 de julho de 2023, e com a Instrução Normativa Nº 02, DE 12 DE JULHO DE 2023, da Controladoria-Geral do Estado.'),
  (6, 'Governanca', 'DI2026-GOV-02', 'Planejamento Organizacional', 2, 'O órgão ou entidade possui Plano Estratégico formalmente instituído?', 'O órgão ou entidade não possui Plano Estratégico formalmente instituído.', true, 'Instituir formalmente o Plano Estratégico por meio de ato normativo (portaria, resolução ou instrumento equivalente), contendo diretrizes institucionais, objetivos estratégicos, metas e indicadores, de modo a orientar a atuação institucional no médio e longo prazo, conforme art. 5º ao art. 13 da Instrução Normativa Nº 07, de 30 de outubro de 2023.'),
  (7, 'Governanca', 'DI2026-GOV-02', 'Planejamento Organizacional', 2, 'O Plano Estratégico está alinhado aos instrumentos de planejamento governamental (PPA, LDO e LOA)?', 'Não foi evidenciado alinhamento claro entre o Plano Estratégico e os instrumentos de planejamento governamental.', false, 'Promover o alinhamento entre o Plano Estratégico e os instrumentos de planejamento governamental (PPA, LDO e LOA), assegurando coerência entre os objetivos institucionais, as prioridades governamentais e a programação orçamentária.'),
  (8, 'Governanca', 'DI2026-GOV-02', 'Planejamento Organizacional', 2, 'O Plano Estratégico contempla objetivos, metas e indicadores formalmente definidos?', 'O Plano Estratégico não apresenta objetivos, metas e indicadores claramente definidos ou mensuráveis.', false, 'Estruturar o Plano Estratégico com definição clara de objetivos estratégicos, metas mensuráveis e indicadores de desempenho, permitindo o acompanhamento sistemático dos resultados institucionais'),
  (9, 'Governanca', 'DI2026-GOV-02', 'Planejamento Organizacional', 2, 'Há instância, unidade ou comitê formalmente designado responsável pela coordenação, monitoramento e revisão do Plano Estratégico?', 'Não foi identificada instância formalmente responsável pela coordenação e monitoramento do planejamento estratégico.', true, 'Designar formalmente unidade administrativa, instância ou comitê responsável pela coordenação, monitoramento e revisão do Plano Estratégico, garantindo a continuidade e a governança do processo de planejamento.'),
  (10, 'Governanca', 'DI2026-GOV-02', 'Planejamento Organizacional', 2, 'O Plano Estratégico possui rotina formal de monitoramento periódico de seus objetivos e metas?', 'Não foi evidenciada rotina formal de monitoramento periódico do Plano Estratégico.', false, 'Instituir rotina periódica de monitoramento do Plano Estratégico, com acompanhamento das metas e indicadores definidos e registro das avaliações realizadas.'),
  (11, 'Governanca', 'DI2026-GOV-02', 'Planejamento Organizacional', 2, 'São elaborados relatórios, painéis ou outros instrumentos formais de acompanhamento do Plano Estratégico?', 'Não foram identificados instrumentos formais de acompanhamento da execução do Plano Estratégico.', true, 'Implementar instrumentos formais de acompanhamento do planejamento estratégico, tais como relatórios gerenciais, painéis de indicadores ou sistemas de monitoramento.'),
  (12, 'Governanca', 'DI2026-GOV-02', 'Planejamento Organizacional', 2, 'O Plano Estratégico está disponível para consulta interna e/ou externa por meio do site institucional ou outros meios oficiais?', 'O Plano Estratégico não está disponível para consulta pública ou interna em meios institucionais oficiais.', true, 'Disponibilizar o Plano Estratégico no sítio eletrônico institucional ou em outros meios oficiais, fortalecendo a transparência e permitindo o acompanhamento das diretrizes estratégicas pela sociedade e pelos servidores.'),
  (13, 'Governanca', 'DI2026-GOV-02', 'Planejamento Organizacional', 2, 'O Plano Estratégico contempla diretrizes, objetivos ou ações relacionadas à integridade, compliance, gestão de riscos ou controles internos?', 'O Plano Estratégico não contempla diretrizes ou ações relacionadas à integridade, gestão de riscos ou controles internos.', false, 'Incorporar ao Plano Estratégico diretrizes, objetivos ou iniciativas voltadas à promoção da integridade, gestão de riscos, compliance e fortalecimento dos controles internos, assegurando maior integração entre o planejamento estratégico e o Programa de Integridade e Compliance.'),
  (14, 'Governanca', 'DI2026-GOV-03', 'Gestão Processual', 3, 'O órgão ou entidade possui seus processos de trabalho mapeados e formalmente documentados?', 'O órgão ou entidade não possui seus processos de trabalho devidamente mapeados e formalmente documentados.', false, 'Promover o mapeamento e a documentação dos principais processos de trabalho do órgão ou entidade, especialmente aqueles considerados críticos para a execução das atividades institucionais. O mapeamento deve contemplar a descrição das etapas do processo, responsáveis, entradas, saídas e controles existentes.'),
  (15, 'Governanca', 'DI2026-GOV-03', 'Gestão Processual', 3, 'Existe ato formal, metodologia ou diretriz institucional que discipline o mapeamento e a gestão de processos?', 'Não foi identificada a existência de ato normativo, metodologia ou diretriz institucional que discipline o mapeamento e a gestão de processos no âmbito do órgão ou entidade.', true, 'Estabelecer diretriz institucional ou ato normativo que discipline a gestão por processos, definindo metodologia, padrões de documentação, responsabilidades e procedimentos para mapeamento, revisão e atualização dos processos organizacionais.'),
  (16, 'Governanca', 'DI2026-GOV-03', 'Gestão Processual', 3, 'Os processos mapeados possuem documentação padronizada (fluxogramas, POPs, manuais ou instrumentos equivalentes)?', 'Os processos existentes não apresentam documentação padronizada ou não foi possível evidenciar a utilização de instrumentos formais de documentação processual.', true, 'Adotar padrão institucional de documentação dos processos, utilizando instrumentos como fluxogramas, Procedimentos Operacionais Padrão (POPs), manuais ou ferramentas equivalentes, garantindo maior clareza na execução das atividades e facilitando a disseminação do conhecimento institucional.'),
  (17, 'Governanca', 'DI2026-GOV-03', 'Gestão Processual', 3, 'Há definição clara de responsáveis, entradas, saídas, prazos e controles para os processos mapeados?', 'Não foi evidenciada a definição clara de responsabilidades, entradas, saídas, prazos e controles associados aos processos mapeados.', false, 'Revisar os processos mapeados para incluir a definição clara de responsáveis, entradas e saídas do processo, prazos de execução e controles associados, fortalecendo a organização das rotinas administrativas e a responsabilização pelas atividades executadas.'),
  (18, 'Governanca', 'DI2026-GOV-03', 'Gestão Processual', 3, 'Existe unidade, instância ou responsável formalmente designado para coordenar a gestão por processos no órgão ou entidade?', 'Não foi identificada instância, unidade administrativa ou responsável formalmente designado para coordenar a gestão por processos.', true, 'Designar formalmente unidade administrativa ou responsável institucional para coordenar a gestão por processos, promovendo a padronização metodológica, o acompanhamento do mapeamento e a melhoria contínua dos processos organizacionais.'),
  (19, 'Governanca', 'DI2026-GOV-03', 'Gestão Processual', 3, 'Os processos mapeados são periodicamente monitorados, revisados e aprimorados?', 'Não foi evidenciada a existência de rotina sistemática de monitoramento e revisão dos processos organizacionais.', true, 'Instituir rotina periódica de monitoramento e revisão dos processos mapeados, com o objetivo de identificar oportunidades de melhoria, corrigir falhas operacionais e atualizar os processos conforme mudanças organizacionais ou normativas.'),
  (20, 'Governanca', 'DI2026-GOV-03', 'Gestão Processual', 3, 'São utilizados indicadores de desempenho, qualidade ou eficiência para avaliar os processos?', 'Não foram identificados indicadores de desempenho ou instrumentos de avaliação da eficiência dos processos organizacionais.', true, 'Estabelecer indicadores de desempenho para os processos considerados críticos, permitindo avaliar aspectos como tempo de execução, qualidade das entregas e eficiência operacional, subsidiando a tomada de decisões gerenciais.'),
  (21, 'Governanca', 'DI2026-GOV-03', 'Gestão Processual', 3, 'Os processos mapeados consideram riscos operacionais, riscos de integridade e controles internos associados?', 'Os processos organizacionais não contemplam, de forma estruturada, a identificação de riscos operacionais ou de integridade e os respectivos controles internos associados', false, 'Integrar a gestão de riscos ao mapeamento de processos, identificando riscos relevantes associados às atividades institucionais e definindo controles internos adequados para sua mitigação.'),
  (22, 'Governanca', 'DI2026-GOV-03', 'Gestão Processual', 3, 'As atividades de gestão processual são utilizadas como insumo para ações de integridade, auditoria, gestão de riscos ou controles internos?', 'Não foi evidenciada a utilização das informações oriundas da gestão por processos como insumo para ações de auditoria, integridade ou gestão de riscos.', false, 'Promover a integração entre a gestão por processos e os demais mecanismos de governança institucional, especialmente auditoria interna, gestão de riscos, controles internos e ações de integridade, de modo a fortalecer o sistema de governança do órgão ou entidade.'),
  (23, 'Governanca', 'DI2026-GOV-03', 'Gestão Processual', 3, 'Os processos mapeados e documentados estão disponíveis para consulta interna pelas unidades envolvidas?', 'Os processos mapeados não estão disponibilizados para consulta pelas unidades envolvidas ou não há evidência de sua disponibilização em ambiente institucional.', true, 'Disponibilizar os processos mapeados em repositório institucional acessível às unidades envolvidas, garantindo transparência interna, padronização das rotinas administrativas e maior disseminação do conhecimento organizacional.'),
  (24, 'Governanca', 'DI2026-GOV-04', 'Gestão de Riscos', 4, 'O órgão ou entidade realiza a identificação e avaliação sistemática de riscos em seus processos, projetos ou atividades?', 'O órgão ou entidade não realiza, ou realiza de forma limitada, a identificação e avaliação sistemática de riscos associados às suas atividades institucionais.', false, 'Implementar processo estruturado de identificação e avaliação de riscos institucionais, abrangendo processos, projetos e atividades relevantes do órgão ou entidade. Esse processo deve contemplar a identificação dos eventos de risco, análise de probabilidade e impacto e registro sistematizado das informações em instrumento apropriado, como matriz ou mapa de riscos, em conformidade com os art. 16 ao art. 21 da Instrução Normativa Nº 07, de 30 de outubro de 2023.'),
  (25, 'Governanca', 'DI2026-GOV-04', 'Gestão de Riscos', 4, 'O órgão ou entidade possui política, norma ou diretriz formal de gerenciamento de riscos?', 'Não foi evidenciada a existência de política, norma ou diretriz formal que discipline a gestão de riscos no âmbito do órgão ou entidade.', true, 'Instituir formalmente política ou diretriz institucional de gestão de riscos, por meio de ato normativo específico, definindo metodologia, responsabilidades, critérios de avaliação e procedimentos para identificação, análise, tratamento e monitoramento dos riscos institucionais.'),
  (26, 'Governanca', 'DI2026-GOV-04', 'Gestão de Riscos', 4, 'Há instância, unidade ou responsável formalmente designado para coordenar o gerenciamento de riscos no órgão ou entidade?', 'Não foi identificada instância, unidade administrativa ou responsável formalmente designado para coordenar o gerenciamento de riscos.', true, 'Designar formalmente unidade, instância ou responsável institucional para coordenar a gestão de riscos, assegurando a implementação da metodologia adotada, o acompanhamento dos riscos identificados e a articulação com as demais áreas da organização.'),
  (27, 'Governanca', 'DI2026-GOV-04', 'Gestão de Riscos', 4, 'Para os riscos identificados, são definidas respostas e planos de tratamento (mitigar, transferir, evitar ou aceitar)?', 'Os riscos identificados não possuem planos de tratamento formalmente definidos ou não foi possível evidenciar a adoção de respostas estruturadas para sua mitigação.', false, 'Estabelecer planos de tratamento para os riscos identificados, definindo as ações necessárias para sua mitigação, os responsáveis pela implementação das medidas, os prazos de execução e os controles associados.'),
  (28, 'Governanca', 'DI2026-GOV-04', 'Gestão de Riscos', 4, 'Os controles internos existentes estão formalmente associados aos riscos identificados?', 'Não foi evidenciada associação formal entre os controles internos existentes e os riscos identificados no âmbito do órgão ou entidade.', false, 'Estabelecer relação clara entre os riscos identificados e os controles internos existentes ou a serem implementados, de modo a garantir que os mecanismos de controle sejam adequados e proporcionais aos riscos institucionais identificados.'),
  (29, 'Governanca', 'DI2026-GOV-04', 'Gestão de Riscos', 4, 'Os riscos identificados são periodicamente monitorados e revisados?', 'Não foi evidenciada rotina sistemática de monitoramento e revisão periódica dos riscos institucionais.', true, 'Instituir rotina periódica de monitoramento e revisão dos riscos identificados, de modo a verificar a efetividade das medidas de tratamento adotadas e atualizar o mapa de riscos conforme mudanças no ambiente institucional.'),
  (30, 'Governanca', 'DI2026-GOV-04', 'Gestão de Riscos', 4, 'São elaborados relatórios, matrizes ou painéis formais de riscos para apoio à tomada de decisão?', 'Não foram identificados instrumentos formais de registro ou acompanhamento dos riscos institucionais, tais como matrizes, relatórios ou painéis de risco.', true, 'Adotar instrumentos formais de registro e acompanhamento dos riscos institucionais, como matrizes de riscos ou relatórios gerenciais, permitindo maior sistematização das informações e subsidiando a tomada de decisão da gestão.'),
  (31, 'Governanca', 'DI2026-GOV-04', 'Gestão de Riscos', 4, 'O gerenciamento de riscos é utilizado como insumo para o planejamento estratégico, planos setoriais ou definição de prioridades?', 'Não foi evidenciada a utilização das informações provenientes da gestão de riscos como subsídio para o planejamento institucional ou definição de prioridades estratégicas.', false, 'Integrar o processo de gestão de riscos ao planejamento institucional, utilizando as informações geradas no gerenciamento de riscos como insumo para definição de prioridades, planejamento de ações e alocação de recursos.'),
  (32, 'Governanca', 'DI2026-GOV-04', 'Gestão de Riscos', 4, 'Os resultados do gerenciamento de riscos são considerados nas ações de auditoria, integridade, compliance ou controles internos?', 'Não foi evidenciada integração entre os resultados da gestão de riscos e as ações de auditoria, integridade ou controles internos.', false, 'Promover a integração entre o gerenciamento de riscos e os demais mecanismos de governança institucional, especialmente auditoria interna, ações de integridade e controles internos, de forma a fortalecer o sistema de governança e prevenção de irregularidades.'),
  (33, 'Governanca', 'DI2026-GOV-05', 'Gestão da Ética', 5, 'O órgão ou entidade possui Comitê Setorial de Ética (CSE) formalmente instituído?', 'O órgão ou entidade não possui Comitê Setorial de Ética formalmente instituído.', true, 'Recomenda-se instituir formalmente o Comitê Setorial de Ética por meio de ato normativo específico, definindo sua composição, atribuições e forma de funcionamento, em conformidade com a Instrução Normativa Nº 18, de 10 de dezembro de 2024 da Controladoria-Geral do Estado.'),
  (34, 'Governanca', 'DI2026-GOV-05', 'Gestão da Ética', 5, 'O Comitê Setorial de Ética é formado apenas por servidores efetivos ou empregados públicos?', 'A composição do Comitê Setorial de Ética não está claramente definida ou não foi possível comprovar que seus membros são servidores efetivos ou empregados públicos.', false, 'Assegurar que o Comitê Setorial de Ética seja composto por servidores efetivos ou empregados públicos, garantindo maior estabilidade institucional e imparcialidade na atuação da instância ética.'),
  (35, 'Governanca', 'DI2026-GOV-05', 'Gestão da Ética', 5, 'As informações relativas ao Comitê Setorial de Ética estão divulgadas no sítio eletrônico institucional?', 'Não foi evidenciada a divulgação das informações relativas ao Comitê Setorial de Ética no sítio eletrônico institucional ou em outros meios oficiais.', true, 'Divulgar no sítio eletrônico institucional informações sobre o Comitê Setorial de Ética, incluindo composição, atribuições e canais de contato, fortalecendo a transparência institucional.'),
  (36, 'Governanca', 'DI2026-GOV-05', 'Gestão da Ética', 5, 'O Comitê realiza reuniões periódicas e mantém registros formais de suas atividades?', 'Não foram apresentadas evidências de reuniões periódicas ou registros formais das atividades do Comitê Setorial de Ética.', false, 'Instituir rotina periódica de reuniões do Comitê Setorial de Ética, com elaboração e registro de atas, relatórios ou documentos equivalentes que evidenciem suas atividades e deliberações.'),
  (37, 'Governanca', 'DI2026-GOV-05', 'Gestão da Ética', 5, 'O Comitê apresenta entregas relevantes relacionadas à disseminação da ética pública?', 'Não foram identificadas ações ou entregas relevantes relacionadas à promoção ou disseminação da ética pública no âmbito do órgão ou entidade.', true, 'Promover ações voltadas à disseminação da ética pública, tais como orientações institucionais, campanhas educativas, eventos ou atividades de capacitação voltadas aos servidores.'),
  (38, 'Governanca', 'DI2026-GOV-05', 'Gestão da Ética', 5, 'O órgão ou entidade observa e aplica as normas estaduais que regem a ética no Poder Executivo Estadual?', 'Não foi possível evidenciar a plena observância das normas estaduais relacionadas à ética pública no âmbito do órgão ou entidade.', false, 'Promover a adequada aplicação das normas estaduais que regem a ética pública, assegurando que os servidores e colaboradores tenham conhecimento dessas diretrizes e que elas sejam observadas nas práticas institucionais, tais como: Decreto Estadual N° 33.094, de 27 de outubro de 2023 (código de ética); Decreto N° 33.233, de 12 de dezembro de 2023; Decreto Nº 34.193, de 09 de dezembro de 2024.'),
  (39, 'Governanca', 'DI2026-GOV-05', 'Gestão da Ética', 5, 'O órgão ou entidade instituiu Código de Ética ou Conduta próprio?', 'O órgão ou entidade não possui Código de Ética ou Conduta próprio formalmente instituído.', true, 'Elaborar e instituir Código de Ética ou de Conduta próprio, por meio de ato normativo específico, estabelecendo princípios, diretrizes e padrões de comportamento esperados dos agentes públicos no âmbito institucional, conforme art. 22 e art. 23 da Instrução Normativa Nº 07, de 30 de outubro de 2023, da Controladoria-Geral do Estado.'),
  (40, 'Governanca', 'DI2026-GOV-05', 'Gestão da Ética', 5, 'O órgão ou entidade promove ações de orientação ética aos servidores e colaboradores?', 'Não foram evidenciadas ações estruturadas de orientação ética destinadas aos servidores, empregados públicos ou colaboradores.', true, 'Implementar ações periódicas de orientação ética, como capacitações, campanhas de conscientização, divulgação de orientações institucionais ou outras iniciativas voltadas à promoção da ética pública.'),
  (41, 'Governanca', 'DI2026-GOV-05', 'Gestão da Ética', 5, 'São adotadas ações específicas para prevenção de conflitos de interesse, nepotismo ou outras situações sensíveis sob a ótica ética?', 'Não foram identificadas ações específicas voltadas à prevenção de conflitos de interesse, nepotismo ou outras situações sensíveis do ponto de vista ético.', true, 'Adotar medidas institucionais voltadas à prevenção de conflitos de interesse e outras situações sensíveis, incluindo orientações internas, procedimentos formais ou instrumentos de controle que auxiliem na identificação e prevenção dessas situações.'),
  (42, 'Governanca', 'DI2026-GOV-05', 'Gestão da Ética', 5, 'Existem canais formais para consulta e orientação ética aos servidores?', 'O órgão ou entidade não possui canal formal destinado à consulta ou orientação ética aos servidores.', true, 'Instituir canal institucional para consultas e orientações relacionadas a questões éticas, possibilitando que servidores e colaboradores obtenham esclarecimentos prévios sobre situações potencialmente sensíveis.'),
  (43, 'Governanca', 'DI2026-GOV-05', 'Gestão da Ética', 5, 'O Código de Ética e as orientações éticas estão amplamente divulgados no site institucional ou em outros meios oficiais?', 'Não foi evidenciada ampla divulgação do Código de Ética ou de orientações éticas em meios institucionais.', true, 'Promover ampla divulgação do Código de Ética e das orientações institucionais relacionadas à ética pública, especialmente por meio do sítio eletrônico institucional e de canais internos de comunicação.'),
  (44, 'Governanca', 'DI2026-GOV-05', 'Gestão da Ética', 5, 'O órgão possui fluxos definidos para tratamento de demandas, denúncias ou representações de natureza ética?', 'Não foi possível identificar a existência de fluxos formalmente definidos para o tratamento de demandas ou denúncias de natureza ética.', true, 'Estabelecer e desenhar fluxos formais para o recebimento, análise e encaminhamento de demandas, denúncias ou representações relacionadas à ética pública, assegurando maior clareza e padronização no tratamento dessas situações.'),
  (45, 'Governanca', 'DI2026-GOV-05', 'Gestão da Ética', 5, 'Há articulação entre o Comitê de Ética, a Ouvidoria e a Unidade de Correição?', 'Não foi evidenciada articulação institucional entre o Comitê de Ética, a Ouvidoria e a Unidade de Correição para o tratamento das demandas éticas.', false, 'Promover a articulação entre as instâncias responsáveis pela ética, ouvidoria e correição, estabelecendo mecanismos de cooperação e fluxo de encaminhamento de demandas, fortalecendo o sistema de integridade institucional.'),
  (46, 'Governanca', 'DI2026-GOV-06', 'Gestão Correcional', 6, 'O órgão ou entidade possui Unidade de Correição formalmente instituída?', 'O órgão ou entidade não possui Unidade de Correição formalmente instituída ou não apresentou evidência de sua instituição.', true, 'Instituir formalmente a Unidade de Correição por meio de ato normativo específico (portaria), definindo suas competências, responsabilidades e estrutura de funcionamento, em conformidade com a Instrução Normativa Nº 11, de 08 de dezembro de 2023, da Controladoria-Geral do Estado.'),
  (47, 'Governanca', 'DI2026-GOV-06', 'Gestão Correcional', 6, 'A Unidade de Correição é formada apenas por servidores efetivos ou empregados públicos?', 'A composição da Unidade de Correição não está claramente definida ou não foi possível comprovar que seus membros são servidores efetivos ou empregados públicos.', false, 'Assegurar que a Unidade de Correição seja composta prioritariamente por servidores efetivos ou empregados públicos, garantindo maior estabilidade institucional, independência funcional e segurança na condução das atividades correcionais.'),
  (48, 'Governanca', 'DI2026-GOV-06', 'Gestão Correcional', 6, 'As informações relativas à Unidade de Correição (composição e canais de contato) estão devidamente divulgadas no sítio eletrônico institucional?', 'Não foi evidenciada a divulgação das informações relativas à Unidade de Correição no sítio eletrônico institucional ou em outros meios oficiais.', true, 'Divulgar no sítio eletrônico institucional informações relativas à Unidade de Correição, incluindo sua composição, atribuições e canais institucionais de contato, fortalecendo a transparência institucional.'),
  (49, 'Governanca', 'DI2026-GOV-06', 'Gestão Correcional', 6, 'Os servidores designados para a função correcional possuem capacitação compatível com as atribuições exercidas?', 'Não foram apresentadas evidências de que os servidores responsáveis pela função correcional possuam capacitação específica ou compatível com as atribuições exercidas.', false, 'Promover a capacitação dos servidores responsáveis pelas atividades correcionais, especialmente em temas relacionados a procedimentos disciplinares, sindicâncias e processos administrativos disciplinares, garantindo maior segurança jurídica e qualidade na condução das apurações.'),
  (50, 'Governanca', 'DI2026-GOV-06', 'Gestão Correcional', 6, 'O órgão ou entidade observa e aplica as normas estaduais que disciplinam a atividade correcional no âmbito do Poder Executivo Estadual?', 'Não foi possível evidenciar a plena observância das normas estaduais relacionadas à atividade correcional.', false, 'Assegurar a adequada aplicação das normas estaduais que disciplinam a atividade correcional, promovendo a adoção de procedimentos compatíveis com as diretrizes estabelecidas pela Controladoria-Geral do Estado, observando as disposições do Decreto Estadual Nº 29.353, de 06 de dezembro de 2019.'),
  (51, 'Governanca', 'DI2026-GOV-06', 'Gestão Correcional', 6, 'O órgão ou entidade possui fluxos formalmente definidos para o tratamento de denúncias, representações ou notícias de irregularidades de natureza disciplinar?', 'Não foram identificados fluxos formalmente definidos para o tratamento de denúncias, representações ou notícias de irregularidades de natureza disciplinar.', true, 'Estabelecer fluxos formais para o recebimento, análise e encaminhamento de denúncias ou representações de natureza disciplinar, definindo responsabilidades, etapas do processo e mecanismos de acompanhamento.'),
  (52, 'Governanca', 'DI2026-GOV-06', 'Gestão Correcional', 6, 'São instaurados e conduzidos, quando cabível, procedimentos correcionais (sindicâncias, processos administrativos disciplinares ou instrumentos equivalentes)?', 'Não foi possível evidenciar a instauração ou condução sistemática de procedimentos correcionais quando identificadas situações que demandem apuração disciplinar.', false, 'Assegurar a instauração e condução adequada de procedimentos correcionais, tais como sindicâncias ou processos administrativos disciplinares, sempre que houver indícios de irregularidades administrativas, observando as normas aplicáveis.'),
  (53, 'Governanca', 'DI2026-GOV-06', 'Gestão Correcional', 6, 'Há controle formal de prazos e acompanhamento da tramitação dos procedimentos correcionais instaurados?', 'Não foram identificados mecanismos formais de controle de prazos ou acompanhamento da tramitação dos procedimentos correcionais.', true, 'Instituir mecanismos formais de controle e acompanhamento dos procedimentos correcionais instaurados, garantindo o cumprimento dos prazos legais e maior organização na condução dos processos disciplinares.'),
  (54, 'Governanca', 'DI2026-GOV-06', 'Gestão Correcional', 6, 'O órgão ou entidade mantém articulação com a Controladoria-Geral do Estado para orientação, supervisão ou encaminhamento de demandas correcionais?', 'Não foi evidenciada articulação institucional entre o órgão ou entidade e a Controladoria-Geral do Estado para fins de orientação ou supervisão das atividades correcionais.', false, 'Fortalecer a articulação institucional com a Controladoria-Geral do Estado, buscando orientação técnica e alinhamento quanto à condução das atividades correcionais.'),
  (55, 'Governanca', 'DI2026-GOV-06', 'Gestão Correcional', 6, 'Há integração entre a Unidade de Correição, a Ouvidoria e o Comitê de Ética para o tratamento das demandas recebidas?', 'Não foi evidenciada integração entre as instâncias de correição, ouvidoria e ética para o tratamento das demandas recebidas.', false, 'Promover a integração entre as instâncias responsáveis pela correição, ouvidoria e ética, estabelecendo fluxos de comunicação e encaminhamento de demandas que contribuam para maior efetividade na apuração de irregularidades.'),
  (56, 'Governanca', 'DI2026-GOV-06', 'Gestão Correcional', 6, 'O órgão ou entidade mantém registros organizados e atualizados dos procedimentos correcionais instaurados, resguardadas as informações sigilosas?', 'Não foi possível evidenciar a existência de registros organizados e atualizados dos procedimentos correcionais instaurados.', true, 'Manter registros organizados e atualizados dos procedimentos correcionais instaurados, observando as regras de sigilo aplicáveis, de forma a facilitar o acompanhamento das apurações e a gestão das informações correcionais.'),
  (57, 'Governanca', 'DI2026-GOV-06', 'Gestão Correcional', 6, 'As informações consolidadas da atividade correcional são utilizadas para fins de prevenção e aprimoramento de controles?', 'Não foi evidenciada a utilização das informações provenientes das atividades correcionais para fins de prevenção de irregularidades ou aprimoramento de controles internos.', false, 'Utilizar as informações consolidadas das atividades correcionais como insumo para identificação de fragilidades institucionais, prevenção de irregularidades e aprimoramento dos controles internos e das práticas de integridade.'),
  (58, 'Governanca', 'DI2026-GOV-07', 'Gestão da Transparência', 7, 'O órgão ou entidade possui agente(s) público(s) formalmente designado(s) para atuar nas atividades de transparência e de acesso à informação?', 'O órgão ou entidade não possui agente público formalmente designado para atuar nas atividades relacionadas à transparência e ao acesso à informação, ou não apresentou evidência de sua designação.', true, 'Designar formalmente agente(s) público(s) responsável(is) pelas atividades de transparência e acesso à informação, por meio de ato administrativo específico (portaria), garantindo a organização e a adequada condução das atividades relacionadas à Lei de Acesso à Informação.'),
  (59, 'Governanca', 'DI2026-GOV-07', 'Gestão da Transparência', 7, 'Os responsáveis pela transparência e acesso à informação possuem capacitação compatível com as atribuições exercidas?', 'Não foram apresentadas evidências de capacitação específica dos servidores responsáveis pelas atividades de transparência e acesso à informação.', false, 'Promover a capacitação dos servidores responsáveis pela transparência e acesso à informação, especialmente em temas relacionados à Lei de Acesso à Informação, transparência pública e gestão da informação.'),
  (60, 'Governanca', 'DI2026-GOV-07', 'Gestão da Transparência', 7, 'As informações relativas ao responsável pela transparência e acesso à informação estão divulgadas no sítio eletrônico institucional?', 'Não foi evidenciada a divulgação das informações relativas ao responsável pela transparência e acesso à informação no sítio eletrônico institucional ou em outros meios oficiais.', true, 'Divulgar no sítio eletrônico institucional as informações relativas ao responsável pelas atividades de transparência e acesso à informação, incluindo nome, unidade de atuação e canais institucionais de contato.'),
  (61, 'Governanca', 'DI2026-GOV-07', 'Gestão da Transparência', 7, 'O órgão ou entidade mantém seção específica de transparência ativa em seu sítio eletrônico oficial?', 'O órgão ou entidade não mantém seção específica de transparência ativa em seu sítio eletrônico institucional ou não apresentou evidência de sua existência.', true, 'Estruturar e manter seção específica de transparência ativa no sítio eletrônico institucional, disponibilizando informações de interesse público de forma clara, organizada e acessível à sociedade.'),
  (62, 'Governanca', 'DI2026-GOV-07', 'Gestão da Transparência', 7, 'O órgão ou entidade implementou procedimentos para classificação, desclassificação e tratamento de informações protegidas por sigilo?', 'Não foi evidenciada a implementação de procedimentos formais para classificação, desclassificação e tratamento de informações protegidas por sigilo.', false, 'Implementar procedimentos institucionais para classificação e tratamento de informações protegidas por sigilo, em conformidade com a Instrução Normativa N° 01, de 03 de janeiro de 2022, da Controladoria-Geral do Estado, garantindo a adequada gestão das informações públicas e protegidas.'),
  (63, 'Governanca', 'DI2026-GOV-07', 'Gestão da Transparência', 7, 'A divulgação das informações observa a proteção de dados pessoais e as hipóteses de restrição de acesso previstas na legislação?', 'Não foi possível evidenciar a adoção de procedimentos que assegurem a observância da proteção de dados pessoais na divulgação de informações institucionais.', false, 'Assegurar que a divulgação das informações institucionais observe as disposições da legislação sobre proteção de dados pessoais e as hipóteses legais de restrição de acesso, especialmente no que se refere à Lei Geral de Proteção de Dados.'),
  (64, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'O órgão ou entidade possui responsável(is) formalmente designado(s) para Ouvidoria?', 'O órgão ou entidade não possui responsável formalmente designado para a Ouvidoria ou não apresentou evidência de sua designação.', true, 'Designar formalmente responsável(is) pela Ouvidoria por meio de ato normativo específico (Portaria), definindo suas atribuições e garantindo a adequada condução das atividades relacionadas ao recebimento e tratamento das manifestações da sociedade.'),
  (65, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'O responsável titular designado para Ouvidoria é servidor público efetivo ou empregado público?', 'Não foi possível evidenciar que o responsável pela Ouvidoria seja servidor efetivo ou empregado público.', false, 'Recomenda-se que a função de ouvidoria seja exercida, preferencialmente, por servidor efetivo ou empregado público, garantindo maior estabilidade institucional e segurança no exercício das atribuições.'),
  (66, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'Os responsáveis pela Ouvidoria possuem capacitação ou certificação compatível com as atribuições exercidas?', 'Não foram apresentadas evidências de capacitação específica dos servidores responsáveis pelas atividades de ouvidoria.', false, 'Promover a capacitação dos servidores responsáveis pela ouvidoria, especialmente em temas relacionados à Lei Nº 13.460, de 26 de junho de 2017, bem como à gestão de manifestações, atendimento ao cidadão, integridade e proteção do manifestante.'),
  (67, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'As informações relativas ao responsável pela Ouvidoria estão divulgadas no sítio eletrônico institucional?', 'Não foi evidenciada a divulgação das informações relativas ao responsável pela Ouvidoria no sítio eletrônico institucional ou em outros meios oficiais.', true, 'Divulgar no sítio eletrônico institucional as informações relativas ao responsável pela Ouvidoria, incluindo nome, unidade de atuação e canais institucionais de contato.'),
  (68, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'A Ouvidoria dispõe de estrutura mínima adequada para o desempenho de suas atribuições?', 'Não foi evidenciada a divulgação das informações relativas ao responsável pela Ouvidoria no sítio eletrônico institucional ou em outros meios oficiais.', false, 'Assegurar que a Ouvidoria disponha de estrutura mínima adequada, incluindo recursos humanos, acesso aos sistemas institucionais e meios de comunicação necessários para o desempenho de suas atribuições.'),
  (69, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'A Ouvidoria dispõe de sala reservada para atendimento, garantindo a confidencialidade das manifestações?', 'Não foi evidenciada a existência de espaço adequado que assegure a confidencialidade no atendimento das manifestações.', false, 'Disponibilizar espaço adequado para o atendimento das manifestações da Ouvidoria, garantindo condições de confidencialidade e segurança para o cidadão.'),
  (70, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'As instalações da Ouvidoria são acessíveis a pessoas com deficiência ou mobilidade reduzida?', 'Não foi evidenciada a existência de instalações que atendam aos requisitos de acessibilidade.', false, 'Assegurar que as instalações utilizadas pela Ouvidoria atendam aos requisitos de acessibilidade, garantindo atendimento adequado a todos os cidadãos.'),
  (71, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'O órgão ou entidade disponibiliza canais acessíveis para o recebimento de manifestações de ouvidoria?', 'Não foi evidenciada a existência de canais adequados para o recebimento de manifestações de ouvidoria.', false, 'Disponibilizar canais acessíveis para o recebimento de manifestações, incluindo reclamações, denúncias, sugestões, elogios e solicitações, garantindo o acesso da sociedade à Ouvidoria institucional.'),
  (72, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'Os canais de ouvidoria são amplamente divulgados no site institucional ou em outros meios oficiais?', 'Não foi evidenciada ampla divulgação dos canais de ouvidoria nos meios institucionais.', false, 'Recomenda-se promover ampla divulgação dos canais de ouvidoria no sítio eletrônico institucional e em outros meios de comunicação oficiais, incentivando a participação social.'),
  (73, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'O órgão ou entidade possui fluxos formalmente definidos para o recebimento, análise, encaminhamento e resposta às manifestações de ouvidoria?', 'Não foram identificados fluxos formais que disciplinem o tratamento das manifestações de ouvidoria.', true, 'Estabelecer fluxos formais para o tratamento das manifestações de ouvidoria, definindo etapas de recebimento, análise, encaminhamento e resposta ao cidadão.'),
  (74, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'Há registro, controle e acompanhamento das manifestações recebidas e das providências adotadas?', 'Não foi possível evidenciar a existência de mecanismos de registro e acompanhamento das manifestações recebidas.', false, 'Manter registro sistemático das manifestações recebidas, bem como das providências adotadas e das respostas encaminhadas ao cidadão, garantindo maior controle e transparência do processo.'),
  (75, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'São adotadas medidas para garantir a proteção da identidade do manifestante e o tratamento adequado das denúncias recebidas?', 'Não foi possível evidenciar a adoção de medidas institucionais destinadas à proteção da identidade do manifestante', false, 'Adotar medidas que assegurem a proteção da identidade do manifestante e o tratamento adequado das denúncias recebidas, especialmente nos casos que envolvam possíveis irregularidades.'),
  (76, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'As denúncias recebidas pela Ouvidoria são encaminhadas às instâncias competentes quando cabível?', 'Não foi possível evidenciar o encaminhamento sistemático das denúncias às instâncias competentes para apuração.', false, 'Assegurar que as denúncias recebidas pela Ouvidoria sejam devidamente analisadas e encaminhadas às instâncias competentes, como correição, auditoria ou comitê de ética, quando cabível.'),
  (77, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'Há articulação entre a Ouvidoria e as demais instâncias do sistema de integridade (comitês, auditoria, controle interno, correição)?', 'Não foi evidenciada articulação institucional entre a Ouvidoria e as demais instâncias do sistema de integridade.', false, 'Promover a integração entre a Ouvidoria e as demais instâncias do sistema de integridade, como comitês de integridade, auditoria, controle interno e correição, fortalecendo o tratamento das manifestações recebidas.'),
  (78, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'As informações consolidadas da Ouvidoria são utilizadas para aprimoramento de processos?', 'Não foi evidenciada a utilização estratégica das informações provenientes da Ouvidoria para fins de melhoria da gestão.', false, 'Utilizar as informações consolidadas das manifestações de ouvidoria como insumo para aprimoramento de processos institucionais.'),
  (79, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'As informações consolidadas da Ouvidoria são utilizadas para identificação de riscos?', 'Não foi evidenciada a utilização estratégica das informações provenientes da Ouvidoria para fins de melhoria da gestão.', false, 'Utilizar as informações consolidadas das manifestações de ouvidoria como insumo para aprimoramento de identificação de riscos.'),
  (80, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'As informações consolidadas da Ouvidoria são utilizadas para prevenção de irregularidades?', 'Não foi evidenciada a utilização estratégica das informações provenientes da Ouvidoria para fins de melhoria da gestão.', false, 'Utilizar as informações consolidadas das manifestações de ouvidoria como insumo para prevenção de irregularidades.'),
  (81, 'Governanca', 'DI2026-GOV-08', 'Gestão da Ouvidoria', 8, 'São elaborados relatórios ou painéis periódicos com dados consolidados das manifestações de ouvidoria?', 'Não foram identificados relatórios ou instrumentos de consolidação das informações das manifestações de ouvidoria.', true, 'Elaborar relatórios periódicos ou painéis gerenciais contendo dados consolidados das manifestações recebidas pela Ouvidoria, permitindo análise das demandas e apoio à tomada de decisão da gestão.'),
  (82, 'Governanca', 'DI2026-GOV-09', 'Gestão da Implementação das Auditorias', 9, 'O órgão ou entidade compreende a auditoria governamental como instrumento de avaliação, aprimoramento da gestão e fortalecimento da integridade institucional?', 'Não foi possível evidenciar que a auditoria governamental seja compreendida institucionalmente como instrumento de aprimoramento da gestão e fortalecimento da integridade.', false, 'Promover ações institucionais de sensibilização e orientação voltadas à compreensão do papel da auditoria governamental como instrumento de avaliação, melhoria da gestão pública e fortalecimento dos mecanismos de integridade e controle.'),
  (83, 'Governanca', 'DI2026-GOV-09', 'Gestão da Implementação das Auditorias', 9, 'A alta administração e as unidades envolvidas demonstram postura colaborativa em relação às auditorias realizadas pelos órgãos de controle?', 'Não foi possível evidenciar postura institucional colaborativa ou sistemática no atendimento às auditorias realizadas pelos órgãos de controle.', false, 'Fortalecer a cooperação institucional com os órgãos de controle, assegurando postura colaborativa das unidades administrativas e da alta administração no fornecimento de informações, documentos e esclarecimentos necessários às auditorias.'),
  (84, 'Governanca', 'DI2026-GOV-09', 'Gestão da Implementação das Auditorias', 9, 'O órgão ou entidade presta, de forma tempestiva e adequada, as informações e documentos solicitados pelos órgãos de controle no âmbito de auditorias e demais trabalhos de fiscalização?', 'Não foi possível evidenciar que o atendimento às demandas dos órgãos de controle ocorra de forma tempestiva e adequada.', false, 'Estabelecer procedimentos internos que assegurem o atendimento tempestivo e adequado às solicitações dos órgãos de controle, garantindo a organização das informações e a pronta disponibilização dos documentos solicitados.'),
  (85, 'Governanca', 'DI2026-GOV-09', 'Gestão da Implementação das Auditorias', 9, 'Há responsável ou unidade de trabalho designado para centralizar e coordenar o atendimento às demandas dos órgãos de controle?', 'Não foi evidenciada a existência de responsável ou unidade formalmente designada para coordenar o atendimento às demandas dos órgãos de controle.', true, 'Atribuir à Unidade de Controle interno, conforme Instrução Normativa 002/2022 da Controladoria-Geral do Estado, o papel de centralizar e coordenar o atendimento às demandas dos órgãos de controle, facilitando a comunicação institucional e o acompanhamento das solicitações recebidas.'),
  (86, 'Governanca', 'DI2026-GOV-09', 'Gestão da Implementação das Auditorias', 9, 'O órgão ou entidade recebe formalmente e analisa as recomendações emitidas pelos órgãos de controle?', 'Não foi possível evidenciar procedimento institucional para recebimento e análise formal das recomendações emitidas pelos órgãos de controle.', false, 'Instituir procedimento formal para registro, análise e encaminhamento das recomendações emitidas pelos órgãos de controle, garantindo sua adequada avaliação pela gestão.'),
  (87, 'Governanca', 'DI2026-GOV-09', 'Gestão da Implementação das Auditorias', 9, 'As recomendações recebidas são desdobradas em ações corretivas ou de melhoria, com definição de responsáveis e prazos?', 'Não foram identificados mecanismos estruturados para desdobramento das recomendações de auditoria em ações corretivas ou de melhoria.', true, 'Estabelecer mecanismos de gestão das recomendações de auditoria, com definição de ações corretivas, responsáveis pela implementação e prazos para cumprimento.'),
  (88, 'Governanca', 'DI2026-GOV-09', 'Gestão da Implementação das Auditorias', 9, 'O órgão ou entidade elabora planos de ação para implementação das recomendações de auditoria, quando aplicável?', 'Não foi possível evidenciar a elaboração de planos de ação destinados à implementação das recomendações de auditoria.', true, 'Elaborar planos de ação para implementação das recomendações emitidas pelos órgãos de controle, contendo descrição das medidas a serem adotadas, responsáveis e prazos para execução.'),
  (89, 'Governanca', 'DI2026-GOV-09', 'Gestão da Implementação das Auditorias', 9, 'Há acompanhamento sistemático da implementação das recomendações emitidas pelos órgãos de controle?', 'Não foi evidenciado acompanhamento sistemático da implementação das recomendações de auditoria.', true, 'Instituir rotina de monitoramento da implementação das recomendações de auditoria, permitindo o acompanhamento das ações adotadas e a verificação do cumprimento dos prazos estabelecidos.'),
  (90, 'Governanca', 'DI2026-GOV-09', 'Gestão da Implementação das Auditorias', 9, 'O status de implementação das recomendações é periodicamente atualizado e comunicado aos órgãos de controle, quando solicitado?', 'Não foi possível evidenciar atualização periódica ou comunicação sistemática do status de implementação das recomendações aos órgãos de controle.', true, 'Manter controle atualizado sobre o status de implementação das recomendações de auditoria e comunicar essas informações aos órgãos de controle sempre que solicitado.'),
  (91, 'Governanca', 'DI2026-GOV-09', 'Gestão da Implementação das Auditorias', 9, 'As recomendações de auditoria são utilizadas como insumo para aprimoramento de processos, controles internos, gestão de riscos ou ações de integridade?', 'Não foi evidenciada a utilização sistemática das recomendações de auditoria como insumo para aprimoramento dos processos institucionais.', false, 'Utilizar as recomendações de auditoria como instrumento de melhoria da gestão, incorporando as fragilidades identificadas nos processos institucionais, na gestão de riscos, nos controles internos e nas ações de integridade.'),
  (92, 'Governanca', 'DI2026-GOV-09', 'Gestão da Implementação das Auditorias', 9, 'As fragilidades apontadas em auditorias ou análises de prestação de contas são consideradas no planejamento de ações corretivas e preventivas?', 'Não foi possível evidenciar que as fragilidades identificadas em auditorias sejam consideradas de forma estruturada no planejamento institucional.', false, 'Incorporar as fragilidades apontadas em auditorias ou análises de prestação de contas no planejamento de ações corretivas e preventivas, contribuindo para o aprimoramento contínuo da gestão institucional.'),
  (93, 'Governanca', 'DI2026-GOV-09', 'Gestão da Implementação das Auditorias', 9, 'O órgão ou entidade mantém registro organizado das auditorias realizadas pelos órgãos de controle e das respectivas recomendações recebidas?', 'Não foi possível evidenciar a existência de registro organizado e sistematizado das auditorias realizadas pelos órgãos de controle e das recomendações delas decorrentes.', true, 'Instituir mecanismo institucional de registro e organização das auditorias realizadas pelos órgãos de controle e das respectivas recomendações recebidas. Esse registro pode ser mantido por meio de planilha, sistema ou outro instrumento gerencial que permita acompanhar as recomendações emitidas, os responsáveis pelas ações corretivas e o status de implementação.'),
  (94, 'Governanca', 'DI2026-GOV-09', 'Gestão da Implementação das Auditorias', 9, 'As lições aprendidas a partir das auditorias e recomendações são disseminadas internamente para prevenir a recorrência de falhas?', 'Não foi possível evidenciar a disseminação institucional das lições aprendidas a partir das auditorias realizadas e das recomendações emitidas pelos órgãos de controle.', false, 'Promover a disseminação interna das lições aprendidas decorrentes das auditorias e recomendações dos órgãos de controle, por meio de comunicações institucionais, orientações internas, capacitações ou reuniões com as unidades envolvidas, de modo a fortalecer o aprendizado institucional e prevenir a recorrência de falhas administrativas.'),
  (95, 'Ambiental', 'DI2026-AMB-01', 'Governança e Institucionalização do Compliance Ambiental', 1, 'Há responsável(is), unidade ou instância formalmente designada para coordenar as ações ambientais e de compliance ambiental no órgão ou entidade?', 'Não foi evidenciada a existência de responsável, unidade administrativa ou instância formalmente designada para coordenar as ações ambientais e de compliance ambiental no âmbito do órgão ou entidade.', true, 'Designar formalmente responsável, unidade administrativa ou instância institucional encarregada de coordenar as ações ambientais e de compliance ambiental, definindo suas atribuições e responsabilidades no âmbito da gestão ambiental institucional, conforme disposições da Instrução Normativa Nº 1, de 24 de março de 2025.'),
  (96, 'Ambiental', 'DI2026-AMB-02', 'Adoção da Agenda Ambiental na Administração Pública (A3P)', 2, 'O órgão ou entidade aderiu formalmente à Agenda Ambiental na Administração Pública (A3P)?', 'Não foi evidenciada a adesão formal do órgão ou entidade à Agenda Ambiental na Administração Pública (A3P).', true, 'Avaliar a adesão formal à Agenda Ambiental na Administração Pública (A3P), iniciativa do Governo Federal que orienta a implementação de práticas sustentáveis na gestão pública, contribuindo para a racionalização do uso de recursos naturais, melhoria da gestão ambiental institucional e fortalecimento da sustentabilidade no setor público.'),
  (97, 'Ambiental', 'DI2026-AMB-03', 'Planejamento e Execução das Ações Ambientais (A3P)', 3, 'O órgão ou entidade possui plano, cronograma ou conjunto estruturado de ações para a execução da A3P ou de práticas ambientais institucionais?', 'Não foi evidenciada a existência de plano, cronograma ou conjunto estruturado de ações voltadas à execução da Agenda Ambiental na Administração Pública (A3P) ou de outras práticas ambientais institucionais.', true, 'Elaborar plano, cronograma ou instrumento equivalente que organize e estruture as ações ambientais institucionais, definindo objetivos, iniciativas prioritárias, responsáveis e prazos para implementação das práticas de sustentabilidade alinhadas à A3P ou a diretrizes equivalentes de gestão ambiental.'),
  (98, 'Ambiental', 'DI2026-AMB-03', 'Planejamento e Execução das Ações Ambientais (A3P)', 3, 'As ações ambientais estão integradas ao planejamento institucional ou a outros instrumentos de gestão?', 'Não foi possível evidenciar que as ações ambientais estejam integradas aos instrumentos de planejamento institucional ou a outros mecanismos de gestão do órgão ou entidade.', false, 'Integrar as ações ambientais aos instrumentos de planejamento institucional, como planejamento estratégico, planos de ação, programas institucionais por outros instrumentos de gestão, de forma a fortalecer a institucionalização das práticas de sustentabilidade no âmbito da organização.'),
  (99, 'Ambiental', 'DI2026-AMB-03', 'Planejamento e Execução das Ações Ambientais (A3P)', 3, 'O órgão ou entidade executa ações alinhadas aos eixos da A3P (ex.: uso racional de recursos, gestão de resíduos, compras sustentáveis, qualidade de vida no trabalho e sensibilização)?', 'Não foi evidenciada a execução estruturada de ações alinhadas aos eixos da Agenda Ambiental na Administração Pública (A3P), como uso racional de recursos naturais, gestão de resíduos, compras sustentáveis, promoção da qualidade de vida no trabalho e ações de sensibilização ambiental.', false, 'Implementar ações práticas alinhadas aos eixos da A3P, incluindo iniciativas voltadas ao uso eficiente de recursos (água, energia, papel), gestão adequada de resíduos, adoção de critérios de sustentabilidade nas contratações públicas e desenvolvimento de ações de sensibilização ambiental.'),
  (100, 'Ambiental', 'DI2026-AMB-03', 'Planejamento e Execução das Ações Ambientais (A3P)', 3, 'São adotadas práticas para assegurar a conformidade ambiental nas atividades administrativas, operacionais ou contratações, quando aplicável?', 'Não foi possível evidenciar a adoção de práticas institucionais voltadas à garantia da conformidade ambiental nas atividades administrativas, operacionais ou nos processos de contratação do órgão ou entidade.', false, 'Adotar práticas e procedimentos que assegurem a conformidade ambiental nas atividades institucionais, incluindo a incorporação de critérios ambientais em processos de contratação e a adoção de controles internos voltados à mitigação de riscos ambientais.'),
  (101, 'Ambiental', 'DI2026-AMB-04', 'Monitoramento, Avaliação e Melhoria Contínua', 4, 'As ações ambientais e da A3P são monitoradas e avaliadas periodicamente quanto à sua execução e resultados?', 'Não foi evidenciado o monitoramento e a avaliação periódica das ações ambientais e da A3P quanto à sua execução e resultados, o que pode comprometer a mensuração da efetividade das iniciativas implementadas.', false, 'Instituir mecanismos de monitoramento e avaliação das ações ambientais, com definição de indicadores, metas e instrumentos de acompanhamento que permitam avaliar a execução e os resultados das iniciativas de sustentabilidade adotadas pelo órgão ou entidade.'),
  (102, 'Ambiental', 'DI2026-AMB-05', 'Capacitação, Comunicação e Cultura Ambiental', 5, 'As ações ambientais e da A3P são divulgadas internamente para estimular o engajamento dos servidores, empregados públicos e colaboradores?', 'Não foi evidenciada a divulgação interna das ações ambientais e da A3P com vistas a estimular o engajamento dos servidores, empregados públicos e colaboradores.', true, 'Promover a divulgação interna das ações ambientais por meio de campanhas institucionais, comunicados, eventos ou capacitações, com o objetivo de estimular o engajamento dos servidores, empregados públicos e colaboradores na adoção de práticas sustentáveis.'),
  (103, 'Ambiental', 'DI2026-AMB-06', 'Identificação e Gestão de Riscos Ambientais', 6, 'O órgão ou entidade identifica riscos e impactos ambientais relacionados às suas atividades, processos ou contratações?', 'Não foi evidenciada a identificação sistemática de riscos e impactos ambientais relacionados às atividades, processos ou contratações do órgão ou entidade.', false, 'Realizar a identificação de riscos e impactos ambientais associados às atividades institucionais, processos e contratações, incorporando essa análise à gestão de riscos organizacional.'),
  (104, 'Ambiental', 'DI2026-AMB-06', 'Identificação e Gestão de Riscos Ambientais', 6, 'Os riscos ambientais identificados são considerados no gerenciamento de riscos institucional e nas decisões de gestão?', 'Não foi possível evidenciar que os riscos ambientais identificados sejam considerados de forma estruturada no gerenciamento de riscos institucional ou nas decisões de gestão.', false, 'Incorporar os riscos ambientais ao processo de gerenciamento de riscos institucional, assegurando que sejam considerados na tomada de decisão e no planejamento das ações organizacionais.'),
  (105, 'Ambiental', 'DI2026-AMB-06', 'Identificação e Gestão de Riscos Ambientais', 6, 'São utilizados indicadores, registros ou relatórios para acompanhar o desempenho ambiental do órgão ou entidade?', 'Não foi evidenciada a utilização de indicadores, registros ou relatórios para acompanhamento do desempenho ambiental institucional.', true, 'Estabelecer indicadores e instrumentos de acompanhamento do desempenho ambiental, como relatórios, painéis ou registros sistemáticos, permitindo o monitoramento contínuo das ações e resultados ambientais.'),
  (106, 'Ambiental', 'DI2026-AMB-07', 'Integração do ambiental com Integridade e Governança', 7, 'As ações ambientais estão integradas às ações de integridade, gestão de riscos, controles internos ou governança do órgão ou entidade?', 'Não foi evidenciada a integração das ações ambientais com os mecanismos de integridade, gestão de riscos, controles internos ou governança institucional.', false, 'Integrar as ações ambientais aos instrumentos de governança, integridade, gestão de riscos e controles internos, assegurando abordagem sistêmica e alinhada às diretrizes do Programa de Integridade e Compliance.'),
  (107, 'Ambiental', 'DI2026-AMB-07', 'Integração do ambiental com Integridade e Governança', 7, 'O órgão ou entidade promove ações de capacitação, treinamento ou sensibilização em temas ambientais ou de sustentabilidade?', 'Não foi evidenciada a realização de ações de capacitação, treinamento ou sensibilização em temas ambientais ou de sustentabilidade no âmbito do órgão ou entidade.', false, 'Promover ações de capacitação, treinamento e sensibilização voltadas à temática ambiental, contribuindo para o fortalecimento da cultura organizacional voltada à sustentabilidade e ao compliance ambiental.'),
  (108, 'Social', 'DI2026-SOC-01', 'Qualidade de Vida e Saúde no Trabalho', 1, 'O órgão ou entidade instituiu formalmente Comissão Executiva Local de Qualidade de Vida (CEL) para a implementação de programa de qualidade de vida interno?', 'Não foi evidenciada a instituição formal de Comissão Executiva Local de Qualidade de Vida (CEL), o que pode comprometer a coordenação e execução estruturada das ações de qualidade de vida no trabalho.', true, 'Instituir formalmente Comissão Executiva Local de Qualidade de Vida (CEL), com definição clara de competências, composição e responsabilidades, assegurando a coordenação das ações voltadas ao bem-estar dos servidores, observadas as disposições da Instrução Normativa Nº 2, de 30 de junho de 2025, da Controladoria-Geral do Estado.'),
  (109, 'Social', 'DI2026-SOC-01', 'Qualidade de Vida e Saúde no Trabalho', 1, 'O órgão ou entidade realizou diagnóstico interno para subsidiar a definição e a execução das ações de Qualidade de Vida e Saúde no Trabalho?', 'Não foi evidenciado diagnóstico institucional que subsidie a definição das ações de qualidade de vida e saúde no trabalho.', true, 'Realizar diagnóstico interno para identificar necessidades, riscos e oportunidades relacionadas à qualidade de vida e saúde no trabalho, subsidiando o planejamento das ações institucionais.'),
  (110, 'Social', 'DI2026-SOC-01', 'Qualidade de Vida e Saúde no Trabalho', 1, 'As ações de Qualidade de Vida e Saúde no Trabalho promovidas no âmbito do órgão ou entidade são formalmente registradas (relatórios, atas, registros ou instrumentos equivalentes)?', 'Não foi evidenciado registro formal das ações de qualidade de vida e saúde no trabalho.', true, 'Instituir mecanismos de registro formal das ações realizadas, por meio de relatórios, atas ou instrumentos equivalentes, assegurando rastreabilidade e memória institucional.'),
  (111, 'Social', 'DI2026-SOC-01', 'Qualidade de Vida e Saúde no Trabalho', 1, 'O órgão ou entidade possui indicador(es) formalmente instituído(s) para acompanhamento da Qualidade de Vida e Saúde no Trabalho?', 'Não foi evidenciada a existência de indicadores formalmente instituídos para acompanhamento das ações de qualidade de vida e saúde no trabalho.', true, 'Estabelecer indicadores para monitoramento das ações de qualidade de vida, permitindo avaliar resultados, orientar decisões e promover melhoria contínua.'),
  (112, 'Social', 'DI2026-SOC-01', 'Qualidade de Vida e Saúde no Trabalho', 1, 'O órgão ou entidade possui plano, diretrizes ou fluxos definidos para prevenção e enfrentamento ao assédio moral, sexual e outras formas de violência no ambiente de trabalho?', 'Não foi evidenciada a existência de planejamento ou fluxos institucionais voltados à prevenção e enfrentamento ao assédio e outras formas de violência.', true, 'Elaborar e instituir plano, diretrizes ou fluxos formais para prevenção e enfrentamento ao assédio moral, sexual e outras formas de violência, assegurando abordagem estruturada e preventiva, em observância às disposições contidas na Lei Estadual Nº 11.902, de 10 de setembro DE 2024.'),
  (113, 'Social', 'DI2026-SOC-01', 'Qualidade de Vida e Saúde no Trabalho', 1, 'Existem canais e procedimentos para acolhimento, registro e encaminhamento de denúncias relacionadas a assédio ou violência?', 'Não foi evidenciada a existência de canais e procedimentos estruturados para acolhimento e tratamento de denúncias relacionadas a assédio ou violência.', false, 'Instituir canais seguros e procedimentos formais para acolhimento, registro e encaminhamento de denúncias, garantindo confidencialidade, proteção ao denunciante e tratamento adequado das demandas.'),
  (114, 'Social', 'DI2026-SOC-02', 'Políticas Afirmativas, Diversidade e Inclusão', 2, 'O órgão ou entidade adota políticas ou práticas voltadas à promoção da diversidade, inclusão e igualdade de oportunidades?', 'Não foi evidenciada a adoção estruturada de políticas ou práticas voltadas à promoção da diversidade, inclusão e igualdade de oportunidades.', true, 'Instituir políticas e práticas voltadas à diversidade, inclusão e igualdade de oportunidades, promovendo ambiente organizacional mais equitativo e alinhado às diretrizes de compliance social.'),
  (115, 'Social', 'DI2026-SOC-02', 'Políticas Afirmativas, Diversidade e Inclusão', 2, 'O órgão ou entidade observa e monitora o cumprimento das políticas afirmativas e cotas sociais nos seus processos e contratações, quando aplicável?', 'Não foi evidenciado monitoramento do cumprimento de políticas afirmativas e cotas sociais nos processos institucionais e contratações.', false, 'Implementar mecanismos de controle e monitoramento do cumprimento das políticas afirmativas e cotas sociais, especialmente em contratações públicas e processos institucionais.'),
  (116, 'Social', 'DI2026-SOC-03', 'Equidade de Gênero e Raça', 3, 'O órgão ou entidade adota medidas para promover a equidade de gênero e raça, inclusive em funções de confiança e posições de decisão?', 'Não foi evidenciada a adoção de medidas institucionais voltadas à promoção da equidade de gênero e raça.', true, 'Implementar ações e políticas voltadas à promoção da equidade de gênero e raça, inclusive no acesso a funções de liderança e decisão.'),
  (117, 'Social', 'DI2026-SOC-03', 'Equidade de Gênero e Raça', 3, 'São produzidas ou acompanhadas informações e indicadores sobre a participação de mulheres e grupos racialmente minorizados em funções de liderança?', 'Não foi evidenciada a produção ou acompanhamento de indicadores sobre a participação de grupos minorizados em posições de liderança.', true, 'Instituir indicadores e mecanismos de monitoramento da participação de mulheres e grupos racialmente minorizados em funções de liderança, subsidiando ações de equidade.'),
  (118, 'Social', 'DI2026-SOC-04', 'Compliance Trabalhista nas Contratações', 4, 'O órgão ou entidade inclui exigências relacionadas à integridade e ao compliance trabalhista nos instrumentos de contratação?', 'Não foi evidenciada a inclusão de exigências de compliance trabalhista nos instrumentos de contratação.', true, 'Incluir requisitos de integridade e compliance trabalhista em termos de referência, editais e contratos de terceirização, observadas as disposições da Instrução Normativa Nº 3, de 02 de julho de 2024, da Controladoria-Geral do Estado.'),
  (119, 'Social', 'DI2026-SOC-04', 'Compliance Trabalhista nas Contratações', 4, 'São inseridas cláusulas contratuais que preveem a obrigatoriedade de programas de compliance trabalhista pelas empresas contratadas?', 'Não foi evidenciada a exigência contratual de programas de compliance trabalhista pelas empresas contratadas.', false, 'Inserir cláusulas contratuais que exijam a implementação de programas de compliance trabalhista pelas contratadas.'),
  (120, 'Social', 'DI2026-SOC-04', 'Compliance Trabalhista nas Contratações', 4, 'O órgão ou entidade aplica formulário de due diligence trabalhista às empresas contratadas?', 'Não foi evidenciada a aplicação de due diligence trabalhista nas contratações.', true, 'Instituir a aplicação de due diligence trabalhista previamente à contratação e nas prorrogações contratuais, conforme Instrução Normativa Nº 21, de 12 de dezembro de 2024.'),
  (121, 'Social', 'DI2026-SOC-04', 'Compliance Trabalhista nas Contratações', 4, 'O formulário de due diligence trabalhista é exigido previamente à assinatura do contrato e nas prorrogações contratuais?', 'Não foi evidenciado o uso sistemático da due diligence trabalhista em todas as fases contratuais.', true, 'Assegurar a aplicação da due diligence trabalhista antes da contratação e nas prorrogações.'),
  (122, 'Social', 'DI2026-SOC-04', 'Compliance Trabalhista nas Contratações', 4, 'Havendo inconformidades trabalhistas identificadas, são definidas e acompanhadas ações corretivas junto à empresa contratada?', 'Não foi evidenciado o tratamento estruturado de inconformidades trabalhistas.', true, 'Instituir procedimentos para definição e acompanhamento de ações corretivas junto às empresas contratadas.'),
  (123, 'Social', 'DI2026-SOC-04', 'Compliance Trabalhista nas Contratações', 4, 'O órgão ou entidade estabelece prazos e acompanha a implementação das medidas corretivas?', 'Não foi evidenciado o acompanhamento sistemático das medidas corretivas.', true, 'Estabelecer prazos e monitorar a implementação das ações corretivas pelas empresas contratadas.'),
  (124, 'Social', 'DI2026-SOC-05', 'Capacitação, Comunicação e Cultura Social', 5, 'O órgão ou entidade promove ações de capacitação ou sensibilização em temas de compliance social?', 'Não foi evidenciada a promoção de ações de capacitação em temas de compliance social.', true, 'Promover capacitações e ações de sensibilização em temas como diversidade, equidade, trabalho digno e qualidade de vida.'),
  (125, 'Social', 'DI2026-SOC-05', 'Capacitação, Comunicação e Cultura Social', 5, 'As ações e políticas de compliance social são divulgadas internamente?', 'Não foi evidenciada a divulgação interna das ações de compliance social.', false, 'Recomenda-se fortalecer a comunicação interna das ações e políticas de compliance social para promover engajamento institucional.'),
  (126, 'Social', 'DI2026-SOC-06', 'Integração do social com Integridade e Governança', 6, 'As ações de compliance social estão integradas às ações de integridade, gestão de riscos, controles internos e governança do órgão ou entidade?', 'Não foi evidenciada a integração das ações de compliance social com os mecanismos de governança e integridade institucional.', false, 'Integrar as ações de compliance social aos instrumentos de governança, gestão de riscos, controles internos e integridade, assegurando abordagem sistêmica e alinhada ao PIC.');

-- Evita reutilizar silenciosamente um código DI2026-* que pertença a outra seção.
  if exists (
    select 1
    from (
      select distinct on (section_code)
        section_code,
        axis_name,
        section_name,
        section_order
      from diagnostico_integridade_2026_source
      order by section_code, source_order
    ) source_section
    join public.sections section_row
      on section_row.code = source_section.section_code
    join public.axes axis_row
      on axis_row.id = section_row.axis_id
    where section_row.name is distinct from source_section.section_name
       or axis_row.name is distinct from source_section.axis_name
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'import_diagnostico_integridade_2026_section_code_conflict',
      hint = 'Um código DI2026-* existente aponta para uma seção ou eixo diferente. Corrija a colisão antes de reaplicar.';
  end if;

insert into public.sections (
  axis_id,
  code,
  name,
  ordem,
  status,
  created_by,
  updated_by
)
select
  axis_row.id,
  source_section.section_code,
  source_section.section_name,
  source_section.section_order,
  'draft'::public.library_item_status,
  context.admin_user_id,
  context.admin_user_id
from (
  select distinct on (section_code)
    section_code,
    axis_name,
    section_name,
    section_order
  from diagnostico_integridade_2026_source
  order by section_code, source_order
) source_section
join public.axes axis_row
  on axis_row.name = source_section.axis_name
cross join diagnostico_integridade_2026_context context
on conflict (code) do nothing;

-- O nome é a identidade humana do formulário. Nunca injete conteúdo em uma versão
-- já publicada, pois isso quebraria o contrato de snapshots imutáveis.
  if exists (
    select 1
    from public.forms
    where name = 'Diagnóstico de Integridade 2026'
      and current_form_version_id is not null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'import_diagnostico_integridade_2026_form_already_published',
      hint = 'A importação só pode preencher um rascunho. Crie um novo formulário para uma nova edição.';
  end if;

insert into public.forms (name, created_by)
select 'Diagnóstico de Integridade 2026', context.admin_user_id
from diagnostico_integridade_2026_context context
where not exists (
  select 1
  from public.forms
  where name = 'Diagnóstico de Integridade 2026'
);

update diagnostico_integridade_2026_context context
set form_id = form_row.id
from public.forms form_row
where form_row.name = 'Diagnóstico de Integridade 2026';

insert into public.form_drafts (form_id)
select form_id
from diagnostico_integridade_2026_context
on conflict (form_id) do nothing;

update diagnostico_integridade_2026_context context
set form_draft_id = draft_row.id
from public.form_drafts draft_row
where draft_row.form_id = context.form_id;

  if exists (
    select 1
    from diagnostico_integridade_2026_context
    where form_id is null or form_draft_id is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'import_diagnostico_integridade_2026_form_draft_not_resolved';
  end if;

-- Impede misturar os 126 critérios importados com conteúdo manual já existente
-- em um rascunho homônimo.
  if exists (
    select 1
    from diagnostico_integridade_2026_context context
    join public.form_draft_questions draft_question
      on draft_question.form_draft_id = context.form_draft_id
    join public.questions question_row
      on question_row.id = draft_question.question_id
    join public.sections section_row
      on section_row.id = question_row.section_id
    left join diagnostico_integridade_2026_source source_row
      on source_row.section_code = section_row.code
     and source_row.prompt = question_row.prompt
    where source_row.source_order is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'import_diagnostico_integridade_2026_draft_contains_foreign_questions',
      hint = 'O rascunho de mesmo nome contém critérios que não pertencem à planilha de 2026.';
  end if;

-- Cria somente os critérios que ainda não estão vinculados ao rascunho alvo.
insert into public.questions (
  section_id,
  prompt,
  evidence_parameter,
  fami_enabled,
  applies_to_respondent,
  allows_not_applicable
)
select
  section_row.id,
  source_row.prompt,
  jsonb_build_object('required', source_row.requires_evidence),
  true,
  true,
  source_row.requires_evidence
from diagnostico_integridade_2026_source source_row
join public.sections section_row
  on section_row.code = source_row.section_code
cross join diagnostico_integridade_2026_context context
where not exists (
  select 1
  from public.form_draft_questions draft_question
  join public.questions question_row
    on question_row.id = draft_question.question_id
  where draft_question.form_draft_id = context.form_draft_id
    and question_row.section_id = section_row.id
    and question_row.prompt = source_row.prompt
);

insert into public.form_draft_questions (
  form_draft_id,
  question_id,
  order_index
)
select
  context.form_draft_id,
  question_row.id,
  source_row.source_order - 1
from diagnostico_integridade_2026_source source_row
join public.sections section_row
  on section_row.code = source_row.section_code
join public.questions question_row
  on question_row.section_id = section_row.id
 and question_row.prompt = source_row.prompt
cross join diagnostico_integridade_2026_context context
on conflict (form_draft_id, question_id) do nothing;

-- Preserva todo o conteúdo da planilha em campos que já existem no contrato de
-- vínculos editoriais por critério:
--   ACHADO        → metric.description
--   COMPROVAÇÃO   → questions.evidence_parameter.required
--   RECOMENDAÇÃO  → bindings.defaultRecommendation.textoBaseFixo
--
-- `answerType = yes_no` reproduz a resposta esperada pelo diagnóstico.
insert into public.question_library_binding (
  question_id,
  metric,
  bindings,
  response_mapping,
  coverage_score,
  updated_by
)
select
  question_row.id,
  jsonb_build_object(
    'name', 'Conformidade do critério',
    'description', source_row.finding,
    'answerType', 'yes_no',
    'interpretation', 'qualitative'
  ),
  jsonb_build_object(
    'defaultRecommendation',
    jsonb_build_object(
      'title', 'Recomendação para: ' || source_row.prompt,
      'textoBaseFixo', source_row.recommendation_text
    )
  ),
  '{}'::jsonb,
  100,
  context.admin_user_id
from diagnostico_integridade_2026_source source_row
join public.sections section_row
  on section_row.code = source_row.section_code
join public.questions question_row
  on question_row.section_id = section_row.id
 and question_row.prompt = source_row.prompt
join public.form_draft_questions draft_question
  on draft_question.question_id = question_row.id
cross join diagnostico_integridade_2026_context context
where draft_question.form_draft_id = context.form_draft_id
on conflict (question_id) do nothing;

-- Valida a importação e também acusa conflito editorial em vez de encobri-lo.
  select count(*) into v_expected_count
  from diagnostico_integridade_2026_source;

  select count(*) into v_linked_count
  from diagnostico_integridade_2026_source source_row
  join public.sections section_row
    on section_row.code = source_row.section_code
  join public.questions question_row
    on question_row.section_id = section_row.id
   and question_row.prompt = source_row.prompt
  join public.form_draft_questions draft_question
    on draft_question.question_id = question_row.id
  join diagnostico_integridade_2026_context context
    on context.form_draft_id = draft_question.form_draft_id;

  if v_linked_count <> v_expected_count then
    raise exception using
      errcode = 'P0001',
      message = format(
        'import_diagnostico_integridade_2026_incomplete: esperados %s critérios vinculados, encontrados %s.',
        v_expected_count,
        v_linked_count
      );
  end if;

  if exists (
    select 1
    from diagnostico_integridade_2026_source source_row
    join public.sections section_row
      on section_row.code = source_row.section_code
    join public.questions question_row
      on question_row.section_id = section_row.id
     and question_row.prompt = source_row.prompt
    join public.form_draft_questions draft_question
      on draft_question.question_id = question_row.id
    join diagnostico_integridade_2026_context context
      on context.form_draft_id = draft_question.form_draft_id
    where coalesce((question_row.evidence_parameter ->> 'required')::boolean, false)
          is distinct from source_row.requires_evidence
       or question_row.fami_enabled is distinct from true
       or question_row.applies_to_respondent is distinct from true
       or question_row.allows_not_applicable is distinct from source_row.requires_evidence
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'import_diagnostico_integridade_2026_question_contract_conflict',
      hint = 'Um critério existente no rascunho tem comprovação ou flags divergentes da planilha.';
  end if;

  if exists (
    select 1
    from diagnostico_integridade_2026_source source_row
    join public.sections section_row
      on section_row.code = source_row.section_code
    join public.questions question_row
      on question_row.section_id = section_row.id
     and question_row.prompt = source_row.prompt
    join public.form_draft_questions draft_question
      on draft_question.question_id = question_row.id
    join public.question_library_binding binding_row
      on binding_row.question_id = question_row.id
    join diagnostico_integridade_2026_context context
      on context.form_draft_id = draft_question.form_draft_id
    where binding_row.metric ->> 'description' is distinct from source_row.finding
       or binding_row.metric ->> 'answerType' is distinct from 'yes_no'
       or binding_row.bindings #>> '{defaultRecommendation,textoBaseFixo}'
          is distinct from source_row.recommendation_text
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'import_diagnostico_integridade_2026_editorial_binding_conflict',
      hint = 'Um vínculo editorial existente diverge do achado ou da recomendação-base da planilha.';
  end if;

  raise notice
    'Diagnóstico de Integridade 2026 importado: % critérios em rascunho, prontos para revisão e publicação.',
    v_expected_count;

  select form_id, form_draft_id
    into v_form_id, v_form_draft_id
  from diagnostico_integridade_2026_context;

  select count(*)
    into v_question_count
  from public.form_draft_questions
  where form_draft_id = v_form_draft_id;

  return jsonb_build_object(
    'formId', v_form_id,
    'formDraftId', v_form_draft_id,
    'questionCount', v_question_count,
    'status', 'ready_for_review'
  );
end;
$bootstrap$;

revoke all on function public.bootstrap_diagnostico_integridade_2026(uuid) from public;
grant execute on function public.bootstrap_diagnostico_integridade_2026(uuid) to service_role;
