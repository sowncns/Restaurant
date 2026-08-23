import os

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from conftest import require_env
from tests.test_customer_auth_ui import login_customer
from tests.test_internal_auth_ui import login_internal
from tests.workflow_helpers import (
    DESKTOP_SIZE,
    MOBILE_SIZE,
    book_order_and_serve,
    by_testid,
    click_scrolled,
    logout_customer,
    logout_internal,
    safe_click,
    set_viewport,
    slow,
)


@pytest.mark.ui
@pytest.mark.auth
def test_customer_booking_to_vat_app_payment_confirmed_by_customer(
    driver, wait, ui_config, clean_reservation_state, ensure_customer_payment_pin
):
    """Cung luong dat ban -> phuc vu -> bep -> phuc vu phuc vu nhu workflow chinh, nhung
    ket thuc khac: thu ngan nhap thong tin xuat VAT roi chon thanh toan "Qua App" (tao yeu
    cau thanh toan qua vi), sau do CHINH khach hang mo app, vao muc Hoa don, bam "Thanh
    toan ngay" va nhap ma PIN de xac nhan tra tien - cuoi cung thu ngan bam "KT. Thanh toan"
    de xac nhan da nhan duoc tien va in hoa don.

    Dieu kien rieng: tai khoan E2E_CUSTOMER_EMAIL phai da co PIN thanh toan (tu dong thiet
    lap qua fixture ensure_customer_payment_pin neu chua co) VA vi phai co du so du (khong
    co API nap vi tu dong - vi chi nap qua PayOS that - nen can nap tay 1 lan vao DB cho tai
    khoan test truoc khi chay).
    """
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
    customer_pin = os.getenv("E2E_CUSTOMER_PIN", "123456")

    state = book_order_and_serve(driver, wait, ui_config)
    table_id = state["table_id"]
    member_token = state["member_token"]

    # Thu ngan: quet the thanh vien (bat buoc de biet tru vi ai khi tra "Qua App"), nhap
    # thong tin xuat VAT roi chon "Qua App".
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

    click_scrolled(driver, wait, by_testid("checkout-vat-toggle"))
    slow()
    driver.find_element(*by_testid("checkout-vat-company")).send_keys("iGourmet Selenium Demo")
    driver.find_element(*by_testid("checkout-vat-taxcode")).send_keys("0312345678")
    driver.find_element(*by_testid("checkout-vat-address")).send_keys("Selenium E2E environment")
    driver.find_element(*by_testid("checkout-vat-email")).send_keys(os.environ["E2E_CUSTOMER_EMAIL"])
    slow()
    driver.find_element(*by_testid("checkout-vat-save")).click()
    wait.until(lambda d: "đã lưu" in d.page_source)
    slow()

    safe_click(driver, driver.find_element(*by_testid("checkout-app-button")))
    wait.until(EC.alert_is_present()).accept()
    wait.until(lambda d: "Chờ khách xác nhận" in d.page_source)
    slow()
    logout_internal(driver, wait)

    # Khach hang: mo app, vao Hoa don, bam Thanh toan ngay va nhap PIN de xac nhan.
    set_viewport(driver, MOBILE_SIZE)
    login_customer(
        driver,
        wait,
        ui_config["customer_url"],
        os.environ["E2E_CUSTOMER_EMAIL"],
        os.environ["E2E_CUSTOMER_PASSWORD"],
    )
    driver.get(f"{ui_config['customer_url']}/invoices")
    slow()
    click_scrolled(driver, wait, by_testid("invoice-pay-now-button"))
    slow()
    for digit in customer_pin:
        key = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, f"[data-testid='pin-keypad-key'][data-key='{digit}']")))
        key.click()
    wait.until(EC.alert_is_present()).accept()
    slow()
    logout_customer(driver, wait)

    # Thu ngan quay lai: khach xac nhan PIN da hoan tat thanh toan ngay (khong can bam
    # "KT. Thanh toan" nua), nen di thang toi tab Cong no de xem va in lai hoa don.
    set_viewport(driver, DESKTOP_SIZE)
    login_internal(
        driver,
        wait,
        ui_config["internal_url"],
        os.environ["E2E_CASHIER_USERNAME"],
        os.environ["E2E_CASHIER_PASSWORD"],
    )
    driver.get(f"{ui_config['internal_url']}/invoices")
    click_scrolled(driver, wait, by_testid("invoices-filter-paid"))
    slow()
    reprint_button = wait.until(EC.element_to_be_clickable(by_testid("invoice-reprint-button")))
    safe_click(driver, reprint_button)
    slow()
