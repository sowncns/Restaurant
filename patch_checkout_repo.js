const fs = require('fs');
const p = 'backend/src/modules/internal/checkout/checkout.repository.js';
let data = fs.readFileSync(p, 'utf8');

const t1 = `       WHERE o.table_id = $1 AND o.status IN \${ACTIVE_STATUSES} AND \${BILLABLE}`;
const r1 = `       WHERE o.table_id = $1 AND o.status IN \${ACTIVE_STATUSES} AND \${BILLABLE} 
         AND NOT (oi.is_combo_parent = false AND oi.kitchen_status = 'SERVED')`;

data = data.replaceAll(t1, r1);
fs.writeFileSync(p, data);
console.log('patched checkout.repository.js for excluding SERVED combo children');
