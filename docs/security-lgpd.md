# Segurança e LGPD

O ambiente atual possui autenticação JWT, segregação por perfil e
concessionária, auditoria, bloqueio de tentativas, recuperação de senha e
revogação de sessões. Ainda não deve ir a produção sem gestão externa de
segredos, provedor transacional, testes de intrusão e revisão jurídica de
privacidade.

Para a avaliação de Sprint 3, consulte também o [relatório de cibersegurança](sprint-3-cybersecurity.md),
que registra os controles de rate limiting, Helmet/CORS, logs, pipeline de
análise, tratamento seguro de links de convite/reset e os itens ainda
pendentes para uma implantação real.

- **Risco de infraestrutura corrigido (2026-09-03):** as 25 tabelas do banco
  local estavam em `ENGINE=MyISAM` (padrão do WampServer neste ambiente), que
  não aplica `FOREIGN KEY` (a cláusula era aceita e ignorada silenciosamente)
  nem suporta transações reais — todo `prisma.$transaction([...])` usado no
  projeto (login, revogação de sessão, criação de convite, etc.) executava
  como uma sequência de comandos independentes, não atomicamente. Todas as
  tabelas foram convertidas para `ENGINE=InnoDB` e as 38 foreign keys do
  schema foram criadas de fato (nenhum dado foi perdido; `ALTER TABLE ...
  ENGINE=InnoDB` preserva as linhas). O `default_storage_engine` do
  `my.ini` (`c:/wamp64/bin/mysql/mysql9.1.0/my.ini`) também foi trocado para
  `InnoDB`, para que futuras migrations já criem tabelas novas no engine
  correto — essa mudança só entra em vigor após reiniciar o serviço
  `wampmysqld64`.

- O access token expira em 15 minutos e permanece apenas na memória do painel.
  A continuidade da sessão usa um refresh token aleatório, armazenado no navegador apenas em cookie HttpOnly e no banco
  apenas como SHA-256, com rotação a cada uso e validade máxima de 30 dias.
- Cada acesso persistente pertence a uma sessão identificada. Encerrar um
  dispositivo revoga também os access tokens associados a ele.

- VIN, placa e histórico técnico devem ser classificados como dados de negócio; dados que identifiquem o proprietário são pessoais.
- Toda transferência de veículo deve encerrar o vínculo anterior e impedir a exibição de nome, telefone, e-mail e documentos do antigo proprietário.
- Registrar base legal, finalidade, consentimentos opcionais, auditoria e pedidos dos titulares.
- Aplicar menor privilégio por papel e por concessionária. Nunca confiar em `dealershipId` enviado pelo cliente após a autenticação estar disponível.
- Convites e recuperações armazenam o hash do código e expiram em prazo curto.
  O link é enviado sem entrar na fila persistente; eventos e respostas da fila
  omitem o conteúdo. Em caso de falha de envio, a credencial é invalidada. O
  token de desenvolvimento só pode aparecer com `NODE_ENV=development`,
  `EXPOSE_DEVELOPMENT_TOKENS=true` e sem SMTP configurado. Antes de produção,
  sanear registros históricos e backups que possam ter sido gravados pelo fluxo
  anterior, conforme o [relatório de cibersegurança](sprint-3-cybersecurity.md).
