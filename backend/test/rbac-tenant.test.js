const test = require("node:test");
const assert = require("node:assert/strict");

const { authorize } = require("../src/shared/middlewares/role.middleware");
const {
  assertBranchScope,
  buildScopedBranchWhere,
  assertCanAssignRole,
  resolveEmployeeScope,
} = require("../src/shared/utils/permission");
const { resolveCompanyId } = require("../src/shared/utils/resolveCompanyId");

function runMiddleware(middleware, req) {
  let result;
  middleware(req, {}, (error) => { result = error || "next"; });
  return result;
}

test("authorize rejects anonymous and disallowed roles", () => {
  assert.equal(runMiddleware(authorize("COMPANY_ADMIN"), {}).statusCode, 401);
  assert.equal(
    runMiddleware(authorize("COMPANY_ADMIN"), { user: { role: "WAITER" } }).statusCode,
    403
  );
  assert.equal(
    runMiddleware(authorize("COMPANY_ADMIN"), { user: { role: "COMPANY_ADMIN" } }),
    "next"
  );
});

test("branch scope prevents cross-company and cross-branch access", () => {
  assert.throws(
    () => assertBranchScope({ role: "COMPANY_ADMIN", company_id: 10 }, { company_id: 20 }),
    (error) => error.statusCode === 403
  );
  assert.throws(
    () => assertBranchScope({ role: "BRANCH_MANAGER", branch_id: 101 }, { id: 202 }),
    (error) => error.statusCode === 403
  );
  assert.doesNotThrow(() => assertBranchScope({ role: "SUPER_ADMIN" }, { id: 202 }));
});

test("scoped query parameters are derived from the authenticated tenant", () => {
  const companyValues = [];
  assert.equal(
    buildScopedBranchWhere({ role: "COMPANY_ADMIN", company_id: 10 }, companyValues),
    "WHERE b.company_id = $1"
  );
  assert.deepEqual(companyValues, [10]);

  const branchValues = ["existing"];
  assert.equal(
    buildScopedBranchWhere({ role: "BRANCH_MANAGER", branch_id: 101 }, branchValues, "e"),
    "WHERE e.branch_id = $2"
  );
  assert.deepEqual(branchValues, ["existing", 101]);
});

test("non-super-admin input cannot override employee or company tenant scope", () => {
  assert.deepEqual(
    resolveEmployeeScope(
      { role: "BRANCH_MANAGER", company_id: 10, branch_id: 101 },
      { company_id: 20, branch_id: 202 }
    ),
    { company_id: 10, branch_id: 101 }
  );
  assert.equal(
    resolveCompanyId({
      user: { role: "COMPANY_ADMIN", company_id: 10 },
      body: { company_id: 20 },
      query: {},
    }),
    10
  );
});

test("managers cannot assign an equal or higher role", () => {
  assert.throws(
    () => assertCanAssignRole({ role: "BRANCH_MANAGER" }, "COMPANY_ADMIN"),
    (error) => error.statusCode === 403
  );
  assert.throws(
    () => assertCanAssignRole({ role: "COMPANY_ADMIN" }, "unknown"),
    (error) => error.statusCode === 400
  );
  assert.doesNotThrow(() => assertCanAssignRole({ role: "COMPANY_ADMIN" }, "WAITER"));
});
