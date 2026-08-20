// src/modules/internal/procurement/procurement.service.js
// Tang nghiep vu: Nha cung cap + Phieu nhap kho.
// Pham vi theo company_id (giong inventory). Xac nhan phieu -> cong ton kho & ghi
// inventory_transactions (PURCHASE, reference_type='PURCHASE_RECEIPT').
const repo = require("./procurement.repository");
const inventoryRepo = require("../inventory/inventory.repository");
const { NotFound, BadRequest, Conflict } = require("../../../shared/errors/AppError");
const { sendMail } = require("../../../shared/utils/mail");

// ---------- Suppliers ----------
exports.listSuppliers = (companyId, filters) => repo.findSuppliers(companyId, filters);

exports.getSupplier = async (id, companyId) => {
  const supplier = await repo.findSupplierById(id, companyId);
  if (!supplier) throw new NotFound("Không tìm thấy nhà cung cấp");
  return supplier;
};

exports.createSupplier = (companyId, data) => repo.insertSupplier(companyId, data);

exports.updateSupplier = async (id, companyId, data) => {
  const supplier = await repo.updateSupplier(id, companyId, data);
  if (!supplier) throw new NotFound("Không tìm thấy nhà cung cấp");
  return supplier;
};

exports.deleteSupplier = async (id, companyId) => {
  const supplier = await repo.updateSupplier(id, companyId, { status: "INACTIVE" });
  if (!supplier) throw new NotFound("Không tìm thấy nhà cung cấp");
  return supplier;
};

// ---------- Purchase receipts ----------
exports.listReceipts = (companyId, branchId, filters) => repo.findReceipts(companyId, branchId, filters);

exports.getReceipt = async (id, companyId, branchId) => {
  const receipt = await repo.findReceiptById(id, companyId, branchId);
  if (!receipt) throw new NotFound("Không tìm thấy phiếu nhập");
  const items = await repo.findReceiptItems(id);
  return { ...receipt, items };
};

async function assertBranchCompany(branchId, companyId) {
  if (branchId == null) return;
  const branch = await repo.findBranchById(branchId);
  if (!branch || branch.company_id !== companyId) {
    throw new BadRequest("Chi nhánh không tồn tại hoặc không thuộc công ty");
  }
}

exports.createReceipt = async (companyId, branchScopeId, createdBy, data) => {
  // NCC phai thuoc cong ty & con hoat dong
  const supplier = await repo.findSupplierById(data.supplier_id, companyId);
  if (!supplier) throw new BadRequest("Nhà cung cấp không tồn tại");
  if (supplier.status !== "ACTIVE") throw new BadRequest("Nhà cung cấp đã ngưng hoạt động");

  const branchId = branchScopeId ?? data.branch_id ?? null;
  await assertBranchCompany(branchId, companyId);

  // Nguyen lieu phai thuoc cung cong ty; tinh line_amount.
  const items = [];
  for (const it of data.items) {
    const ing = await inventoryRepo.findIngredientById(it.ingredient_id, companyId);
    if (!ing) throw new BadRequest(`Nguyên liệu #${it.ingredient_id} không tồn tại hoặc không thuộc công ty`);
    const unitPrice = Number(it.unit_price ?? 0);
    items.push({
      ingredient_id: it.ingredient_id,
      quantity: Number(it.quantity),
      unit_price: unitPrice,
      line_amount: Number((Number(it.quantity) * unitPrice).toFixed(2)),
      note: it.note,
    });
  }

  const header = {
    supplier_id: data.supplier_id,
    branch_id: branchId,
    receipt_code: data.receipt_code || `PN-${Date.now()}`,
    receipt_date: data.receipt_date ?? null,
    note: data.note ?? null,
    created_by: createdBy,
  };

  let id;
  try {
    id = await repo.createReceipt(companyId, header, items);
  } catch (e) {
    if (e.code === "23505") throw new Conflict("Mã phiếu nhập đã tồn tại");
    throw e;
  }
  return exports.getReceipt(id, companyId, branchScopeId);
};

