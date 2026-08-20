const fs = require('fs');
const p = 'backend/src/modules/internal/order/order.repository.js';
let data = fs.readFileSync(p, 'utf8');

data = data.replace(
  'oi.kitchen_status, oi.item_name, mi.kitchen_type_id',
  'oi.kitchen_status, oi.item_name, mi.kitchen_type_id, oi.is_combo_parent, oi.combo_id'
);

fs.writeFileSync(p, data);
console.log('patched lockOrderItemScoped');
