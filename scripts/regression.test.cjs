const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const apiRequire = createRequire(resolve(__dirname, '../apps/api/package.json'));
const { PrismaClient } = apiRequire('@prisma/client');
const { hash } = apiRequire('bcryptjs');
process.loadEnvFile(resolve(__dirname, '../apps/api/.env'));
const prisma = new PrismaClient();
const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
const stamp = `${Date.now()}`;
const password = 'Ford@360-QA-Local';
const tokens = {};
const fixtures = { users: [], vehicles: [], orders: [], campaigns: [] };
const cookieSessions = new Map();
const nativeRefreshTokens = new Set();
let customer, vehicle, claimVehicle, foreignVehicle, originalPolicy;

async function call(path, { token, method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const responseBody = await response.json();
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    const cookiePair = setCookie.split(';', 1)[0];
    const separator = cookiePair.indexOf('=');
    const name = cookiePair.slice(0, separator);
    const value = cookiePair.slice(separator + 1);
    if (value) {
      cookieSessions.set(cookiePair, name === 'ford360_owner_refresh' ? '/auth/app/logout' : '/auth/logout');
    }
  }
  if (path.startsWith('/auth/mobile/') && responseBody.refreshToken) {
    nativeRefreshTokens.add(responseBody.refreshToken);
  }
  return { status: response.status, body: responseBody, headers: response.headers };
}
async function login(email, pass = 'Ford@360') {
  const result = await call('/auth/login', { method: 'POST', body: { email, password: pass } });
  assert.equal(result.status, 200, `login ${email}`);
  return result.body.accessToken;
}

before(async () => {
  tokens.manager = await login('gerente@ford360.local');
  tokens.other = await login('gerente.pr@ford360.local');
  tokens.admin = await login('admin@ford360.local');
  originalPolicy = (await call('/settings/program', { token: tokens.admin })).body;
  customer = await prisma.user.create({ data: { email: `qa.regression.${stamp}@ford360.local`, fullName: 'QA temporário de regressão', passwordHash: await hash(password, 10), role: 'CUSTOMER', registeredByDealershipId: 'seed-dealer-center-norte', loyalty: { create: { balance: 500 } } } });
  fixtures.users.push(customer.id);
  const customerLogin = await call('/auth/mobile/login', { method: 'POST', body: { email: customer.email, password } });
  assert.equal(customerLogin.status, 200, 'native customer login');
  tokens.customer = customerLogin.body.accessToken;
  vehicle = await prisma.vehicle.create({ data: { vin: `9BF${stamp.padStart(14, '0')}`, model: 'Veículo QA temporário', modelYear: 2026, manufactureYear: 2026, currentMileage: 10000, originDealershipId: 'seed-dealer-center-norte', ownerships: { create: { userId: customer.id, status: 'ACTIVE' } } } });
  fixtures.vehicles.push(vehicle.id);
  claimVehicle = await prisma.vehicle.create({ data: { vin: `8AF${stamp.padStart(14, '0')}`, plate: `QAZ1A${stamp.slice(-2)}`, model: 'Veículo QA para vínculo', modelYear: 2025, manufactureYear: 2025, currentMileage: 7200, originDealershipId: 'seed-dealer-center-norte' } });
  fixtures.vehicles.push(claimVehicle.id);
  const existingOwner = await prisma.user.findFirst({ where: { role: 'CUSTOMER', id: { not: customer.id } }, select: { id: true } });
  assert.ok(existingOwner, 'A base local precisa de outro cliente para validar privacidade do vínculo.');
  foreignVehicle = await prisma.vehicle.create({ data: { vin: `7FA${stamp.padStart(14, '0')}`, plate: `QBX2B${stamp.slice(-2)}`, model: 'Veículo QA com outro titular', modelYear: 2024, manufactureYear: 2024, currentMileage: 15300, originDealershipId: 'seed-dealer-center-norte', ownerships: { create: { userId: existingOwner.id, status: 'ACTIVE' } } } });
  fixtures.vehicles.push(foreignVehicle.id);
});