exports.confirmReceipt = async (id, companyId, branchId, staffId) => {
  const existing = await repo.findReceiptById(id, companyId, branchId);
  if (!existing) throw new NotFound("Không tìm thấy phiếu nhập");
  await assertBranchCompany(existing.branch_id, companyId);
  const result = await repo.confirmReceipt(id, companyId, branchId, staffId);
  if (result.error === "NOT_FOUND") throw new NotFound("Không tìm thấy phiếu nhập");
  if (result.error === "NOT_DRAFT") throw new BadRequest(`Phiếu đã ở trạng thái ${result.status}, không thể xác nhận`);
  if (result.error === "NO_BRANCH") throw new BadRequest("Phiếu nhập chưa gắn chi nhánh. Vui lòng cập nhật chi nhánh trước khi xác nhận");
  if (result.error === "INGREDIENT_NOT_FOUND") throw new BadRequest(`Nguyên liệu #${result.ingredientId} không hợp lệ`);
  return exports.getReceipt(id, companyId, branchId);
};

exports.getReceiptByCode = async (code, companyId, branchId) => {
  const receipt = await repo.findReceiptByCode(code, companyId, branchId);
  if (!receipt) throw new NotFound("Không tìm thấy phiếu nhập với mã này");
  const items = await repo.findReceiptItems(receipt.id);
  return { ...receipt, items };
};

exports.importReceiptByCode = async (code, companyId, branchScopeId, requestedBranchId, staffId) => {
  const receipt = await repo.findReceiptByCode(code, companyId, branchScopeId);
  if (!receipt) throw new NotFound("Không tìm thấy phiếu nhập với mã này");
  const branchId = branchScopeId ?? requestedBranchId ?? receipt.branch_id;
  await assertBranchCompany(branchId, companyId);
  const result = await repo.importReceipt(receipt.id, companyId, branchScopeId, branchId, staffId);
  if (result.error === "ALREADY_IMPORTED") throw new BadRequest("Phiếu này đã được nhập kho, không thể nhập lại");
  if (result.error === "CANCELLED") throw new BadRequest("Phiếu này đã bị hủy");
  if (result.error === "NO_BRANCH") throw new BadRequest("Không xác định được chi nhánh để nhập kho. Vui lòng chỉ định chi nhánh");
  return { ...result, receipt: await exports.getReceipt(receipt.id, companyId, branchScopeId) };
};

exports.cancelReceipt = async (id, companyId, branchId) => {
  const existing = await repo.findReceiptById(id, companyId, branchId);
  if (!existing) throw new NotFound("Không tìm thấy phiếu nhập");
  if (existing.status !== "DRAFT") throw new BadRequest("Chỉ hủy được phiếu ở trạng thái nháp (DRAFT)");
  await repo.cancelReceipt(id, companyId, branchId);
  return exports.getReceipt(id, companyId, branchId);
};

