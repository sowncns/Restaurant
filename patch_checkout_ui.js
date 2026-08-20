const fs = require('fs');
const p = 'igourmet-internal/src/components/CheckoutPanel.tsx';
let data = fs.readFileSync(p, 'utf8');

const t = `  const items = order?.items || []
  const subtotal = items.reduce((acc, it) => acc + lineNet(it), 0)`;
const r = `  const items = (order?.items || []).filter(i => i.is_combo_parent !== false)
  const subtotal = items.reduce((acc, it) => acc + lineNet(it), 0)`;

data = data.replaceAll(t, r);
fs.writeFileSync(p, data);
console.log('patched checkout UI to hide combo children');
