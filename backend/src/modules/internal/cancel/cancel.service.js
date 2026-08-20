// src/modules/internal/cancel/cancel.service.js
// Nghiep vu huy mon: phuc vu gui yeu cau -> BEP quyet dinh.
//   WAITING  -> vao hang cho bep (PENDING).
//   Da nau (READY/SERVED/...) -> tu dong REJECTED + danh dau nham lan (BR-08).
//   COMBO cha -> luon PENDING, bep quyet dinh tach mon le hay huy het.
const pool = require("../../../config/db");
const repo = require("./cancel.repository");
const { BadRequest, NotFound, Conflict } = require("../../../shared/errors/AppError");

const CLOSED_ORDER = new Set(["COMPLETED", "CANCELLED"]);

// Phuc vu tao yeu cau huy 1 mon da gui bep.
async function createRequest({ orderId, orderItemId, user, reason_code, reason_note, requested_qty }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const item = await repo.lockItemForCancel(client, orderItemId, user.company_id, user.branch_id);
    if (!item) throw new NotFound("Không tìm thấy món trong đơn");
    if (item.order_id !== orderId) throw new BadRequest("Món không thuộc đơn này");
    if (CLOSED_ORDER.has(item.order_status)) {
      throw new BadRequest("Đơn đã đóng — dùng quy trình hoàn tiền (refund)");
    }
    if (item.kitchen_status === "CANCELLED" || item.billing_status === "VOIDED") {
      throw new BadRequest("Món đã bị hủy/void trước đó");
    }
    const existing = await repo.findOpenRequest(client, orderItemId);
    if (existing) throw new Conflict("Món này đã có yêu cầu hủy đang chờ xử lý");

    const qty = Math.min(Number(requested_qty) || item.quantity, item.quantity);

    // Combo cha (is_combo_parent = true): LUON gui PENDING cho bep quyet dinh.
    // Mon le: neu da nau (khong phai WAITING) -> tu dong REJECTED + danh dau nham lan.
    const isComboParent = item.is_combo_parent === true;
    const alreadyMade = !isComboParent && item.kitchen_status !== "WAITING";

    const base = {
      order_id: item.order_id,
      order_item_id: orderItemId,
      company_id: user.company_id,
      branch_id: user.branch_id,
      requested_by: user.employee_id || user.id,
      requested_qty: qty,
      reason_code,
      reason_note,
      item_status_at_request: item.kitchen_status || "WAITING",
    };

    let request;
    if (alreadyMade) {
      // BR-08: mon le da nau -> khong hoi bep, danh dau nham lan ngay.
      await repo.flagItemMistake(client, orderItemId, {
        reason_code,
        note: reason_note,
        by: base.requested_by,
      });
      request = await repo.insertRequest(client, {
        ...base,
        status: "REJECTED",
        decided_by: null,
        decided_at: new Date(),
        decision_note: "Món đã nấu — tự chuyển nhầm lẫn (BR-08)",
        stock_effect: "WASTE",
      });
    } else {
      // WAITING mon le, hoac bat ky Combo cha -> cho bep quyet dinh.
      request = await repo.insertRequest(client, { ...base, status: "PENDING" });
    }

    await client.query("COMMIT");
    return {
      cancel_request_id: request.cancel_request_id,
      status: request.status,
      is_mistake: alreadyMade,
      order_item_id: orderItemId,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Bep chap nhan huy (mon chua lam) -> CANCELLED.
async function accept({ cancelRequestId, user }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cr = await repo.lockRequestScoped(client, cancelRequestId, user.company_id, user.branch_id);
    if (!cr) throw new NotFound("Không tìm thấy yêu cầu hủy");
    if (cr.status !== "PENDING") throw new Conflict(`Yêu cầu đã ở trạng thái ${cr.status}`);
    if ((user.employee_id || user.id) === cr.requested_by) {
      throw new BadRequest("Người xử lý phải khác người yêu cầu");
    }

    await repo.setItemCancelled(client, cr.order_item_id);
    await repo.updateRequestDecision(client, cancelRequestId, {
      status: "ACCEPTED",
      decided_by: user.employee_id || user.id,
      stock_effect: "NONE",
    });
    await repo.recomputeOrderTotals(client, cr.order_id);
    await client.query("COMMIT");
    return { cancel_request_id: cancelRequestId, status: "ACCEPTED", order_item_id: cr.order_item_id };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Bep tu choi huy.
// - Mon le da nau -> danh dau nham lan, thu ngan void khi thanh toan.
// - Combo cha -> tach mon con thanh mon le doc lap, huy combo cha.
async function reject({ cancelRequestId, user, decision_note }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cr = await repo.lockRequestScoped(client, cancelRequestId, user.company_id, user.branch_id);
    if (!cr) throw new NotFound("Không tìm thấy yêu cầu hủy");
    if (cr.status !== "PENDING") throw new Conflict(`Yêu cầu đã ở trạng thái ${cr.status}`);

    // Kiem tra co phai Combo cha khong
    const { rows: parentCheck } = await client.query(
      "SELECT is_combo_parent FROM order_items WHERE order_item_id = $1",
      [cr.order_item_id]
    );
    const isComboParent = parentCheck[0]?.is_combo_parent === true;

    if (isComboParent) {
      // Combo da lam roi: tach cac mon con thanh mon le, huy combo cha
      const reasonText = decision_note || cr.reason_note || "Combo bị hủy — phục vụ lẻ";
      await repo.detachComboChildren(client, cr.order_item_id, reasonText);
      await repo.cancelComboParentOnly(client, cr.order_item_id);
      await repo.recomputeOrderTotals(client, cr.order_id);
    } else {
      // Mon le da nau -> danh dau nham lan binh thuong
      await repo.flagItemMistake(client, cr.order_item_id, {
        reason_code: cr.reason_code,
        note: cr.reason_note,
        by: cr.requested_by,
      });
    }

    await repo.updateRequestDecision(client, cancelRequestId, {
      status: "REJECTED",
      decided_by: user.employee_id || user.id,
      decision_note: decision_note || (isComboParent ? "Combo đã làm — tách thành món lẻ" : "Món đã nấu"),
      stock_effect: isComboParent ? "NONE" : "WASTE",
    });

    await client.query("COMMIT");
    return {
      cancel_request_id: cancelRequestId,
      status: "REJECTED",
      is_mistake: !isComboParent,
      order_item_id: cr.order_item_id,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Phuc vu rut yeu cau khi bep chua xu ly.
async function withdraw({ cancelRequestId, user }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cr = await repo.lockRequestScoped(client, cancelRequestId, user.company_id, user.branch_id);
    if (!cr) throw new NotFound("Không tìm thấy yêu cầu hủy");
    if (cr.status !== "PENDING") throw new Conflict(`Yêu cầu đã ở trạng thái ${cr.status}`);
    if ((user.employee_id || user.id) !== cr.requested_by) {
      throw new BadRequest("Chỉ người tạo mới rút được yêu cầu");
    }
    await repo.updateRequestStatus(client, cancelRequestId, "WITHDRAWN");
    await client.query("COMMIT");
    return { cancel_request_id: cancelRequestId, status: "WITHDRAWN" };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function list(user, { status }) {
  // SUPER_ADMIN co the khong gan branch -> tra rong an toan neu thieu scope.
  // Nhan vien BEP chi thay yeu cau huy cua mon dung loai bep cua minh (nong/lanh/bar).
  const kitchenTypeId = user.role === "KITCHEN" ? user.kitchen_type_id ?? null : null;
  return repo.listRequests(user.company_id, user.branch_id, { status, kitchenTypeId });
}

module.exports = { createRequest, accept, reject, withdraw, list };
