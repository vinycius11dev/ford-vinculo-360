const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');

const apiRequire = createRequire(path.resolve(__dirname, '../apps/api/package.json'));
const repoRoot = path.resolve(__dirname, '..');
const backupRoot = path.join(repoRoot, 'backups');
const templateKeys = ['TEAM_INVITATION', 'CUSTOMER_ACTIVATION', 'PASSWORD_RESET', 'VEHICLE_APPROVED'];
const targetRestorePattern = /^ford_vinculo_360_restore_[0-9]{8}_[0-9]{6}$/;
const confirmationPhrase = 'SANITIZE-LEGACY-CREDENTIALS';
const batchSize = 250;

class SafeOperationError extends Error {}

function parseArguments(values) {
  const options = { mode: 'dry-run' };
  for (let index = 0; index < values.length; index += 1) {
    const argument = values[index];
    if (argument === '--dry-run' && options.mode === 'dry-run') continue;
    if (argument === '--apply' && options.mode === 'dry-run') {
      options.mode = 'apply';
      continue;
    }
    if (argument === '--application-stopped') {
      options.applicationStopped = true;
      continue;
    }
    if (['--confirm', '--backup-file'].includes(argument)) {
      const value = values[index + 1];
      if (!value || value.startsWith('--') || options[argument]) throw new SafeOperationError('Parâmetros duplicados ou incompletos.');
      options[argument] = value;
      index += 1;
      continue;
    }
    throw new SafeOperationError('Parâmetro inválido. Consulte docs/operations-security.md.');
  }
  if (options.mode === 'apply') {
    if (options['--confirm'] !== confirmationPhrase) throw new SafeOperationError(`A execução exige --confirm ${confirmationPhrase}.`);
    if (!options.applicationStopped) throw new SafeOperationError('Pare todas as instâncias da aplicação antes de usar --apply.');
    if (!options['--backup-file']) throw new SafeOperationError('A execução exige --backup-file com manifesto de restauração validado.');
  } else if (options['--confirm'] || options['--backup-file'] || options.applicationStopped) {
    throw new SafeOperationError('Confirmação e backup só são aceitos junto com --apply.');
  }
  return options;
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function readRestoreRecord(fileArgument) {
  const backupPath = path.resolve(fileArgument);
  const rootPath = path.resolve(backupRoot);
  if (!backupPath.toLowerCase().startsWith(`${rootPath}${path.sep}`.toLowerCase())) {
    throw new SafeOperationError('O backup precisa estar dentro do diretório local backups/.');
  }
  if (!backupPath.endsWith('.sql.enc')) throw new SafeOperationError('Informe um backup cifrado .sql.enc.');
  if (!fs.existsSync(backupPath) || !fs.lstatSync(backupPath).isFile() || fs.lstatSync(backupPath).isSymbolicLink()) {
    throw new SafeOperationError('O arquivo de backup não existe ou não é um arquivo regular.');
  }
  const canonicalRoot = fs.realpathSync(rootPath);
  const canonicalBackup = fs.realpathSync(backupPath);
  if (!canonicalBackup.toLowerCase().startsWith(`${canonicalRoot}${path.sep}`.toLowerCase())) {
    throw new SafeOperationError('O backup aponta para fora de backups/.');
  }

  const evidencePath = `${canonicalBackup}.restore-verified.json`;
  if (!fs.existsSync(evidencePath) || fs.lstatSync(evidencePath).isSymbolicLink()) {
    throw new SafeOperationError('Faça uma restauração isolada bem-sucedida com scripts/restore-wamp.ps1 antes da limpeza.');
  }
  let evidence;
  try {
    evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  } catch {
    throw new SafeOperationError('O manifesto da restauração não pôde ser validado.');
  }
  if (
    evidence.version !== 1 ||
    evidence.sourceDatabase !== 'ford_vinculo_360' ||
    evidence.backupFile !== path.basename(canonicalBackup) ||
    !targetRestorePattern.test(evidence.restoredDatabase ?? '') ||
    !Number.isSafeInteger(evidence.tablesVerified) ||
    evidence.tablesVerified < 1
  ) {
    throw new SafeOperationError('O registro operacional não corresponde a uma restauração isolada deste arquivo.');
  }
  const restoredAt = Date.parse(evidence.restoredAt ?? '');
  const age = Date.now() - restoredAt;
  if (!Number.isFinite(restoredAt) || age < -5 * 60_000 || age > 24 * 60 * 60_000) {
    throw new SafeOperationError('O registro operacional de restauração deve ter menos de 24 horas.');
  }
  const digest = await sha256File(canonicalBackup);
  if (digest !== evidence.backupSha256) throw new SafeOperationError('O SHA-256 atual não corresponde ao registro operacional de restauração.');
  return {
    backupSha256: digest,
    restoredDatabase: evidence.restoredDatabase,
    tablesVerified: evidence.tablesVerified,
  };
}

async function* sensitiveMessageBatches(prisma) {
  let cursor;
  while (true) {
    const rows = await prisma.outboundMessage.findMany({
      where: { templateKey: { in: templateKeys } },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        templateKey: true,
        status: true,
        recipient: true,
        userId: true,
        createdAt: true,
      },
    });
    if (!rows.length) return;
    yield rows;
    cursor = rows[rows.length - 1].id;
    if (rows.length < batchSize) return;
  }
}

