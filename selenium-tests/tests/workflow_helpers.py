"""Shared steps for the full-stack UI workflow tests: everything from customer booking
through the waiter marking items served. Each test file picks its own payment ending."""
import os
import time
from datetime import date, timedelta

from selenium.common.exceptions import ElementNotInteractableException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select

from tests.test_customer_auth_ui import login_customer
from tests.test_internal_auth_ui import login_internal

# Pace between UI actions so a human can watch --headed runs. Override with
# SELENIUM_SLOWMO=0 to go back to full speed (e.g. for CI).
SLOWMO_SECONDS = float(os.getenv("SELENIUM_SLOWMO", "1.2"))

MOBILE_SIZE = (390, 844)  # iPhone-ish - receptionist/waiter screens are built for handheld use
DESKTOP_SIZE = (1440, 1000)  # kitchen display / cashier POS - bigger terminal screens


def slow():
    if SLOWMO_SECONDS > 0:
        time.sleep(SLOWMO_SECONDS)


def set_viewport(driver, size):
    driver.set_window_size(*size)
    slow()


def by_testid(testid):
    return (By.CSS_SELECTOR, f"[data-testid='{testid}']")


def safe_click(driver, element):
    """A scrolled-into-view element can still sit under a sticky header on small viewports,
    so a native click misses; fall back to dispatching the click via JS in that case."""
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
    try:
        element.click()
    except ElementNotInteractableException:
        driver.execute_script("arguments[0].click();", element)


def click_scrolled(driver, wait, locator):
    """wait.until(clickable).click() alone doesn't scroll - on the mobile viewport a card
    below the fold is "displayed" but not interactable until scrolled into view."""
    element = wait.until(EC.presence_of_element_located(locator))
    safe_click(driver, element)


def set_react_input_value(driver, element, value):
    """send_keys() on <input type=date>/<input type=time> goes through the browser's
    segment-based key handling and does not accept ISO values reliably; set the value via
    the native setter + input event instead, which is what React's onChange listens for."""
    driver.execute_script(
        """
        const [el, value] = arguments;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        """,
        element,
        value,
    )


def logout_internal(driver, wait):
    # Desktop sidebar and mobile topbar each render their own logout button under the
    # same testid (one is CSS-hidden depending on viewport) - click whichever is visible.
    def visible_logout_button(d):
        candidates = d.find_elements(*by_testid("internal-logout-button"))
        return next((el for el in candidates if el.is_displayed()), False)

    wait.until(visible_logout_button).click()
    wait.until(lambda d: "/login" in d.current_url)


def logout_customer(driver, wait):
    # Desktop nav and mobile topbar each render their own profile button under the same
    # testid (one is CSS-hidden depending on viewport) - click whichever is visible.
    def visible_profile_button(d):
        candidates = d.find_elements(*by_testid("customer-profile-button"))
        return next((el for el in candidates if el.is_displayed()), False)

    wait.until(visible_profile_button).click()
    wait.until(EC.element_to_be_clickable(by_testid("customer-logout-button"))).click()
    wait.until(lambda d: "/login" in d.current_url or d.current_url.rstrip("/").endswith("localhost:5173"))


def find_reservation_row(wait, phone):
    return wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, f"[data-testid='reservation-row'][data-phone='{phone}']")))