after(async () => {
  // Remove only records created by this run; never reseed the user's database.
  try {
    for (const [cookie, logoutPath] of cookieSessions) {
      await call(logoutPath, { method: 'POST', cookie }).catch(() => undefined);
    }
    for (const refreshToken of nativeRefreshTokens) {
      await call('/auth/mobile/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
    }
    await prisma.$transaction(async (tx) => {
      if (fixtures.campaigns.length) await tx.campaign.deleteMany({ where: { id: { in: fixtures.campaigns } } });
      if (fixtures.orders.length) {
        await tx.pointTransaction.deleteMany({ where: { serviceOrderId: { in: fixtures.orders } } });
        await tx.serviceOrder.deleteMany({ where: { id: { in: fixtures.orders } } });
      }
      if (fixtures.vehicles.length) await tx.vehicle.deleteMany({ where: { id: { in: fixtures.vehicles } } });
      if (fixtures.users.length) await tx.user.deleteMany({ where: { id: { in: fixtures.users } } });
    });
  } finally { await prisma.$disconnect(); }
});

test('manager cannot retrieve another dealership vehicle or loyalty account', async () => {
  assert.equal((await call(`/vehicles/${vehicle.vin}`, { token: tokens.manager })).status, 200);
  assert.equal((await call(`/vehicles/${vehicle.vin}`, { token: tokens.other })).status, 404);
  assert.equal((await call(`/loyalty/${customer.id}`, { token: tokens.other })).status, 404);
  const own = await call(`/loyalty/${customer.id}`, { token: tokens.manager });
  assert.equal(own.status, 200);
  assert.equal(own.body.balance, 500);
  const scoped = await call('/loyalty/summary', { token: tokens.other });
  assert.equal(scoped.status, 200);
  const expected = await prisma.loyaltyAccount.aggregate({ where: { user: { OR: [{ registeredByDealershipId: 'seed-dealer-slaviero' }, { ownerships: { some: { status: 'ACTIVE', vehicle: { OR: [{ originDealershipId: 'seed-dealer-slaviero' }, { serviceOrders: { some: { dealershipId: 'seed-dealer-slaviero' } } }] } } } }] } }, _sum: { balance: true } });
  assert.equal(scoped.body.balance, expected._sum.balance ?? 0);
});

test('native refresh rotates once, rejects reuse, and logout revokes the access token', async () => {
  const first = await call('/auth/mobile/login', { method: 'POST', body: { email: customer.email, password } });
  assert.equal(first.status, 200);
  assert.equal(first.body.refreshToken.length, 96);
  const second = await call('/auth/mobile/refresh', { method: 'POST', body: { refreshToken: first.body.refreshToken } });
  assert.equal(second.status, 200);
  assert.notEqual(second.body.refreshToken, first.body.refreshToken);
  assert.equal((await call('/auth/me', { token: first.body.accessToken })).status, 401);
  assert.equal((await call('/auth/mobile/refresh', { method: 'POST', body: { refreshToken: first.body.refreshToken } })).status, 401);
  assert.equal((await call('/auth/mobile/refresh', { method: 'POST', body: { refreshToken: 'invalid' } })).status, 400);
  assert.equal((await call('/auth/mobile/logout', { method: 'POST', body: { refreshToken: second.body.refreshToken } })).status, 200);
  assert.equal((await call('/auth/me', { token: second.body.accessToken })).status, 401);
});

test('customer claim requires a matching VIN and plate, is private, and is idempotent', async () => {
  const denied = await call('/ownerships/claim', { token: tokens.manager, method: 'POST', body: { vin: claimVehicle.vin, plate: claimVehicle.plate } });
  assert.equal(denied.status, 403);

  const invalid = await call('/ownerships/claim', { token: tokens.customer, method: 'POST', body: { vin: 'curto', plate: 'x' } });
  const mismatch = await call('/ownerships/claim', { token: tokens.customer, method: 'POST', body: { vin: claimVehicle.vin, plate: 'ABC1D23' } });
  const owned = await call('/ownerships/claim', { token: tokens.customer, method: 'POST', body: { vin: foreignVehicle.vin, plate: foreignVehicle.plate } });
  assert.deepEqual([invalid.status, mismatch.status, owned.status], [400, 400, 400]);
  assert.equal(mismatch.body.message, owned.body.message);

  const linked = await call('/ownerships/claim', { token: tokens.customer, method: 'POST', body: { vin: claimVehicle.vin.toLowerCase(), plate: claimVehicle.plate.toLowerCase() } });
  assert.equal(linked.status, 201);
  assert.equal(linked.body.alreadyLinked, false);
  assert.equal(linked.body.status, 'ACTIVE');
  assert.equal(linked.body.userId, customer.id);
  assert.equal(linked.body.vehicle.vin, claimVehicle.vin);
  assert.equal(linked.body.vehicle.plate, claimVehicle.plate);
  assert.equal(typeof linked.body.message, 'string');

  const repeated = await call('/ownerships/claim', { token: tokens.customer, method: 'POST', body: { vin: claimVehicle.vin, plate: claimVehicle.plate } });
  assert.equal(repeated.status, 201);
  assert.equal(repeated.body.alreadyLinked, true);
  assert.equal(repeated.body.id, linked.body.id);
});

test('customer offers honor marketing consent, validity, dispatch, and active ownership', async () => {
  assert.equal((await call('/campaigns/offers', { token: tokens.manager })).status, 403);
  await prisma.userConsent.upsert({
    where: { userId_purpose: { userId: customer.id, purpose: 'MARKETING' } },
    update: { granted: false, revokedAt: new Date(), grantedAt: null, source: 'QA' },
    create: { userId: customer.id, purpose: 'MARKETING', granted: false, revokedAt: new Date(), source: 'QA' },
  });
  const withoutConsent = await call('/campaigns/offers', { token: tokens.customer });
  assert.equal(withoutConsent.status, 200);
  assert.equal(withoutConsent.body.marketingConsent, false);
  assert.deepEqual(withoutConsent.body.items, []);

  await prisma.userConsent.update({ where: { userId_purpose: { userId: customer.id, purpose: 'MARKETING' } }, data: { granted: true, grantedAt: new Date(), revokedAt: null } });
  const now = Date.now();
  const campaignData = [
    { name: 'Oferta QA elegível', active: true, startsAt: new Date(now - 86_400_000), endsAt: new Date(now + 86_400_000), sentAt: new Date(), vehicleId: vehicle.id },
    { name: 'Oferta QA não enviada', active: true, startsAt: new Date(now - 86_400_000), endsAt: new Date(now + 86_400_000), sentAt: null, vehicleId: vehicle.id },
    { name: 'Oferta QA expirada', active: true, startsAt: new Date(now - 10 * 86_400_000), endsAt: new Date(now - 5 * 86_400_000), sentAt: new Date(now - 9 * 86_400_000), vehicleId: vehicle.id },
    { name: 'Oferta QA inativa', active: false, startsAt: new Date(now - 86_400_000), endsAt: new Date(now + 86_400_000), sentAt: new Date(), vehicleId: vehicle.id },
    { name: 'Oferta QA de outro titular', active: true, startsAt: new Date(now - 86_400_000), endsAt: new Date(now + 86_400_000), sentAt: new Date(), vehicleId: foreignVehicle.id },
  ];
  for (const item of campaignData) {
    const created = await prisma.campaign.create({ data: {
      name: item.name,
      description: `${item.name} — descrição`,
      publicTitle: item.name,
      publicDescription: `${item.name} — descrição pública`,
      publicCtaLabel: 'Agendar agora',
      publicCtaLink: '/agendamentos',
      active: item.active,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      targets: { create: { vehicleId: item.vehicleId, sentAt: item.sentAt } },
    } });
    fixtures.campaigns.push(created.id);
  }

  const offers = await call('/campaigns/offers', { token: tokens.customer });
  assert.equal(offers.status, 200);
  assert.equal(offers.body.marketingConsent, true);
  assert.equal(offers.body.items.length, 1);
  const [offer] = offers.body.items;
  assert.equal(offer.title, 'Oferta QA elegível');
  assert.equal(offer.vehicle.vin, vehicle.vin);
  assert.equal(typeof offer.cta.label, 'string');
  assert.equal(typeof offer.cta.link, 'string');
});

test('program rules require administrator role and validate divisor', async () => {
  const body = { minimumPoints: originalPolicy.minimumPoints, mileagePerPoint: originalPolicy.mileagePerPoint };
  assert.equal((await call('/settings/program', { method: 'PATCH', token: tokens.manager, body })).status, 403);
  assert.equal((await call('/settings/program', { method: 'PATCH', token: tokens.admin, body: { ...body, mileagePerPoint: 0 } })).status, 400);
  const saved = await call('/settings/program', { method: 'PATCH', token: tokens.admin, body });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.minimumPoints, body.minimumPoints);
  assert.equal((await call('/settings/integrations', { token: tokens.manager })).body.database, true);
});

