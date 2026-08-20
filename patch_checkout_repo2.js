const fs = require('fs');
const p = 'backend/src/modules/internal/checkout/checkout.repository.js';
let data = fs.readFileSync(p, 'utf8');

const t = `AND NOT (oi.is_combo_parent = false AND oi.kitchen_status = 'SERVED')`;
const r = `AND NOT (oi.combo_id IS NOT NULL AND oi.is_combo_parent = false AND oi.kitchen_status = 'SERVED')`;

data = data.replaceAll(t, r);
fs.writeFileSync(p, data);
console.log('patched checkout.repository.js for excluding SERVED combo children correctly');
