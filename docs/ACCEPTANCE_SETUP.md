# Acceptance Data Setup

## Purpose

`scripts/demo/acceptance-data.json` is the canonical, deterministic data recipe for tenant/RBAC acceptance. Its stable `key` values are references, not database IDs. It contains no passwords, tokens, connection strings, or real personal data.

## Prepare

1. Validate references with `node scripts/demo/validate-acceptance-data.js` from the repository root.
2. Start a disposable, migrated application environment using the normal deployment procedure.
3. Create the two companies and two branches through supported admin APIs or UI, in fixture order. Reuse records with the exact fixture `name`/`code` when rerunning; do not create duplicates.
4. Create the four actor accounts through the supported identity/admin flow and assign their fixture roles/scopes. Store credentials in the environment's secret manager or tester-local variables, never in this repository.
5. Record environment-specific database IDs beside fixture keys in tester-local notes. Do not edit the canonical fixture with generated IDs.

This recipe deliberately does not write directly to the database: identity provisioning and schema constraints are runtime/environment concerns, and bypassing them would make acceptance results misleading.

Expected validator output for the committed v1 fixture is a structural count of 2 companies, 2 branches and 4 actors. Treat that only as fixture validation, never as an acceptance pass.

## Concise Demo Runbook

From `D:\Projects\NhaHang`:

```powershell
node scripts/demo/validate-acceptance-data.js
Set-Location backend
npm test
```

The first command validates fixture references. The second runs local mock-backed Node tests. Neither starts services nor proves the scenarios below. For a real demo, provision a disposable migrated environment, create records from `scripts/demo/acceptance-data.json` through supported APIs/UI, execute each `ACC-*` scenario, and capture actual request/response evidence. Do not use production credentials or provider accounts.

Before demonstrating feature flows, separately record the DB migration snapshot, Redis availability, Supabase publication/subscription status, and whether PayOS/email are sandboxed. Mark reservation/preorder/deposit, combo ordering/cancel, QR settlement and Realtime as `pending` whenever those dependencies are unavailable.

## Scenarios

| ID | Actor | Action | Expected result |
|---|---|---|---|
| ACC-RBAC-01 | anonymous | Call an internal company endpoint | `401` |
| ACC-RBAC-02 | company-a-waiter | Call company administration | `403` |
| ACC-TENANT-01 | company-a-admin | List companies and branches | Only Company A and Branch A1 are returned |
| ACC-TENANT-02 | company-a-admin | Read or update Branch B1 by its environment ID | `403`; Branch B1 remains unchanged |
| ACC-TENANT-03 | branch-a-manager | Submit Company B or Branch B1 IDs while creating/updating scoped staff | Stored scope remains Company A / Branch A1, or request is rejected |
| ACC-BIZ-01 | super-admin | Create a branch without a company | `400` |
| ACC-BIZ-02 | super-admin | Create a branch for a nonexistent company ID | `400` |
| ACC-BIZ-03 | super-admin | Read a nonexistent branch | `404` |

Capture request method/path, status, response body, actor key, fixture key, timestamp, and evidence for each run. These scenarios are **not executed** by fixture validation or backend unit tests.

## Cleanup

Delete the disposable environment when possible. Otherwise, remove records through supported APIs in reverse dependency order (actors, branches, companies). Confirm names/codes match the fixture before removal.