test('browser app and dealership dashboard have independent HttpOnly sessions', async () => {
  const manager = await call('/auth/login', { method: 'POST', body: { email: 'gerente@ford360.local', password: 'Ford@360' } });
  const owner = await call('/auth/app/login', { method: 'POST', body: { email: customer.email, password } });
  assert.equal(owner.status, 200);
  assert.equal(owner.body.refreshToken, undefined);
  const managerCookie = manager.headers.get('set-cookie');
  const ownerCookie = owner.headers.get('set-cookie');
  assert.match(ownerCookie, /^ford360_owner_refresh=/);
  assert.match(ownerCookie, /HttpOnly/i);
  assert.match(ownerCookie, /Path=\/api\/v1\/auth\/app/);
  const jar = `${managerCookie.split(';')[0]}; ${ownerCookie.split(';')[0]}`;
  const renewedOwner = await call('/auth/app/refresh', { method: 'POST', cookie: jar });
  const renewedManager = await call('/auth/refresh', { method: 'POST', cookie: jar });
  assert.equal(renewedOwner.body.user.email, customer.email);
  assert.equal(renewedManager.body.user.email, 'gerente@ford360.local');
  await call('/auth/app/logout', { method: 'POST', cookie: renewedOwner.headers.get('set-cookie').split(';')[0] });
  await call('/auth/logout', { method: 'POST', cookie: renewedManager.headers.get('set-cookie').split(';')[0] });
});

