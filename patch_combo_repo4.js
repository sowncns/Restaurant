const fs = require('fs');
const p = 'backend/src/modules/internal/combo/combo.repository.js';
let data = fs.readFileSync(p, 'utf8');

const target1 = `WHERE combo_id = \${values.length - 1} AND company_id = \${values.length}`;
const replace1 = `WHERE combo_id = $\${values.length - 1} AND company_id = $\${values.length}`;
data = data.replaceAll(target1, replace1);

const target2 = `WHERE combo_id = \${values.length}`;
const replace2 = `WHERE combo_id = $\${values.length}`;
data = data.replaceAll(target2, replace2);

fs.writeFileSync(p, data);
console.log('patched combo.repository.js correctly');
