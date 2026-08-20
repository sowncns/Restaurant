const fs = require('fs');
const p = 'igourmet-internal/src/components/CheckoutPanel.tsx';
let data = fs.readFileSync(p, 'utf8');

const targetStr = `  const items = order?.items || []
  const subtotal = items.reduce((acc, it) => acc + lineNet(it), 0)
  const totalVat = items.reduce((acc, it) => acc + lineVat(it), 0)`;

const replaceStr = `  const items = React.useMemo(() => {
    const list = order?.items || []
    const toHide = new Set<number>()
    const parents = list.filter(i => i.is_combo_parent)
    
    for (const parent of parents) {
      const children = list.filter(i => i.combo_id === parent.combo_id && !i.is_combo_parent)
      
      // Hide child items that have been fully served. 
      // If they are missing (e.g. CANCELLED, WAITING), keep them visible so the cashier knows.
      for (const c of children) {
        if (c.kitchen_status === 'SERVED') {
          toHide.add(c.order_item_id)
        }
      }
    }
    return list.filter(i => !toHide.has(i.order_item_id))
  }, [order?.items])

  const subtotal = items.reduce((acc, it) => acc + lineNet(it), 0)
  const totalVat = items.reduce((acc, it) => acc + lineVat(it), 0)`;

fs.writeFileSync(p, data.replace(targetStr, replaceStr));
console.log('patched CheckoutPanel.tsx');
