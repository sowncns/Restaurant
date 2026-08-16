import type { KiemMon } from '../api/checkout'

type InvoiceItem = {
  item_name?: string
  name?: string
  quantity?: number
  unit_price?: number | string
  price?: number | string
  total_price?: number | string
  line_total?: number | string
  discount_percent?: number | string
  vat_rate?: number | string
  vat_amount?: number | string
  is_mistake?: boolean
}

export type PaymentInvoice = {
  invoice_code?: string
  status?: string
  table_name?: string
  table_number?: string
  created_at?: string
  paid_at?: string
  final_amount?: number | string
  amount?: number | string
  items?: InvoiceItem[]
}

const money = (value: number | string | undefined) =>
  `${Number(value || 0).toLocaleString('vi-VN')} đ`

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const receiptStyles = `
  @page { size: 58mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 52mm;
    color: #111827;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5px;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .brand { text-align: center; padding: 1mm 0 2.5mm; }
  .brand-mark {
    display: inline-block;
    border: 1.5px solid #111827;
    padding: 1mm 2.4mm .8mm;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -.4px;
  }
  .document-title {
    margin: 2.5mm 0 .6mm;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .8px;
    text-transform: uppercase;
  }
  .document-note { color: #4b5563; font-size: 9px; }
  .status {
    margin-top: 2mm;
    border: 1.5px solid #111827;
    padding: 1.2mm 1mm;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .5px;
    text-transform: uppercase;
  }
  .section { border-top: 1px dashed #6b7280; padding: 2.4mm 0; }
  .meta-row, .total-row, .tax-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 2mm;
  }
  .meta-row + .meta-row, .tax-row + .tax-row { margin-top: .8mm; }
  .label { color: #4b5563; }
  .value { text-align: right; font-weight: 700; }
  .code { font-family: "Courier New", monospace; letter-spacing: .1px; }
  .items { padding-bottom: 1.2mm; }
  .item { padding: 1.4mm 0; break-inside: avoid; }
  .item + .item { border-top: 1px dotted #d1d5db; }
  .item-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 2mm; }
  .item-name { max-width: 35mm; font-weight: 700; }
  .item-total { white-space: nowrap; font-weight: 700; }
  .item-detail { margin-top: .4mm; color: #4b5563; font-size: 9.5px; }
  .item-tag { font-size: 8px; font-weight: 800; text-transform: uppercase; }
  .summary { padding-top: 2mm; }
  .total-row { margin-top: 1.8mm; padding-top: 1.8mm; border-top: 1.5px solid #111827; }
  .total-label { font-size: 11px; font-weight: 800; text-transform: uppercase; }
  .total-value { font-size: 15px; font-weight: 800; white-space: nowrap; letter-spacing: -.3px; }
  .footer { border-top: 1px dashed #6b7280; padding-top: 2.8mm; text-align: center; }
  .footer strong { display: block; margin-bottom: .8mm; font-size: 10px; }
  .footer span { color: #4b5563; font-size: 8.5px; }
  @media screen {
    body { width: 60mm; margin: 16px auto; padding: 4mm; box-shadow: 0 8px 32px rgba(15, 23, 42, .15); }
  }
  @media print {
    body { width: auto; }
  }
`

function formatDate(value?: string) {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN')
}

function renderPrintDocument(title: string, body: string) {
  return `<!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <style>${receiptStyles}</style>
      </head>
      <body>${body}</body>
    </html>`
}

function openPrintWindow(html: string) {
  const printWindow = window.open('', '_blank', 'width=420,height=720')
  if (!printWindow) {
    window.alert('Trình duyệt đang chặn cửa sổ in. Vui lòng cho phép pop-up và thử lại.')
    return
  }

  printWindow.addEventListener('load', () => {
    printWindow.focus()
    printWindow.print()
    window.setTimeout(() => printWindow.close(), 600)
  })
  printWindow.document.write(html)
  printWindow.document.close()
}

