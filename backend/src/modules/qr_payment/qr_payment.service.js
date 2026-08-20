// src/modules/qr_payment/qr_payment.service.js
// Logic dung chung cho thanh toan QR. Nhan vien GUI yeu cau -> khach XAC NHAN.
const { redisClient } = require("../../config/redis");
const { randomUUID } = require("crypto");
const { EventEmitter } = require("events");
const pool = require("../../config/db");
const repo = require("./qr_payment.repository");
const { applyCashback } = require("../../shared/services/cashback.service");
const {
  verifyPaymentPin,
  addPointsAndProcessRank,
} = require("../customer/profile/profile.service");
const { BadRequest, NotFound } = require("../../shared/errors/AppError");
const { genRedeemCode } = require("../../shared/utils/redeemCode");
const logger = require("../../shared/utils/logger");
const { sendVatInvoiceEmail } = require("../../shared/services/vatInvoiceEmail.service");

const REQ_KEY = (id) => `qr_payment_req_id:${id}`;
const PENDING_KEY = (cid) => `qr_payment_pending_cust:${cid}`;
const TOKEN_KEY = (tok) => `payment_token:${tok}`;
const SCAN_KEY = (tok) => `qr_scan:${tok}`;
const SCAN_CODE_KEY = (c) => `qr_scan_code:${String(c).trim().toUpperCase()}`;
const SCAN_TTL = 120; // giay
const INTENT_KEY = (tid) => `checkout_intent_table_${tid}`;


const qrEvents = new EventEmitter();
qrEvents.setMaxListeners(0); // nhieu ket noi SSE dong thoi
exports.qrEvents = qrEvents;


async function settle(customerId, { invoiceId, companyId, branchId, restaurantName }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const invoice = await repo.lockInvoiceForPayment(client, invoiceId, companyId, branchId);
    if (!invoice) throw new NotFound("Không tìm thấy hóa đơn.");
    if (invoice.status !== "UNPAID") throw new BadRequest("Hóa đơn đã được xử lý.");
    if (invoice.customer_id && String(invoice.customer_id) !== String(customerId)) {
      throw new BadRequest("Hóa đơn không thuộc về khách hàng này.");
    }
    const payAmount = parseFloat(invoice.amount);
    const tableId = invoice.table_id;

    const wallet = await repo.lockWallet(client, customerId);
    if (!wallet) throw new NotFound("Không tìm thấy ví của khách hàng.");

    const balanceBefore = parseFloat(wallet.balance);
    if (balanceBefore < payAmount) throw new BadRequest("Số dư trong ví không đủ để thanh toán.");
    const balanceAfter = balanceBefore - payAmount;

    await repo.updateBalance(client, customerId, balanceAfter);
    await repo.insertPayTransaction(client, {
      walletId: wallet.id,
      code: `PAY-${Date.now()}`,
      amount: payAmount,
      balanceBefore,
      balanceAfter,
      invoiceId,
      description: `Thanh toán hóa đơn qua QR tại ${restaurantName}`,
    });

    await repo.markInvoicePaid(client, invoiceId, customerId);
    await applyCashback(client, invoiceId); // hoan tien theo hang
    await repo.completeOrders(client, tableId);
    await repo.setTableStatus(client, tableId, "SERVING");
    await redisClient.del(INTENT_KEY(tableId));

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }


  void sendVatInvoiceEmail({ invoiceId });
  try {
    const invoice = await pool.query("SELECT amount FROM invoices WHERE invoice_id = $1", [invoiceId]);
    await addPointsAndProcessRank(customerId, parseFloat(invoice.rows[0].amount));
  } catch (e) {
    logger.error({ err: e }, "Lỗi cộng điểm sau thanh toán QR");
  }
}

// ============ KHACH HANG ============
exports.generatePaymentToken = async (customerId) => {
  const token = `PAY-${randomUUID()}`;
  await redisClient.set(TOKEN_KEY(token), String(customerId), { EX: 60 });
  return { token, expiresIn: 60 };
};

