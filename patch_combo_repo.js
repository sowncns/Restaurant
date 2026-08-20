const fs = require('fs');
const p = 'backend/src/modules/internal/combo/combo.repository.js';
let data = fs.readFileSync(p, 'utf8');

const targetStr = `exports.findCombos = (companyId, { status, search } = {}) => {
  const values = [companyId];
  const conditions = ["company_id = $1"];`;

const replaceStr = `exports.findCombos = (companyId, { status, search } = {}) => {
  const values = [];
  const conditions = [];

  if (companyId != null) {
    values.push(companyId);
    conditions.push(\`company_id = $\${values.length}\`);
  }`;

data = data.replace(targetStr, replaceStr);
fs.writeFileSync(p, data);
console.log('patched combo.repository.js for SUPER_ADMIN');
