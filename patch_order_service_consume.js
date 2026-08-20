const fs = require('fs');
const p = 'backend/src/modules/internal/order/order.service.js';
let data = fs.readFileSync(p, 'utf8');

const t = `    // Tru kho khi mon bat dau duoc nau (chi tru 1 lan, tu WAITING)
    if (current === "WAITING" && COOKED_STATUSES.has(newStatus)) {`;

const r = `    // Tru kho khi mon bat dau duoc nau (chi tru 1 lan, tu WAITING)
    if (current === "WAITING" && COOKED_STATUSES.has(newStatus) && !item.is_combo_parent) {`;

data = data.replace(t, r);
fs.writeFileSync(p, data);
console.log('patched order.service.js to skip consumeForDish for combo parent');
