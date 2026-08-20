require("dotenv").config();
const pool = require("../src/config/db");

const queries = {
  branches: "SELECT branch_id, company_id, name, status FROM branches ORDER BY branch_id",
  tables: "SELECT table_id, branch_id, table_number, capacity, status FROM dining_tables ORDER BY branch_id, table_id",
  menu: `SELECT mi.menu_item_id, mi.name, mi.status, r.ingredient_id, r.quantity,
                i.ingredient_name, bi.branch_id, bi.current_stock
         FROM menu_items mi
         JOIN recipes r ON r.menu_item_id = mi.menu_item_id
         JOIN ingredients i ON i.ingredient_id = r.ingredient_id
         LEFT JOIN branch_inventory bi ON bi.ingredient_id = i.ingredient_id
         ORDER BY mi.menu_item_id LIMIT 50`,
  suppliers: "SELECT supplier_id, company_id, supplier_name, status FROM suppliers ORDER BY supplier_id",
  roles: "SELECT role_id, role_code FROM roles ORDER BY role_id",
  employees: `SELECT e.employee_id, e.username, e.company_id, e.branch_id, e.status, r.role_code
              FROM employees e JOIN roles r ON r.role_id = e.role_id ORDER BY e.employee_id`,
  customers: "SELECT customer_id, email, email_verified, status FROM customers ORDER BY customer_id LIMIT 20",
  combos: `SELECT c.combo_id, c.company_id, c.combo_code, c.name, c.status,
                  json_agg(json_build_object('menu_item_id', ci.menu_item_id, 'menu_company_id', mi.company_id, 'quantity', ci.quantity)
                           ORDER BY ci.combo_item_id) AS items
           FROM combos c
           LEFT JOIN combo_items ci ON ci.combo_id = c.combo_id
           LEFT JOIN menu_items mi ON mi.menu_item_id = ci.menu_item_id
           GROUP BY c.combo_id ORDER BY c.combo_id`,
};

(async () => {
  for (const [name, sql] of Object.entries(queries)) {
    try {
      const { rows } = await pool.query(sql);
      console.log(`---${name}---`);
      console.log(JSON.stringify(rows));
    } catch (error) {
      console.log(`---${name} ERROR--- ${error.message}`);
    }
  }
  await pool.end();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
