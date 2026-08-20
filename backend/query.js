const pool = require('./src/config/db'); 
pool.query("SELECT * FROM order_items WHERE is_combo_parent = false AND combo_id IS NOT NULL").then(r => { 
  console.log(r.rows); 
  process.exit(0); 
});