function latestCutoff(rows, predicate, keyFor) {
  const cutoffs = new Map();
  for (const row of rows) {
    if (!predicate(row)) continue;
    const key = keyFor(row);
    if (!key) continue;
    const current = cutoffs.get(key);
    if (!current || current < row.createdAt) cutoffs.set(key, row.createdAt);
  }
  return cutoffs;
}

async function associatedCredentialIds(prisma, rows) {
  const invitationCutoffs = latestCutoff(
    rows,
    (row) => row.templateKey === 'TEAM_INVITATION',
    (row) => row.recipient?.toLowerCase(),
  );
  const resetCutoffs = latestCutoff(
    rows,
    (row) => ['CUSTOMER_ACTIVATION', 'PASSWORD_RESET', 'VEHICLE_APPROVED'].includes(row.templateKey),
    (row) => row.userId,
  );
  const invitationIds = [];
  const resetIds = [];

  if (invitationCutoffs.size) {
    const invitations = await prisma.userInvitation.findMany({
      where: { email: { in: [...invitationCutoffs.keys()] }, acceptedAt: null, cancelledAt: null },
      select: { id: true, email: true, createdAt: true },
    });
    for (const invitation of invitations) {
      const cutoff = invitationCutoffs.get(invitation.email.toLowerCase());
      if (cutoff && invitation.createdAt <= cutoff) invitationIds.push(invitation.id);
    }
  }
  if (resetCutoffs.size) {
    const resets = await prisma.passwordResetToken.findMany({
      where: { userId: { in: [...resetCutoffs.keys()] }, usedAt: null },
      select: { id: true, userId: true, createdAt: true },
    });
    for (const reset of resets) {
      const cutoff = resetCutoffs.get(reset.userId);
      if (cutoff && reset.createdAt <= cutoff) resetIds.push(reset.id);
    }
  }
  return { invitationIds, resetIds };
}

async function collectDryRun(prisma) {
  const groups = await prisma.outboundMessage.groupBy({
    by: ['templateKey', 'status'],
    where: { templateKey: { in: templateKeys } },
    _count: { _all: true },
  });
  const statusCounts = {};
  for (const key of templateKeys) statusCounts[key] = {};
  for (const group of groups) statusCounts[group.templateKey][group.status] = group._count._all;
  const messageCount = groups.reduce((total, group) => total + group._count._all, 0);
  const eventCount = await prisma.messageEvent.count({
    where: { message: { is: { templateKey: { in: templateKeys } } } },
  });
  const invitationIds = new Set();
  const resetIds = new Set();
  for await (const rows of sensitiveMessageBatches(prisma)) {
    const associated = await associatedCredentialIds(prisma, rows);
    associated.invitationIds.forEach((id) => invitationIds.add(id));
    associated.resetIds.forEach((id) => resetIds.add(id));
  }
  return {
    messageCount,
    eventCount,
    statusCounts,
    activeInvitationHashes: invitationIds.size,
    activePasswordResetHashes: resetIds.size,
  };
}

