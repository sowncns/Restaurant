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
    for path in ("/customer/profile/me", "/customer/voucher/", "/customer/reservations/"):
        response = customer_api.get(path)
        assert response.status_code == 200, f"GET {path}: HTTP {response.status_code} {response.text[:300]}"


@pytest.mark.smoke
@pytest.mark.parametrize("role", STAFF_READS)
def test_each_internal_role_group_safe_reads(staff_api_factory, role):
    client = staff_api_factory(role)
    for path in STAFF_READS[role]:
        response = client.get(path)
        assert response.status_code == 200, f"{role} GET {path}: HTTP {response.status_code} {response.text[:300]}"