exports.emailReceipt = async (id, companyId, branchId) => {
  const receipt = await exports.getReceipt(id, companyId, branchId);
  if (!receipt) throw new NotFound("Không tìm thấy phiếu nhập");

  // supplier_email da có sẵn trong receipt (JOIN suppliers trong query)
  const supplierEmail = receipt.supplier_email;
  if (!supplierEmail) throw new BadRequest("Nhà cung cấp này chưa có địa chỉ email. Vui lòng cập nhật email cho nhà cung cấp trước");

  const num = (v) => new Intl.NumberFormat("vi-VN").format(Number(v || 0));
  const statusLabel = { DRAFT: "Chưa nhập", CONFIRMED: "Đã nhập kho", CANCELLED: "Đã hủy" };

  const rows = receipt.items.map((it, i) => `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"}">
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px">${i + 1}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:500;color:#1e293b;font-size:13px">
        ${it.ingredient_name}
        ${it.ingredient_code ? `<span style="display:block;font-size:11px;color:#94a3b8;font-weight:400">${it.ingredient_code}</span>` : ""}
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;text-align:center">${it.unit || "—"}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;color:#1e293b">${num(it.quantity)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;color:#1e293b">${num(it.unit_price)}₫</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;font-weight:600;color:#0f172a">${num(it.line_amount ?? 0)}₫</td>
    </tr>`).join("");

  const statusColor = { DRAFT: "#f59e0b", CONFIRMED: "#10b981", CANCELLED: "#ef4444" };
  const badgeBg    = { DRAFT: "#fffbeb", CONFIRMED: "#ecfdf5", CANCELLED: "#fef2f2" };

  const html = `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Phiếu nhập kho ${receipt.receipt_code}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:32px 36px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-.3px">🧾 Phiếu Nhập Kho</h1>
          <p style="margin:6px 0 0;color:#bfdbfe;font-size:14px">Thông báo từ hệ thống iGourmet</p>
        </div>
        <div style="text-align:right">
          <div style="background:rgba(255,255,255,.15);border-radius:8px;padding:8px 16px;display:inline-block">
            <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.5px">${receipt.receipt_code}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Status bar -->
    <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:14px 36px;display:flex;align-items:center;gap:10px">
      <span style="background:${badgeBg[receipt.status] || "#f1f5f9"};color:${statusColor[receipt.status] || "#64748b"};border:1px solid ${statusColor[receipt.status] || "#cbd5e1"};border-radius:20px;padding:3px 12px;font-size:12px;font-weight:600">
        ${statusLabel[receipt.status] || receipt.status}
      </span>
      <span style="color:#94a3b8;font-size:13px">•</span>
      <span style="color:#64748b;font-size:13px">Ngày: <strong style="color:#1e293b">${receipt.receipt_date ? new Date(receipt.receipt_date).toISOString().slice(0, 10) : "—"}</strong></span>
    </div>

    <div style="padding:28px 36px">

      <!-- Info grid -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr>
          <td style="width:50%;padding:0 12px 0 0;vertical-align:top">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px">
              <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;font-weight:600">Nhà Cung Cấp</p>
              <p style="margin:0;font-size:15px;font-weight:700;color:#1e293b">${receipt.supplier_name}</p>
              ${receipt.supplier_code ? `<p style="margin:4px 0 0;font-size:12px;color:#64748b">Mã: ${receipt.supplier_code}</p>` : ""}
            </div>
          </td>
          <td style="width:50%;padding:0 0 0 12px;vertical-align:top">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px">
              <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;font-weight:600">Chi Nhánh</p>
              <p style="margin:0;font-size:15px;font-weight:700;color:#1e293b">${receipt.branch_name || "—"}</p>
              ${receipt.created_by_name ? `<p style="margin:4px 0 0;font-size:12px;color:#64748b">Người tạo: ${receipt.created_by_name}</p>` : ""}
            </div>
          </td>
        </tr>
      </table>

      ${receipt.note ? `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:24px">
        <p style="margin:0;font-size:13px;color:#92400e"><strong>📝 Ghi chú:</strong> ${receipt.note}</p>
      </div>` : ""}

      <!-- Items table -->
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:.5px">Chi Tiết Nguyên Liệu</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#1e40af">
            <th style="padding:11px 14px;text-align:left;font-size:12px;color:#bfdbfe;font-weight:600;text-transform:uppercase;letter-spacing:.5px">#</th>
            <th style="padding:11px 14px;text-align:left;font-size:12px;color:#bfdbfe;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Nguyên liệu</th>
            <th style="padding:11px 14px;text-align:center;font-size:12px;color:#bfdbfe;font-weight:600;text-transform:uppercase;letter-spacing:.5px">ĐVT</th>
            <th style="padding:11px 14px;text-align:right;font-size:12px;color:#bfdbfe;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Số lượng</th>
            <th style="padding:11px 14px;text-align:right;font-size:12px;color:#bfdbfe;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Đơn giá</th>
            <th style="padding:11px 14px;text-align:right;font-size:12px;color:#bfdbfe;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Thành tiền</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#eff6ff">
            <td colspan="5" style="padding:14px 14px;text-align:right;font-size:14px;font-weight:700;color:#1e40af;border-top:2px solid #bfdbfe">TỔNG CỘNG</td>
            <td style="padding:14px 14px;text-align:right;font-size:16px;font-weight:800;color:#1e40af;border-top:2px solid #bfdbfe">${num(receipt.total_amount)}₫</td>
          </tr>
        </tfoot>
      </table>

    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center">
      <p style="margin:0;font-size:12px;color:#94a3b8">Email này được gửi tự động từ hệ thống <strong style="color:#3b82f6">iGourmet</strong>. Vui lòng không trả lời email này.</p>
    </div>
  </div>
</body>
</html>`;

  await sendMail(
    supplierEmail,
    `[iGourmet] Phiếu nhập kho ${receipt.receipt_code} – ${num(receipt.total_amount)}₫`,
    html
  );

  return { message: `Đã gửi email phiếu nhập tới ${supplierEmail}` };
};
