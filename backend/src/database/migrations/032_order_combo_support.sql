-- 032_order_combo_support.sql

BEGIN;

ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS combo_id INTEGER REFERENCES combos(combo_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_combo_parent BOOLEAN NOT NULL DEFAULT FALSE,
ALTER COLUMN menu_item_id DROP NOT NULL;

-- Cập nhật comment giải thích
COMMENT ON COLUMN order_items.combo_id IS 'Mã combo nếu món này thuộc về một combo (Dùng cho cả parent và child)';
COMMENT ON COLUMN order_items.is_combo_parent IS 'True = Dòng đại diện cho Combo (tính tiền), False = Món lẻ trong Combo (đưa xuống bếp)';

COMMIT;
