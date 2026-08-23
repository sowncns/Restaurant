import os
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.support.ui import WebDriverWait


ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")
load_dotenv(ROOT.parent / "api-tests" / ".env")


def pytest_addoption(parser):
    parser.addoption("--headed", action="store_true", help="show browser window")
    parser.addoption("--browser", default=None, help="chrome, edge, or firefox")


@pytest.fixture(scope="session")
def ui_config(pytestconfig):
    return {
        "customer_url": os.getenv("CUSTOMER_WEB_URL", "http://localhost:5173").rstrip("/"),
        "internal_url": os.getenv("INTERNAL_WEB_URL", "http://localhost:5174").rstrip("/"),
        "browser": (pytestconfig.getoption("--browser") or os.getenv("SELENIUM_BROWSER", "chrome")).lower(),
        "headless": not pytestconfig.getoption("--headed") and os.getenv("SELENIUM_HEADLESS", "1") not in {"0", "false", "False"},
        "timeout": float(os.getenv("SELENIUM_TIMEOUT", "15")),
    }


@pytest.fixture
def driver(ui_config):
    browser = ui_config["browser"]
    if browser == "edge":
        options = EdgeOptions()
        if ui_config["headless"]:
            options.add_argument("--headless=new")
        driver = webdriver.Edge(options=options)
    elif browser == "firefox":
        options = FirefoxOptions()
        if ui_config["headless"]:
            options.add_argument("-headless")
        driver = webdriver.Firefox(options=options)
    else:
        options = ChromeOptions()
        if ui_config["headless"]:
            options.add_argument("--headless=new")
        options.add_argument("--window-size=1440,1000")
        driver = webdriver.Chrome(options=options)

    driver.set_page_load_timeout(ui_config["timeout"])
    yield driver
    driver.quit()


@pytest.fixture
def wait(driver, ui_config):
    return WebDriverWait(driver, ui_config["timeout"])


def require_env(*names):
    missing = [name for name in names if not os.getenv(name)]
    if missing:
        pytest.skip("missing Selenium test configuration: " + ", ".join(missing))


def _clean_stale_reservations():
    """Remove non-terminal reservations left over from previous (interrupted) UI test
    runs for the shared test phone/table, so the same table+time slot doesn't collide."""
    needed = ("E2E_RECEPTIONIST_USERNAME", "E2E_RECEPTIONIST_PASSWORD", "E2E_BRANCH_ID", "E2E_SALES_TABLE_ID")
    if not all(os.getenv(name) for name in needed):
        return
    base = os.getenv("API_BASE_URL", "http://localhost:5000/api")
    phone = os.getenv("E2E_CUSTOMER_PHONE", "0900000001")
    try:
        login = requests.post(
            f"{base}/internal/auth/login",
            json={"username": os.environ["E2E_RECEPTIONIST_USERNAME"], "password": os.environ["E2E_RECEPTIONIST_PASSWORD"]},
            timeout=10,
        )
        login.raise_for_status()
        headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}

        listing = requests.get(
            f"{base}/internal/reservations/",
            params={"branch_id": os.environ["E2E_BRANCH_ID"]},
            headers=headers,
            timeout=10,
        )
        listing.raise_for_status()
        for r in listing.json().get("reservations", []):
            if r.get("customer_phone") != phone or r.get("status") in ("COMPLETED", "CANCELLED"):
                continue
            rid = r["id"]
            if r["status"] == "CHECKED_IN":
                requests.patch(f"{base}/internal/reservations/{rid}/status", json={"status": "COMPLETED"}, headers=headers, timeout=10)
            else:
                requests.delete(f"{base}/internal/reservations/{rid}", headers=headers, timeout=10)

        requests.patch(
            f"{base}/internal/dining-tables/tables/{os.environ['E2E_SALES_TABLE_ID']}/status",
            json={"status": "AVAILABLE"},
            headers=headers,
            timeout=10,
        )
    except requests.RequestException:
        pass  # best-effort - let the UI test itself surface any real backend problem


