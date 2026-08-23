import pytest


@pytest.mark.auth
@pytest.mark.parametrize("path", [
    "/customer/profile/verify-pin", "/customer/profile/setup-pin",
    "/customer/profile/reset-pin-by-password", "/customer/qr-payment/scan-token",
])
def test_customer_mutations_reject_invalid_bodies(customer_api, path):
    """
    Muc dich: 4 API khach hang nhay cam lien quan PIN thanh toan / vi (xac thuc PIN, thiet
    lap PIN, doi PIN qua mat khau, sinh QR quet) phai duoc middleware validate (Zod schema)
    chan LAI truoc khi cham toi service - dam bao khong the goi voi body thieu du lieu.

    Dau vao:
      - customer_api da dang nhap (Authorization: Bearer <token>).
      - Body gui len: {} (rong hoan toan - thieu truong "pin"/"password"/"newPin"/"kind"...).

    Dau ra mong doi: HTTP 400 (Bad Request) cho ca 4 endpoint - chung to Zod schema
    (pinSchema, resetPinSchema, scanTokenSchema...) bat loi truoc khi query DB, KHONG duoc
    tra 401 (sai token) hay 500 (loi he thong khong luong truoc).
    """
    response = customer_api.post(path, json={})
    assert response.status_code == 400, f"POST {path}: HTTP {response.status_code} {response.text[:300]}"


@pytest.mark.auth
@pytest.mark.parametrize(("role", "method", "path"), [
    ("WAITER", "post", "/internal/orders/"),
    ("BRANCH_MANAGER", "post", "/internal/employees/"),
    ("COMPANY_ADMIN", "post", "/internal/inventory/ingredients"),
    ("SUPER_ADMIN", "post", "/internal/vouchers/"),
])
def test_authorized_mutations_validate_before_business_logic(staff_api_factory, role, method, path):
    """
    Muc dich: voi 4 cap (role, API) ma role NAY CO QUYEN goi (dung roles trong
    route_catalog.py), kiem tra khi gui body rong thi request van bi chan boi buoc validate
    du lieu (400) truoc khi chay den logic nghiep vu (vd tao order, tao nhan vien, tao
    nguyen lieu, tao voucher) - tranh truong hop code nghiep vu chay voi du lieu thieu roi
    crash 500 hoac ghi du lieu rac vao DB.

    Dau vao:
      - staff_api_factory(role): dang nhap dung role co quyen POST vao API tuong ung.
      - Body: {} (rong).
      - 4 to hop: WAITER POST /internal/orders/, BRANCH_MANAGER POST /internal/employees/,
        COMPANY_ADMIN POST /internal/inventory/ingredients, SUPER_ADMIN POST
        /internal/vouchers/.

    Dau ra mong doi: HTTP 400 cho ca 4 truong hop - xac nhan thu tu xu ly la
    requireAuth -> authorize(role) -> validate(schema) -> controller, va validate chay
    TRUOC khi vao service/repository.
    """
    response = getattr(staff_api_factory(role), method)(path, json={})
    assert response.status_code == 400, f"{role} {method.upper()} {path}: HTTP {response.status_code} {response.text[:300]}"


@pytest.mark.auth
@pytest.mark.parametrize(("role", "path"), [
    ("RECEPTIONIST", "/internal/checkout/create-invoice"),
    ("WAITER", "/internal/menu-categories/"),
    ("KITCHEN", "/internal/orders/"),
    ("CASHIER", "/internal/procurement/suppliers"),
    ("BRANCH_MANAGER", "/internal/menu-items/"),
])
def test_internal_roles_cannot_call_forbidden_mutations(staff_api_factory, role, path):
    """
    Muc dich: nguoc lai voi test tren - voi 5 cap (role, API) ma role NAY KHONG CO QUYEN
    goi (RECEPTIONIST khong duoc tao hoa don, WAITER khong duoc tao danh muc mon, KITCHEN
    khong duoc tao order, CASHIER khong duoc tao nha cung cap, BRANCH_MANAGER khong duoc
    tao mon an), kiem tra middleware authorize() chan dung o buoc phan quyen (403) truoc
    ca khi toi buoc validate du lieu.

    Dau vao:
      - staff_api_factory(role): dang nhap dung role KHONG co quyen voi API do.
      - Body: {} (rong - khong lien quan, vi request phai bi chan boi phan quyen truoc khi
        toi validate).

    Dau ra mong doi: HTTP 403 (Forbidden) cho ca 5 truong hop - khong duoc la 400 (neu la
    400 nghia la validate chay truoc phan quyen - sai thu tu middleware) hay 200.
    """
    response = staff_api_factory(role).post(path, json={})
    assert response.status_code == 403, f"{role} POST {path}: HTTP {response.status_code} {response.text[:300]}"


@pytest.mark.auth
def test_customer_token_cannot_cross_into_internal_api(customer_api):
    """
    Muc dich: token cua khach hang (type="customer" trong JWT payload) tuyet doi khong
    duoc dung de goi API noi bo (/internal/*) danh cho nhan vien - kiem tra
    auth.middleware.js.requireAuth phan biet dung req.user.type theo tien to URL.

    Dau vao: customer_api da dang nhap thanh cong (co Authorization: Bearer <customer JWT>
    hop le), goi GET /internal/dining-tables/tables (mot API noi bo binh thuong, khong can
    quyen dac biet ngoai la nhan vien).

    Dau ra mong doi: HTTP 403 (Forbidden) - "Khong co quyen truy cap Internal" - CHU Y day
    la 403 chu khong phai 401, vi token van hop le (verify JWT thanh cong), chi la sai loai
    tai khoan cho pham vi URL nay.
    """
    response = customer_api.get("/internal/dining-tables/tables")
    assert response.status_code == 403
