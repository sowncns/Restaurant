const fs = require('fs');
const p = 'igourmet-internal/src/pages/OrdersPage.tsx';
let data = fs.readFileSync(p, 'utf8');

const target = `  useEffect(() => {
    loadTables()
  }, [loadTables])`;

const replace = `  useEffect(() => {
    loadTables()
    const timer = setInterval(() => {
      loadTables()
    }, 10000)
    return () => clearInterval(timer)
  }, [loadTables])`;

data = data.replace(target, replace);

const target2 = `  // Đổi bàn -> switch mobile view sang menu, load lại scan (voucher/thành viên) từ backend
  useEffect(() => {
    let cancelled = false
    setCart({})`;

const replace2 = `  // Auto refresh active order
  useEffect(() => {
    if (!table) return
    const timer = setInterval(() => {
      ordersApi.getActiveForTable(table.id)
        .then(activeOrder => setOrder(activeOrder))
        .catch(() => {})
    }, 10000)
    return () => clearInterval(timer)
  }, [table])

  // Đổi bàn -> switch mobile view sang menu, load lại scan (voucher/thành viên) từ backend
  useEffect(() => {
    let cancelled = false
    setCart({})`;

data = data.replace(target2, replace2);

fs.writeFileSync(p, data);
console.log('patched OrdersPage for auto refresh');
