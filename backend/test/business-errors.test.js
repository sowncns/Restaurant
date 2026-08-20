const test = require("node:test");
const assert = require("node:assert/strict");

const branchRepo = require("../src/modules/internal/branch/branch.repository");
const companyRepo = require("../src/modules/internal/company/company.repository");
const branchService = require("../src/modules/internal/branch/branch.service");
const companyService = require("../src/modules/internal/company/company.service");

async function withMethod(object, name, replacement, action) {
  const original = object[name];
  object[name] = replacement;
  try {
    return await action();
  } finally {
    object[name] = original;
  }
}

test("missing branch returns a 404 business error without a DB", async () => {
  await withMethod(branchRepo, "findById", async () => undefined, async () => {
    await assert.rejects(
      branchService.getBranch({ type: "staff", role: "SUPER_ADMIN" }, 999),
      (error) => error.statusCode === 404 && error.isOperational
    );
  });
});

test("company admin cannot update a branch belonging to another tenant", async () => {
  await withMethod(branchRepo, "findById", async () => ({ id: 202, company_id: 20 }), async () => {
    await assert.rejects(
      branchService.updateBranch(
        { type: "staff", role: "COMPANY_ADMIN", company_id: 10 },
        202,
        { name: "Blocked update" }
      ),
      (error) => error.statusCode === 403
    );
  });
});

test("super admin branch creation validates company selection and existence", async () => {
  await assert.rejects(
    branchService.createBranch({ role: "SUPER_ADMIN" }, { name: "No company" }),
    (error) => error.statusCode === 400
  );
  await withMethod(branchRepo, "companyExists", async () => false, async () => {
    await assert.rejects(
      branchService.createBranch({ role: "SUPER_ADMIN" }, { company_id: 999, name: "Unknown" }),
      (error) => error.statusCode === 400
    );
  });
});

test("company creation rejects insufficient role and missing name", async () => {
  assert.throws(
    () => companyService.createCompany({ role: "COMPANY_ADMIN" }, { name: "Tenant" }),
    (error) => error.statusCode === 403
  );
  assert.throws(
    () => companyService.createCompany({ role: "SUPER_ADMIN" }, {}),
    (error) => error.statusCode === 400
  );
});

test("company admin only receives its own company", async () => {
  let requestedId;
  await withMethod(companyRepo, "findById", async (id) => {
    requestedId = id;
    return { id, name: "Acceptance Company A" };
  }, async () => {
    const result = await companyService.getCompanies({ role: "COMPANY_ADMIN", company_id: 10 });
    assert.equal(requestedId, 10);
    assert.deepEqual(result, [{ id: 10, name: "Acceptance Company A" }]);
  });
});
