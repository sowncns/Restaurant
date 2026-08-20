import json
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

from route_catalog import ROUTES

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

ROLE_ENV = {
    "RECEPTIONIST": "RECEPTIONIST", "WAITER": "WAITER", "KITCHEN": "KITCHEN",
    "CASHIER": "CASHIER", "BRANCH_MANAGER": "MANAGER",
    "COMPANY_ADMIN": "COMPANY_ADMIN", "SUPER_ADMIN": "SUPER_ADMIN",
}


def pytest_addoption(parser):
    parser.addoption("--api-base-url", default=None, help="API root including /api")
    parser.addoption("--api-timeout", type=float, default=None, help="request timeout in seconds")


def pytest_collection_modifyitems(config, items):
    if os.getenv("API_DESTRUCTIVE") == "1":
        return
    reason = "destructive API flows disabled: set API_DESTRUCTIVE=1 and run with -m destructive"
    for item in items:
        if "destructive" in item.keywords:
            item.add_marker(pytest.mark.skip(reason=reason))


@pytest.fixture(scope="session")
def api_config(pytestconfig):
    base = pytestconfig.getoption("--api-base-url") or os.getenv("API_BASE_URL") or os.getenv("E2E_API_URL") or "http://localhost:5000/api"
    return {
        "base_url": base.rstrip("/"),
        "timeout": pytestconfig.getoption("--api-timeout") or float(os.getenv("API_TIMEOUT_SECONDS", "10")),
        "verify": os.getenv("API_VERIFY_TLS", "true").lower() not in {"0", "false", "no"},
    }


class ApiSession(requests.Session):
    def __init__(self, config):
        super().__init__()
        self.base_url, self.api_timeout, self.verify_tls = config["base_url"], config["timeout"], config["verify"]

    def request(self, method, url, **kwargs):
        kwargs.setdefault("timeout", self.api_timeout)
        kwargs.setdefault("verify", self.verify_tls)
        return super().request(method, self.base_url + url, **kwargs)


@pytest.fixture(scope="session")
def api(api_config):
    client = ApiSession(api_config)
    try:
        client.get("/public/companies")
    except requests.RequestException as exc:
        pytest.skip(f"API service unavailable at {api_config['base_url']}: {exc}")
    return client


def _login(config, endpoint, payload, identity):
    client = ApiSession(config)
    try:
        response = client.post(endpoint, json=payload)
    except requests.RequestException as exc:
        pytest.skip(f"API service unavailable while logging in {identity}: {exc}")
    if response.status_code != 200:
        pytest.skip(f"credentials/service unavailable for {identity}: login returned HTTP {response.status_code}")
    token = response.json().get("accessToken")
    if token:
        client.headers["Authorization"] = f"Bearer {token}"
    return client


@pytest.fixture(scope="session")
def customer_api(api_config):
    email, password = os.getenv("E2E_CUSTOMER_EMAIL"), os.getenv("E2E_CUSTOMER_PASSWORD")
    if not email or not password:
        pytest.skip("customer credentials absent: set E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD")
    return _login(api_config, "/customer/auth/login", {"email": email, "password": password}, "customer")


@pytest.fixture(scope="session")
def staff_api_factory(api_config):
    cache = {}
    def factory(role):
        if role in cache:
            return cache[role]
        prefix = ROLE_ENV[role]
        username, password = os.getenv(f"E2E_{prefix}_USERNAME"), os.getenv(f"E2E_{prefix}_PASSWORD")
        if not username or not password:
            pytest.skip(f"{role} credentials absent: set E2E_{prefix}_USERNAME and E2E_{prefix}_PASSWORD")
        cache[role] = _login(api_config, "/internal/auth/login", {"username": username, "password": password}, role)
        return cache[role]
    return factory


def concrete_path(path):
    values = {
        "companyId": os.getenv("E2E_COMPANY_ID", "2147483647"), "branchId": os.getenv("E2E_BRANCH_ID", "2147483647"),
        "tableId": os.getenv("E2E_SALES_TABLE_ID", "2147483647"), "menuItemId": os.getenv("E2E_MENU_ITEM_ID", "2147483647"),
        "rank": "INVALID_TEST_RANK", "code": "API_TEST_MISSING", "requestId": "2147483647",
    }
    return re.sub(r":([A-Za-z_]+)", lambda m: values.get(m.group(1), "2147483647"), path)


@pytest.fixture(scope="session")
def route_path():
    return concrete_path


def pytest_sessionfinish(session, exitstatus):
    reports = ROOT / "reports"
    reports.mkdir(exist_ok=True)
    catalog = {
        "total": len(ROUTES),
        "public": sum(not r.protected for r in ROUTES),
        "protected": sum(r.protected for r in ROUTES),
        "safe_reads": sum(r.safe_read for r in ROUTES),
        "live_probe_exclusions": [r.id for r in ROUTES if not r.live_probe],
        "routes": [{"id": r.id, "audience": r.audience, "roles": sorted(r.roles)} for r in ROUTES],
    }
    (reports / "route-coverage.json").write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    lines = ["# API Route Coverage", "", f"- Catalogued routes: {catalog['total']}", f"- Public routes: {catalog['public']}", f"- Protected routes: {catalog['protected']}", f"- Safe reads: {catalog['safe_reads']}", "", "Generated by pytest. Test outcomes remain in the pytest/JUnit report."]
    (reports / "route-coverage.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