// Sinh QR token de nhan vien quet: loai "voucher" (kem voucher) hoac "member" (chi khach).
// Token ngan han, dung 1 lan (nhan vien quet -> xoa).
exports.generateScanToken = async (customerId, { kind, customerVoucherId }) => {
  const payload = { customerId: String(customerId) };

  if (kind === "voucher") {
    if (!customerVoucherId) throw new BadRequest("Thiếu customerVoucherId cho mã voucher.");
    const cv = await repo.findUnusedCustomerVoucher(customerId, customerVoucherId);
    if (!cv) throw new BadRequest("Voucher không hợp lệ, không thuộc về bạn hoặc đã được sử dụng.");
    payload.type = "VOUCHER";
    payload.voucherCode = cv.code;
  } else {
    payload.type = "MEMBER";
  }

  const token = `QRS-${randomUUID()}`;
  const data = JSON.stringify(payload);
  await redisClient.set(SCAN_KEY(token), data, { EX: SCAN_TTL });

  // Voucher: kem ma go tay NGAN, ephemeral (song/chet cung QR 120s) de nhan vien go khi
  // khong quet duoc. Member khong can (nhan vien go SDT/ID khach). Retry neu trung ma dang song.
  let code = null;
  if (kind === "voucher") {
    for (let i = 0; i < 5; i++) {
      const c = genRedeemCode(6);
      const ok = await redisClient.set(SCAN_CODE_KEY(c), data, { EX: SCAN_TTL, NX: true });
      if (ok) { code = c; break; }
    }
  }
  return { token, code, expiresIn: SCAN_TTL };
};

// Nhan vien quet: doc token, xoa ngay (dung 1 lan), tra du lieu da giai ma.
exports.resolveScanToken = async (token) => {
  const dataStr = await redisClient.get(SCAN_KEY(token));
  if (!dataStr) throw new NotFound("Mã QR không hợp lệ hoặc đã hết hạn.");
  await redisClient.del(SCAN_KEY(token));
  return JSON.parse(dataStr);
};

// Nhan vien go ma ngan (fallback khi khong quet duoc): doc + xoa (dung 1 lan).
// Tra null neu khong co -> caller coi la SDT/ID member.
exports.resolveScanCode = async (code) => {
  const key = SCAN_CODE_KEY(code);
  const dataStr = await redisClient.get(key);
  if (!dataStr) return null;
  await redisClient.del(key);
  return JSON.parse(dataStr);
};

exports.getPendingPayment = async (customerId) => {
  const requestId = await redisClient.get(PENDING_KEY(customerId));
  if (!requestId) return null;
  const dataStr = await redisClient.get(REQ_KEY(requestId));
  if (!dataStr) return null;
  const data = JSON.parse(dataStr);
  if (data.status !== "PENDING") return null;

  let items = [];
  if (data.invoiceId) {
    const r = await pool.query("SELECT items FROM invoices WHERE invoice_id = $1", [data.invoiceId]);
    if (r.rows[0] && r.rows[0].items) {
      items = r.rows[0].items;
    }
  }

  return {
    requestId: data.requestId,
    amount: data.amount,
    restaurantName: data.restaurantName,
    tableId: data.tableId,
    createdAt: data.createdAt,
    items,
  };
};

exports.confirmPayment = async (customerId, requestId, action, pin) => {
  if (!requestId || !action) throw new BadRequest("Thiếu dữ liệu (requestId, action).");

  const dataStr = await redisClient.get(REQ_KEY(requestId));
  if (!dataStr) throw new NotFound("Yêu cầu thanh toán không tồn tại hoặc đã hết hạn.");
  const data = JSON.parse(dataStr);

  if (String(data.customerId) !== String(customerId)) {
    throw new BadRequest("Yêu cầu thanh toán không thuộc về bạn.");
  }
  if (data.status !== "PENDING") throw new BadRequest("Yêu cầu này đã được xử lý.");

  if (action === "REJECT") {
    data.status = "REJECTED";
    await redisClient.set(REQ_KEY(requestId), JSON.stringify(data), { EX: 30 });
    await redisClient.del(PENDING_KEY(customerId));
    return "Đã hủy yêu cầu thanh toán.";
  }

  if (action === "ACCEPT") {
    if (!pin) throw new BadRequest("Vui lòng nhập mã PIN.");
    await verifyPaymentPin(customerId, pin); // xac thuc PIN truoc khi tru tien

    await settle(customerId, {
      invoiceId: data.invoiceId,
      companyId: data.companyId,
      branchId: data.branchId,
      restaurantName: data.restaurantName,
    });

    data.status = "SUCCESS";
    await redisClient.set(REQ_KEY(requestId), JSON.stringify(data), { EX: 60 });
    await redisClient.del(PENDING_KEY(customerId));
    return "Thanh toán thành công.";
  }

  throw new BadRequest("Hành động không hợp lệ.");
};

exports.getInvoiceHistory = async (customerId) => {
  const rows = await repo.getInvoiceHistory(customerId);
  return rows.map((r) => ({
    id: r.id,
    invoiceCode: r.invoice_code,
    amount: r.amount,
    status: r.status,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    restaurantName: `${r.company_name || "Hệ thống"} - ${r.branch_name || "Chi nhánh"}`,
  }));
};

