-- Remove legacy combo components that belong to another company.
BEGIN;

DELETE FROM combo_items ci
USING combos c, menu_items mi
WHERE ci.combo_id = c.combo_id
  AND ci.menu_item_id = mi.menu_item_id
  AND c.company_id <> mi.company_id;

UPDATE combos c
SET status = 'INACTIVE', updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM combo_items ci WHERE ci.combo_id = c.combo_id
);

COMMIT;
