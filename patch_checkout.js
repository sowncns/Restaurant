const fs = require('fs');
const p = 'backend/src/modules/internal/checkout/checkout.repository.js';
let data = fs.readFileSync(p, 'utf8');

const targetStr = `      \`SELECT mi.name AS item_name, SUM(oi.quantity) AS quantity, oi.unit_price, oi.discount_percent,
              SUM(oi.unit_price * oi.quantity * (1 - oi.discount_percent / 100.0)) AS line_total, oi.vat_rate AS vat
       FROM orders o
       JOIN order_items oi ON o.order_id = oi.order_id
       JOIN menu_items mi ON oi.menu_item_id = mi.menu_item_id
       WHERE o.table_id = $1 AND o.status IN \${ACTIVE_STATUSES} AND \${BILLABLE}
       GROUP BY mi.name, oi.unit_price, oi.discount_percent, oi.vat_rate
       ORDER BY mi.name\``;

const replaceStr = `      \`SELECT COALESCE(oi.item_name, mi.name) AS item_name, SUM(oi.quantity) AS quantity, oi.unit_price, oi.discount_percent,
              SUM(oi.unit_price * oi.quantity * (1 - oi.discount_percent / 100.0)) AS line_total, oi.vat_rate AS vat
       FROM orders o
       JOIN order_items oi ON o.order_id = oi.order_id
       LEFT JOIN menu_items mi ON oi.menu_item_id = mi.menu_item_id
       WHERE o.table_id = $1 AND o.status IN \${ACTIVE_STATUSES} AND \${BILLABLE}
       GROUP BY COALESCE(oi.item_name, mi.name), oi.unit_price, oi.discount_percent, oi.vat_rate
       ORDER BY COALESCE(oi.item_name, mi.name)\``;

fs.writeFileSync(p, data.replace(targetStr, replaceStr));
console.log('patched checkout.repository.js');
