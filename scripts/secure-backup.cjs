const {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { promisify } = require('node:util');
const { pipeline } = require('node:stream/promises');
const { Readable, Writable } = require('node:stream');

const scryptAsync = promisify(scrypt);
const MAGIC = Buffer.from('FV360ENC', 'ascii');
const VERSION = 1;
const SALT_LENGTH = 16;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = MAGIC.length + 1 + SALT_LENGTH + NONCE_LENGTH;
const SCRYPT_OPTIONS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SOURCE_DATABASE = 'ford_vinculo_360';
const TARGET_PATTERN = /^ford_vinculo_360_restore_[0-9]{8}_[0-9]{6}$/;
const repoRoot = path.resolve(__dirname, '..');
const backupRoot = path.join(repoRoot, 'backups');

function makeHeader(salt, nonce) {
  return Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, nonce]);
}

function parseHeader(header) {
  if (header.length !== HEADER_LENGTH || !header.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Formato de backup não reconhecido.');
  }
  if (header[MAGIC.length] !== VERSION) throw new Error('Versão de backup não suportada.');
  const saltOffset = MAGIC.length + 1;
  return {
    salt: header.subarray(saltOffset, saltOffset + SALT_LENGTH),
    nonce: header.subarray(saltOffset + SALT_LENGTH),
  };
}

async function deriveKey(passphrase, salt) {
  if (!Buffer.isBuffer(passphrase) || passphrase.length < 16) {
    throw new Error('A frase secreta precisa ter pelo menos 16 bytes.');
  }
  return scryptAsync(passphrase, salt, 32, SCRYPT_OPTIONS);
}

async function encryptStream(source, output, passphrase) {
  const salt = randomBytes(SALT_LENGTH);
  const nonce = randomBytes(NONCE_LENGTH);
  const header = makeHeader(salt, nonce);
  const key = await deriveKey(passphrase, salt);
  try {
    const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_LENGTH });
    cipher.setAAD(header);
    if (!output.write(header)) await once(output, 'drain');
    await pipeline(source, cipher, output, { end: false });
    const finished = once(output, 'finish');
    output.end(cipher.getAuthTag());
    await finished;
  } finally {
    key.fill(0);
  }
}

async function askHidden(label) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Execute em um terminal interativo para informar segredos sem eco.');
  }
  process.stdout.write(`${label}: `);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    const characters = [];
    const finish = (error) => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(Buffer.from(characters.join(''), 'utf8'));
    };
    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') return finish(new Error('Operação cancelada pelo operador.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') {
          characters.pop();
          continue;
        }
        if (character >= ' ' && character !== '\u007f' && characters.length < 4096) characters.push(character);
      }
    };
    process.stdin.on('data', onData);
  });
}

async function askPassphrase() {
  const first = await askHidden('Frase secreta do backup (mínimo 16 caracteres)');
  try {
    if (first.length < 16) throw new Error('A frase secreta precisa ter pelo menos 16 bytes.');
    const second = await askHidden('Repita a frase secreta');
    try {
      if (first.length !== second.length || !timingSafeEqual(first, second)) {
        throw new Error('As frases secretas não coincidem.');
      }
      return Buffer.from(first);
    } finally {
      second.fill(0);
    }
  } finally {
    first.fill(0);
  }
}

function findMysqlBinary(name) {
  if (process.platform !== 'win32') throw new Error('A rotina de backup/restauração foi preparada para WampServer no Windows.');
  const mysqlRoot = 'C:\\wamp64\\bin\\mysql';
  if (!fs.existsSync(mysqlRoot)) throw new Error('Diretório MySQL do WampServer não encontrado.');
  const candidates = fs.readdirSync(mysqlRoot)
    .filter((entry) => /^mysql/i.test(entry))
    .map((entry) => path.join(mysqlRoot, entry, 'bin', name))
    .filter((candidate) => fs.existsSync(candidate))
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
  if (!candidates.length) throw new Error(`${name} não encontrado no WampServer.`);
  return candidates[0];
}

