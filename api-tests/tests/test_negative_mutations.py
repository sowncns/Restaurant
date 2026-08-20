import pytest


@pytest.mark.auth
@pytest.mark.parametrize("path", [
    "/customer/profile/verify-pin", "/customer/profile/setup-pin",
    "/customer/profile/reset-pin-by-password", "/customer/qr-payment/scan-token",
])
def test_customer_mutations_reject_invalid_bodies(customer_api, path):
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
    response = staff_api_factory(role).post(path, json={})
    assert response.status_code == 403, f"{role} POST {path}: HTTP {response.status_code} {response.text[:300]}"


@pytest.mark.auth
def test_customer_token_cannot_cross_into_internal_api(customer_api):
    response = customer_api.get("/internal/dining-tables/tables")
    assert response.status_code == 403
