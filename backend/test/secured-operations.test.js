const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/config/db");
const { redisClient } = require("../src/config/redis");
const checkoutRepo = require("../src/modules/internal/checkout/checkout.repository");
const checkoutService = require("../src/modules/internal/checkout/checkout.service");
const qrRepo = require("../src/modules/qr_payment/qr_payment.repository");
const qrService = require("../src/modules/qr_payment/qr_payment.service");
const inventoryRepo = require("../src/modules/internal/inventory/inventory.repository");
const inventoryService = require("../src/modules/internal/inventory/inventory.service");
const procurementRepo = require("../src/modules/internal/procurement/procurement.repository");
const procurementService = require("../src/modules/internal/procurement/procurement.service");
const reservationRepo = require("../src/modules/internal/reservation/reservation.repository");
const reservationService = require("../src/modules/internal/reservation/reservation.service");
const auditService = require("../src/shared/services/audit.service");

async function withMethods(replacements, action) {
  const originals = replacements.map(([object, name]) => [object, name, object[name]]);
  for (const [object, name, replacement] of replacements) object[name] = replacement;
  try {
    return await action();
  } finally {
    for (const [object, name, original] of originals.reverse()) object[name] = original;
  }
}

function transactionClient() {
  return { query: async () => ({ rows: [], rowCount: 0 }), release() {} };
}

test("checkout denies a table outside the authenticated company and branch", async () => {
  const client = transactionClient();
  let scope;
  await withMethods([
    [pool, "connect", async () => client],
    [checkoutRepo, "lockTable", async (_client, tableId, companyId, branchId) => {
      scope = [tableId, companyId, branchId];
      return undefined;
    }],
  ], async () => {
    await assert.rejects(
      checkoutService.createInvoice({ role: "CASHIER", company_id: 10, branch_id: 101 }, 202, "CASH"),
      (error) => error.statusCode === 404
    );
  });
  assert.deepEqual(scope, [202, 10, 101]);
});

test("checkout rejects a duplicate unpaid invoice before inserting another", async () => {
  const client = transactionClient();
  let inserted = false;
  await withMethods([
    [pool, "connect", async () => client],
    [checkoutRepo, "lockTable", async () => ({ status: "WAIT_PAYMENT", company_id: 10, branch_id: 101 })],
    [checkoutRepo, "sumOrderTotal", async () => 100000],
    [checkoutRepo, "sumOrderVatTotal", async () => 8000],
    [checkoutRepo, "findHeldDepositByTable", async () => undefined],
    [checkoutRepo, "findUnpaidInvoiceByTable", async () => ({ id: 77 })],
    [checkoutRepo, "insertInvoice", async () => { inserted = true; }],
    [redisClient, "get", async () => null],
  ], async () => {
    await assert.rejects(
      checkoutService.createInvoice({ role: "CASHIER", company_id: 10, branch_id: 101 }, 5, "APP", 9),
      (error) => error.statusCode === 409
    );
  });
  assert.equal(inserted, false);
});

test("QR payment scopes the invoice and derives amount, table, and customer from it", async () => {
  const client = transactionClient();
  const writes = [];
  let lockArgs;
  await withMethods([
    [pool, "connect", async () => client],
    [qrRepo, "lockInvoiceForPayment", async (...args) => {
      lockArgs = args.slice(1);
      return { id: 33, amount: "125000", table_id: 7, customer_id: 44, company_id: 10, branch_id: 101, status: "UNPAID" };
    }],
    [qrRepo, "findRestaurantName", async () => "Scoped branch"],
    [qrRepo, "findCustomerByIdOrPhone", async () => ({ id: 44 })],
    [redisClient, "set", async (key, value) => { writes.push([key, value]); }],
  ], async () => {
    await qrService.requestPayment(
      { company_id: 10, branch_id: 101 }, 44, 1, 999, 33
    );
  });
  assert.deepEqual(lockArgs, [33, 10, 101]);
  const pending = writes.map(([, value]) => {
    try { return JSON.parse(value); } catch { return null; }
  }).find((value) => value && value.status === "PENDING");
  assert.equal(pending.amount, "125000");
  assert.equal(pending.tableId, 7);
  assert.equal(pending.customerId, 44);
});

test("QR payment hides cross-branch invoices", async () => {
  const client = transactionClient();
  await withMethods([
    [pool, "connect", async () => client],
    [qrRepo, "lockInvoiceForPayment", async () => undefined],
  ], async () => {
    await assert.rejects(
      qrService.requestPayment({ company_id: 10, branch_id: 101 }, 44, 500, 7, 99),
      (error) => error.statusCode === 404
    );
  });
});

