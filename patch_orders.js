const fs = require('fs');
const p = 'igourmet-internal/src/api/orders.ts';
let data = fs.readFileSync(p, 'utf8');

const t = `  billing_status?: 'BILLABLE' | 'VOIDED'\n  created_at?: string\n}`;
const r = `  billing_status?: 'BILLABLE' | 'VOIDED'\n  created_at?: string\n  combo_id?: number | null\n  is_combo_parent?: boolean\n}`;

fs.writeFileSync(p, data.replace(t, r));
console.log('patched orders.ts');
