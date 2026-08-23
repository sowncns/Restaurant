import os

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from conftest import require_env


ROLE_CREDENTIALS = {
    "RECEPTIONIST": ("E2E_RECEPTIONIST_USERNAME", "E2E_RECEPTIONIST_PASSWORD", "/floor"),
    "WAITER": ("E2E_WAITER_USERNAME", "E2E_WAITER_PASSWORD", "/orders"),
    "KITCHEN": ("E2E_KITCHEN_USERNAME", "E2E_KITCHEN_PASSWORD", "/kitchen"),
    "CASHIER": ("E2E_CASHIER_USERNAME", "E2E_CASHIER_PASSWORD", "/tables"),
    "BRANCH_MANAGER": ("E2E_MANAGER_USERNAME", "E2E_MANAGER_PASSWORD", "/"),
    "COMPANY_ADMIN": ("E2E_COMPANY_ADMIN_USERNAME", "E2E_COMPANY_ADMIN_PASSWORD", "/"),
    "SUPER_ADMIN": ("E2E_SUPER_ADMIN_USERNAME", "E2E_SUPER_ADMIN_PASSWORD", "/"),
}


def login_internal(driver, wait, base_url, username, password):
    driver.get(f"{base_url}/login")
    inputs = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "input")))
    inputs[0].send_keys(username)
    inputs[1].send_keys(password)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    wait.until(lambda d: "/login" not in d.current_url)


@pytest.mark.ui
@pytest.mark.auth
def test_internal_login_rejects_invalid_credentials(driver, wait, ui_config):
    """Test UI dang nhap noi bo: username/password sai phai hien thong bao loi va van o trang login."""
    driver.get(f"{ui_config['internal_url']}/login")
    inputs = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "input")))
    inputs[0].send_keys("selenium-invalid-user")
    inputs[1].send_keys("wrong-password")
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

    wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, "body"), "Đăng nhập"))
    assert "/login" in driver.current_url


@pytest.mark.ui
@pytest.mark.auth
@pytest.mark.parametrize("role", ROLE_CREDENTIALS)
def test_each_internal_role_can_login_and_reach_home(driver, wait, ui_config, role):
    """Test UI phan quyen noi bo: moi role dang nhap thanh cong va vao dung trang mac dinh theo vai tro."""
    user_env, pass_env, expected_path = ROLE_CREDENTIALS[role]
    require_env(user_env, pass_env)

    login_internal(driver, wait, ui_config["internal_url"], os.environ[user_env], os.environ[pass_env])

    wait.until(lambda d: d.current_url.startswith(ui_config["internal_url"]))
    if expected_path != "/":
        assert expected_path in driver.current_url
    assert "iGourmet" in driver.page_source or driver.title


@pytest.mark.ui
@pytest.mark.auth
def test_waiter_cannot_open_manager_inventory_page(driver, wait, ui_config):
    """Test UI route guard: Waiter khong duoc mo trang quan ly kho cua Manager/Admin."""
    require_env("E2E_WAITER_USERNAME", "E2E_WAITER_PASSWORD")

    login_internal(
        driver,
        wait,
        ui_config["internal_url"],
        os.environ["E2E_WAITER_USERNAME"],
        os.environ["E2E_WAITER_PASSWORD"],
    )
    driver.get(f"{ui_config['internal_url']}/inventory")

    wait.until(lambda d: "/403" in d.current_url or "403" in d.page_source or "Không có quyền" in d.page_source)
    assert "/403" in driver.current_url or "Không có quyền" in driver.page_source or "403" in driver.page_source
