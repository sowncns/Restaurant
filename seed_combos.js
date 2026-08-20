const pool = require("./backend/src/config/db");

async function seedCombos() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Get company ID (assume company 1 for seed)
    const companyRes = await client.query("SELECT company_id FROM companies LIMIT 1");
    if (companyRes.rows.length === 0) {
      console.log("No company found to seed combos into.");
      process.exit(1);
    }
    const companyId = companyRes.rows[0].company_id;

    // Get a few random menu items for the combos
    const menuRes = await client.query("SELECT menu_item_id, price FROM menu_items WHERE company_id = $1 LIMIT 5", [companyId]);
    if (menuRes.rows.length < 2) {
      console.log("Not enough menu items to create combos.");
      process.exit(1);
    }
    const items = menuRes.rows;

    // Insert Combo 1
    const combo1Res = await client.query(
      `INSERT INTO combos (company_id, combo_code, name, description, price, status) 
       VALUES ($1, 'CB01', 'Combo Gia Đình Nhỏ', 'Thích hợp cho 2-3 người ăn', 450000, 'ACTIVE') RETURNING combo_id`,
      [companyId]
    );
    const combo1Id = combo1Res.rows[0].combo_id;

    await client.query(
      `INSERT INTO combo_items (combo_id, menu_item_id, quantity) VALUES ($1, $2, $3)`,
      [combo1Id, items[0].menu_item_id, 2]
    );
    await client.query(
      `INSERT INTO combo_items (combo_id, menu_item_id, quantity) VALUES ($1, $2, $3)`,
      [combo1Id, items[1].menu_item_id, 1]
    );

    // Insert Combo 2
    if (items.length >= 4) {
      const combo2Res = await client.query(
        `INSERT INTO combos (company_id, combo_code, name, description, price, status) 
         VALUES ($1, 'CB02', 'Combo Siêu Tiết Kiệm', 'Combo 4 món giá siêu mềm', 690000, 'ACTIVE') RETURNING combo_id`,
        [companyId]
      );
      const combo2Id = combo2Res.rows[0].combo_id;
  
      await client.query(
        `INSERT INTO combo_items (combo_id, menu_item_id, quantity) VALUES ($1, $2, $3)`,
        [combo2Id, items[2].menu_item_id, 1]
      );
      await client.query(
        `INSERT INTO combo_items (combo_id, menu_item_id, quantity) VALUES ($1, $2, $3)`,
        [combo2Id, items[3].menu_item_id, 1]
      );
    }

    await client.query("COMMIT");
    console.log("Seeded combos successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error seeding combos:", error);
  } finally {
    client.release();
    process.exit(0);
  }
}

seedCombos();
