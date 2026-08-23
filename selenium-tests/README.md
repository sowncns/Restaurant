# Selenium UI tests

Python Selenium tests for browser-level checks of the customer and internal web apps.

## Setup

```powershell
Set-Location D:\Projects\NhaHang\selenium-tests
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Fill `.env` with local web URLs and E2E credentials. The tests also load `api-tests/.env` automatically, so credentials can be shared with API tests.

## Start Apps

Run these in separate terminals before Selenium:

```powershell
Set-Location D:\Projects\NhaHang\backend
npm start
```

```powershell
Set-Location D:\Projects\NhaHang\igourmet-app
npm run dev -- --host 127.0.0.1 --port 5173
```

```powershell
Set-Location D:\Projects\NhaHang\igourmet-internal
npm run dev -- --host 127.0.0.1 --port 5174
```

## Run

```powershell
pytest
pytest -m auth
pytest --headed
pytest --browser edge
```

## Current Coverage

- Internal invalid login.
- Each internal fixed role can log in and reach its default page.
- Waiter is blocked from the manager inventory page.
- Customer invalid login.
- Customer can log in and open reservation history.
- Full UI workflow: customer booking -> receptionist assigns/checks in -> waiter orders item -> kitchen marks ready -> cashier scans customer QR token -> cash payment success.

The full workflow uses stable `data-testid` attributes in the React screens, so it does not depend on CSS layout classes.

## Full Workflow Data

The full workflow test requires these shared variables, usually already present in `api-tests/.env`:

```text
E2E_COMPANY_ID
E2E_BRANCH_ID
E2E_SALES_TABLE_ID
E2E_MENU_ITEM_ID
E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD
E2E_RECEPTIONIST_USERNAME / E2E_RECEPTIONIST_PASSWORD
E2E_WAITER_USERNAME / E2E_WAITER_PASSWORD
E2E_KITCHEN_USERNAME / E2E_KITCHEN_PASSWORD
E2E_CASHIER_USERNAME / E2E_CASHIER_PASSWORD
```
