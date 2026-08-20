const fs = require('fs');
const p = 'igourmet-internal/src/components/CheckoutPanel.tsx';
let data = fs.readFileSync(p, 'utf8');

const t = `  const items = allItems.filter((it) => it.kitchen_status !== 'CANCELLED')`;
const r = `  // Bo mon da huy; bo luon cac mon con cua combo (de chi hien combo cha)
  const items = allItems.filter((it) => it.kitchen_status !== 'CANCELLED' && !(it.combo_id != null && it.is_combo_parent === false))`;

data = data.replaceAll(t, r);
fs.writeFileSync(p, data);
console.log('patched checkout ui to correctly hide combo children');