async function currentWindowsSid() {
  const identity = spawn('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  let output = '';
  identity.stdout.setEncoding('utf8');
  identity.stdout.on('data', (chunk) => { output += chunk; });
  const [identityCode] = await once(identity, 'close');
  if (identityCode !== 0) throw new Error('Não foi possível identificar o usuário para proteger o diretório do backup.');
  const userSid = output.match(/S-\d-(?:\d+-){1,14}\d+/)?.[0];
  if (!userSid) throw new Error('Não foi possível identificar o SID do usuário Windows.');
  return userSid;
}

async function setAcl(target, grants) {
  const icacls = spawn('icacls.exe', [target, '/inheritance:r', '/grant:r', ...grants], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  icacls.stderr.setEncoding('utf8');
  icacls.stderr.on('data', () => {});
  const [code] = await once(icacls, 'close');
  if (code !== 0) throw new Error(`Não foi possível restringir a ACL do arquivo de backup (código ${code}).`);
}

async function restrictDirectory(directory) {
  const userSid = await currentWindowsSid();
  const grants = [userSid, 'S-1-5-18', 'S-1-5-32-544'].map((sid) => `*${sid}:(OI)(CI)F`);
  await setAcl(directory, grants);
}

async function restrictFileReadOnly(filePath) {
  const userSid = await currentWindowsSid();
  await setAcl(filePath, [`*${userSid}:R`, '*S-1-5-18:F', '*S-1-5-32-544:F']);
}

function promptDatabasePassword() {
  return askHidden('Senha do usuário MySQL local');
}

function spawnMysql(binary, argumentsList, databasePassword, stdio = ['ignore', 'inherit', 'inherit']) {
  const env = {
    PATH: process.env.PATH,
    SYSTEMROOT: process.env.SYSTEMROOT,
    WINDIR: process.env.WINDIR,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    MYSQL_PWD: databasePassword.toString('utf8'),
  };
  return spawn(binary, argumentsList, { env, windowsHide: true, stdio });
}

function processExit(child) {
  if (child.stderr) child.stderr.on('data', () => {});
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
}

async function hashFile(filePath) {
  const hash = createHash('sha256');
  await pipeline(fs.createReadStream(filePath), new Writable({ write(chunk, encoding, callback) { hash.update(chunk); callback(); } }));
  return hash.digest('hex');
}

async function promptDatabaseCredentials() {
  const user = process.env.MYSQL_USER || 'ford';
  if (!/^[A-Za-z0-9_.@-]+$/.test(user)) throw new Error('MYSQL_USER contém caracteres inválidos.');
  const password = await promptDatabasePassword();
  if (!password.length) {
    password.fill(0);
    throw new Error('A senha MySQL não pode ser vazia.');
  }
  return { user, password };
}

async function encryptFixture(input, passphrase) {
  const encryptedParts = [];
  const sink = new Writable({ write(chunk, _encoding, callback) { encryptedParts.push(Buffer.from(chunk)); callback(); } });
  const chunks = [input.subarray(0, Math.ceil(input.length / 2)), input.subarray(Math.ceil(input.length / 2))];
  await encryptStream(Readable.from(chunks), sink, passphrase);
  return Buffer.concat(encryptedParts);
}

async function decryptFixture(envelope, passphrase) {
  if (envelope.length < HEADER_LENGTH + TAG_LENGTH) throw new Error('Backup truncado.');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ford-vinculo-crypto-selftest-'));
  const filePath = path.join(directory, 'fixture.sql.enc');
  fs.writeFileSync(filePath, envelope, { flag: 'wx', mode: 0o600 });
  const fileHandle = await fs.promises.open(filePath, 'r');
  let key;
  try {
    const info = await readHeaderAndTag(fileHandle);
    const decryptedParts = [];
    const sink = new Writable({ write(chunk, _encoding, callback) { decryptedParts.push(Buffer.from(chunk)); callback(); } });
    const stream = await decryptionStream(fileHandle.fd, filePath, info.header, info.tag, info.salt, info.nonce, info.size, passphrase);
    key = stream.key;
    await pipeline(stream.source, stream.decipher, sink);
    return Buffer.concat(decryptedParts);
  } finally {
    if (key) key.fill(0);
    await fileHandle.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

async function selfTest() {
  const fixture = Buffer.from('fixture sintética: não contém dados do projeto', 'utf8');
  const temporaryPassphrase = Buffer.from('temporary-fixture-passphrase-2026', 'utf8');
  const envelope = await encryptFixture(fixture, temporaryPassphrase);
  const recovered = await decryptFixture(envelope, temporaryPassphrase);
  if (!recovered.equals(fixture)) throw new Error('Falha no ciclo sintético de criptografia/restauração.');
  const tampered = Buffer.from(envelope);
  tampered[tampered.length - 1] ^= 0x01;
  let rejected = false;
  try { await decryptFixture(tampered, temporaryPassphrase); } catch { rejected = true; }
  temporaryPassphrase.fill(0);
  if (!rejected) throw new Error('O teste sintético aceitou uma tag GCM adulterada.');
  process.stdout.write('Self-test sintético AES-256-GCM aprovado; nenhum banco ou backup foi acessado.\n');
}

async function backup() {
  const dumpBinary = findMysqlBinary('mysqldump.exe');
  let user;
  let databasePassword;
  let passphrase;
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const backupDirectory = path.join(backupRoot, `${SOURCE_DATABASE}-${timestamp}-${randomBytes(4).toString('hex')}`);
  let createdDirectory = false;
  let passwordText = '';
  let output;
  let dump;
  let partialFile;
  try {
    passphrase = await askPassphrase();
    const credentials = await promptDatabaseCredentials();
    user = credentials.user;
    databasePassword = credentials.password;
    fs.mkdirSync(backupRoot, { recursive: true });
    fs.mkdirSync(backupDirectory, { recursive: false });
    createdDirectory = true;
    await restrictDirectory(backupDirectory);
    const outputFile = path.join(backupDirectory, `${SOURCE_DATABASE}.sql.enc`);
    partialFile = `${outputFile}.partial`;
    output = fs.createWriteStream(partialFile, { flags: 'wx', mode: 0o600 });
    passwordText = databasePassword.toString('utf8');
    const mysqlArguments = [
      '--host=127.0.0.1', '--port=3306', `--user=${user}`,
      '--single-transaction', '--quick', '--no-tablespaces', '--routines',
      '--events', '--triggers', '--hex-blob', '--set-gtid-purged=OFF',
      '--default-character-set=utf8mb4',
      SOURCE_DATABASE,
    ];
    dump = spawn(dumpBinary, mysqlArguments, {
      env: {
        PATH: process.env.PATH,
        SYSTEMROOT: process.env.SYSTEMROOT,
        WINDIR: process.env.WINDIR,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        MYSQL_PWD: passwordText,
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const exitPromise = processExit(dump);
    passwordText = '';
    databasePassword.fill(0);
    const pipePromise = encryptStream(dump.stdout, output, passphrase);
    const [{ code, signal }] = await Promise.all([exitPromise, pipePromise]);
    if (code !== 0) throw new Error(`mysqldump falhou (código ${code ?? signal}).`);
    const fileHandle = await fs.promises.open(partialFile, 'r');
    const { size } = await fileHandle.stat();
    await fileHandle.close();
    if (size <= HEADER_LENGTH + TAG_LENGTH) throw new Error('mysqldump não produziu dados utilizáveis.');
    const backupFile = path.join(backupDirectory, `${SOURCE_DATABASE}.sql.enc`);
    fs.renameSync(partialFile, backupFile);
    const manifest = {
      version: 1,
      encryption: 'AES-256-GCM',
      keyDerivation: { algorithm: 'scrypt', cost: 32768, blockSize: 8, parallelization: 1 },
      sourceDatabase: SOURCE_DATABASE,
      backupFile: path.basename(backupFile),
      sha256: await hashFile(backupFile),
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(`${backupFile}.json`, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    process.stdout.write(`Backup cifrado criado: ${backupFile}\n`);
    process.stdout.write('Guarde a frase secreta em cofre aprovado. Sem ela, o backup não pode ser restaurado.\n');
  } catch (error) {
    if (dump && dump.exitCode === null) dump.kill();
    if (output && !output.destroyed) output.destroy();
    if (createdDirectory) fs.rmSync(backupDirectory, { recursive: true, force: true });
    throw error;
  } finally {
    if (passphrase) passphrase.fill(0);
    if (databasePassword) databasePassword.fill(0);
    if (passwordText) passwordText = '';
  }
}

function requireBackupLocation(filePath) {
  const resolved = path.resolve(filePath);
  const rootResolved = path.resolve(backupRoot);
  if (!resolved.toLowerCase().startsWith(`${rootResolved}${path.sep}`.toLowerCase())) {
    throw new Error('O backup precisa estar dentro do diretório local backups/.');
  }
  if (path.basename(resolved) !== `${SOURCE_DATABASE}.sql.enc`) throw new Error('Nome de backup inválido.');
  if (!fs.existsSync(resolved) || !fs.lstatSync(resolved).isFile() || fs.lstatSync(resolved).isSymbolicLink()) {
    throw new Error('Arquivo de backup ausente ou inválido.');
  }
  const realRoot = fs.realpathSync(rootResolved);
  const realFile = fs.realpathSync(resolved);
  if (!realFile.toLowerCase().startsWith(`${realRoot}${path.sep}`.toLowerCase())) throw new Error('O backup aponta para fora de backups/.');
  return realFile;
}

async function readHeaderAndTag(fileHandle) {
  const { size } = await fileHandle.stat();
  if (size < HEADER_LENGTH + TAG_LENGTH + 1) throw new Error('Backup truncado ou vazio.');
  const header = Buffer.alloc(HEADER_LENGTH);
  await fileHandle.read(header, 0, header.length, 0);
  const tag = Buffer.alloc(TAG_LENGTH);
  await fileHandle.read(tag, 0, tag.length, size - TAG_LENGTH);
  return { header, tag, size, ...parseHeader(header) };
}

async function decryptionStream(fileDescriptor, filePath, header, tag, salt, nonce, size, passphrase) {
  const key = await deriveKey(passphrase, salt);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_LENGTH });
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  const source = fs.createReadStream(filePath, {
    fd: fileDescriptor,
    autoClose: false,
    start: HEADER_LENGTH,
    end: size - TAG_LENGTH - 1,
  });
  return { source, decipher, key };
}

async function verifyEncryptedFile(fileDescriptor, info, passphrase, filePath) {
  const { source, decipher, key } = await decryptionStream(fileDescriptor, filePath, info.header, info.tag, info.salt, info.nonce, info.size, passphrase);
  try {
    await pipeline(source, decipher, new Writable({ write(_chunk, _encoding, callback) { callback(); } }));
  } finally {
    key.fill(0);
  }
}

async function importEncryptedFile(mysqlBinary, filePath, info, passphrase, databasePassword, user, targetDatabase) {
  const { source, decipher, key } = await decryptionStream(info.fileDescriptor, filePath, info.header, info.tag, info.salt, info.nonce, info.size, passphrase);
  const child = spawnMysql(mysqlBinary, [
    '--host=127.0.0.1', '--port=3306', `--user=${user}`,
    `--database=${targetDatabase}`, '--default-character-set=utf8mb4',
  ], databasePassword, ['pipe', 'ignore', 'pipe']);
  const exitPromise = processExit(child);
  try {
    await pipeline(source, decipher, child.stdin);
    const result = await exitPromise;
    if (result.code !== 0) throw new Error(`Importação MySQL falhou (código ${result.code ?? result.signal}). O banco descartável foi preservado: ${targetDatabase}`);
  } catch (error) {
    if (child.exitCode === null) child.kill();
    throw error;
  } finally {
    key.fill(0);
  }
}

async function mysqlOutput(binary, args, password) {
  const child = spawnMysql(binary, args, password, ['ignore', 'pipe', 'pipe']);
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { output += chunk; });
  const result = await processExit(child);
  if (result.code !== 0) throw new Error(`Consulta MySQL de verificação falhou (código ${result.code ?? result.signal}).`);
  return output.trim();
}

async function restore(fileArgument, targetDatabase, confirmation) {
  if (!TARGET_PATTERN.test(targetDatabase)) throw new Error('O alvo deve ser ford_vinculo_360_restore_YYYYMMDD_HHMMSS.');
  if (confirmation !== `RESTORE ${targetDatabase}`) throw new Error(`Confirme explicitamente com: -Confirmation 'RESTORE ${targetDatabase}'`);
  const encryptedFile = requireBackupLocation(fileArgument);
  const manifestFile = `${encryptedFile}.json`;
  if (!fs.existsSync(manifestFile)) throw new Error('Manifesto do backup não encontrado.');
  const sourceManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (sourceManifest.version !== 1 || sourceManifest.backupFile !== path.basename(encryptedFile) || sourceManifest.sourceDatabase !== SOURCE_DATABASE) {
    throw new Error('Manifesto do backup incompatível.');
  }
  const fileHash = await hashFile(encryptedFile);
  if (fileHash !== sourceManifest.sha256) throw new Error('O SHA-256 do backup não corresponde ao manifesto.');

  const mysqlBinary = findMysqlBinary('mysql.exe');
  let passphrase;
  let databasePassword;
  let user;
  let fileHandle;
  let stagingDirectory;
  try {
    passphrase = await askHidden('Frase secreta do backup');
    const credentials = await promptDatabaseCredentials();
    user = credentials.user;
    databasePassword = credentials.password;
    stagingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ford-vinculo-restore-'));
    await restrictDirectory(stagingDirectory);
    const stagingFile = path.join(stagingDirectory, `${SOURCE_DATABASE}.sql.enc`);
    fs.copyFileSync(encryptedFile, stagingFile, fs.constants.COPYFILE_EXCL);
    await restrictFileReadOnly(stagingFile);
    fs.chmodSync(stagingFile, 0o400);
    if (await hashFile(stagingFile) !== fileHash) throw new Error('A cópia cifrada de restauração não corresponde ao backup validado.');
    fileHandle = await fs.promises.open(stagingFile, 'r');
    const info = await readHeaderAndTag(fileHandle);
    info.fileDescriptor = fileHandle.fd;
    // GCM libera blocos antes de validar a tag; a primeira passagem descarta todo plaintext.
    // Somente depois de autenticar o arquivo iniciamos o cliente MySQL.
    await verifyEncryptedFile(fileHandle.fd, info, passphrase, stagingFile);

    const existing = await mysqlOutput(mysqlBinary, [
      '--host=127.0.0.1', '--port=3306', `--user=${user}`, '--batch', '--skip-column-names',
      `--execute=SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='${targetDatabase}'`,
    ], databasePassword);
    if (existing !== '0') throw new Error('O banco de destino já existe ou a consulta retornou resultado inesperado; nenhum conteúdo será sobrescrito.');
    const createChild = spawnMysql(mysqlBinary, [
      '--host=127.0.0.1', '--port=3306', `--user=${user}`,
      `--execute=CREATE DATABASE ${targetDatabase} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    ], databasePassword);
    const created = await processExit(createChild);
    if (created.code !== 0) throw new Error(`Não foi possível criar o banco descartável (código ${created.code ?? created.signal}).`);

    await importEncryptedFile(mysqlBinary, stagingFile, info, passphrase, databasePassword, user, targetDatabase);
    const tables = await mysqlOutput(mysqlBinary, [
      '--host=127.0.0.1', '--port=3306', `--user=${user}`, '--batch', '--skip-column-names',
      `--execute=SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${targetDatabase}' AND table_type='BASE TABLE'`,
    ], databasePassword);
    const tablesVerified = Number.parseInt(tables, 10);
    if (!Number.isSafeInteger(tablesVerified) || tablesVerified < 1) throw new Error(`A importação não criou tabelas verificáveis. Banco descartável preservado: ${targetDatabase}`);

    const restoreManifest = {
      version: 1,
      sourceDatabase: SOURCE_DATABASE,
      backupFile: path.basename(encryptedFile),
      backupSha256: fileHash,
      restoredDatabase: targetDatabase,
      restoredAt: new Date().toISOString(),
      tablesVerified,
    };
    fs.writeFileSync(`${encryptedFile}.restore-verified.json`, `${JSON.stringify(restoreManifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    process.stdout.write(`Restauração isolada autenticada: ${targetDatabase} (${tablesVerified} tabelas).\n`);
    process.stdout.write(`Registro operacional da restauração gravado: ${path.basename(encryptedFile)}.restore-verified.json\n`);
    process.stdout.write('O banco restaurado contém uma cópia de dados. Não o conecte à aplicação nem o compartilhe.\n');
  } finally {
    if (fileHandle) await fileHandle.close();
    if (passphrase) passphrase.fill(0);
    if (databasePassword) databasePassword.fill(0);
    if (stagingDirectory) fs.rmSync(stagingDirectory, { recursive: true, force: true });
  }
}

function usage() {
  process.stdout.write('Uso:\n  node scripts/secure-backup.cjs backup\n  node scripts/secure-backup.cjs restore --file <arquivo.sql.enc> --database ford_vinculo_360_restore_YYYYMMDD_HHMMSS --confirm "RESTORE <mesmo-alvo>"\n  node scripts/secure-backup.cjs self-test\n');
}

function parseOptions(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!['--file', '--database', '--confirm'].includes(key) || !value || value.startsWith('--') || parsed[key]) {
      throw new Error('Parâmetros de restauração inválidos.');
    }
    parsed[key] = value;
  }
  return parsed;
}

async function main() {
  if (process.argv[2] === 'self-test') return selfTest();
  if (process.argv[2] === 'backup' && process.argv.length === 3) return backup();
  if (process.argv[2] === 'restore') {
    const options = parseOptions(process.argv.slice(3));
    if (!options['--file'] || !options['--database'] || !options['--confirm']) throw new Error('Restauração exige arquivo, banco descartável e confirmação literal.');
    return restore(options['--file'], options['--database'], options['--confirm']);
  }
  usage();
  throw new Error('Comando inválido.');
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ event: 'secure_backup_failed', errorType: error?.name ?? 'Error', message: error?.message ?? 'Falha desconhecida' })}\n`);
  process.exitCode = 1;
});
