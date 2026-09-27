const { test } = require('node:test');
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
const password = 'Ford@360-Campaign-QA';
const vin = `9BF${stamp.padStart(14, '0')}`;
let customerId;
let vehicleId;
let campaignId;
let orderId;
const cookieSessions = new Map();
let customerRefreshToken;

async function call(path, { token, method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const responseBody = await response.json();
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    const cookiePair = setCookie.split(';', 1)[0];
    const separator = cookiePair.indexOf('=');
    if (cookiePair.slice(separator + 1)) cookieSessions.set(cookiePair, '/auth/logout');
  }
  if (path === '/auth/mobile/login') customerRefreshToken = responseBody.refreshToken;
  return { status: response.status, body: responseBody };
}

test('campaign dispatch sends a consented offer and attributes the completed service', async () => {
  try {
    const customer = await prisma.user.create({
      data: {
        email: `campaign.qa.${stamp}@ford360.local`,
        fullName: 'Cliente QA Campanha',
        passwordHash: await hash(password, 10),
        role: 'CUSTOMER',
        registeredByDealershipId: 'seed-dealer-center-norte',
        consents: { create: { purpose: 'MARKETING', granted: true, grantedAt: new Date(), source: 'QA' } },
      },
    });
    customerId = customer.id;
    const vehicle = await prisma.vehicle.create({
      data: {
        vin,
        model: 'Territory Pilot QA',
        modelYear: 2024,
        manufactureYear: 2024,
        currentMileage: 12000,
        originDealershipId: 'seed-dealer-center-norte',
        ownerships: { create: { userId: customer.id, status: 'ACTIVE' } },
      },
    });
    vehicleId = vehicle.id;

    const managerLogin = await call('/auth/login', { method: 'POST', body: { email: 'gerente@ford360.local', password: 'Ford@360' } });
    const customerLogin = await call('/auth/mobile/login', { method: 'POST', body: { email: customer.email, password } });
    assert.equal(managerLogin.status, 200);
    assert.equal(customerLogin.status, 200);

    const now = Date.now();
    const created = await call('/campaigns', {
      method: 'POST',
      token: managerLogin.body.accessToken,
      body: {
        name: 'Campanha QA rastreável',
        description: 'Campanha de teste do piloto',
        publicTitle: 'Revisão especial do seu Territory',
        publicDescription: 'Agende sua revisão com condição especial.',
        publicCtaLabel: 'Agendar agora',
        publicCtaLink: '/agendamentos',
        startsAt: new Date(now - 60_000).toISOString(),
        endsAt: new Date(now + 86_400_000).toISOString(),
        vehicleVins: [vin],
      },
    });
    assert.equal(created.status, 201);
    campaignId = created.body.id;

    const dispatched = await call(`/campaigns/${campaignId}/dispatch`, { method: 'POST', token: managerLogin.body.accessToken });
    assert.equal(dispatched.status, 201);
    assert.deepEqual({ sent: dispatched.body.sent, skipped: dispatched.body.skipped }, { sent: 1, skipped: 0 });

    const target = await prisma.campaignTarget.findFirst({ where: { campaignId, vehicleId }, include: { outboundMessages: true } });
    assert.ok(target);
    assert.equal(target.outboundMessages.length, 1);
    assert.equal(target.outboundMessages[0].templateKey, 'CAMPAIGN_OFFER');
    assert.equal(target.outboundMessages[0].channel, 'EMAIL');

    const offers = await call('/campaigns/offers', { token: customerLogin.body.accessToken });
    assert.equal(offers.status, 200);
    assert.equal(offers.body.items.length, 1);
    const viewed = await prisma.campaignTarget.findUnique({ where: { id: target.id } });
    assert.ok(viewed?.viewedAt);

    const order = await call('/service-orders', { method: 'POST', token: managerLogin.body.accessToken, body: { vin, mileage: 12000, description: 'Revisão QA', amount: 1100 } });
    assert.equal(order.status, 201);
    orderId = order.body.id;
    const completed = await call(`/service-orders/${orderId}`, { method: 'PATCH', token: managerLogin.body.accessToken, body: { status: 'COMPLETED', mileage: 12000, description: 'Revisão QA', amount: 1100 } });
    assert.equal(completed.status, 200);
    const converted = await prisma.campaignTarget.findUnique({ where: { id: target.id } });
    assert.ok(converted?.convertedAt);
  } finally {
    for (const [cookie, path] of cookieSessions) {
      await call(path, { method: 'POST', cookie }).catch(() => undefined);
    }
    if (customerRefreshToken) {
      await call('/auth/mobile/logout', { method: 'POST', body: { refreshToken: customerRefreshToken } }).catch(() => undefined);
    }
    if (campaignId) await prisma.campaign.delete({ where: { id: campaignId } }).catch(() => undefined);
    if (orderId) await prisma.serviceOrder.delete({ where: { id: orderId } }).catch(() => undefined);
    if (vehicleId) await prisma.vehicle.delete({ where: { id: vehicleId } }).catch(() => undefined);
    if (customerId) await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});
