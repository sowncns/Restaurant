const fs = require('fs');
let p = 'backend/src/modules/internal/order/order.repository.js';
let d = fs.readFileSync(p, 'utf8');

d = d.replace(
  'oi.quantity, oi.kitchen_status, oi.note, oi.created_at, oi.ready_at,',
  'oi.quantity, oi.kitchen_status, oi.note, oi.created_at, oi.ready_at, oi.is_mistake,'
);

d = d.replace(
  'oi.quantity, oi.kitchen_status, oi.created_at, oi.ready_at,',
  'oi.quantity, oi.kitchen_status, oi.created_at, oi.ready_at, oi.is_mistake,'
);

fs.writeFileSync(p, d);
console.log('patched order.repository.js to select is_mistake');
