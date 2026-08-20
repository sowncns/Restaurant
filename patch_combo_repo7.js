const fs = require('fs');
const p = 'backend/src/modules/internal/combo/combo.repository.js';
let data = fs.readFileSync(p, 'utf8');

data = data.replace(/company_id = \$\{values\.length\}/g, 'company_id = $${values.length}');

fs.writeFileSync(p, data);
console.log('patched combo.repository.js to fix findCombos');
