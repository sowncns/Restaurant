import pytest


STAFF_READS = {
    "RECEPTIONIST": ["/internal/dining-tables/sections", "/internal/reservations/"],
    "WAITER": ["/internal/dining-tables/tables", "/internal/menu-items/"],
    "KITCHEN": ["/internal/orders/kitchen/queue", "/internal/inventory/ingredients"],
    "CASHIER": ["/internal/dining-tables/tables", "/internal/checkout/invoices"],
    "BRANCH_MANAGER": ["/internal/reports/dashboard", "/internal/employees/"],
    "COMPANY_ADMIN": ["/internal/companies/", "/internal/vouchers/"],
    "SUPER_ADMIN": ["/internal/cashback-rates/", "/internal/home-banners/"],
}


@pytest.mark.smoke
def test_customer_safe_reads(customer_api):
    """
    Muc dich: kiem tra 1 khach hang da dang nhap thanh cong co the doc (GET, khong pha huy
    du lieu) 3 man hinh co ban nhat cua app khach: ho so ca nhan, danh sach voucher dang
    con dung, va danh sach phieu dat ban cua chinh minh.

    Dau vao:
      - customer_api: session da dang nhap qua POST /customer/auth/login voi
        E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD (fixture trong conftest.py), da gan
        header Authorization: Bearer <accessToken>. Neu thieu bien moi truong -> tu skip
        o tang fixture.
      - Lan luot GET: /customer/profile/me, /customer/voucher/, /customer/reservations/.

    Dau ra mong doi: ca 3 request deu tra HTTP 200 (khong bi 401/403 - tuc token hop le va
    khach co quyen doc du lieu cua chinh minh).
    """
    for path in ("/customer/profile/me", "/customer/voucher/", "/customer/reservations/"):
        response = customer_api.get(path)
        assert response.status_code == 200, f"GET {path}: HTTP {response.status_code} {response.text[:300]}"


@pytest.mark.smoke
@pytest.mark.parametrize("role", STAFF_READS)
def test_each_internal_role_group_safe_reads(staff_api_factory, role):
    """
    Muc dich: voi TUNG vai tro nhan vien (RECEPTIONIST, WAITER, KITCHEN, CASHIER,
    BRANCH_MANAGER, COMPANY_ADMIN, SUPER_ADMIN), kiem tra sau khi dang nhap ho doc duoc
    dung nhung man hinh/API thuoc nghiep vu cua minh - vd le tan xem duoc khu vuc + danh
    sach dat ban, bep xem duoc hang cho bep + kho nguyen lieu, quan ly xem duoc dashboard
    bao cao + danh sach nhan vien...

    Dau vao:
      - staff_api_factory(role): dang nhap qua POST /internal/auth/login bang
        E2E_<ROLE>_USERNAME / E2E_<ROLE>_PASSWORD tuong ung (xem ROLE_ENV trong
        conftest.py), tra ve session da gan Authorization header. Thieu credential -> skip.
      - STAFF_READS[role]: danh sach 2 duong dan GET dac trung cho tung role, vi du:
          RECEPTIONIST -> /internal/dining-tables/sections, /internal/reservations/
          WAITER       -> /internal/dining-tables/tables, /internal/menu-items/
          KITCHEN      -> /internal/orders/kitchen/queue, /internal/inventory/ingredients
          CASHIER      -> /internal/dining-tables/tables, /internal/checkout/invoices
          BRANCH_MANAGER -> /internal/reports/dashboard, /internal/employees/
          COMPANY_ADMIN  -> /internal/companies/, /internal/vouchers/
          SUPER_ADMIN    -> /internal/cashback-rates/, /internal/home-banners/

    Dau ra mong doi: moi request GET trong danh sach cua role do phai tra HTTP 200 (dang
    nhap dung role + dung phan quyen thi phai doc duoc, khong bi 401/403).
    """
    client = staff_api_factory(role)
    for path in STAFF_READS[role]:
        response = client.get(path)
        assert response.status_code == 200, f"{role} GET {path}: HTTP {response.status_code} {response.text[:300]}"
