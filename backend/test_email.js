// Test truc tiep emailReceipt service logic
const env = require('./src/config/env');
const repo = require('./src/modules/internal/procurement/procurement.repository');
const { sendMail } = require('./src/shared/utils/mail');

async function test() {
  // receipt id=5, company_id=5 (Lau Nuong Sai Gon)
  const receiptId = 5;
  const companyId = 5;

  console.log('Step 1: getReceipt...');
  const receipt = await repo.findReceiptById(receiptId, companyId);
  console.log('receipt:', JSON.stringify({
    id: receipt?.id,
    receipt_code: receipt?.receipt_code,
    supplier_name: receipt?.supplier_name,
    supplier_email: receipt?.supplier_email,
    status: receipt?.status,
  }, null, 2));

  if (!receipt) { console.log('NOT FOUND'); process.exit(1); }

  console.log('\nStep 2: findReceiptItems...');
  const items = await repo.findReceiptItems(receiptId);
  console.log('items:', items.map(i => i.ingredient_name));

  const supplierEmail = receipt.supplier_email;
  console.log('\nsupplierEmail:', supplierEmail);

  if (!supplierEmail) { console.log('NO EMAIL on supplier'); process.exit(1); }

  console.log('\nStep 3: build HTML & send mail...');
  const num = (v) => new Intl.NumberFormat('vi-VN').format(Number(v || 0));

  // Simulate rows
  const rows = items.map((it, i) => `<tr><td>${i+1}</td><td>${it.ingredient_name}</td></tr>`).join('');
  const html = `<h1>Test - ${receipt.receipt_code}</h1><table>${rows}</table><p>Total: ${num(receipt.total_amount)}₫</p>`;

  try {
    const result = await sendMail(
      supplierEmail,
      `[Test] Phiếu nhập ${receipt.receipt_code}`,
      html
    );
    console.log('SEND OK:', result);
  } catch(e) {
    console.error('SEND FAILED:', e.message);
  }
  process.exit(0);
}

test().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
