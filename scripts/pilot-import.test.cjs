const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');

const apiRequire = createRequire(resolve(__dirname, '../apps/api/package.json'));
const { PrismaClient } = apiRequire('@prisma/client');
process.loadEnvFile(resolve(__dirname, '../apps/api/.env'));

const prisma = new PrismaClient();
const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
const stamp = `${Date.now()}`;
const sourceSystem = `pilot-test-${stamp}`;
const vin = `9BF${stamp.padStart(14, '0')}`;
const vehicleExternalId = `vehicle-${stamp}`;
const orderExternalId = `order-${stamp}`;
const cookieSessions = new Set();

async function call(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const responseBody = await response.json();
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    const cookiePair = setCookie.split(';', 1)[0];
    if (cookiePair.slice(cookiePair.indexOf('=') + 1)) cookieSessions.add(cookiePair);
  }
  return { status: response.status, body: responseBody };
}

test('pilot import is validated, scoped, and idempotent', async () => {
  let vehicle;
  try {
    const login = await call('/auth/login', { method: 'POST', body: { email: 'gerente@ford360.local', password: 'Ford@360' } });
    assert.equal(login.status, 200);
    const payload = {
      sourceSystem,
      vehicles: [{ externalId: vehicleExternalId, vin, model: 'Ranger Pilot QA', modelYear: 2024, manufactureYear: 2024, currentMileage: 1200, plate: 'QAP1L23', dealershipId: 'seed-dealer-center-norte' }],
      serviceOrders: [{ externalId: orderExternalId, vin, mileage: 1200, status: 'COMPLETED', description: 'Revisão piloto QA', amount: 1500, completedAt: '2026-08-20T12:00:00.000Z', dealershipId: 'seed-dealer-center-norte' }],
    };

    const first = await call('/pilot-import', { method: 'POST', token: login.body.accessToken, body: payload });
    assert.equal(first.status, 201);
    assert.deepEqual(first.body.vehicles, { created: 1, updated: 0 });
    assert.deepEqual(first.body.serviceOrders, { created: 1, updated: 0 });

    const second = await call('/pilot-import', { method: 'POST', token: login.body.accessToken, body: payload });
    assert.equal(second.status, 201);
    assert.deepEqual(second.body.vehicles, { created: 0, updated: 1 });
    assert.deepEqual(second.body.serviceOrders, { created: 0, updated: 1 });

    vehicle = await prisma.vehicle.findUnique({ where: { vin }, include: { serviceOrders: true } });
    assert.ok(vehicle);
    assert.equal(vehicle.sourceSystem, sourceSystem);
    assert.equal(vehicle.externalId, vehicleExternalId);
    assert.equal(vehicle.serviceOrders.length, 1);
    assert.equal(vehicle.serviceOrders[0].externalId, orderExternalId);
  } finally {
    for (const cookie of cookieSessions) {
      await fetch(`${base}/auth/logout`, { method: 'POST', headers: { Cookie: cookie } }).catch(() => undefined);
    }
    await prisma.serviceOrder.deleteMany({ where: { sourceSystem, externalId: orderExternalId } });
    await prisma.vehicle.deleteMany({ where: { sourceSystem, externalId: vehicleExternalId } });
    await prisma.$disconnect();
  }
});
