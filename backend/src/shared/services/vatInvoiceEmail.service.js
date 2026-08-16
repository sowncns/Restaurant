const pool = require("../../config/db");
const { redisClient } = require("../../config/redis");
const logger = require("../utils/logger");
const { sendMail } = require("../utils/mail");

const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function parseItems(rawItems) {
  let items = rawItems || [];
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
      if (typeof items === "string") items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  return Array.isArray(items) ? items : [];
}

async function loadInvoice(invoiceId) {
  if (!invoiceId) return null;
  const result = await pool.query(
    `SELECT i.invoice_id AS id, i.invoice_code, i.table_id, i.amount, i.items,
            i.created_at, i.paid_at, c.name AS company_name, b.name AS branch_name,
            dt.table_name, dt.table_number
     FROM invoices i
     LEFT JOIN companies c ON c.company_id = i.company_id
     LEFT JOIN branches b ON b.branch_id = i.branch_id
     LEFT JOIN dining_tables dt ON dt.table_id = i.table_id
     WHERE i.invoice_id = $1`,
    [invoiceId]
  );
  return result.rows[0] || null;
}

function renderVatInvoiceEmail(vat, invoice) {
  const items = parseItems(invoice.items);
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.total_price ?? item.line_total ?? 0),
    0
  );
  const vatTotal = items.reduce((sum, item) => {
    const lineTotal = Number(item.total_price ?? item.line_total ?? 0);
    return sum + Number(item.vat_amount ?? (lineTotal * Number(item.vat_rate || 0)) / 100);
  }, 0);
  const rows = items
    .map((item, index) => {
      const name = item.item_name || item.name || "Món ăn";
      const quantity = Number(item.quantity || 0);
      const unitPrice = item.unit_price ?? item.price ?? 0;
      const lineTotal = item.total_price ?? item.line_total ?? 0;
      const vatRate = Number(item.vat_rate || 0);
      return `<tr>
        <td class="cell index">${index + 1}</td>
        <td class="cell item-name">${escapeHtml(name)}${vatRate > 0 ? `<div style="margin-top:3px;color:#687386;font-size:10px;font-weight:400;">VAT ${vatRate}%</div>` : ""}</td>
        <td class="cell number quantity-column">${quantity}</td>
        <td class="cell number unit-column">${money(unitPrice)}</td>
        <td class="cell number total-cell total-column">${money(lineTotal)}</td>
      </tr>`;
    })
    .join("");

  const issuedAt = new Date(invoice.paid_at || invoice.created_at || Date.now()).toLocaleString("vi-VN");
  const restaurant = [invoice.company_name, invoice.branch_name].filter(Boolean).join(" · ") || "iGourmet";
  const table = invoice.table_name || invoice.table_number;

  return `<!doctype html>
  <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        .cell { padding: 12px 8px; border-bottom: 1px solid #e8ecf2; font-size: 13px; }
        .index { text-align: center; color: #8a94a6; }
        .item-name { color: #172033; font-weight: 700; line-height: 1.4; }
        .number { text-align: right; white-space: nowrap; }
        .total-cell { color: #172033; font-weight: 700; }
        @media only screen and (max-width: 620px) {
          .page { padding: 0 !important; }
          .document { border-radius: 0 !important; }
          .content, .header { padding-left: 20px !important; padding-right: 20px !important; }
          .brand-cell, .invoice-meta { display: block !important; width: 100% !important; text-align: left !important; }
          .invoice-meta { padding-top: 18px !important; }
          .buyer-grid { display: block !important; }
          .buyer-cell { display: block !important; width: 100% !important; padding-bottom: 12px !important; }
          .cell { padding: 10px 6px !important; font-size: 12px !important; }
          .index, .unit-column { display: none !important; }
          .quantity-column { width: 36px !important; }
          .total-column { width: 92px !important; }
          .amount-label, .amount-value { display: block !important; width: 100% !important; text-align: right !important; }
          .amount-value { padding-top: 6px !important; font-size: 22px !important; }
        }
      </style>
    </head>
    <body style="margin:0;background:#eef2f7;color:#172033;font-family:Arial,Helvetica,sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Hóa đơn ${escapeHtml(invoice.invoice_code)} từ iGourmet đã sẵn sàng.</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#eef2f7;">
        <tr>
          <td class="page" align="center" style="padding:32px 16px;">
            <table class="document" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;border-collapse:separate;background:#ffffff;border:1px solid #dfe5ee;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px rgba(23,32,51,.08);">
              <tr>
                <td class="header" style="padding:32px 36px 28px;background:#172033;color:#ffffff;border-bottom:4px solid #4f46e5;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td class="brand-cell" style="vertical-align:top;">
                        <div style="font-size:22px;font-weight:800;letter-spacing:-.4px;">iGourmet</div>
                        <div style="margin-top:6px;color:#bac4d5;font-size:13px;">${escapeHtml(restaurant)}</div>
                      </td>
                      <td class="invoice-meta" align="right" style="vertical-align:top;">
                        <div style="color:#aeb9ca;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">Hóa đơn VAT</div>
                        <div style="margin-top:7px;font-family:'Courier New',monospace;font-size:14px;font-weight:700;">${escapeHtml(invoice.invoice_code)}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td class="content" style="padding:30px 36px 36px;">
                  <div style="font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#4f46e5;">Thông tin xuất hóa đơn</div>
                  <h1 style="margin:7px 0 22px;color:#172033;font-size:24px;line-height:1.25;letter-spacing:-.5px;">Hóa đơn giá trị gia tăng</h1>

                  <table class="buyer-grid" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:26px;border-collapse:separate;border-spacing:0;background:#f6f8fb;border:1px solid #e3e8f0;border-radius:12px;">
                    <tr>
                      <td class="buyer-cell" width="50%" style="padding:18px 20px;vertical-align:top;border-bottom:1px solid #e3e8f0;">
                        <div style="color:#687386;font-size:11px;">Đơn vị mua hàng</div>
                        <div style="margin-top:5px;font-size:14px;font-weight:700;line-height:1.45;">${escapeHtml(vat.companyName || "Khách hàng")}</div>
                      </td>
                      <td class="buyer-cell" width="50%" style="padding:18px 20px;vertical-align:top;border-bottom:1px solid #e3e8f0;">
                        <div style="color:#687386;font-size:11px;">Mã số thuế</div>
                        <div style="margin-top:5px;font-family:'Courier New',monospace;font-size:14px;font-weight:700;">${escapeHtml(vat.taxCode || "Chưa cung cấp")}</div>
                      </td>
                    </tr>
                    <tr>
                      <td class="buyer-cell" width="50%" style="padding:18px 20px;vertical-align:top;">
                        <div style="color:#687386;font-size:11px;">Địa chỉ</div>
                        <div style="margin-top:5px;font-size:13px;line-height:1.45;">${escapeHtml(vat.address || "Chưa cung cấp")}</div>
                      </td>
                      <td class="buyer-cell" width="50%" style="padding:18px 20px;vertical-align:top;">
                        <div style="color:#687386;font-size:11px;">Ngày lập${table ? " · Bàn" : ""}</div>
                        <div style="margin-top:5px;font-size:13px;font-weight:700;line-height:1.45;">${escapeHtml(issuedAt)}${table ? ` · ${escapeHtml(table)}` : ""}</div>
                      </td>
                    </tr>
                  </table>

                  <table class="item-table" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border-top:2px solid #172033;">
                    <thead>
                      <tr style="background:#f6f8fb;color:#687386;">
                        <th class="cell index" style="padding:11px 8px;text-align:center;font-size:10px;text-transform:uppercase;">STT</th>
                        <th class="cell" style="padding:11px 8px;text-align:left;font-size:10px;text-transform:uppercase;">Tên món</th>
                        <th class="cell quantity-column" style="padding:11px 8px;text-align:right;font-size:10px;text-transform:uppercase;">SL</th>
                        <th class="cell unit-column" style="padding:11px 8px;text-align:right;font-size:10px;text-transform:uppercase;">Đơn giá</th>
                        <th class="cell total-column" style="padding:11px 8px;text-align:right;font-size:10px;text-transform:uppercase;">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px;border-collapse:collapse;">
                    <tr>
                      <td style="padding-bottom:7px;color:#687386;font-size:12px;">Tạm tính</td>
                      <td align="right" style="padding-bottom:7px;color:#172033;font-size:13px;font-weight:700;">${money(subtotal)}</td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:12px;color:#687386;font-size:12px;">Thuế VAT</td>
                      <td align="right" style="padding-bottom:12px;color:#172033;font-size:13px;font-weight:700;">${money(vatTotal)}</td>
                    </tr>
                    <tr>
                      <td class="amount-label" style="color:#687386;font-size:12px;vertical-align:bottom;">Tổng tiền thanh toán</td>
                      <td class="amount-value" align="right" style="color:#172033;font-size:25px;font-weight:800;letter-spacing:-.6px;white-space:nowrap;">${money(invoice.amount)}</td>
                    </tr>
                  </table>

                  <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e3e8f0;text-align:center;color:#687386;font-size:12px;line-height:1.6;">
                    Cảm ơn quý khách đã lựa chọn iGourmet.<br>
                    <span style="font-size:11px;color:#8a94a6;">Email này được gửi tự động đến ${escapeHtml(vat.email)}.</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

async function sendVatInvoiceEmail({ tableId, invoiceId, invoice: suppliedInvoice }) {
  try {
    const invoice = (await loadInvoice(invoiceId || suppliedInvoice?.id)) || suppliedInvoice;
    const resolvedTableId = tableId || invoice?.table_id;
    if (!invoice || !resolvedTableId) return;

    const vatKey = `table_vat_${resolvedTableId}`;
    const vatString = await redisClient.get(vatKey);
    if (!vatString) return;

    const vat = JSON.parse(vatString);
    if (!vat.email) return;

    await sendMail(
      vat.email,
      `Hóa đơn VAT ${invoice.invoice_code} | iGourmet`,
      renderVatInvoiceEmail(vat, invoice)
    );
    await redisClient.del(vatKey);
    logger.info({ email: vat.email, invoiceId: invoice.id }, "Đã gửi hóa đơn VAT qua email");
  } catch (error) {
    logger.error({ err: error, tableId, invoiceId }, "Lỗi gửi hóa đơn VAT qua email");
  }
}

module.exports = { renderVatInvoiceEmail, sendVatInvoiceEmail };
