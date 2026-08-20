const fs = require('fs');
let p = 'igourmet-internal/src/components/orders/OrderPanel.tsx';
let d = fs.readFileSync(p, 'utf8');

const target = `        const readyCount = validChildren.filter(c => c.kitchen_status === 'READY' || c.kitchen_status === 'SERVED').length;
        const total = validChildren.length;
        const allReady = total > 0 && readyCount === total;
        const allServed = total > 0 && servedCount === total;
        return {
          ...item,
          kitchen_status: allServed ? 'SERVED' : (allReady ? 'READY' : 'WAITING'),`;

const replace = `        const readyCount = validChildren.filter(c => c.kitchen_status === 'READY' || c.kitchen_status === 'SERVED').length;
        const startedCount = validChildren.filter(c => c.kitchen_status === 'COOKING' || c.kitchen_status === 'READY' || c.kitchen_status === 'SERVED').length;
        const total = validChildren.length;
        const allReady = total > 0 && readyCount === total;
        const allServed = total > 0 && servedCount === total;
        
        let parentStatus = 'WAITING';
        if (allServed) parentStatus = 'SERVED';
        else if (allReady) parentStatus = 'READY';
        else if (startedCount > 0) parentStatus = 'COOKING';

        return {
          ...item,
          kitchen_status: parentStatus,`;

d = d.replace(target, replace);
fs.writeFileSync(p, d);
console.log('patched OrderPanel for combo COOKING state');
