# Requirements Traceability and Status

Status meanings: **Automated** means a local mock-backed test currently verifies the stated behavior; **Documented** means an acceptance procedure exists but has not been executed here; **Gap** means further integration or acceptance evidence is required.

| Requirement | Evidence | Status | Remaining work |
|---|---|---|---|
| Unauthenticated internal access is rejected | `backend/test/rbac-tenant.test.js` | Automated (unit) | Add HTTP integration coverage |
| Role allow-list rejects unauthorized staff | `backend/test/rbac-tenant.test.js` | Automated (unit) | Verify representative deployed endpoints |
| Company admins cannot cross company scope | `backend/test/rbac-tenant.test.js`, `backend/test/business-errors.test.js` | Automated (unit) | Execute `ACC-TENANT-01/02` against a disposable environment |
| Branch managers are fixed to their branch | `backend/test/rbac-tenant.test.js` | Automated (unit) | Execute `ACC-TENANT-03`; add repository/HTTP integration coverage |
| Staff cannot assign equal/higher roles | `backend/test/rbac-tenant.test.js` | Automated (unit) | Add service and endpoint integration coverage |
| Missing branch produces an operational `404` | `backend/test/business-errors.test.js` | Automated (mock-backed unit) | Verify HTTP error serialization |
| Invalid branch company selection produces `400` | `backend/test/business-errors.test.js` | Automated (mock-backed unit) | Execute `ACC-BIZ-01/02` with a real database |
| Deterministic tenant acceptance data is reproducible without committed secrets | `scripts/demo/acceptance-data.json`, `scripts/demo/validate-acceptance-data.js`, `docs/ACCEPTANCE_SETUP.md` | Documented | Provision and record an acceptance run |
| DB/Redis integration behavior | None in this change | Gap | Add disposable service-backed tests in CI |
| Delivery/cart contract | `igourmet-app/src/pages/DeliveryMenu.tsx`, `igourmet-app/src/pages/Booking.tsx`, `backend/src/routes/index.js`, migration `008_drop_cart_tables.sql` | Implemented, not integrated | Verify menu-to-preorder handoff; do not accept as delivery fulfillment |
| Authenticated reservation preorder | customer reservation route/service and migration `005_reservation_preorder.sql` | Implemented, not integrated | Verify canonical prices, deposit/PIN, cancel/refund, check-in and concurrency against disposable services |
| Guest reservation without preorder | `backend/src/modules/public/public.route.js` | Implemented, not integrated | Exercise HTTP validation and persistence |
| Combo CRUD and public-menu exposure | internal combo module; public service/repository | Implemented, not integrated | Verify tenant scope and exact public menu shape |
| Combo ordering/billing/kitchen/cancel | internal order/cancel/checkout modules; migrations `032` and `033` | Implemented, not integrated | Test parent/child pricing, stock, cancellation and repaired historical rows |
| Kitchen and reservation near-realtime refresh | `backend/src/shared/services/realtime.service.js`, SSE routes, migration `034_enable_supabase_realtime.sql` | Implemented, not integrated | Verify publication, branch isolation, reconnect and polling fallback with Supabase |
| Customer QR notification SSE | QR customer route/controller/service | Implemented, not integrated | Verify auth/PIN, reconnect, idempotency and settlement with Redis/DB |
| Migration from empty or known production snapshot | SQL files and `run_migrations.js` | Gap | Define baseline/ledger and tested upgrade path; current helper runs only `003`, `032`, `033` |

## Current Boundary

The automated suite exercises middleware, permission helpers, and selected service branches. Repository calls are replaced in memory; no PostgreSQL, Redis, Supabase, email, or payment behavior is validated. Passing tests therefore does not establish end-to-end completion or production readiness.
