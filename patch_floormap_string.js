const fs = require('fs');
let p = 'igourmet-internal/src/pages/FloorMapPage.tsx';
let d = fs.readFileSync(p, 'utf8');

d = d.replace(
  '`Xác nhận khách đã rời bàn ${table.table_name || table.table_number}?`',
  '`Xác nhận khách đã rời bàn ${table.table_number}?`'
);

fs.writeFileSync(p, d);
console.log('Fixed FloorMapPage string');
