# Plano de implementação

## Entregas implementadas

- Monorepo e ambientes locais.
- Banco MySQL com modelo relacional inicial.
- Health checks, CRUD de veículos e contrato de risco de evasão.
- Interfaces web e móvel responsivas.
- Autenticação JWT, RBAC e gestão de concessionárias e equipes.
- Transferência auditável de propriedade, serviços, pontos e vouchers.
- Campanhas, notificações, recalls, agendamentos e oportunidades de recompra.
- Consentimentos, solicitações do titular e exportação LGPD.
- Expediente e capacidade da oficina com validação de conflito na API.
- Exportação CSV do painel administrativo.
- Central de suporte persistente, com escopo por usuário e concessionária.
- Convites seguros, recuperação de senha, bloqueio de tentativas e revogação
  imediata das sessões JWT.
- Access token de curta duração, refresh token rotativo em cookie HttpOnly e
  gestão dos dispositivos conectados.
- Infraestrutura de comunicação transacional: fila persistida em banco (com
  retentativas e backoff exponencial), templates de e-mail para convites e
  recuperação de senha, e rastreamento de entrega por mensagem (tentativas,
  erros e eventos). Canais SMS e push já mapeados no modelo de dados, com
  provedor simulado até a integração real (ver próximas entregas).
- Banco local migrado de MyISAM para InnoDB em todas as tabelas, com as 38
  foreign keys do schema aplicadas de fato (ver `docs/security-lgpd.md`).
  `$transaction` agora é atômico de verdade.
- Corrigida a perda de sessão ao recarregar o painel web: `apps/web/vite.config.ts`
  agora faz proxy de `/api/v1` para a API, eliminando o cross-site entre
  `localhost:5173` e `127.0.0.1:3000` que bloqueava o cookie de refresh
  (`SameSite=Lax`). F5, links diretos e e-mails de convite/recuperação agora
  mantêm a sessão.
- Guarda de rota por perfil no painel web (`RequireRoles`): `/ford-admin`,
  `/clientes`, `/servicos`, `/campanhas` e `/recompra` redirecionam para "/"
  se o usuário autenticado não tiver o perfil adequado, em vez de renderizar
  uma casca de tela vazia. A API já bloqueava os dados (403); isso fecha a
  inconsistência visual.
- Previsão de risco de evasão conectada de ponta a ponta: novos endpoints
  `GET /predictions/vehicles/:vin/churn` e `GET /predictions/customers/churn`
  calculam as features reais (dias desde o serviço, serviços em 24 meses,
  idade do veículo, uso de vouchers) e chamam o serviço de ML (com fallback
  local se ele estiver fora do ar). A ficha do veículo e a lista de clientes
  no painel usavam um número fixo por faixa (92/78/55/18); agora mostram o
  valor real e informam a origem (modelo de ML ou estimativa local).
- Dados decorativos removidos do Ford Admin: os três selos fixos do mapa
  (71%/69%/65%, copiados do mockup) agora usam a retenção real das
  concessionárias, e o seletor "Brasil" (sem função) virou um rótulo estático.
- Cartões de Configurações sem função ("Regras de pontos", "Notificações",
  "Integrações") agora mostram "Em breve" em vez de simular um link morto;
  "Concessionária", "Equipe e permissões" e "Privacidade e LGPD" viraram
  âncoras reais para as seções correspondentes na mesma página.
- App mobile: sessão persistida com `expo-secure-store` (sobrevive a
  fechar/reabrir o app) e expiração tratada explicitamente (401 limpa a
  sessão e volta ao login com aviso, em vez de travar); adicionado botão de
  sair. A sessão nativa usa access token curto e refresh token rotativo; somente
  o refresh é persistido no SecureStore. Reuso e revogação são cobertos por
  regressão local. O fluxo ainda não foi testado em dispositivo/emulador real.

- Base de demonstração de nível corporativo: 3 concessionárias (SP/PR/MG), 12
  clientes distribuídos nas quatro faixas de risco, 24 meses de histórico de
  serviços, agenda do dia corrente, 3 campanhas com conversão real, 2 recalls,
  funil de recompra e chamados de suporte. Todas as datas são relativas ao dia
  da execução, então a demonstração não envelhece.
- Correções de credibilidade dos indicadores: `retenção` e `VIN Share` passaram
  a medir veículos distintos que voltaram à rede em 12 meses (antes dividiam
  ordens de serviço por veículos e podiam passar de 100%); o gráfico de risco
  virou proporcional aos dados; a conversão estimada e os selos do mapa deixaram
  de ser números fixos; o VIN Share por modelo agrupa por família comercial.
- Interface preparada para apresentação: credenciais e senha pré-preenchida
  removidas da tela de login, menções a ambiente local retiradas, dado mockado
  eliminado do código e concordância verbal corrigida em todos os contadores.
- Concessionária de origem passou a ser retornada na ficha do veículo (o campo
  existia no banco, mas a tela sempre exibia "Não informada").

- App do proprietário com vínculo autônomo por VIN e placa normalizados. A API
  não diferencia veículo inexistente, placa divergente e vínculo ativo de outro
  titular, reduzindo enumeração, mantém auditoria e torna a repetição do próprio
  vínculo idempotente.
- Agenda do app separada entre próximos atendimentos e histórico: somente
  `REQUESTED`/`CONFIRMED` no futuro aparecem como próximos; itens passados,
  concluídos ou cancelados permanecem consultáveis em ordem decrescente.
