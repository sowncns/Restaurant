const fs = require('fs');
let p = 'igourmet-internal/src/pages/TablesPage.tsx';
let d = fs.readFileSync(p, 'utf8');
d = d.replace(/\{t\.table_name \|\| t\.table_number\}/g, '{t.table_number && <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded text-sm mr-2">{t.table_number}</span>}{t.table_name || ""}');
fs.writeFileSync(p, d);
console.log('patched TablesPage');
