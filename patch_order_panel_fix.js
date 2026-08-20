const fs = require('fs');
const p = 'igourmet-internal/src/components/orders/OrderPanel.tsx';
let data = fs.readFileSync(p, 'utf8');

const t = `.filter((i) => i.is_combo_parent !== false && i.kitchen_status !== 'CANCELLED')`;
const r = `.filter((i) => !(i.combo_id != null && i.is_combo_parent === false) && i.kitchen_status !== 'CANCELLED')`;

data = data.replaceAll(t, r);
fs.writeFileSync(p, data);
console.log('patched OrderPanel.tsx correctly');
