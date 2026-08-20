const fs = require('fs');
let opPath = 'igourmet-internal/src/pages/OrdersPage.tsx';
let opData = fs.readFileSync(opPath, 'utf8');

opData = opData.replace(
  `          {table?.table_name && (
            <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 ml-1">
              {table.table_name}
            </span>
          )}`,
  ''
);

// Also check table list in Waiter UI
opData = opData.replace(
  '{t.table_name || t.table_number}',
  '{t.table_number}'
);

fs.writeFileSync(opPath, opData);
console.log('patched OrdersPage to only show code');
