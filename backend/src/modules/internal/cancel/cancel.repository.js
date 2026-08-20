// src/modules/internal/cancel/cancel.repository.js
// Repo cho nghiep vu huy mon (cancel_requests). PK: cancel_request_id, order_item_id, order_id.
const pool = require("../../../config/db");

// Khoa mon + lay thong tin can thiet, scope theo cong ty/chi nhanh.
exports.lockItemForCancel = (client, orderItemId, companyId, branchId) =>
  client
    .query(
      `SELECT oi.order_item_id, oi.order_id, oi.menu_item_id, oi.item_name,
              oi.quantity, oi.unit_price, oi.total_price, oi.kitchen_status,
              oi.is_combo_parent, oi.combo_id,
              oi.is_mistake, oi.billing_status,
              o.status AS order_status, o.company_id, o.branch_id
       FROM order_items oi
       JOIN orders o ON o.order_id = oi.order_id
       WHERE oi.order_item_id = $1 AND o.company_id = $2 AND o.branch_id = $3
       FOR UPDATE OF oi`,
      [orderItemId, companyId, branchId]
    )
    .then((r) => r.rows[0]);

// Da co yeu cau dang mo (PENDING) cho mon nay chua?
exports.findOpenRequest = (client, orderItemId) =>
  client
    .query(
      `SELECT cancel_request_id FROM cancel_requests
       WHERE order_item_id = $1 AND status = 'PENDING' LIMIT 1`,
      [orderItemId]
    )
    .then((r) => r.rows[0]);

