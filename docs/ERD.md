# Logical ERD

This is a concise logical view of the current application paths, not proof that a target database has every migration applied.

```mermaid
erDiagram
  COMPANIES ||--o{ BRANCHES : owns
  COMPANIES ||--o{ MENU_CATEGORIES : scopes
  MENU_CATEGORIES ||--o{ MENU_ITEMS : contains
  COMPANIES ||--o{ COMBOS : defines
  COMBOS ||--o{ COMBO_ITEMS : contains
  MENU_ITEMS ||--o{ COMBO_ITEMS : component
  BRANCHES ||--o{ DINING_TABLES : has
  BRANCHES ||--o{ RESERVATIONS : receives
  CUSTOMERS ||--o{ RESERVATIONS : may_create
  RESERVATIONS o|--o| ORDERS : preorder
  DINING_TABLES o|--o{ ORDERS : serves
  ORDERS ||--o{ ORDER_ITEMS : contains
  MENU_ITEMS o|--o{ ORDER_ITEMS : item
  COMBOS o|--o{ ORDER_ITEMS : parent_or_child
  ORDERS ||--o{ INVOICES : billed_as
  BRANCHES ||--o{ INGREDIENTS : stocks
  MENU_ITEMS ||--o{ RECIPES : consumes
  INGREDIENTS ||--o{ RECIPES : measured_by
  SUPPLIERS ||--o{ PURCHASE_RECEIPTS : supplies
  PURCHASE_RECEIPTS ||--o{ PURCHASE_RECEIPT_ITEMS : contains
  INGREDIENTS ||--o{ PURCHASE_RECEIPT_ITEMS : received
```

Combo order representation is intentionally denormalized into `order_items`: one `is_combo_parent = true` row carries combo price, while child rows carry kitchen work with zero price until detached. Migration `032_order_combo_support.sql` adds this representation; `033_repair_detached_combo_prices.sql` repairs a specific historical detached-child condition.

Migration history is not a canonical ERD migration chain: combo tables are created/dropped/recreated across `003_combo_verify_audit.sql`, `016_drop_combo.sql`, `017_recreate_combos.sql` and `028_drop_combos.sql`. Validate the target snapshot before applying SQL.
