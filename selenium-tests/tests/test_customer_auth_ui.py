import os

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from conftest import require_env


def login_customer(driver, wait, base_url, email, password):
    driver.get(f"{base_url}/login")
    email_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']")))
    password_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
    email_input.send_keys(email)
    password_input.send_keys(password)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    wait.until(lambda d: "/login" not in d.current_url)


@pytest.mark.ui
@pytest.mark.auth
def test_customer_login_rejects_invalid_credentials(driver, wait, ui_config):
    """Test UI dang nhap khach hang: email/password sai phai bao loi va khong vao tai khoan."""
    driver.get(f"{ui_config['customer_url']}/login")
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']"))).send_keys("bad@example.test")
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys("wrong-password")
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

    wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, "body"), "Đăng nhập"))
    assert "/login" in driver.current_url


@pytest.mark.ui
@pytest.mark.auth
def test_customer_can_login_and_open_reservation_history(driver, wait, ui_config):
    """Test UI khach hang: dang nhap thanh cong va mo duoc trang lich su dat ban da bao ve."""
    require_env("E2E_CUSTOMER_EMAIL", "E2E_CUSTOMER_PASSWORD")

    login_customer(
        driver,
        wait,
        ui_config["customer_url"],
        os.environ["E2E_CUSTOMER_EMAIL"],
        os.environ["E2E_CUSTOMER_PASSWORD"],
    )
    driver.get(f"{ui_config['customer_url']}/booking/history")

    wait.until(lambda d: "/login" not in d.current_url)
    assert "Đăng nhập" not in driver.find_element(By.TAG_NAME, "body").text
