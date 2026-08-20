const fs = require('fs');
const p = 'backend/src/modules/internal/cancel/cancel.repository.js';
let data = fs.readFileSync(p, 'utf8');

data = data.replace(
  "UPDATE order_items SET kitchen_status = 'CANCELLED' WHERE order_item_id = $1",
  "UPDATE order_items SET kitchen_status = 'CANCELLED' WHERE order_item_id = $1 OR (combo_id = (SELECT combo_id FROM order_items WHERE order_item_id = $1) AND is_combo_parent = false AND order_id = (SELECT order_id FROM order_items WHERE order_item_id = $1))"
);

fs.writeFileSync(p, data);
console.log('patched cancel.repository.js to cascade cancel');
