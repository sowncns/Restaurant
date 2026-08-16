import http from 'node:http'

const companies = [
  { id: 1, name: 'iGourmet Test', code: 'IGT', description: 'Du lieu QA local', logo_url: '', phone: '0900000000', email: 'qa@example.test', address: 'Quan 1', status: 'ACTIVE' },
  { id: 2, name: 'Bistro Test', code: 'BST', description: 'Thuong hieu thu hai', logo_url: '', phone: '0911111111', email: 'bistro@example.test', address: 'Quan 3', status: 'ACTIVE' },
]
const branches = [
  { id: 11, company_id: 1, name: 'Chi nhanh Trung Tam', address: '123 Nguyen Hue, TP.HCM', phone: '0900000000', opening_time: '08:00', closing_time: '22:00' },
  { id: 12, company_id: 1, name: 'Chi nhanh San Vuon', address: '45 Le Loi, TP.HCM', phone: '0900000001', opening_time: '09:00', closing_time: '23:00' },
]
const menu = [
  { category_id: 1, category_name: 'Mon chinh', items: Array.from({ length: 70 }, (_, index) => ({ id: index + 1, menu_item_id: index + 1, name: `Mon an QA ${index + 1}`, description: 'Mon mau dung cho kiem thu local', image_url: '', price: 100000 + index * 10000, vat: index % 2 ? 8 : 10 })) },
  { category_id: 2, category_name: 'Do uong', items: [{ id: 20, menu_item_id: 20, name: 'Tra dao QA', description: 'Do uong mau', image_url: '', price: 65000, vat: 8 }] },
]
const tables = [
  { id: 1, branch_id: 11, branch_name: 'Chi nhanh Trung Tam', section_id: 1, section_name: 'Tang 1', table_number: 'T01', table_name: 'Ban cua so', capacity: 4, status: 'AVAILABLE', active_waiter_name: null, active_order_amount: 0, active_order_id: null, upcoming_reservation: null },
  { id: 2, branch_id: 11, branch_name: 'Chi nhanh Trung Tam', section_id: 1, section_name: 'Tang 1', table_number: 'T02', table_name: 'Ban gia dinh', capacity: 8, status: 'SERVING', active_waiter_name: 'Nhan vien QA', active_order_amount: 450000, active_order_id: 101, upcoming_reservation: null },
  { id: 3, branch_id: 11, branch_name: 'Chi nhanh Trung Tam', section_id: 2, section_name: 'San vuon', table_number: 'S01', table_name: 'Ban san vuon', capacity: 6, status: 'RESERVED', active_waiter_name: null, active_order_amount: 0, active_order_id: null, upcoming_reservation: { id: 1, customer_name: 'Khach QA', reservation_time: '19:00', guest_count: 4 } },
]
const sections = [
  { id: 1, branch_id: 11, branch_name: 'Chi nhanh Trung Tam', name: 'Tang 1', section_type: 'INDOOR', status: 'ACTIVE' },
  { id: 2, branch_id: 11, branch_name: 'Chi nhanh Trung Tam', name: 'San vuon', section_type: 'OUTDOOR', status: 'ACTIVE' },
]

function json(res, status, body, origin) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin || '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  })
  res.end(JSON.stringify(body))
}

function sse(res, origin) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    'access-control-allow-origin': origin || '*',
    'access-control-allow-credentials': 'true',
  })
  res.write(': qa mock connected\n\n')
}

