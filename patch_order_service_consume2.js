const fs = require('fs');
const p = 'backend/src/modules/internal/order/order.service.js';
let data = fs.readFileSync(p, 'utf8');

data = data.replace(
  'if (current === "WAITING" && COOKED_STATUSES.has(newStatus)) {',
  'if (current === "WAITING" && COOKED_STATUSES.has(newStatus) && !item.is_combo_parent) {'
);

fs.writeFileSync(p, data);
console.log('patched order.service.js properly this time');
