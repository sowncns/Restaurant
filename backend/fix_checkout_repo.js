const fs = require('fs');
let p = 'backend/src/modules/internal/checkout/checkout.repository.js';
let d = fs.readFileSync(p, 'utf8');

d = d.replaceAll(
  'AND oi.is_combo_parent IS NOT FALSE',
  'AND (oi.combo_id IS NULL OR oi.is_combo_parent = true)'
);

fs.writeFileSync(p, d);
console.log('Fixed checkout.repository.js query');
