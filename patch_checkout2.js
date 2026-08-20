const fs = require('fs');
const p = 'backend/src/modules/internal/checkout/checkout.repository.js';
let data = fs.readFileSync(p, 'utf8');

const targetStr = `      \`SELECT mi.name, oi.quantity, oi.unit_price AS price, oi.discount_percent, oi.vat_rate,
              (oi.unit_price * oi.quantity * (1 - oi.discount_percent / 100.0)) AS line_total,
              (oi.unit_price * oi.quantity * (1 - oi.discount_percent / 100.0) * oi.vat_rate / 100.0) AS vat_amount
       FROM orders o
       JOIN order_items oi ON o.order_id = oi.order_id
       JOIN menu_items mi ON oi.menu_item_id = mi.menu_item_id
       WHERE o.table_id = $1 AND o.status IN \${ACTIVE_STATUSES} AND \${BILLABLE}\``;

const replaceStr = `      \`SELECT COALESCE(oi.item_name, mi.name) AS name, oi.quantity, oi.unit_price AS price, oi.discount_percent, oi.vat_rate,
              (oi.unit_price * oi.quantity * (1 - oi.discount_percent / 100.0)) AS line_total,
              (oi.unit_price * oi.quantity * (1 - oi.discount_percent / 100.0) * oi.vat_rate / 100.0) AS vat_amount
       FROM orders o
       JOIN order_items oi ON o.order_id = oi.order_id
       LEFT JOIN menu_items mi ON oi.menu_item_id = mi.menu_item_id
       WHERE o.table_id = $1 AND o.status IN \${ACTIVE_STATUSES} AND \${BILLABLE}\``;

data = data.replace(targetStr, replaceStr);
fs.writeFileSync(p, data);
console.log('patched checkout.repository.js again');
