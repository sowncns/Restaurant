const pool = require('./src/config/db');
pool.query("SELECT * FROM combos WHERE name = 'AN trua 3'").then(r => {
  console.log(r.rows);
  process.exit(0);
});
