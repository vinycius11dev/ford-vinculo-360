# Operação segura: backup e saneamento

## Estado e limites

- As rotinas WampServer fazem backup local de `ford_vinculo_360` em streaming; o conteúdo SQL é cifrado antes de tocar em disco com AES-256-GCM, chave derivada por scrypt e salt/nonce/tag versionados. Nenhum arquivo SQL em claro é criado.
- A frase secreta é solicitada sem eco no terminal. Ela não é gravada no projeto nem nos manifestos. Guarde-a em um cofre aprovado; perdê-la torna o backup irrecuperável.
- O diretório por backup recebe ACL para o usuário atual, SYSTEM e Administradores. O arquivo cifrado e o manifesto ficam em `backups/`, ignorado pelo Git. A restauração copia somente o arquivo cifrado para um diretório temporário restrito.
- A restauração verifica a tag GCM em uma primeira passagem que descarta os bytes descriptografados. Só depois conecta ao MySQL e descriptografa diretamente para o stdin do cliente; a cópia temporária contém apenas ciphertext e recebe ACL restrita e somente leitura durante o processo.
- Cada restauração cria um banco isolado com nome `ford_vinculo_360_restore_YYYYMMDD_HHMMSS` e falha se o banco já existir. Não conecta nem reconfigura a aplicação.
- `scripts/start-local.ps1` mantém `EXPOSE_DEVELOPMENT_TOKENS=false` por padrão; `-ExposeDevelopmentTokens` é opt-in, avisa o operador e serve apenas a testes manuais locais.
- A rotina **não comprova** cópia fora da máquina, política de retenção, proteção do disco, rotação/escrow da frase secreta ou recuperação após perda do Windows. Isso ainda precisa de cofre corporativo, destino aprovado, responsável e ensaio de recuperação em infraestrutura controlada. Os dumps SQL antigos em claro não são alterados por esses scripts.

## Criar backup cifrado

Execute em um terminal interativo Windows com WampServer e Node instalados:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup-wamp.ps1
```

Informe a senha do usuário MySQL local e a frase secreta do backup nos prompts ocultos. A frase é solicitada duas vezes. O usuário padrão é `ford`; para outro usuário local, defina `MYSQL_USER` antes de iniciar o comando. A senha não é argumento de processo. O utilitário usa loopback (`127.0.0.1:3306`) e só o banco `ford_vinculo_360`.

O resultado é `backups/<banco>-<data>-<id>/ford_vinculo_360.sql.enc` e um manifesto com algoritmo, parâmetros KDF e SHA-256. Sem a frase secreta, não há recuperação. Não envie o arquivo nem a frase por e-mail, issue, chat público ou no mesmo pacote sem uma política de transferência aprovada.

Para verificar AES-GCM sem tocar no MySQL nem em backups existentes, execute `node scripts/secure-backup.cjs self-test`. O teste usa uma fixture sintética, uma frase temporária, o fluxo criptográfico em streaming e confirma que uma tag adulterada é rejeitada.

## Ensaiar restauração isolada

Gere um nome de banco de teste novo, por exemplo `ford_vinculo_360_restore_20260927_153000`, e confirme exatamente o mesmo nome:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restore-wamp.ps1 `
  -BackupFile 'C:\caminho\backups\...\ford_vinculo_360.sql.enc' `
  -TargetDatabase ford_vinculo_360_restore_20260927_153000 `
  -Confirmation 'RESTORE ford_vinculo_360_restore_20260927_153000'
```

A rotina exige que o arquivo esteja sob a pasta local `backups/`, confira o SHA-256, autentique o conteúdo GCM antes de iniciar o cliente MySQL e não sobrescreva um banco existente. Depois da importação, verifica que ao menos uma tabela foi criada e grava `<arquivo>.restore-verified.json` com o hash, o banco de restauração e a contagem de tabelas — sem dados de cliente, chaves ou frase secreta. Esse arquivo é um registro operacional local sem assinatura; não é garantia independente nem prova inviolável de restauração.

O registro apenas documenta que a rotina concluiu a importação e encontrou ao menos uma tabela; não valida contagens esperadas, vínculos, consultas da aplicação, integridade de cada linha ou recuperação completa do serviço. Como o registro não é assinado, um usuário local com acesso pode alterá-lo ou criá-lo manualmente. Faça validação funcional supervisionada no ambiente isolado e mantenha aprovação explícita antes do saneamento. Apague o banco de restauração somente após conferir e registrar o resultado segundo a política aprovada; a rotina não o remove automaticamente.

## Saneamento de credenciais históricas

O saneador opera somente sobre os templates `TEAM_INVITATION`, `CUSTOMER_ACTIVATION`, `PASSWORD_RESET` e `VEHICLE_APPROVED` em `OutboundMessage`/`MessageEvent`, e invalida hashes de convite/reset diretamente associados às mensagens. Destinatários são mantidos para auditoria. IDs, destinatários, payloads, links e tokens nunca são impressos. Não toca em outros templates, audit logs, dados de clientes ou arquivos de backup.

Faça primeiro uma simulação sem alterar nada:

```powershell
node scripts/sanitize-credential-history.cjs --dry-run
```

O modo padrão também é dry-run. Revise apenas as contagens retornadas. Para efetivar em um ambiente controlado:

1. Pare **todas** as instâncias da API e qualquer worker, para impedir entregas ou novas credenciais durante o saneamento.
2. Gere o backup cifrado e faça uma restauração isolada nas últimas 24 horas; mantenha o registro operacional `.restore-verified.json` ao lado do backup. O hash detecta alterações acidentais no arquivo, mas o registro não é assinado nem prova independente.
3. Execute novamente `--dry-run` e confirme que o banco selecionado é o ambiente autorizado.
4. Passe o caminho do mesmo backup restaurado e a confirmação literal:

```powershell
node scripts/sanitize-credential-history.cjs --apply `
  --application-stopped `
  --confirm SANITIZE-LEGACY-CREDENTIALS `
  --backup-file 'C:\caminho\backups\...\ford_vinculo_360.sql.enc'
```

`--application-stopped` é uma confirmação do operador; o script não interrompe processos e não consegue detectar outras instâncias. O saneamento é idempotente por campo, grava uma entrada `CREDENTIAL_HISTORY_SANITIZE` com contagens e hash do backup, e não apaga cópias antigas. Links que já foram entregues podem continuar em caixas de e-mail; reemita somente credenciais necessárias por um canal aprovado.

Não execute o modo `--apply` sem autorização do controlador de dados, responsáveis pelo serviço e backup; o comando altera registros de autenticação e a fila persistida. Backups antigos que possam conter links não ficam corrigidos: restrinja-os, inventarie-os e aplique a retenção/apagamento sob política aprovada. Não abra nem copie tokens para relatório.

## Dependências externas antes de produção

- Provisionar cofre corporativo para a frase de cifragem, com política de acesso, recuperação/escrow e rotação. O backup local atual é cifrado, mas ainda não é recuperação de desastre.
- Escolher destino de backup aprovado, transferência cifrada, retenção e teste periódico fora da estação WampServer.
- Operador com credencial MySQL autorizada para dump/restauração; a senha é solicitada localmente e não está configurada automaticamente.
- Janela e aprovação formal para parar serviços, executar dry-run e saneamento real no banco de produção. Nenhum dado real foi alterado nesta preparação.
- Classificação/eliminação de dumps SQL antigos em claro e credenciais já entregues; os scripts novos não os apagam.
- Implantação de produção, observabilidade, revisão LGPD e segurança independente continuam fora desta rotina.