exports.getInvoiceById = async (customerId, invoiceId) => {
  const r = await repo.getInvoiceById(customerId, invoiceId);
  if (!r) return null;
  return {
    id: r.id,
    invoiceCode: r.invoice_code,
    amount: r.amount,
    status: r.status,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    items: r.items || [],
    restaurantName: `${r.company_name || "Hệ thống"} - ${r.branch_name || "Chi nhánh"}`,
  };
};

// ============ NHAN VIEN ============
exports.requestPayment = async (user, customerId, amount, tableId, invoiceId = null) => {
  if (!customerId || !invoiceId) {
    throw new BadRequest("Thiếu thông tin yêu cầu thanh toán (customerId, amount, tableId)");
  }

  const client = await pool.connect();
  let invoice;
  try {
    await client.query("BEGIN");
    invoice = await repo.lockInvoiceForPayment(client, invoiceId, user.company_id, user.branch_id);
    if (!invoice) throw new NotFound("Không tìm thấy hóa đơn.");
    if (invoice.status !== "UNPAID") throw new BadRequest("Hóa đơn đã được xử lý.");
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  if (!invoice.customer_id) throw new BadRequest("Hóa đơn chưa được gắn với khách hàng.");
  const scopedCustomerId = invoice.customer_id;
  const restaurantName = await repo.findRestaurantName(invoice.branch_id);

  // TH1: Khach quet token (PAY-...) -> tru tien ngay
  if (String(customerId).startsWith("PAY-")) {
    const realCustomerId = await redisClient.get(TOKEN_KEY(customerId));
    if (!realCustomerId) throw new BadRequest("Mã thanh toán không hợp lệ hoặc đã hết hạn.");
    if (String(realCustomerId) !== String(scopedCustomerId)) {
      throw new BadRequest("Mã thanh toán không thuộc khách hàng trên hóa đơn.");
    }

    await settle(realCustomerId, {
      invoiceId,
      companyId: invoice.company_id,
      branchId: invoice.branch_id,
      restaurantName,
    });
    await redisClient.del(TOKEN_KEY(customerId));

    const fakeRequestId = randomUUID();
    await redisClient.set(REQ_KEY(fakeRequestId), JSON.stringify({
      status: "SUCCESS",
      tableId: invoice.table_id,
      companyId: invoice.company_id,
      branchId: invoice.branch_id,
    }), { EX: 60 });
    return fakeRequestId;
  }

  if (String(scopedCustomerId) !== String(customerId)) {
    throw new BadRequest("Hóa đơn không thuộc về khách hàng này.");
  }

  // TH2: Push xuong app khach (khach tu xac nhan)
  const customer = await repo.findCustomerByIdOrPhone(scopedCustomerId);
  if (!customer) throw new BadRequest("Không tìm thấy khách hàng này trong hệ thống.");
  const realCustomerId = customer.id;

  const requestId = randomUUID();
  const paymentData = {
    requestId,
    customerId: realCustomerId,
    amount: invoice.amount,
    tableId: invoice.table_id,
    invoiceId,
    companyId: invoice.company_id,
    branchId: invoice.branch_id,
    restaurantName,
    status: "PENDING",
    createdAt: Date.now(),
  };
  await redisClient.set(REQ_KEY(requestId), JSON.stringify(paymentData), { EX: 120 });
  await redisClient.set(PENDING_KEY(realCustomerId), requestId, { EX: 120 });
  qrEvents.emit(`pending:${realCustomerId}`); // push realtime xuong app khach
  return requestId;
};

exports.getPaymentStatus = async (user, requestId) => {
  const dataStr = await redisClient.get(REQ_KEY(requestId));
  if (!dataStr) throw new NotFound("Yêu cầu thanh toán không tồn tại hoặc đã hết hạn.");
  const data = JSON.parse(dataStr);
  if (String(data.companyId) !== String(user.company_id) || String(data.branchId) !== String(user.branch_id)) {
    throw new NotFound("Yêu cầu thanh toán không tồn tại hoặc đã hết hạn.");
  }
  return data;
};

exports.cancelPayment = async (user, requestId) => {
  const dataStr = await redisClient.get(REQ_KEY(requestId));
  if (!dataStr) return;
  const data = JSON.parse(dataStr);
  if (String(data.companyId) !== String(user.company_id) || String(data.branchId) !== String(user.branch_id)) {
    throw new NotFound("Yêu cầu thanh toán không tồn tại hoặc đã hết hạn.");
  }
  if (data.status !== "PENDING") throw new BadRequest("Yêu cầu này đã được xử lý.");
  data.status = "REJECTED";
  await redisClient.set(REQ_KEY(requestId), JSON.stringify(data), { EX: 10 });
  if (data.customerId) await redisClient.del(PENDING_KEY(data.customerId));
};
