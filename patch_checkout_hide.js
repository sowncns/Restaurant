const fs = require('fs');
const p = 'backend/src/modules/internal/checkout/checkout.repository.js';
let data = fs.readFileSync(p, 'utf8');

const t = `AND NOT (oi.combo_id IS NOT NULL AND oi.is_combo_parent = false AND oi.kitchen_status = 'SERVED')`;
const r = `AND oi.is_combo_parent IS NOT FALSE`;

data = data.replaceAll(t, r);
fs.writeFileSync(p, data);
console.log('patched checkout.repository.js to entirely hide combo children');
