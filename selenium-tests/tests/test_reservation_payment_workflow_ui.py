import os

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from conftest import require_env
from tests.test_internal_auth_ui import login_internal
from tests.workflow_helpers import book_order_and_serve, by_testid, click_scrolled, safe_click, slow


@pytest.mark.ui
@pytest.mark.auth
def test_customer_booking_to_reception_waiter_kitchen_cashier_payment(driver, wait, ui_config, clean_reservation_state):
    """Test luong UI day du: customer dat ban, le tan check-in, phuc vu goi mon, bep bao xong,
    phuc vu xac nhan da mang mon ra ban, thu ngan quet QR va thanh toan tien mat."""
    require_env(
        "E2E_CUSTOMER_EMAIL",
        "E2E_CUSTOMER_PASSWORD",
        "E2E_COMPANY_ID",
        "E2E_BRANCH_ID",
        "E2E_SALES_TABLE_ID",
        "E2E_MENU_ITEM_ID",
        "E2E_RECEPTIONIST_USERNAME",
        "E2E_RECEPTIONIST_PASSWORD",
        "E2E_WAITER_USERNAME",
        "E2E_WAITER_PASSWORD",
        "E2E_KITCHEN_USERNAME",
        "E2E_KITCHEN_PASSWORD",
        "E2E_CASHIER_USERNAME",
        "E2E_CASHIER_PASSWORD",
    )

    state = book_order_and_serve(driver, wait, ui_config)
    table_id = state["table_id"]
    member_token = state["member_token"]

    # Cashier: chon ban, dan token QR thanh vien/voucher, thanh toan tien mat va thay modal hoa don thanh cong.
    login_internal(
        driver,
        wait,
        ui_config["internal_url"],
        os.environ["E2E_CASHIER_USERNAME"],
        os.environ["E2E_CASHIER_PASSWORD"],
    )
    driver.get(f"{ui_config['internal_url']}/tables")
    click_scrolled(driver, wait, (By.CSS_SELECTOR, f"[data-testid='cashier-table-card'][data-table-id='{table_id}']"))
    slow()
    wait.until(EC.presence_of_element_located(by_testid("checkout-qr-token-input"))).send_keys(member_token)
    driver.find_element(*by_testid("checkout-scan-qr-button")).click()
    wait.until(lambda d: "Khách:" in d.page_source or "MEMBER" in d.page_source or "VOUCHER" in d.page_source)
    slow()
    driver.find_element(*by_testid("checkout-cash-button")).click()
    wait.until(EC.alert_is_present()).accept()
    wait.until(EC.presence_of_element_located(by_testid("checkout-paid-message")))
    slow()

    # Chuyen sang tab Cong no, loc "Da thu" va in lai hoa don vua thanh toan.
    driver.get(f"{ui_config['internal_url']}/invoices")
    click_scrolled(driver, wait, by_testid("invoices-filter-paid"))
    slow()
    reprint_button = wait.until(EC.element_to_be_clickable(by_testid("invoice-reprint-button")))
    safe_click(driver, reprint_button)
    slow()
