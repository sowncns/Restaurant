// src/modules/internal/combo/combo.repository.js
const pool = require("../../../config/db");

exports.findCombos = (companyId, { status, search } = {}) => {
  const values = [];
  const conditions = [];

  if (companyId != null) {
    values.push(companyId);
    conditions.push(`company_id = $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`name ILIKE $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return pool
    .query(
      `SELECT combo_id AS id, company_id, combo_code, name, description, image_url, price, status, created_at, updated_at
       FROM combos
       ${where}
       ORDER BY name`,
      values
    )
    .then((r) => r.rows);
};

exports.findComboById = (id, companyId) => {
  if (companyId != null) {
    return pool
      .query(
        `SELECT combo_id AS id, company_id, combo_code, name, description, image_url, price, status, created_at, updated_at
         FROM combos
         WHERE combo_id = $1 AND company_id = $2`,
        [id, companyId]
      )
      .then((r) => r.rows[0]);
  } else {
    return pool
      .query(
        `SELECT combo_id AS id, company_id, combo_code, name, description, image_url, price, status, created_at, updated_at
         FROM combos
         WHERE combo_id = $1`,
        [id]
      )
      .then((r) => r.rows[0]);
  }
};

exports.findComboItems = (comboId) => {
  return pool
    .query(
      `SELECT ci.combo_item_id, ci.combo_id, ci.menu_item_id, ci.quantity,
              mi.name AS menu_item_name, mi.price AS menu_item_price
       FROM combo_items ci
       JOIN menu_items mi ON mi.menu_item_id = ci.menu_item_id
       WHERE ci.combo_id = $1`,
      [comboId]
    )
    .then((r) => r.rows);
};

exports.createCombo = async (companyId, data) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // 1. Insert combo
    const comboRes = await client.query(
      `INSERT INTO combos (company_id, combo_code, name, description, image_url, price)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING combo_id AS id, *`,
      [companyId, data.combo_code, data.name, data.description || null, data.image_url || null, data.price]
    );
    const combo = comboRes.rows[0];

    // 2. Insert items
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        await client.query(
          `INSERT INTO combo_items (combo_id, menu_item_id, quantity)
           VALUES ($1, $2, $3)`,
          [combo.id, item.menu_item_id, item.quantity]
        );
      }
    }

    await client.query("COMMIT");
    return combo;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

exports.updateCombo = async (id, companyId, data) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // 1. Update combo if fields provided
    const cols = [];
    const values = [];
    for (const key of ['combo_code', 'name', 'description', 'image_url', 'price', 'status']) {
      if (data[key] !== undefined) {
        values.push(data[key]);
        cols.push(`${key} = $${values.length}`);
      }
    }
    
    let updatedCombo = null;
    if (cols.length > 0) {
      values.push(new Date()); // updated_at
      cols.push(`updated_at = $${values.length}`);
      
      let comboRes;
      if (companyId != null) {
        values.push(id, companyId);
        comboRes = await client.query(
          `UPDATE combos SET ${cols.join(", ")}
           WHERE combo_id = $${values.length - 1} AND company_id = $${values.length}
           RETURNING combo_id AS id, *`,
          values
        );
      } else {
        values.push(id);
        comboRes = await client.query(
          `UPDATE combos SET ${cols.join(", ")}
           WHERE combo_id = $${values.length}
           RETURNING combo_id AS id, *`,
          values
        );
      }
      updatedCombo = comboRes.rows[0];
    } else {
      updatedCombo = await exports.findComboById(id, companyId);
    }

    // 2. Update items if provided
    if (data.items) {
      await client.query(`DELETE FROM combo_items WHERE combo_id = $1`, [id]);
      for (const item of data.items) {
        await client.query(
          `INSERT INTO combo_items (combo_id, menu_item_id, quantity)
           VALUES ($1, $2, $3)`,
          [id, item.menu_item_id, item.quantity]
        );
      }
    }

    await client.query("COMMIT");
    return updatedCombo;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

exports.deleteCombo = (id, companyId) => {
  // Hard delete is possible if we want, or status update
  return pool
    .query(
      `DELETE FROM combos WHERE combo_id = $1 AND company_id = $2 RETURNING combo_id AS id`,
      [id, companyId]
    )
    .then((r) => r.rows[0]);
};
