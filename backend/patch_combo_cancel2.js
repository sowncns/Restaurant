const fs = require('fs');

let p1 = 'src/modules/internal/cancel/cancel.service.js';
let d1 = fs.readFileSync(p1, 'utf8');

const oldAlreadyMade = 'const alreadyMade = ["READY", "SERVED", "COOKING"].includes(item.kitchen_status);';
const newAlreadyMade = `let alreadyMade = ["READY", "SERVED", "COOKING"].includes(item.kitchen_status);
    if (item.is_combo_parent) {
      const { rows } = await client.query(
        "SELECT kitchen_status FROM order_items WHERE combo_id = $1 AND is_combo_parent = false AND order_id = $2",
        [item.combo_id, item.order_id]
      );
      alreadyMade = rows.some(r => ["READY", "SERVED", "COOKING"].includes(r.kitchen_status));
    }`;

d1 = d1.replace(oldAlreadyMade, newAlreadyMade);
fs.writeFileSync(p1, d1);

let p2 = 'src/modules/internal/cancel/cancel.repository.js';
let d2 = fs.readFileSync(p2, 'utf8');

const oldWhere = 'WHERE ${cond} AND ($${ktIdx}::int IS NULL OR mi.kitchen_type_id = $${ktIdx})';
const newWhere = 'WHERE ${cond} AND ($${ktIdx}::int IS NULL OR mi.kitchen_type_id = $${ktIdx} OR oi.is_combo_parent = true)';

d2 = d2.replace(oldWhere, newWhere);
fs.writeFileSync(p2, d2);

console.log('Patched cancel combo logic');