def _cancel_stale_checkout_intent():
    """A pending TRANSFER/APP payment intent left over from an interrupted UI run hides
    the payment-method buttons on next load (the panel jumps straight to "waiting for
    customer") - clear it so the table starts from a clean payment state."""
    needed = ("E2E_CASHIER_USERNAME", "E2E_CASHIER_PASSWORD", "E2E_SALES_TABLE_ID")
    if not all(os.getenv(name) for name in needed):
        return
    base = os.getenv("API_BASE_URL", "http://localhost:5000/api")
    try:
        login = requests.post(
            f"{base}/internal/auth/login",
            json={"username": os.environ["E2E_CASHIER_USERNAME"], "password": os.environ["E2E_CASHIER_PASSWORD"]},
            timeout=10,
        )
        login.raise_for_status()
        headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
        requests.delete(
            f"{base}/internal/checkout/intent/{os.environ['E2E_SALES_TABLE_ID']}",
            headers=headers,
            timeout=10,
        )
        requests.post(
            f"{base}/internal/checkout/table/{os.environ['E2E_SALES_TABLE_ID']}/vat",
            json={"companyName": "", "taxCode": "", "address": "", "email": ""},
            headers=headers,
            timeout=10,
        )

        # Neu ban con mot don dang mo (chua thanh toan) tu lan chay truoc, chi PATCH
        # table.status = AVAILABLE khong du - ban se roi ngay ve SERVING khi UI doc lai
        # trang thai that. Tra tien mat cho don do de dong ban dung theo luong nghiep vu
        # that (nhu mot thanh toan CASH binh thuong se lam).
        table_id = os.environ["E2E_SALES_TABLE_ID"]
        active = requests.get(f"{base}/internal/orders/table/{table_id}/active", headers=headers, timeout=10)
        if active.ok and active.json().get("order"):
            requests.post(
                f"{base}/internal/checkout/create-invoice",
                json={"tableId": int(table_id), "paymentMethod": "CASH"},
                headers=headers,
                timeout=10,
            )

        requests.patch(
            f"{base}/internal/dining-tables/tables/{table_id}/status",
            json={"status": "AVAILABLE"},
            headers=headers,
            timeout=10,
        )
    except requests.RequestException:
        pass  # best-effort - let the UI test itself surface any real backend problem


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if report.when == "call" and report.failed:
        driver = item.funcargs.get("driver")
        if driver is not None:
            debug_dir = ROOT / "debug"
            debug_dir.mkdir(exist_ok=True)
            stem = debug_dir / item.name
            try:
                driver.save_screenshot(str(stem) + ".png")
                (stem.with_suffix(".html")).write_text(driver.page_source, encoding="utf-8")
                print(f"\nsaved failure screenshot/HTML to {stem}.png / {stem}.html")
            except Exception as exc:
                print(f"\ncould not save failure debug artifacts: {exc}")


@pytest.fixture
def clean_reservation_state():
    """Run before AND after the full-workflow UI test so a failed run never blocks the
    next one (same fixed table/date/time is reused every run)."""
    _clean_stale_reservations()
    _cancel_stale_checkout_intent()
    yield
    _clean_stale_reservations()
    _cancel_stale_checkout_intent()


@pytest.fixture
def ensure_customer_payment_pin():
    """The APP payment flow requires the test customer to already have a 6-digit payment
    PIN set up; set it once (idempotent) rather than requiring manual setup every run.
    NOTE: this does NOT fund the wallet - "pay via app" also needs wallet_balance > 0,
    which has no API (only real PayOS top-up), so that part still needs a one-off manual
    DB top-up for the test customer."""
    needed = ("E2E_CUSTOMER_EMAIL", "E2E_CUSTOMER_PASSWORD")
    if not all(os.getenv(name) for name in needed):
        return
    base = os.getenv("API_BASE_URL", "http://localhost:5000/api")
    pin = os.getenv("E2E_CUSTOMER_PIN", "123456")
    try:
        login = requests.post(
            f"{base}/customer/auth/login",
            json={"email": os.environ["E2E_CUSTOMER_EMAIL"], "password": os.environ["E2E_CUSTOMER_PASSWORD"]},
            timeout=10,
        )
        login.raise_for_status()
        headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
        profile = requests.get(f"{base}/customer/profile/me", headers=headers, timeout=10)
        profile.raise_for_status()
        if not profile.json().get("profile", {}).get("has_payment_pin"):
            requests.post(f"{base}/customer/profile/setup-pin", json={"pin": pin}, headers=headers, timeout=10)
    except requests.RequestException:
        pass  # best-effort - let the UI test itself surface any real backend problem