async function applySanitization(prisma, backupEvidence) {
  const now = new Date();
  const counts = {
    messagesRedacted: 0,
    pendingMessagesCancelled: 0,
    eventsRedacted: 0,
    invitationHashesInvalidated: 0,
    passwordResetHashesInvalidated: 0,
  };

  for await (const rows of sensitiveMessageBatches(prisma)) {
    const messageIds = rows.map((row) => row.id);
    const credentials = await associatedCredentialIds(prisma, rows);
    await prisma.$transaction(async (tx) => {
      const redacted = await tx.outboundMessage.updateMany({
        where: { id: { in: messageIds } },
        data: {
          payload: { redacted: true },
          providerRef: null,
          lastError: 'Conteúdo sensível omitido por saneamento histórico.',
        },
      });
      const cancelled = await tx.outboundMessage.updateMany({
        where: { id: { in: messageIds }, status: { in: ['PENDING', 'SENDING'] } },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
        },
      });
      const events = await tx.messageEvent.updateMany({
        where: { messageId: { in: messageIds } },
        data: { detail: 'Conteúdo sensível omitido por saneamento histórico.' },
      });
      const invitations = credentials.invitationIds.length
        ? await tx.userInvitation.updateMany({
            where: { id: { in: credentials.invitationIds }, acceptedAt: null, cancelledAt: null },
            data: { cancelledAt: now },
          })
        : { count: 0 };
      const resets = credentials.resetIds.length
        ? await tx.passwordResetToken.updateMany({
            where: { id: { in: credentials.resetIds }, usedAt: null },
            data: { usedAt: now },
          })
        : { count: 0 };
      counts.messagesRedacted += redacted.count;
      counts.pendingMessagesCancelled += cancelled.count;
      counts.eventsRedacted += events.count;
      counts.invitationHashesInvalidated += invitations.count;
      counts.passwordResetHashesInvalidated += resets.count;
    }, { maxWait: 10_000, timeout: 60_000 });
  }

  await prisma.auditLog.create({
    data: {
      action: 'CREDENTIAL_HISTORY_SANITIZE',
      entityType: 'OutboundMessage',
      metadata: {
        templates: templateKeys,
        ...counts,
        backupSha256: backupEvidence.backupSha256,
        restoredDatabase: backupEvidence.restoredDatabase,
        backupTablesVerified: backupEvidence.tablesVerified,
        completedAt: now.toISOString(),
      },
    },
  });
  return counts;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (typeof process.loadEnvFile === 'function') {
    const apiEnv = path.resolve(__dirname, '../apps/api/.env');
    try { process.loadEnvFile(apiEnv); } catch (error) {
      if (error?.code !== 'ENOENT') throw new SafeOperationError('Não foi possível carregar a configuração local da API.');
    }
  }
  const { PrismaClient } = apiRequire('@prisma/client');
  const prisma = new PrismaClient({ log: [] });
  try {
    if (options.mode === 'dry-run') {
      const result = await collectDryRun(prisma);
      process.stdout.write(`${JSON.stringify({ mode: 'dry-run', templates: templateKeys, ...result }, null, 2)}\n`);
      process.stdout.write('Nenhum dado foi alterado. A saída contém contagens, sem identificadores, destinatários, tokens ou payloads.\n');
      return;
    }
    const backupEvidence = await readRestoreRecord(options['--backup-file']);
    const counts = await applySanitization(prisma, backupEvidence);
    process.stdout.write(`${JSON.stringify({ mode: 'applied', templates: templateKeys, ...counts }, null, 2)}\n`);
    process.stdout.write('Saneamento concluído. Backups antigos não foram alterados e continuam sujeitos à retenção/cifragem.\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message = error instanceof SafeOperationError ? error.message : 'Falha interna; conteúdo e dados de conexão foram omitidos.';
  process.stderr.write(`${JSON.stringify({ event: 'credential_history_sanitization_failed', message })}\n`);
  process.exitCode = 1;
});
