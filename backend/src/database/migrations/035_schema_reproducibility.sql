-- Reconcile the combo schema after the 028/032 history and strengthen write integrity.
-- Existing rows are preserved; NOT VALID foreign keys protect new writes without blocking
-- deployment on historical tenant mismatches.

CREATE TABLE IF NOT EXISTS combos (
  combo_id    SERIAL PRIMARY KEY,
  company_id  INTEGER NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  combo_code  VARCHAR(50),
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  image_url   TEXT,
  price       NUMERIC(14,2) NOT NULL DEFAULT 0,
  status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE combos ADD COLUMN IF NOT EXISTS combo_code VARCHAR(50);
ALTER TABLE combos ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE combos
SET combo_code = 'COMBO-' || combo_id
WHERE combo_code IS NULL OR btrim(combo_code) = '';

ALTER TABLE combos ALTER COLUMN combo_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_combos_company_code
  ON combos(company_id, combo_code);
CREATE INDEX IF NOT EXISTS idx_combos_company ON combos(company_id);
CREATE INDEX IF NOT EXISTS idx_combos_status ON combos(status);

CREATE TABLE IF NOT EXISTS combo_items (
  combo_item_id SERIAL PRIMARY KEY,
  combo_id      INTEGER NOT NULL REFERENCES combos(combo_id) ON DELETE CASCADE,
  menu_item_id  INTEGER NOT NULL REFERENCES menu_items(menu_item_id) ON DELETE RESTRICT,
  quantity      INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_combo_items UNIQUE (combo_id, menu_item_id),
  CONSTRAINT chk_combo_items_qty CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_combo_items_menu ON combo_items(menu_item_id);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS combo_id INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_combo_parent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE order_items ALTER COLUMN menu_item_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_combo_id_fkey') THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_combo_id_fkey FOREIGN KEY (combo_id)
      REFERENCES combos(combo_id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- Invoice codes are the stable external idempotency key. Refuse to hide duplicates:
-- a duplicate requires an explicit data decision before this invariant can be installed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM invoices GROUP BY invoice_code HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add invoice idempotency constraint: duplicate invoice_code values exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_invoice_code ON invoices(invoice_code);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_status ON invoice_payments(status);

-- Composite candidate keys permit foreign keys to verify tenant relationships.
CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_id_company ON branches(branch_id, company_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dining_tables_id_branch ON dining_tables(table_id, branch_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_branch_company_fkey') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_branch_company_fkey
      FOREIGN KEY (branch_id, company_id) REFERENCES branches(branch_id, company_id) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_table_branch_fkey') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_table_branch_fkey
      FOREIGN KEY (table_id, branch_id) REFERENCES dining_tables(table_id, branch_id) NOT VALID;
  END IF;
END $$;

-- combo_items has no tenant column, so enforce ownership without changing runtime inserts.
CREATE OR REPLACE FUNCTION enforce_combo_item_company() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM combos c
    JOIN menu_items mi ON mi.menu_item_id = NEW.menu_item_id
    WHERE c.combo_id = NEW.combo_id AND c.company_id = mi.company_id
  ) THEN
    RAISE EXCEPTION 'Combo and menu item must belong to the same company';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_combo_items_company ON combo_items;
CREATE TRIGGER trg_combo_items_company
BEFORE INSERT OR UPDATE OF combo_id, menu_item_id ON combo_items
FOR EACH ROW EXECUTE FUNCTION enforce_combo_item_company();
