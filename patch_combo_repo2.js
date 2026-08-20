const fs = require('fs');
const p = 'backend/src/modules/internal/combo/combo.repository.js';
let data = fs.readFileSync(p, 'utf8');

const target = `exports.findComboById = (id, companyId) => {
  return pool
    .query(
      \`SELECT combo_id AS id, company_id, combo_code, name, description, image_url, price, status, created_at, updated_at
       FROM combos
       WHERE combo_id = $1 AND company_id = $2\`,
      [id, companyId]
    )
    .then((r) => r.rows[0]);
};`;

const replace = `exports.findComboById = (id, companyId) => {
  if (companyId != null) {
    return pool
      .query(
        \`SELECT combo_id AS id, company_id, combo_code, name, description, image_url, price, status, created_at, updated_at
         FROM combos
         WHERE combo_id = $1 AND company_id = $2\`,
        [id, companyId]
      )
      .then((r) => r.rows[0]);
  } else {
    return pool
      .query(
        \`SELECT combo_id AS id, company_id, combo_code, name, description, image_url, price, status, created_at, updated_at
         FROM combos
         WHERE combo_id = $1\`,
        [id]
      )
      .then((r) => r.rows[0]);
  }
};`;

data = data.replace(target, replace);
fs.writeFileSync(p, data);
console.log('patched findComboById');