test('simultaneous vouchers cannot overdraw points, redeem twice, or cross dealerships', async () => {
  const body = { userId: customer.id, title: 'Benefício QA temporário', pointsCost: 400 };
  const results = await Promise.all([1, 2].map(() => call('/loyalty/vouchers', { token: tokens.manager, method: 'POST', body })));
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
  const voucher = results.find((r) => r.status === 201).body;
  assert.equal((await call(`/loyalty/${customer.id}`, { token: tokens.manager })).body.balance, 100);
  assert.equal((await call(`/loyalty/vouchers/${voucher.code}/redeem`, { token: tokens.other, method: 'POST' })).status, 404);
  const redeemed = await Promise.all([1, 2].map(() => call(`/loyalty/vouchers/${voucher.code}/redeem`, { token: tokens.manager, method: 'POST' })));
  assert.deepEqual(redeemed.map((r) => r.status).sort(), [201, 400]);
});

test('service revenue is stored and concurrent completion awards points once', async () => {
  const opened = await call('/service-orders', { token: tokens.manager, method: 'POST', body: { vin: vehicle.vin, mileage: 11000, description: 'Atendimento QA temporário', amount: 850 } });
  assert.equal(opened.status, 201);
  fixtures.orders.push(opened.body.id);
  assert.equal(opened.body.amount, 850);
  const close = () => call(`/service-orders/${opened.body.id}`, { token: tokens.manager, method: 'PATCH', body: { status: 'COMPLETED', amount: 900 } });
  const results = await Promise.all([close(), close()]);
  assert.ok(results.some((r) => r.status === 200));
  assert.ok(results.every((r) => [200, 409].includes(r.status)));
  assert.equal(await prisma.pointTransaction.count({ where: { serviceOrderId: opened.body.id } }), 1);
  assert.equal((await prisma.serviceOrder.findUnique({ where: { id: opened.body.id } })).amount, 900);
  const entry = await prisma.pointTransaction.findFirst({ where: { serviceOrderId: opened.body.id } });
  assert.equal(entry.amount, Math.max(originalPolicy.minimumPoints, Math.round(11000 / originalPolicy.mileagePerPoint)));
  assert.equal((await call(`/service-orders/${opened.body.id}`, { token: tokens.manager, method: 'PATCH', body: { status: 'OPEN' } })).status, 400);
});