exports.insertRequest = (client, r) =>
  client
    .query(
      `INSERT INTO cancel_requests
         (order_id, order_item_id, company_id, branch_id, requested_by, requested_qty,
          reason_code, reason_note, item_status_at_request, status,
          decided_by, decided_at, decision_note, stock_effect)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        r.order_id, r.order_item_id, r.company_id, r.branch_id, r.requested_by, r.requested_qty,
        r.reason_code, r.reason_note ?? null, r.item_status_at_request, r.status,
        r.decided_by ?? null, r.decided_at ?? null, r.decision_note ?? null, r.stock_effect ?? null,
      ]
    )
    .then((res) => res.rows[0]);

// Danh dau mon nham lan (da nau nhung bi bao huy).
exports.flagItemMistake = (client, orderItemId, { reason_code, note, by }) =>
  client.query(
    `UPDATE order_items
       SET is_mistake = true, mistake_reason = $2, mistake_note = $3,
           mistake_flagged_by = $4, mistake_flagged_at = NOW()
     WHERE order_item_id = $1`,
    [orderItemId, reason_code, note ?? null, by ?? null]
  );

// Huy combo cha + tat ca mon con.
exports.setItemCancelled = (client, orderItemId) =>
  client.query(
    "UPDATE order_items SET kitchen_status = 'CANCELLED' WHERE order_item_id = $1 OR (combo_id = (SELECT combo_id FROM order_items WHERE order_item_id = $1) AND is_combo_parent = false AND order_id = (SELECT order_id FROM order_items WHERE order_item_id = $1))",
    [orderItemId]
  );

// Huy rieng Combo cha (is_combo_parent = true), KHONG huy cac mon con.
exports.cancelComboParentOnly = (client, orderItemId) =>
  client.query(
    "UPDATE order_items SET kitchen_status = 'CANCELLED' WHERE order_item_id = $1",
    [orderItemId]
  );

// Tach cac mon con cua combo ra thanh mon le doc lap (khi bep tu choi huy combo da lam).
// Mon con giu nguyen kitchen_status, chi xoa combo_id + ghi note ly do.
exports.detachComboChildren = (client, comboParentItemId, reasonNote) =>
  client.query(
    `UPDATE order_items
       SET unit_price = mi.price,
           total_price = mi.price * order_items.quantity,
           vat_rate = COALESCE(mi.vat, 0),
           vat_amount = (mi.price * order_items.quantity * COALESCE(mi.vat, 0)) / 100,
           combo_id = NULL, is_combo_parent = false,
           note = CASE WHEN note IS NULL OR note = ''
                       THEN $2
                       ELSE note || ' | ' || $2
                  END
       FROM menu_items mi
     WHERE combo_id = (SELECT combo_id FROM order_items WHERE order_item_id = $1)
       AND is_combo_parent = false
       AND order_id = (SELECT order_id FROM order_items WHERE order_item_id = $1)
       AND mi.menu_item_id = order_items.menu_item_id`,
    [comboParentItemId, reasonNote ?? 'Combo bị hủy — món này tiếp tục phục vụ lẻ']
  );

// Tinh lai tong don tu cac mon con tinh tien (bo CANCELLED va VOIDED).
exports.recomputeOrderTotals = (client, orderId) =>
  client.query(
    `UPDATE orders o
       SET subtotal = t.sub, vat_amount = t.vat, total_amount = t.sub + t.vat, updated_at = NOW()
     FROM (
       SELECT COALESCE(SUM(total_price),0) AS sub, COALESCE(SUM(vat_amount),0) AS vat
       FROM order_items
       WHERE order_id = $1 AND kitchen_status <> 'CANCELLED' AND billing_status = 'BILLABLE'
     ) t
     WHERE o.order_id = $1`,
    [orderId]
  );

// Khoa yeu cau de xu ly (bep accept/reject, hoac phuc vu withdraw).
exports.lockRequestScoped = (client, cancelRequestId, companyId, branchId) =>
  client
    .query(
      `SELECT * FROM cancel_requests
       WHERE cancel_request_id = $1 AND company_id = $2 AND branch_id = $3
       FOR UPDATE`,
      [cancelRequestId, companyId, branchId]
    )
    .then((r) => r.rows[0]);

exports.updateRequestDecision = (client, id, { status, decided_by, decision_note, stock_effect }) =>
  client.query(
    `UPDATE cancel_requests
       SET status = $2, decided_by = $3, decided_at = NOW(),
           decision_note = $4, stock_effect = $5, updated_at = NOW()
     WHERE cancel_request_id = $1`,
    [id, status, decided_by ?? null, decision_note ?? null, stock_effect ?? null]
  );

exports.updateRequestStatus = (client, id, status) =>
  client.query(
    "UPDATE cancel_requests SET status = $2, updated_at = NOW() WHERE cancel_request_id = $1",
    [id, status]
  );

// Danh sach yeu cau (hang cho bep / lich su). Loc theo trang thai neu co.
exports.listRequests = (companyId, branchId, { status, kitchenTypeId = null } = {}) => {
  const vals = [companyId, branchId];
  let cond = "cr.company_id = $1 AND cr.branch_id = $2";
  if (status) {
    vals.push(status);
    cond += ` AND cr.status = $${vals.length}`;
  }
  // Loc theo loai bep cua nhan vien (nong/lanh/bar). null -> khong loc (quan ly).
  vals.push(kitchenTypeId);
  const ktIdx = vals.length;
  return pool
    .query(
      `SELECT cr.*, oi.item_name, oi.kitchen_status AS current_kitchen_status,
              oi.is_combo_parent,
              mi.kitchen_type_id, kt.name AS kitchen_type_name,
              o.order_code, dt.table_number, dt.table_name,
              e.full_name AS requested_by_name
       FROM cancel_requests cr
       JOIN order_items oi ON oi.order_item_id = cr.order_item_id
       JOIN orders o ON o.order_id = cr.order_id
       JOIN dining_tables dt ON dt.table_id = o.table_id
       LEFT JOIN menu_items mi ON mi.menu_item_id = oi.menu_item_id
       LEFT JOIN kitchen_types kt ON kt.kitchen_type_id = mi.kitchen_type_id
       LEFT JOIN employees e ON e.employee_id = cr.requested_by
       WHERE ${cond} AND ($${ktIdx}::int IS NULL OR mi.kitchen_type_id = $${ktIdx} OR oi.is_combo_parent = true)
       ORDER BY cr.created_at DESC
       LIMIT 200`,
      vals
    )
    .then((r) => r.rows);
};
