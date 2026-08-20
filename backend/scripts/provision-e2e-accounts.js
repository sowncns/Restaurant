require("dotenv").config();
const bcrypt = require("bcrypt");
const pool = require("../src/config/db");

const COMPANY_ID = 4;
const BRANCH_ID = 16;
const PASSWORD = process.env.E2E_PROVISION_PASSWORD;

if (!PASSWORD || PASSWORD.length < 10) {
  throw new Error("Set E2E_PROVISION_PASSWORD with at least 10 characters");
}

const employees = [
  ["e2e_reception", "Selenium Receptionist", "RECEPTIONIST", COMPANY_ID, BRANCH_ID, null],
  ["e2e_waiter", "Selenium Waiter", "WAITER", COMPANY_ID, BRANCH_ID, null],
  ["e2e_kitchen", "Selenium Kitchen", "KITCHEN", COMPANY_ID, BRANCH_ID, "MENU_ITEM"],
  ["e2e_cashier", "Selenium Cashier", "CASHIER", COMPANY_ID, BRANCH_ID, null],
  ["e2e_manager", "Selenium Branch Manager", "BRANCH_MANAGER", COMPANY_ID, BRANCH_ID, null],
  ["e2e_company_admin", "Selenium Company Admin", "COMPANY_ADMIN", COMPANY_ID, null, null],
  ["e2e_super_admin", "Selenium Super Admin", "SUPER_ADMIN", null, null, null],
];

(async () => {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const branch = await pool.query(
    "SELECT branch_id FROM branches WHERE branch_id = $1 AND company_id = $2 AND status = 'ACTIVE'",
    [BRANCH_ID, COMPANY_ID],
  );
  if (!branch.rowCount) throw new Error("E2E branch is missing or inactive");

  for (const [username, fullName, roleCode, companyId, branchId, kitchenCode] of employees) {
    const role = await pool.query("SELECT role_id FROM roles WHERE code = $1", [roleCode]);
    if (!role.rowCount) throw new Error(`Missing role ${roleCode}`);

    let kitchenTypeId = null;
    if (kitchenCode) {
      let kitchen = kitchenCode === "MENU_ITEM"
        ? await pool.query("SELECT kitchen_type_id FROM menu_items WHERE menu_item_id = 2")
        : await pool.query(
          "SELECT kitchen_type_id FROM kitchen_types WHERE code = $1 AND status = 'active'",
          [kitchenCode],
        );
      if (!kitchen.rowCount) {
        kitchen = await pool.query(
          "SELECT kitchen_type_id FROM kitchen_types WHERE status = 'active' ORDER BY kitchen_type_id LIMIT 1",
        );
      }
      kitchenTypeId = kitchen.rows[0]?.kitchen_type_id ?? null;
    }

    await pool.query(
      `INSERT INTO employees
         (full_name, username, password_hash, role_id, company_id, branch_id, kitchen_type_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
       ON CONFLICT (username) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         password_hash = EXCLUDED.password_hash,
         role_id = EXCLUDED.role_id,
         company_id = EXCLUDED.company_id,
         branch_id = EXCLUDED.branch_id,
         kitchen_type_id = EXCLUDED.kitchen_type_id,
         status = 'ACTIVE',
         updated_at = NOW()`,
      [fullName, username, passwordHash, role.rows[0].role_id, companyId, branchId, kitchenTypeId],
    );
  }

  const customerEmail = "selenium.customer@example.test";
  await pool.query(
    `INSERT INTO customers (full_name, email, password, email_verified, email_verified_at, status)
     VALUES ('Selenium Customer', $1, $2, TRUE, NOW(), 'active')
     ON CONFLICT (email) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       password = EXCLUDED.password,
       email_verified = TRUE,
       email_verified_at = NOW(),
       status = 'active'`,
    [customerEmail, passwordHash],
  );

  console.log("Provisioned E2E accounts for company 4, branch 16");
  console.log("Customer: selenium.customer@example.test");
  console.log("Staff: e2e_reception, e2e_waiter, e2e_kitchen, e2e_cashier, e2e_manager, e2e_company_admin, e2e_super_admin");
  await pool.end();
})().catch(async (error) => {
  console.error(error.message);
  await pool.end();
  process.exitCode = 1;
});
