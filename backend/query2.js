const pool = require('./src/config/db'); 
pool.query("UPDATE order_items SET kitchen_status = 'SERVED' WHERE is_combo_parent = false AND kitchen_status = 'READY' AND combo_id IS NOT NULL").then(r => { 
  console.log(r.rowCount); 
  process.exit(0); 
});
