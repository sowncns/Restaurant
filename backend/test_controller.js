const env = require('./src/config/env');
const controller = require('./src/modules/internal/procurement/procurement.controller');

async function mockRun() {
  const req = {
    params: { id: '6' },
    user: { id: 1, role: 'SUPER_ADMIN', company_id: 5 },
    query: {},
    body: {}
  };
  
  const res = {
    status: function(code) { console.log('STATUS:', code); return this; },
    json: function(data) { console.log('JSON:', data); }
  };
  
  try {
    console.log('Testing emailReceipt for id=6...');
    // asyncHandler wraps the function, so we need to call it and catch promise rejection
    await controller.emailReceipt(req, res, (err) => {
      console.error('NEXT CALLED WITH ERROR:', err.message, err.stack);
    });
  } catch (err) {
    console.error('CAUGHT ERROR:', err.message, err.stack);
  }
  process.exit(0);
}

mockRun();