def book_order_and_serve(driver, wait, ui_config):
    """Customer books -> receptionist checks in -> waiter orders -> kitchen readies ->
    waiter marks served. Returns dict with table_id, menu_item_id, member_token, readied
    so the caller can continue on to whichever checkout flow it's testing."""
    company_id = os.environ["E2E_COMPANY_ID"]
    branch_id = os.environ["E2E_BRANCH_ID"]
    table_id = os.environ["E2E_SALES_TABLE_ID"]
    menu_item_id = os.environ["E2E_MENU_ITEM_ID"]
    customer_phone = os.getenv("E2E_CUSTOMER_PHONE", "0900000001")
    reservation_date = (date.today() + timedelta(days=7)).isoformat()
    reservation_time = os.getenv("E2E_RESERVATION_TIME", "18:30")
    set_viewport(driver, MOBILE_SIZE)

    # Customer: dang nhap, lay ma QR thanh vien, tao phieu dat ban tren web.
    login_customer(
        driver,
        wait,
        ui_config["customer_url"],
        os.environ["E2E_CUSTOMER_EMAIL"],
        os.environ["E2E_CUSTOMER_PASSWORD"],
    )
    driver.get(f"{ui_config['customer_url']}/my-qr")
    member_token = wait.until(EC.presence_of_element_located(by_testid("customer-member-token"))).get_attribute("data-token")
    assert member_token
    slow()

    driver.get(f"{ui_config['customer_url']}/booking")
    Select(wait.until(EC.element_to_be_clickable(by_testid("booking-company-select")))).select_by_value(company_id)
    slow()
    wait.until(lambda d: len(Select(d.find_element(*by_testid("booking-branch-select"))).options) > 1)
    Select(driver.find_element(*by_testid("booking-branch-select"))).select_by_value(branch_id)
    slow()
    name_input = driver.find_element(*by_testid("booking-name-input"))
    if not name_input.get_attribute("value"):
        name_input.send_keys("Selenium Customer")
    phone_input = driver.find_element(*by_testid("booking-phone-input"))
    phone_input.clear()
    phone_input.send_keys(customer_phone)
    set_react_input_value(driver, driver.find_element(*by_testid("booking-date-input")), reservation_date)
    set_react_input_value(driver, driver.find_element(*by_testid("booking-time-input")), reservation_time)
    driver.find_element(*by_testid("booking-note-input")).send_keys("selenium full UI workflow")
    slow()
    driver.find_element(*by_testid("booking-submit-button")).click()
    wait.until(EC.presence_of_element_located(by_testid("booking-success-message")))
    slow()
    logout_customer(driver, wait)

    # Receptionist va Waiter dung man hinh dien thoai/tablet cam tay tren thuc te.
    set_viewport(driver, MOBILE_SIZE)

    # Receptionist: tim phieu theo SDT, gan ban test, xac nhan va check-in de mo ban.
    login_internal(
        driver,
        wait,
        ui_config["internal_url"],
        os.environ["E2E_RECEPTIONIST_USERNAME"],
        os.environ["E2E_RECEPTIONIST_PASSWORD"],
    )
    driver.get(f"{ui_config['internal_url']}/reservations")
    row = find_reservation_row(wait, customer_phone)
    Select(row.find_element(*by_testid("reservation-table-select"))).select_by_value(table_id)
    slow()
    row = find_reservation_row(wait, customer_phone)
    Select(row.find_element(*by_testid("reservation-status-select"))).select_by_value("CONFIRMED")
    slow()
    row = find_reservation_row(wait, customer_phone)
    row.find_element(*by_testid("reservation-checkin-button")).click()

    def status_is_checked_in(d):
        row = find_reservation_row(wait, customer_phone)
        status_select = row.find_element(*by_testid("reservation-status-select"))
        return status_select.get_attribute("value") == "CHECKED_IN"

    wait.until(status_is_checked_in)
    slow()
    logout_internal(driver, wait)

    # Waiter: vao ban da check-in, goi vai mon (mon demo da biet co cong thuc + cac mon
    # khac dang hien thi tren thuc don) roi gui xuong bep.
    login_internal(
        driver,
        wait,
        ui_config["internal_url"],
        os.environ["E2E_WAITER_USERNAME"],
        os.environ["E2E_WAITER_PASSWORD"],
    )
    driver.get(f"{ui_config['internal_url']}/orders")
    click_scrolled(driver, wait, (By.CSS_SELECTOR, f"[data-testid='waiter-table-card'][data-table-id='{table_id}']"))
    slow()
    click_scrolled(driver, wait, (By.CSS_SELECTOR, f"[data-testid='waiter-menu-item'][data-menu-item-id='{menu_item_id}']"))
    slow()
    other_items = [
        el for el in driver.find_elements(*by_testid("waiter-menu-item"))
        if el.get_attribute("data-menu-item-id") != str(menu_item_id)
    ]
    extra_ids = []
    for extra in other_items[:1]:
        extra_ids.append(extra.get_attribute("data-menu-item-id"))
        safe_click(driver, extra)
        slow()
    # Tren man hinh dien thoai, gio hang nam o tab rieng - can chuyen qua truoc khi gui bep.
    view_cart_buttons = driver.find_elements(*by_testid("waiter-view-cart-button"))
    if view_cart_buttons and view_cart_buttons[0].is_displayed():
        safe_click(driver, view_cart_buttons[0])
        slow()
    wait.until(EC.element_to_be_clickable(by_testid("waiter-submit-order-button"))).click()
    slow()
    if "hết món" in driver.page_source:
        # Mot trong cac mon phu chon ngau nhien da het nguyen lieu - bo het mon phu (chi
        # menu_item_id chinh la mon da duoc kiem chung con hang) roi gui lai.
        for extra_id in extra_ids:
            for btn in driver.find_elements(*by_testid("waiter-cart-decrease")):
                if btn.get_attribute("data-menu-item-id") == extra_id:
                    safe_click(driver, btn)
                    break
        slow()
        wait.until(EC.element_to_be_clickable(by_testid("waiter-submit-order-button"))).click()
    wait.until(lambda d: "Đã gửi bếp" in d.page_source or "Chờ nấu" in d.page_source)
    slow()
    logout_internal(driver, wait)

    # Bep va thu ngan dung man hinh lon hon (POS / man hinh bep) - tra lai co desktop.
    set_viewport(driver, DESKTOP_SIZE)

    # Kitchen: bao "Xong" cho tung mon trong hang cho, lan luot tung mon mot.
    login_internal(
        driver,
        wait,
        ui_config["internal_url"],
        os.environ["E2E_KITCHEN_USERNAME"],
        os.environ["E2E_KITCHEN_PASSWORD"],
    )
    driver.get(f"{ui_config['internal_url']}/kitchen")
    wait.until(EC.presence_of_element_located(by_testid("kitchen-order-item")))
    slow()
    readied = 0
    max_attempts = len(driver.find_elements(*by_testid("kitchen-order-item"))) + 2
    for _ in range(max_attempts):
        buttons = driver.find_elements(*by_testid("kitchen-ready-button"))
        if not buttons:
            break
        safe_click(driver, buttons[0])
        readied += 1
        slow()
    assert readied > 0, "khong bao duoc mon nao la da nau xong"
    logout_internal(driver, wait)

    # Waiter quay lai xac nhan da mang mon ra ban (READY -> SERVED) truoc khi thanh toan.
    set_viewport(driver, MOBILE_SIZE)
    login_internal(
        driver,
        wait,
        ui_config["internal_url"],
        os.environ["E2E_WAITER_USERNAME"],
        os.environ["E2E_WAITER_PASSWORD"],
    )
    driver.get(f"{ui_config['internal_url']}/orders")
    click_scrolled(driver, wait, (By.CSS_SELECTOR, f"[data-testid='waiter-table-card'][data-table-id='{table_id}']"))
    slow()
    cart_tab_buttons = driver.find_elements(*by_testid("waiter-view-cart-button"))
    if cart_tab_buttons and cart_tab_buttons[0].is_displayed():
        safe_click(driver, cart_tab_buttons[0])
        slow()
    served = 0
    max_serve_attempts = readied + 2
    for _ in range(max_serve_attempts):
        buttons = driver.find_elements(*by_testid("waiter-serve-button"))
        if not buttons:
            break
        safe_click(driver, buttons[0])
        served += 1
        slow()
    assert served > 0, "khong xac nhan phuc vu duoc mon nao"
    logout_internal(driver, wait)
    set_viewport(driver, DESKTOP_SIZE)

    return {
        "table_id": table_id,
        "menu_item_id": menu_item_id,
        "member_token": member_token,
        "readied": readied,
    }
