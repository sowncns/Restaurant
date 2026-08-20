const fs = require('fs');
const p = 'backend/src/modules/internal/order/order.repository.js';
let data = fs.readFileSync(p, 'utf8');

const t = `SELECT oi.order_item_id AS id, oi.order_id, oi.menu_item_id, oi.quantity,
              oi.kitchen_status, oi.item_name, mi.kitchen_type_id
       FROM order_items oi`;
const r = `SELECT oi.order_item_id AS id, oi.order_id, oi.menu_item_id, oi.quantity,
              oi.kitchen_status, oi.item_name, mi.kitchen_type_id, oi.is_combo_parent, oi.combo_id
       FROM order_items oi`;

data = data.replaceAll(t, r);
fs.writeFileSync(p, data);
console.log('patched order.repository.js for lockOrderItemScoped');
