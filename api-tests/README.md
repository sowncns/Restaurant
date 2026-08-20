# Pytest API integration suite

This directory is independent from backend, frontend, and browser E2E tests. The executable catalog in `route_catalog.py` mirrors all 183 Express routes currently mounted below `/api` (23 public, 21 customer-protected, and 139 internal-protected).

## Setup

```powershell
Set-Location D:\Projects\NhaHang\api-tests
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Populate `.env` with disposable test identities. Existing `E2E_*` variable names are deliberately reused, and `E2E_API_URL` is accepted when `API_BASE_URL` is not set. Do not use production credentials or data.

## Run

```powershell
# Non-destructive catalog, contracts, authorization, and safe-read smoke tests.
# The default pytest.ini expression deselects destructive tests.
pytest

# Select groups
pytest -m catalog
pytest -m "contract or smoke"

# Override service settings
pytest --api-base-url http://localhost:5000/api --api-timeout 20

# JUnit result plus route coverage inventory
pytest --junitxml=reports/junit.xml
```

Start the local backend and run the non-destructive suite in one command:

```powershell
powershell -ExecutionPolicy Bypass -File run-local.ps1
```

Unavailable API services and missing role credentials/fixture IDs produce explicit skips. Catalog protection probes use anonymous calls, so protected mutations cannot execute. Public mutation probes send invalid bodies. The local runner redirects `/customer/auth/test-mail` to the fake Resend provider, so no real email is sent.

## Destructive flows

Destructive tests create and clean up a customer reservation and an empty waiter order. Run them only against a disposable environment:

```powershell
$env:API_DESTRUCTIVE = "1"
pytest -m destructive
```

Both the `destructive` marker selection and `API_DESTRUCTIVE=1` are required. If destructive tests are selected without the gate, they skip before fixture setup. Required stable IDs are documented in `.env.example`.

## Coverage

Every pytest session generates `reports/route-coverage.json` and `reports/route-coverage.md`. This is route inventory coverage, not Python line coverage: the application under test is Node/Express and runs out of process. Pytest/JUnit records the corresponding probe outcomes.

When Express routes change, update `route_catalog.py` in the same change and run `pytest --collect-only` before making live calls.