export function renderPaymentInvoice(invoice: PaymentInvoice) {
  const isDebt = invoice.status === 'UNPAID'
  const items = Array.isArray(invoice.items) ? invoice.items : []
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.total_price ?? item.line_total ?? 0),
    0,
  )
  const vatTotal = items.reduce(
    (sum, item) =>
      sum + Number(item.vat_amount ?? (Number(item.total_price ?? item.line_total ?? 0) * Number(item.vat_rate || 0)) / 100),
    0,
  )
  const finalAmount = Number(invoice.final_amount ?? invoice.amount ?? 0)
  const deductions = Math.max(0, subtotal + vatTotal - finalAmount)
  const itemRows = items
    .map((item) => {
      const name = item.item_name || item.name || 'Món ăn'
      const unitPrice = item.unit_price ?? item.price
      const lineTotal = item.total_price ?? item.line_total
      return `<div class="item">
        <div class="item-head">
          <span class="item-name">${escapeHtml(name)}${item.is_mistake ? ' <span class="item-tag">(nhầm lẫn)</span>' : ''}</span>
          <span class="item-total">${money(lineTotal)}</span>
        </div>
        <div class="item-detail">${Number(item.quantity || 0)} × ${money(unitPrice)}${Number(item.vat_rate) > 0 ? ` · VAT ${Number(item.vat_rate)}%` : ''}</div>
      </div>`
    })
    .join('')

  return renderPrintDocument(
    isDebt ? 'Phiếu ghi nợ' : 'Hóa đơn thanh toán',
    `<header class="brand">
      <div class="brand-mark">iGourmet</div>
      <div class="document-title">${isDebt ? 'Phiếu ghi nợ' : 'Hóa đơn thanh toán'}</div>
      <div class="document-note">Ẩm thực trọn vị · Phục vụ tận tâm</div>
      ${isDebt ? '<div class="status">Chưa thanh toán</div>' : ''}
    </header>
    <section class="section">
      <div class="meta-row"><span class="label">Mã hóa đơn</span><span class="value code">${escapeHtml(invoice.invoice_code || '—')}</span></div>
      <div class="meta-row"><span class="label">Bàn</span><span class="value">${escapeHtml(invoice.table_name || invoice.table_number || '—')}</span></div>
      <div class="meta-row"><span class="label">Thời gian</span><span class="value">${escapeHtml(formatDate(invoice.created_at || invoice.paid_at))}</span></div>
    </section>
    <section class="section items">${itemRows}</section>
    <section class="section summary">
      <div class="tax-row"><span class="label">Tạm tính</span><span>${money(subtotal)}</span></div>
      ${vatTotal > 0 ? `<div class="tax-row"><span class="label">Thuế VAT</span><span>${money(vatTotal)}</span></div>` : ''}
      ${deductions > 0 ? `<div class="tax-row"><span class="label">Giảm trừ</span><span>−${money(deductions)}</span></div>` : ''}
      <div class="total-row">
        <span class="total-label">Tổng cộng</span>
        <span class="total-value">${money(finalAmount)}</span>
      </div>
      ${isDebt ? '<div class="meta-row" style="margin-top:2mm"><span class="label">Trạng thái</span><span class="value">Ghi nợ</span></div>' : ''}
    </section>
    <footer class="footer">
      <strong>Cảm ơn quý khách</strong>
      <span>Hẹn gặp lại trong trải nghiệm tiếp theo tại iGourmet.</span>
    </footer>`,
  )
}

export function printPaymentInvoice(invoice: PaymentInvoice) {
  openPrintWindow(renderPaymentInvoice(invoice))
}

export function renderKiemMon(tableLabel: string, data: KiemMon) {
  const itemRows = data.items
    .map(
      (item) => `<div class="item">
        <div class="item-head">
          <span class="item-name">${escapeHtml(item.itemName)}</span>
          <span class="item-total">${money(item.lineTotal)}</span>
        </div>
        <div class="item-detail">${item.quantity} × ${money(item.unitPrice)} · VAT ${Number(item.vat)}%</div>
      </div>`,
    )
    .join('')
  const vatRows = Object.entries(data.vatByRate)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(
      ([rate, amount]) =>
        `<div class="tax-row"><span class="label">VAT ${escapeHtml(rate)}%</span><span>${money(amount)}</span></div>`,
    )
    .join('')

  return renderPrintDocument(
    'Phiếu kiểm món',
    `<header class="brand">
      <div class="brand-mark">iGourmet</div>
      <div class="document-title">Phiếu kiểm món</div>
      <div class="document-note">Chưa thanh toán · Vui lòng kiểm tra</div>
    </header>
    <section class="section">
      <div class="meta-row"><span class="label">Bàn</span><span class="value">${escapeHtml(tableLabel)}</span></div>
      <div class="meta-row"><span class="label">Thời gian</span><span class="value">${escapeHtml(formatDate())}</span></div>
    </section>
    <section class="section items">${itemRows}</section>
    <section class="section summary">
      <div class="tax-row"><span class="label">Tạm tính</span><span>${money(data.subtotal)}</span></div>
      ${vatRows}
      <div class="total-row">
        <span class="total-label">Tổng dự kiến</span>
        <span class="total-value">${money(data.total)}</span>
      </div>
    </section>
    <footer class="footer">
      <strong>Quý khách vui lòng kiểm tra món</strong>
      <span>Phiếu này không phải hóa đơn thanh toán.</span>
    </footer>`,
  )
}

export function printKiemMon(tableLabel: string, data: KiemMon) {
  openPrintWindow(renderKiemMon(tableLabel, data))
}