- Área de ofertas do cliente conectada às campanhas públicas: mostra apenas
  campanhas ativas, vigentes, enviadas e destinadas a um VIN com propriedade
  ativa, e somente quando o consentimento de marketing está concedido.

- Ciclo comercial completo: estoque de veículos, venda com cadastro do cliente
  no ato, início de garantia, entrada do usado na troca (que volta ao estoque
  com o histórico do VIN preservado) e fechamento automático da oportunidade de
  recompra que originou a venda. É o ponto em que a identidade do VIN nasce e
  em que o ciclo "compra → manutenção → fidelização → recompra" se fecha.
- Receita em reais: valor por ordem de serviço, receita de pós-venda e de
  vendas nos últimos 12 meses, ticket médio e valor do estoque. A carteira
  passou a considerar apenas veículos com proprietário ativo — estoque não
  entra em retenção, risco nem VIN Share.

- Cadastro de clientes em tela própria, com os dados exigidos para nota fiscal,
  contrato e emplacamento: CPF validado nos dígitos verificadores e único na
  base, RG, nascimento e endereço com busca por CEP. O campo `cpfHash` (que
  existia no schema, nunca era usado e não serviria para nota fiscal) deu lugar
  ao CPF real, mascarado nas listagens e auditado a cada alteração.
- Corrigida a visibilidade do cliente recém-cadastrado: a unidade que faz o
  cadastro passa a constar em `registeredByDealershipId`. Antes, como o acesso
  derivava apenas de veículo vinculado, o gerente cadastrava um cliente e ele
  desaparecia da lista até a primeira venda.
- Adaptador inicial para piloto: importação idempotente de veículos e ordens de
  serviço com `sourceSystem` + `externalId`, validação por concessionária,
  bloqueio de conflitos de VIN, trilha de auditoria e operação pelo painel em
  Configurações. O contrato está em `docs/pilot-import.md`.
- Jornada de campanha rastreável: o disparo exige conteúdo público, respeita
  consentimento de marketing, cria uma mensagem vinculada ao alvo, registra
  abertura no app e atribui a conversão quando a ordem de serviço é concluída.

## Próximas entregas

1. Integrações reais com DMS/CRM/telemetria e provedores de SMS e push
   (o e-mail já aceita um provedor SMTP real via variáveis de ambiente).
2. Segmentação automática e métricas reais de entrega/conversão de campanhas.
3. Validar o modelo de risco de evasão com dados históricos autorizados e
   representativos. O pipeline acadêmico atual treina e avalia modelos usando
   dados sintéticos; antes da operação real, adicionar monitoramento,
   calibração, avaliação de viés e explicabilidade por versão.
4. LGPD: política automatizada de retenção e execução de exclusão/anônimização.
5. Ampliar testes unitários, integração e E2E; implantar CI/CD, observabilidade,
   alertas e rollback de produção.
6. Resolver os erros de permissão `EPERM` na geração de artefatos estáticos
   neste Windows. A validação visual do painel e do Expo Web foi concluída;
   testes em Android/iOS, acessibilidade nativa, assinatura e lojas continuam
   pendentes. Ver `qa-2026-09-06.md`.

## Revisão de 06/09/2026

- MySQL do WampServer ativo, backup local preservado e 13 migrations aplicadas.
- Configurações agora incluem regras de pontuação persistidas, notificações
  e diagnóstico das integrações. Alteração das regras restrita ao administrador.
- App com renovação de sessão: cookie HttpOnly separado do painel no navegador
  e refresh token em SecureStore no nativo; seleção de veículo e recuperação de acesso.
- Melhorias de identidade visual, formulários, navegação, busca/filtros de OS,
  mensagens de erro e nova tentativa. Mensageria administrativa disponível na web.
- Receita das OS persistida; proteção contra conclusão e resgate duplicados;
  escopo por concessionária reforçado em veículos e fidelidade.
- Cinco scripts de smoke test, nove testes isolados de sessão, quatro testes de
  contrato mobile e oito testes de regressão aprovados nesta revisão.
  Isso não substitui homologação completa, testes nativos ou critérios de produção.

## Dependências externas antes de produção

- **Fornecedores e credenciais:** homologar SMTP, SMS, push, DMS, CRM e
  telemetria, com ambientes de teste, contratos, segredos e SLAs de entrega.
- **Dados e ML:** obter conjunto de dados real com qualidade e base legal;
  treinar, validar, versionar e monitorar o modelo, incluindo drift e
  explicabilidade. O baseline atual não deve orientar decisões automatizadas.
- **Jurídico e segurança:** aprovar DPIA e política LGPD de retenção,
  anonimização/exclusão; concluir revisão de segurança e rotação de segredos.
- **Dispositivos e distribuição:** validar Android/iOS reais e emuladores,
  offline, permissões, deep links, push, acessibilidade, desempenho, assinatura
  e processos das lojas.
- **Operação:** executar testes de carga e restauração, configurar CI/CD,
  observabilidade, alertas, artefatos reproduzíveis e rollback.

## Critérios de pronto para produção

- Segredos fora do repositório e rotação de credenciais.
- Migrações versionadas, backup/restauração testados e observabilidade.
- Testes de autorização por papel e por concessionária.
- DPIA/LGPD revisada com jurídico e segurança.