function staffFor(username = '') {
  const normalized = username.toLowerCase()
  const role = normalized.includes('cashier') ? 'CASHIER'
    : normalized.includes('waiter') ? 'WAITER'
      : normalized.includes('kitchen') ? 'KITCHEN'
        : normalized.includes('reception') ? 'RECEPTIONIST'
          : 'SUPER_ADMIN'
  return { id: 1, employee_id: 1, username, full_name: `QA ${role}`, role, company_id: 1, branch_id: 11, status: 'ACTIVE' }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin
  if (req.method === 'OPTIONS') return json(res, 204, {}, origin)
  const url = new URL(req.url, 'http://127.0.0.1:5999')
  let body = {}
  for await (const chunk of req) body = { ...body, ...JSON.parse(chunk.toString() || '{}') }

  if (url.pathname === '/api/public/companies') return json(res, 200, { companies }, origin)
  if (/\/api\/public\/companies\/\d+\/branches/.test(url.pathname)) return json(res, 200, { branches }, origin)
  if (/\/api\/public\/companies\/\d+\/menu/.test(url.pathname)) return json(res, 200, { menu }, origin)
  if (url.pathname === '/api/public/home-banners') return json(res, 200, { banners: [] }, origin)
  if (url.pathname === '/api/public/reservations' && req.method === 'POST') return json(res, 201, { message: 'Dat ban QA thanh cong', reservation: { id: 999, ...body } }, origin)

  if (url.pathname === '/api/internal/auth/login') return json(res, 200, { message: 'OK', staff: staffFor(body.username) }, origin)
  if (url.pathname === '/api/internal/auth/refresh-token') return json(res, 401, { message: 'QA guest session' }, origin)
  if (url.pathname === '/api/internal/auth/logout') return json(res, 200, { message: 'OK' }, origin)
  if (url.pathname === '/api/internal/dining-tables/sections') return json(res, 200, { sections }, origin)
  if (url.pathname === '/api/internal/dining-tables/tables') return json(res, 200, { tables }, origin)
  if (url.pathname === '/api/internal/checkout/invoices') return json(res, 200, [{ id: 1, invoice_code: 'INV-QA-001', amount: 500000, status: 'UNPAID', created_at: new Date().toISOString(), table_name: 'Ban gia dinh' }], origin)
  if (/\/api\/internal\/orders\/table\/\d+\/active/.test(url.pathname)) return json(res, 200, { order_id: 101, table_id: 2, status: 'CONFIRMED', note: null, items: [{ order_item_id: 1, item_name: 'Mon an QA 1', quantity: 2, unit_price: 100000, total_price: 200000, vat_rate: 10, billing_status: 'BILLABLE', kitchen_status: 'WAITING' }] }, origin)
  if (url.pathname === '/api/internal/menu-categories') return json(res, 200, { categories: menu.map(({ category_id: id, category_name: name }) => ({ id, name, status: 'ACTIVE', company_id: 1 })) }, origin)
  if (url.pathname === '/api/internal/menu-items') return json(res, 200, { items: menu.flatMap(category => category.items.map(item => ({ ...item, category_id: category.category_id, category_name: category.category_name, status: 'ACTIVE', is_available: true }))) }, origin)
  if (url.pathname === '/api/internal/orders/kitchen/queue') return json(res, 200, [{ id: 1, order_id: 101, menu_item_id: 1, item_name: 'Mon an QA 1', quantity: 2, table_number: 'T02', order_code: 'OD-QA', kitchen_status: 'WAITING', created_at: new Date().toISOString() }], origin)
  if (url.pathname === '/api/internal/orders/kitchen/history') return json(res, 200, [], origin)
  if (url.pathname === '/api/internal/orders/kitchen/preorders') return json(res, 200, [], origin)
  if (url.pathname === '/api/internal/orders/kitchen/stream') return sse(res, origin)
  if (url.pathname === '/api/internal/cancel-requests') return json(res, 200, { requests: [] }, origin)
  if (url.pathname === '/api/internal/reservations') return json(res, 200, { reservations: [] }, origin)
  if (url.pathname === '/api/internal/reservations/alerts') return json(res, 200, { alerts: [] }, origin)
  if (url.pathname === '/api/internal/reservations/call-list') return json(res, 200, { pending: [], called: [] }, origin)
  if (url.pathname === '/api/internal/reports/dashboard') return json(res, 200, { data: { revenue_7d: [], today: { date: '2026-08-16', revenue: 1200000, invoice_count: 8, total_orders: 10, completed_orders: 8, total_guests: 24 }, month: { from: '2026-08-01', revenue: 18000000, invoice_count: 100 }, top_items: [], table_status: [] } }, origin)
  if (url.pathname === '/api/internal/reports/admin-overview') return json(res, 200, { data: { system: { companies: 2, branches: 2, employees: 12 }, companies: [] } }, origin)
  if (url.pathname === '/api/internal/branches') return json(res, 200, { branches }, origin)
  if (url.pathname === '/api/internal/companies') return json(res, 200, { companies }, origin)

  if (url.pathname === '/api/customer/profile/me') return json(res, 401, { message: 'QA guest session' }, origin)
  if (url.pathname === '/api/customer/auth/refresh-token') return json(res, 401, { message: 'QA guest session' }, origin)
  if (url.pathname === '/api/customer/auth/login') return json(res, 200, { customer: { id: 7, full_name: 'Khach hang QA', email: body.email, phone: '0900000000', email_verified: true, has_payment_pin: true, points: 1200, rank: 'silver', wallet_balance: 500000 } }, origin)
  if (url.pathname === '/api/customer/auth/logout') return json(res, 200, { message: 'OK' }, origin)
  if (url.pathname === '/api/customer/voucher') return json(res, 200, { vouchers: [] }, origin)
  if (url.pathname === '/api/customer/profile/transactions') return json(res, 200, { transactions: [] }, origin)
  if (url.pathname === '/api/customer/qr-payment/pending') return json(res, 200, { pending: [] }, origin)
  if (url.pathname === '/api/customer/qr-payment/invoices') return json(res, 200, [], origin)
  if (url.pathname === '/api/customer/reservations') return json(res, 200, { reservations: [] }, origin)
  if (url.pathname === '/api/customer/cart') return json(res, 404, { message: 'No cart' }, origin)
  if (url.pathname === '/api/customer/cart/create') return json(res, 201, { cart: { id: 1, items: [] } }, origin)

  return json(res, 404, { message: `QA mock: endpoint not implemented (${req.method} ${url.pathname})` }, origin)
})

server.listen(5999, '127.0.0.1', () => console.log('QA mock API listening on 5999'))
