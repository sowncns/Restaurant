# Current Architecture and Evidence Boundary

Snapshot: working tree reviewed 20/08/2026.

## Runtime Shape

- `backend/src/app.js` and `backend/src/routes/index.js`: Express API under `/api`; PostgreSQL repositories, Redis-dependent flows, Supabase, PayOS and email are external integrations.
- `igourmet-internal`: staff SPA for operations.
- `igourmet-app`: customer SPA for reservation, preorder, wallet/payment and invoice views.
- `igourmet-landing`: public discovery and guest reservation UI.

## Important Flows

| Flow | Current implementation | Evidence boundary |
|---|---|---|
| Menu/cart/delivery | `DeliveryMenu.tsx` keeps selections in component state and navigates to `/booking` with `preorderCart`. Backend has no cart route/tables. | This is reservation preorder selection, not persistent cart or delivery fulfillment. Integration pending. |
| Reservation | Public POST creates guest reservation without preorder. Authenticated customer POST can include `items[]`; internal routes alert, assign, confirm-call and check in. | Source implemented; DB, deposit/refund and race behavior pending integration. |
| Combo | Admin CRUD; public company menu may include active combos. Orders expand to a billable parent and zero-priced kitchen children. Cancel logic can cancel or detach children. | Source implemented; migration/data repair, billing, inventory and cancel acceptance pending. |
| Realtime | Supabase listens to `order_items` and `reservations`; backend emits branch-keyed SSE. QR pending notifications use a separate process-local EventEmitter SSE. | Requires migration `034`, configured Supabase publication and live integration evidence. Process-local QR events do not span backend instances. |
| API/RBAC | Routes use auth/role middleware and service/repository scope checks. | Local tests cover helpers and selected mocked service branches only; HTTP and multi-tenant DB acceptance pending. |
| Migration | Numbered SQL includes superseding create/drop/recreate history. `run_migrations.js` runs only three selected files. | No baseline, ledger or verified clean-install/upgrade path is documented as passing. |

## Evidence Labels

- **Implemented:** present and reachable in current source.
- **Automated local:** exercised by committed tests without real external services.
- **Acceptance pending:** procedure exists but no current captured run.
- **Integration pending:** needs PostgreSQL, Redis, Supabase or provider-backed execution.

See `REQUIREMENTS_TRACEABILITY.md`, `ACCEPTANCE_SETUP.md` and the dated addendum in `../TEST_REPORT.md`.
