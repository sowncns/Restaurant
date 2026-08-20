const fs = require('fs');
const p = 'igourmet-internal/src/components/orders/OrderPanel.tsx';
let data = fs.readFileSync(p, 'utf8');

const targetStr1 = `  const sentItems = useMemo(() => {
    return [...(order?.items ?? [])]
      .filter((i) => i.kitchen_status !== 'CANCELLED')
      .sort((a, b) => {
        if (a.kitchen_status === 'SERVED' && b.kitchen_status !== 'SERVED') return 1
        if (a.kitchen_status !== 'SERVED' && b.kitchen_status === 'SERVED') return -1
        if (a.kitchen_status === 'READY' && b.kitchen_status !== 'READY') return -1
        if (a.kitchen_status !== 'READY' && b.kitchen_status === 'READY') return 1
        return a.order_item_id - b.order_item_id
      })
  }, [order])`;

const replaceStr1 = `  const sentItems = useMemo(() => {
    const list = order?.items ?? []
    const mapped = list
      .filter((i) => i.is_combo_parent !== false && i.kitchen_status !== 'CANCELLED')
      .map(item => {
        if (!item.is_combo_parent) return item;
        const children = list.filter(c => c.combo_id === item.combo_id && c.is_combo_parent === false);
        const validChildren = children.filter(c => c.kitchen_status !== 'CANCELLED');
        const servedCount = validChildren.filter(c => c.kitchen_status === 'SERVED').length;
        const readyCount = validChildren.filter(c => c.kitchen_status === 'READY' || c.kitchen_status === 'SERVED').length;
        const total = validChildren.length;
        const allReady = total > 0 && readyCount === total;
        const allServed = total > 0 && servedCount === total;
        return {
          ...item,
          kitchen_status: allServed ? 'SERVED' : (allReady ? 'READY' : 'WAITING'),
          _comboProgress: total > 0 ? \`\${readyCount}/\${total} món\` : null
        } as OrderItem & { _comboProgress?: string | null };
      });

    return mapped.sort((a, b) => {
        if (a.kitchen_status === 'SERVED' && b.kitchen_status !== 'SERVED') return 1
        if (a.kitchen_status !== 'SERVED' && b.kitchen_status === 'SERVED') return -1
        if (a.kitchen_status === 'READY' && b.kitchen_status !== 'READY') return -1
        if (a.kitchen_status !== 'READY' && b.kitchen_status === 'READY') return 1
        return a.order_item_id - b.order_item_id
      })
  }, [order])`;

data = data.replace(targetStr1, replaceStr1);

const targetStr2 = `                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {it.item_name} <span className="text-emerald-600 font-extrabold ml-1">× {it.quantity}</span>
                      </div>
                      {it.note && <div className="text-[11px] text-slate-500 mt-0.5">📝 {it.note}</div>}`;

const replaceStr2 = `                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {it.item_name} <span className="text-emerald-600 font-extrabold ml-1">× {it.quantity}</span>
                        {(it as any)._comboProgress && !isServed && (
                          <Badge className="ml-2 bg-indigo-100 text-indigo-700">{(it as any)._comboProgress}</Badge>
                        )}
                      </div>
                      {it.note && <div className="text-[11px] text-slate-500 mt-0.5">📝 {it.note}</div>}`;

data = data.replace(targetStr2, replaceStr2);
fs.writeFileSync(p, data);
console.log('patched OrderPanel.tsx');
