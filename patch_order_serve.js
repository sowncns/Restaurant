const fs = require('fs');

let repoPath = 'backend/src/modules/internal/order/order.repository.js';
let repoData = fs.readFileSync(repoPath, 'utf8');

repoData = repoData.replace(
  `SELECT oi.order_item_id AS id, oi.order_id, oi.menu_item_id, oi.quantity,
              oi.kitchen_status, oi.item_name, mi.kitchen_type_id
       FROM order_items oi`,
  `SELECT oi.order_item_id AS id, oi.order_id, oi.menu_item_id, oi.quantity,
              oi.kitchen_status, oi.item_name, mi.kitchen_type_id, oi.is_combo_parent, oi.combo_id
       FROM order_items oi`
);
fs.writeFileSync(repoPath, repoData);


let srvPath = 'backend/src/modules/internal/order/order.service.js';
let srvData = fs.readFileSync(srvPath, 'utf8');

srvData = srvData.replace(
  `await repo.updateItemKitchenStatus(client, orderItemId, newStatus);`,
  `await repo.updateItemKitchenStatus(client, orderItemId, newStatus);
    
    // Nếu đây là combo parent và đang chuyển sang SERVED -> serve tất cả món con!
    if (item.is_combo_parent && newStatus === 'SERVED' && item.combo_id != null) {
      await client.query("UPDATE order_items SET kitchen_status = 'SERVED' WHERE order_id = $1 AND combo_id = $2 AND is_combo_parent = false", [item.order_id, item.combo_id]);
    }`
);
fs.writeFileSync(srvPath, srvData);
console.log('patched backend order logic for combo serve');
