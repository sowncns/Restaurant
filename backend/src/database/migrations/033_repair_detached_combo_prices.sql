-- Repair combo children detached before standalone pricing was restored.
BEGIN;

WITH repaired_items AS (
  UPDATE order_items oi
  SET unit_price = mi.price,
      total_price = mi.price * oi.quantity,
      vat_rate = COALESCE(mi.vat, 0),
      vat_amount = (mi.price * oi.quantity * COALESCE(mi.vat, 0)) / 100
  FROM menu_items mi
  WHERE oi.combo_id IS NULL
    AND oi.is_combo_parent = false
    AND oi.menu_item_id = mi.menu_item_id
    AND COALESCE(oi.unit_price, 0) = 0
    AND COALESCE(oi.total_price, 0) = 0
    AND oi.note ILIKE '%combo%'
  RETURNING oi.order_id
), affected_orders AS (
  SELECT DISTINCT order_id FROM repaired_items
), totals AS (
  SELECT ao.order_id,
         COALESCE(SUM(oi.total_price) FILTER (WHERE oi.kitchen_status <> 'CANCELLED' AND oi.billing_status = 'BILLABLE'), 0) AS subtotal,
         COALESCE(SUM(oi.vat_amount) FILTER (WHERE oi.kitchen_status <> 'CANCELLED' AND oi.billing_status = 'BILLABLE'), 0) AS vat_amount
  FROM affected_orders ao
  LEFT JOIN order_items oi ON oi.order_id = ao.order_id
  GROUP BY ao.order_id
)
UPDATE orders o
SET subtotal = totals.subtotal,
    vat_amount = totals.vat_amount,
    total_amount = totals.subtotal + totals.vat_amount,
    updated_at = NOW()
FROM totals
WHERE o.order_id = totals.order_id;

COMMIT;