test("recipe deletion carries company scope into the destructive query", async () => {
  let args;
  await withMethods([
    [inventoryRepo, "deleteRecipeLine", async (...received) => { args = received; return undefined; }],
  ], async () => {
    await assert.rejects(inventoryService.deleteRecipeLine(55, 10), (error) => error.statusCode === 404);
  });
  assert.deepEqual(args, [55, 10]);
});

test("recipe delete repository joins menu items and filters by company", async () => {
  let query;
  await withMethods([[pool, "query", async (sql, values) => {
    query = { sql, values };
    return { rows: [] };
  }]], async () => inventoryRepo.deleteRecipeLine(55, 10));
  assert.match(query.sql, /USING menu_items mi/);
  assert.match(query.sql, /mi\.company_id = \$2/);
  assert.deepEqual(query.values, [55, 10]);
});

test("procurement rejects a requested branch from another company", async () => {
  let created = false;
  await withMethods([
    [procurementRepo, "findSupplierById", async () => ({ status: "ACTIVE" })],
    [procurementRepo, "findBranchById", async () => ({ id: 202, company_id: 20 })],
    [procurementRepo, "createReceipt", async () => { created = true; }],
  ], async () => {
    await assert.rejects(
      procurementService.createReceipt(10, null, 1, { supplier_id: 2, branch_id: 202, items: [] }),
      (error) => error.statusCode === 400
    );
  });
  assert.equal(created, false);
});

test("procurement branch scope overrides a client-supplied branch", async () => {
  let header;
  await withMethods([
    [procurementRepo, "findSupplierById", async () => ({ status: "ACTIVE" })],
    [procurementRepo, "findBranchById", async (id) => ({ id, company_id: 10 })],
    [procurementRepo, "createReceipt", async (_companyId, received) => { header = received; return 70; }],
    [procurementRepo, "findReceiptById", async () => ({ id: 70, branch_id: 101 })],
    [procurementRepo, "findReceiptItems", async () => []],
  ], async () => {
    await procurementService.createReceipt(10, 101, 1, { supplier_id: 2, branch_id: 202, items: [] });
  });
  assert.equal(header.branch_id, 101);
});

test("audit queries enforce company and branch scope in SQL parameters", async () => {
  let query;
  await withMethods([[pool, "query", async (sql, values) => {
    query = { sql, values };
    return { rows: [] };
  }]], async () => auditService.query(10, { branchId: 101, limit: 25, offset: 50 }));
  assert.match(query.sql, /company_id = \$1/);
  assert.match(query.sql, /branch_id = \$2/);
  assert.deepEqual(query.values, [10, 101, 25, 50]);
});

test("reservation update locks the slot and excludes itself from conflict detection", async () => {
  const client = transactionClient();
  const calls = [];
  const reservation = {
    id: 88, company_id: 10, branch_id: 101, table_id: 7,
    reservation_date: "2026-08-21", reservation_time: "18:00", status: "CONFIRMED",
  };
  await withMethods([
    [pool, "connect", async () => client],
    [reservationRepo, "findByIdForUpdate", async () => reservation],
    [reservationRepo, "getOpenHours", async () => null],
    [reservationRepo, "lockTableSlot", async (...args) => { calls.push(["lock", ...args]); }],
    [reservationRepo, "hasReservationConflict", async (...args) => { calls.push(["conflict", ...args]); return false; }],
    [reservationRepo, "updateTx", async () => ({ id: 88 })],
    [reservationRepo, "findById", async () => reservation],
  ], async () => {
    await reservationService.update(
      { role: "BRANCH_MANAGER", company_id: 10, branch_id: 101 }, 88,
      { reservation_time: "19:00" }
    );
  });
  assert.deepEqual(calls[0], ["lock", client, 7, "2026-08-21"]);
  assert.deepEqual(calls[1], ["conflict", 7, "2026-08-21", "19:00", 88, client]);
});

test("reservation conflict aborts the transaction before update", async () => {
  const client = transactionClient();
  let updated = false;
  await withMethods([
    [pool, "connect", async () => client],
    [reservationRepo, "findByIdForUpdate", async () => ({
      id: 88, company_id: 10, branch_id: 101, table_id: 7,
      reservation_date: "2026-08-21", reservation_time: "18:00", status: "CONFIRMED",
    })],
    [reservationRepo, "getOpenHours", async () => null],
    [reservationRepo, "lockTableSlot", async () => {}],
    [reservationRepo, "hasReservationConflict", async () => true],
    [reservationRepo, "updateTx", async () => { updated = true; }],
  ], async () => {
    await assert.rejects(
      reservationService.update(
        { role: "BRANCH_MANAGER", company_id: 10, branch_id: 101 }, 88,
        { reservation_time: "19:00" }
      ),
      (error) => error.statusCode === 400
    );
  });
  assert.equal(updated, false);
});
