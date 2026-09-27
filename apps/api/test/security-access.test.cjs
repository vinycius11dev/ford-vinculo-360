const assert = require('node:assert/strict');
const test = require('node:test');
const { validate } = require('class-validator');
const { ForbiddenException, NotFoundException } = require('@nestjs/common');
const { UserRole, ServiceOrderStatus } = require('@prisma/client');
const { plainToInstance } = require('class-transformer');
const { ServiceOrdersService } = require('../src/service-orders/service-orders.service');
const { UpdateServiceOrderDto } = require('../src/service-orders/dto/update-service-order.dto');
const { SalesService } = require('../src/sales/sales.service');
const { RepurchaseLeadsService } = require('../src/repurchase-leads/repurchase-leads.service');

function dealerActor(role = UserRole.DEALERSHIP_AGENT) {
  return { userId: 'staff-1', role, dealershipId: 'dealer-1' };
}

test('a dealer can only open a service order for a vehicle in its access scope', async () => {
  let lookup;
  const service = new ServiceOrdersService({
    vehicle: {
      findFirst: async (args) => {
        lookup = args.where;
        return null;
      },
    },
  });

  await assert.rejects(
    service.create({ vin: '1HGCM82633A004352', mileage: 12000 }, dealerActor()),
    NotFoundException,
  );
  assert.equal(lookup.vin, '1HGCM82633A004352');
  assert.deepEqual(lookup.OR, [
    { originDealershipId: 'dealer-1' },
    { serviceOrders: { some: { dealershipId: 'dealer-1' } } },
  ]);
});

test('the request body cannot replace the dealership from the authenticated user', async () => {
  let createdOrder;
  let auditedOrder;
  const service = new ServiceOrdersService({
    vehicle: { findFirst: async () => ({ id: 'vehicle-1' }) },
    serviceOrder: { create: async ({ data }) => { createdOrder = data; return { id: 'order-1' }; } },
    auditLog: { create: async ({ data }) => { auditedOrder = data; } },
  });

  await service.create({
    vin: '1HGCM82633A004352',
    mileage: 12000,
    dealershipId: 'attacker-selected-dealer',
  }, dealerActor());
  assert.equal(createdOrder.dealershipId, 'dealer-1');
  assert.equal(auditedOrder.performedById, 'staff-1');
});

test('a dealership agent cannot manually mint service loyalty points', async () => {
  let queriedOrder = false;
  const service = new ServiceOrdersService({
    serviceOrder: { findUnique: async () => { queriedOrder = true; } },
  });

  await assert.rejects(
    service.update('order-1', { points: 500 }, dealerActor()),
    ForbiddenException,
  );
  assert.equal(queriedOrder, false);
});

test('manual service points have a bounded maximum', async () => {
  const dto = plainToInstance(UpdateServiceOrderDto, {
    status: ServiceOrderStatus.COMPLETED,
    points: 100001,
  });
  const errors = await validate(dto);
  const points = errors.find((error) => error.property === 'points');

  assert.ok(points?.constraints?.max);
});

test('a sale cannot end ownership of a trade-in registered to another customer', async () => {
  let ownershipQuery;
  const soldVehicle = {
    id: 'new-vehicle',
    vin: '1HGCM82633A004352',
    saleStatus: 'IN_STOCK',
    stockDealershipId: 'dealer-1',
    listPrice: 30000,
    condition: 'NEW',
    originDealershipId: 'dealer-1',
  };
  const tradeIn = {
    id: 'trade-in-vehicle',
    vin: '1HGCM82633A004360',
    ownerships: [{ userId: 'victim-customer' }],
  };
  const prisma = {
    vehicle: {
      findUnique: async ({ where }) => where.vin === soldVehicle.vin ? soldVehicle : tradeIn,
    },
    $transaction: async (callback) => callback({
      user: { findUnique: async () => ({ id: 'buyer-customer', role: UserRole.CUSTOMER }) },
      vehicleOwnership: {
        updateMany: async ({ where }) => {
          ownershipQuery = where;
          return { count: 0 };
        },
      },
    }),
  };
  const service = new SalesService(prisma, {}, {});

  await assert.rejects(
    service.register({
      vin: soldVehicle.vin,
      customerId: 'buyer-customer',
      tradeInVin: tradeIn.vin,
    }, dealerActor()),
    ForbiddenException,
  );
  assert.equal(ownershipQuery.userId, 'buyer-customer');
  assert.equal(ownershipQuery.vehicleId, tradeIn.id);
});

test('repurchase leads are listed and updated only in the authenticated dealer scope', async () => {
  const lookups = [];
  const service = new RepurchaseLeadsService({
    repurchaseLead: {
      findMany: async (args) => { lookups.push(args.where); return []; },
      findFirst: async (args) => { lookups.push(args.where); return null; },
    },
  });
  const actor = dealerActor(UserRole.DEALERSHIP_MANAGER);

  await service.list(actor);
  await assert.rejects(
    service.update('other-dealer-lead', { status: 'CONTACTED' }, actor),
    NotFoundException,
  );
  assert.deepEqual(lookups, [
    { dealershipId: 'dealer-1' },
    { id: 'other-dealer-lead', dealershipId: 'dealer-1' },
  ]);
});
