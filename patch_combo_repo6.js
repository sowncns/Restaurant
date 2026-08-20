const fs = require('fs');
const p = 'backend/src/modules/internal/combo/combo.repository.js';
let data = fs.readFileSync(p, 'utf8');

data = data.replace(/WHERE combo_id = \$\{values\.length - 1\} AND company_id = \$\{values\.length\}/g, "WHERE combo_id = $$${values.length - 1} AND company_id = $$${values.length}");
data = data.replace(/WHERE combo_id = \$\{values\.length\}/g, "WHERE combo_id = $$${values.length}");

fs.writeFileSync(p, data);
console.log('patched combo.repository.js with double $$');
