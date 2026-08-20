const fs = require('fs');

// ─── 1. cancel.repository.js ───────────────────────────────────────────────
// Thêm hàm detachComboChildren: tách các món con ra khỏi combo khi bếp từ chối hủy
let repoPath = 'src/modules/internal/cancel/cancel.repository.js';
let repo = fs.readFileSync(repoPath, 'utf8');

// Thêm hàm mới trước dòng cuối
const detachFn = `
// Tach cac mon con cua combo ra thanh mon le doc lap (khi bep tu choi huy combo da lam).
// Combo cha se bi set CANCELLED rieng. Mon con giu nguyen kitchen_status, chi xoa combo_id.
// Dong thoi ghi note ly do huy vao cac mon con de bep biet.
exports.detachComboChildren = (client, comboParentItemId, reasonNote) =>
  client.query(
    \`UPDATE order_items
       SET combo_id = NULL, is_combo_parent = false,
           note = CASE WHEN note IS NULL OR note = ''
                       THEN $2
                       ELSE note || ' | ' || $2
                  END
     WHERE combo_id = (SELECT combo_id FROM order_items WHERE order_item_id = $1)
       AND is_combo_parent = false
       AND order_id = (SELECT order_id FROM order_items WHERE order_item_id = $1)\`,
    [comboParentItemId, reasonNote ?? 'Combo bị hủy — món này tiếp tục phục vụ lẻ']
  );

// Huy rieng Combo cha (is_combo_parent = true), khong huy cac mon con.
exports.cancelComboParentOnly = (client, orderItemId) =>
  client.query(
    "UPDATE order_items SET kitchen_status = 'CANCELLED' WHERE order_item_id = $1",
    [orderItemId]
  );
`;

// Thêm vào trước dòng cuối file (thường là dòng trống cuối)
repo = repo.trimEnd() + '\n' + detachFn;
fs.writeFileSync(repoPath, repo);
console.log('✓ cancel.repository.js patched');

// ─── 2. cancel.service.js ──────────────────────────────────────────────────
let svcPath = 'src/modules/internal/cancel/cancel.service.js';
let svc = fs.readFileSync(svcPath, 'utf8');

// 2a. Trong createRequest: combo cha đang bếp làm → luôn PENDING thay vì auto-reject
const oldComboCheck = `    if (item.is_combo_parent) {
      const { rows } = await client.query(
        "SELECT kitchen_status FROM order_items WHERE combo_id = $1 AND is_combo_parent = false AND order_id = $2",
        [item.combo_id, item.order_id]
      );
      alreadyMade = rows.some(r => ["READY", "SERVED", "COOKING"].includes(r.kitchen_status));
    }`;
const newComboCheck = `    if (item.is_combo_parent) {
      // Combo cha -> luon gui PENDING cho bep quyet dinh (khong auto-reject nhu mon le).
      // Bep bam "Da lam roi" -> tach mon con thanh mon le doc lap.
      const { rows } = await client.query(
        "SELECT kitchen_status FROM order_items WHERE combo_id = $1 AND is_combo_parent = false AND order_id = $2",
        [item.combo_id, item.order_id]
      );
      alreadyMade = false; // Always send PENDING for combo so kitchen can decide
    }`;
svc = svc.replace(oldComboCheck, newComboCheck);

// 2b. Trong reject: nếu là combo cha → detach món con, hủy combo cha, không flag mistake trên cha
const oldReject = `    await repo.flagItemMistake(client, cr.order_item_id, {
      reason_code: cr.reason_code,
      note: cr.reason_note,
      by: cr.requested_by,
    });
    await repo.updateRequestDecision(client, cancelRequestId, {
      status: "REJECTED",
      decided_by: user.employee_id || user.id,
      decision_note: decision_note || "Món đã nấu",
      stock_effect: "WASTE",
    });
    await client.query("COMMIT");
    return { cancel_request_id: cancelRequestId, status: "REJECTED", is_mistake: true, order_item_id: cr.order_item_id };`;

const newReject = `    // Kiem tra co phai Combo cha khong
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
    if (isComboParent) {
      await repo.recomputeOrderTotals(client, cr.order_id);
    }
    await client.query("COMMIT");
    return { cancel_request_id: cancelRequestId, status: "REJECTED", is_mistake: !isComboParent, order_item_id: cr.order_item_id };`;

svc = svc.replace(oldReject, newReject);
fs.writeFileSync(svcPath, svc);
console.log('✓ cancel.service.js patched');
