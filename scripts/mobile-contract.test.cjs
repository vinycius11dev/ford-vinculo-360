const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const { runInNewContext } = require('node:vm');

const mobileRequire = createRequire(resolve(__dirname, '../apps/mobile/package.json'));
const ts = mobileRequire('typescript');
const appPath = resolve(__dirname, '../apps/mobile/App.tsx');
const appSource = readFileSync(appPath, 'utf8');
const sourceFile = ts.createSourceFile(appPath, appSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
const helperNames = new Set([
  'normalizeClaimVin',
  'normalizeClaimPlate',
  'isUpcomingBooking',
  'sortBookingsByDate',
]);
const printer = ts.createPrinter();
const declarations = sourceFile.statements.filter(
  (node) => ts.isFunctionDeclaration(node) && node.name && helperNames.has(node.name.text),
);

assert.equal(declarations.length, helperNames.size, 'Os quatro helpers públicos do contrato mobile devem existir.');

const isolatedSource = declarations.map((node) => printer.printNode(ts.EmitHint.Unspecified, node, sourceFile)).join('\n');
const compiled = ts.transpileModule(isolatedSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helpers = {};
runInNewContext(compiled, { exports: helpers });

test('claim normalizes VIN and plate before sending them to the API', () => {
  assert.equal(helpers.normalizeClaimVin('a b c d e f g h i j k l m n o p q r'), 'ABCDEFGHIJKLMNOPQ');
  assert.equal(helpers.normalizeClaimVin('9bf-abc_123'), '9BFABC123');
  assert.equal(helpers.normalizeClaimPlate(' abc-1d23!!! '), 'ABC1D23');
  assert.equal(helpers.normalizeClaimPlate('ab cdefghi j'), 'ABCDEFGH');
});

test('upcoming agenda accepts only future requested or confirmed appointments', () => {
  const now = new Date('2026-09-06T12:00:00.000Z');
  const booking = (requestedFor, status) => ({ requestedFor, status });
  assert.equal(helpers.isUpcomingBooking(booking('2026-09-06T12:01:00.000Z', 'REQUESTED'), now), true);
  assert.equal(helpers.isUpcomingBooking(booking('2026-09-07T12:00:00.000Z', 'CONFIRMED'), now), true);
  assert.equal(helpers.isUpcomingBooking(booking('2026-09-07T12:00:00.000Z', 'COMPLETED'), now), false);
  assert.equal(helpers.isUpcomingBooking(booking('2026-09-07T12:00:00.000Z', 'CANCELLED'), now), false);
  assert.equal(helpers.isUpcomingBooking(booking('2026-09-06T12:00:00.000Z', 'REQUESTED'), now), false);
  assert.equal(helpers.isUpcomingBooking(booking('invalid-date', 'REQUESTED'), now), false);
});

test('agenda sorting is chronological, reversible, and does not mutate API data', () => {
  const input = [
    { id: 'middle', requestedFor: '2026-09-08T12:00:00.000Z' },
    { id: 'last', requestedFor: '2026-09-09T12:00:00.000Z' },
    { id: 'first', requestedFor: '2026-09-07T12:00:00.000Z' },
  ];
  const snapshot = structuredClone(input);
  assert.deepEqual(Array.from(helpers.sortBookingsByDate(input), ({ id }) => id), ['first', 'middle', 'last']);
  assert.deepEqual(Array.from(helpers.sortBookingsByDate(input, 'desc'), ({ id }) => id), ['last', 'middle', 'first']);
  assert.deepEqual(input, snapshot);
});

test('the mobile UI consumes the tested helpers in claim and agenda flows', () => {
  assert.match(appSource, /const vin = normalizeClaimVin\(claimVin\)/);
  assert.match(appSource, /const plate = normalizeClaimPlate\(claimPlate\)/);
  assert.match(appSource, /bookings\.filter\(\(booking\) => isUpcomingBooking\(booking\)\)/);
  assert.match(appSource, /sortBookingsByDate\(/);
});
