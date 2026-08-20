const fs = require('fs');
const p = 'backend/src/modules/internal/combo/combo.repository.js';
let data = fs.readFileSync(p, 'utf8');

const t1 = `      values.push(id, companyId);
      const comboRes = await client.query(
        \`UPDATE combos SET \${cols.join(", ")}
         WHERE combo_id = $\${values.length - 1} AND company_id = $\${values.length}
         RETURNING combo_id AS id, *\`,
        values
      );`;

const r1 = `      if (companyId != null) {
        values.push(id, companyId);
        var comboRes = await client.query(
          \`UPDATE combos SET \${cols.join(", ")}
           WHERE combo_id = $\${values.length - 1} AND company_id = $\${values.length}
           RETURNING combo_id AS id, *\`,
          values
        );
      } else {
        values.push(id);
        var comboRes = await client.query(
          \`UPDATE combos SET \${cols.join(", ")}
           WHERE combo_id = $\${values.length}
           RETURNING combo_id AS id, *\`,
          values
        );
      }`;

data = data.replace(t1, r1);

const t2 = `exports.removeCombo = (id, companyId) => {
  return pool.query(
    "DELETE FROM combos WHERE combo_id = $1 AND company_id = $2 RETURNING combo_id",
    [id, companyId]
  );
};`;

const r2 = `exports.removeCombo = (id, companyId) => {
  if (companyId != null) {
    return pool.query(
      "DELETE FROM combos WHERE combo_id = $1 AND company_id = $2 RETURNING combo_id",
      [id, companyId]
    );
  }
  return pool.query(
    "DELETE FROM combos WHERE combo_id = $1 RETURNING combo_id",
    [id]
  );
};`;

data = data.replace(t2, r2);
fs.writeFileSync(p, data);
console.log('patched combo.repository.js for update and remove');
