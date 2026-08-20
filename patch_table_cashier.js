const fs = require('fs');

// Patch CheckoutPanel
let cpPath = 'igourmet-internal/src/components/CheckoutPanel.tsx';
let cpData = fs.readFileSync(cpPath, 'utf8');

cpData = cpData.replace(
  '{table.table_name || table.table_number}',
  '<span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded text-sm mr-2">{table.table_number}</span>{table.table_name || ""}'
);
cpData = cpData.replace(
  '<p className="truncate text-lg font-bold text-slate-900">',
  '<p className="truncate text-lg font-bold text-slate-900 flex items-center">'
);
fs.writeFileSync(cpPath, cpData);

// Patch TablesPage
let tpPath = 'igourmet-internal/src/pages/TablesPage.tsx';
let tpData = fs.readFileSync(tpPath, 'utf8');

tpData = tpData.replace(
  '{t.table_name || t.table_number}',
  '<span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded text-sm mr-2">{t.table_number}</span>{t.table_name || ""}'
);
tpData = tpData.replace(
  '<span className="truncate text-lg font-semibold text-slate-900">',
  '<span className="truncate text-lg font-semibold text-slate-900 flex items-center">'
);
fs.writeFileSync(tpPath, tpData);

console.log('patched table numbers in cashier');
