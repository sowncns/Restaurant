"""Executable catalog of every Express route mounted by backend/src/routes/index.js."""

from dataclasses import dataclass


ALL_STAFF = frozenset(
    {"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "RECEPTIONIST", "WAITER", "KITCHEN", "CASHIER"}
)


@dataclass(frozen=True)
class Route:
    method: str
    path: str
    audience: str = "internal"
    roles: frozenset[str] = ALL_STAFF
    safe_read: bool = False
    validated: bool = False
    live_probe: bool = True

    @property
    def id(self):
        return f"{self.method} {self.path}"

    @property
    def protected(self):
        return self.audience in {"customer", "internal"}


def r(method, path, audience="internal", roles=ALL_STAFF, safe=False, validated=False, live=True):
    return Route(method, path, audience, frozenset(roles), safe, validated, live)


PUBLIC = [
    r("POST", "/webhook", "public"),
    r("POST", "/customer/auth/register", "public", validated=True),
    r("POST", "/customer/auth/login", "public", validated=True),
    r("POST", "/customer/auth/refresh-token", "public"),
    r("POST", "/customer/auth/logout", "public"),
    r("POST", "/customer/auth/forgot-password", "public", validated=True),
    r("POST", "/customer/auth/reset-password", "public", validated=True),
    r("GET", "/customer/auth/verify-email", "public"),
    r("POST", "/customer/auth/verify-email", "public", validated=True),
    r("POST", "/customer/auth/resend-verification", "public", validated=True),
    # This route sends real mail, so catalog coverage is static unless explicitly tested manually.
    r("GET", "/customer/auth/test-mail", "public"),
    r("POST", "/internal/auth/login", "public", validated=True),
    r("POST", "/internal/auth/refresh-token", "public"),
    r("POST", "/internal/auth/logout", "public"),
    r("POST", "/public/reservations", "public", validated=True),
    r("GET", "/public/companies", "public", safe=True),
    r("GET", "/public/companies/:companyId", "public", safe=True),
    r("GET", "/public/companies/:companyId/branches", "public", safe=True),
    r("GET", "/public/branches/:branchId", "public", safe=True),
    r("GET", "/public/companies/:companyId/categories", "public", safe=True),
    r("GET", "/public/companies/:companyId/menu", "public", safe=True),
    r("GET", "/public/menu-items/:menuItemId", "public", safe=True),
    r("GET", "/public/home-banners", "public", safe=True),
]

CUSTOMER = [
    r("POST", "/customer/auth/change-password", "customer", validated=True),
    r("POST", "/customer/auth/request-verification", "customer"),
    r("GET", "/customer/profile/me", "customer", safe=True),
    r("POST", "/customer/profile/verify-pin", "customer", validated=True),
    r("GET", "/customer/profile/transactions", "customer", safe=True),
    r("PUT", "/customer/profile/me", "customer", validated=True),
    r("POST", "/customer/profile/setup-pin", "customer", validated=True),
    r("POST", "/customer/profile/reset-pin-by-password", "customer", validated=True),
    r("GET", "/customer/voucher/", "customer", safe=True),
    r("GET", "/customer/reservations/", "customer", safe=True),
    r("GET", "/customer/reservations/:id", "customer", safe=True),
    r("POST", "/customer/reservations/", "customer", validated=True),
    r("DELETE", "/customer/reservations/:id", "customer"),
    r("POST", "/customer/payment/create", "customer", validated=True),
    r("GET", "/customer/qr-payment/pending", "customer", safe=True),
    r("GET", "/customer/qr-payment/stream", "customer", safe=True),
    r("GET", "/customer/qr-payment/invoices", "customer", safe=True),
    r("GET", "/customer/qr-payment/invoices/:id", "customer", safe=True),
    r("POST", "/customer/qr-payment/confirm", "customer", validated=True),
    r("POST", "/customer/qr-payment/generate-token", "customer"),
    r("POST", "/customer/qr-payment/scan-token", "customer", validated=True),
]

MANAGERS = {"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER"}
ADMINS = {"SUPER_ADMIN", "COMPANY_ADMIN"}
READ_MENU = {"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "WAITER", "CASHIER", "KITCHEN"}

INTERNAL = [
    # Dining tables
    r("GET", "/internal/dining-tables/sections", roles=ALL_STAFF, safe=True),
    r("GET", "/internal/dining-tables/sections/:sectionId", roles=ALL_STAFF, safe=True),
    r("POST", "/internal/dining-tables/sections", roles=MANAGERS),
    r("PUT", "/internal/dining-tables/sections/:sectionId", roles=MANAGERS),
    r("PATCH", "/internal/dining-tables/sections/:sectionId/status", roles=MANAGERS),
    r("DELETE", "/internal/dining-tables/sections/:sectionId", roles=MANAGERS),
    r("GET", "/internal/dining-tables/tables", roles=ALL_STAFF, safe=True),
    r("GET", "/internal/dining-tables/tables/:tableId", roles=ALL_STAFF, safe=True),
    r("POST", "/internal/dining-tables/tables", roles=MANAGERS),
    r("PUT", "/internal/dining-tables/tables/:tableId", roles=ALL_STAFF),
    r("PATCH", "/internal/dining-tables/tables/:tableId/status", roles=ALL_STAFF),
    r("DELETE", "/internal/dining-tables/tables/:tableId", roles=MANAGERS),
    # Orders and cancellation
    r("POST", "/internal/orders/", roles={"WAITER", "RECEPTIONIST", "BRANCH_MANAGER", "SUPER_ADMIN", "COMPANY_ADMIN"}, validated=True),
    r("POST", "/internal/orders/:order_id/items/:order_item_id/cancel-request", roles={"WAITER", "RECEPTIONIST", "BRANCH_MANAGER", "SUPER_ADMIN", "COMPANY_ADMIN"}, validated=True),
    r("GET", "/internal/orders/kitchen/preorders", roles={"KITCHEN", "BRANCH_MANAGER", "SUPER_ADMIN", "COMPANY_ADMIN"}, safe=True),
    r("POST", "/internal/orders/kitchen/preorders/:reservationId/confirm", roles={"KITCHEN", "BRANCH_MANAGER", "SUPER_ADMIN", "COMPANY_ADMIN"}),
    r("POST", "/internal/orders/kitchen/preorders/:reservationId/cancel", roles={"KITCHEN", "BRANCH_MANAGER", "SUPER_ADMIN", "COMPANY_ADMIN"}),
    r("GET", "/internal/orders/kitchen/queue", roles={"KITCHEN", "WAITER", "BRANCH_MANAGER", "SUPER_ADMIN", "COMPANY_ADMIN"}, safe=True),
    r("GET", "/internal/orders/kitchen/stream", roles={"KITCHEN", "WAITER", "BRANCH_MANAGER", "SUPER_ADMIN", "COMPANY_ADMIN"}, safe=True),
    r("GET", "/internal/orders/kitchen/history", roles={"KITCHEN", "WAITER", "BRANCH_MANAGER", "SUPER_ADMIN", "COMPANY_ADMIN"}, safe=True),
    r("POST", "/internal/orders/kitchen/scan", roles={"KITCHEN", "WAITER", "BRANCH_MANAGER", "SUPER_ADMIN", "COMPANY_ADMIN"}, validated=True),
    r("GET", "/internal/orders/table/:tableId/active", roles=ALL_STAFF, safe=True),
    r("GET", "/internal/orders/:id", roles=ALL_STAFF, safe=True),
    r("PUT", "/internal/orders/:id/items", roles={"WAITER", "RECEPTIONIST", "BRANCH_MANAGER", "SUPER_ADMIN", "COMPANY_ADMIN"}, validated=True),
    r("POST", "/internal/orders/:id/cancel-empty", roles={"WAITER", "RECEPTIONIST", "BRANCH_MANAGER", "SUPER_ADMIN", "COMPANY_ADMIN"}),
    r("POST", "/internal/orders/:id/scan-qr", roles={"WAITER", "RECEPTIONIST", "BRANCH_MANAGER", "SUPER_ADMIN", "COMPANY_ADMIN"}, validated=True),
    r("POST", "/internal/orders/:id/cook", roles={"KITCHEN", "WAITER", "BRANCH_MANAGER", "SUPER_ADMIN", "COMPANY_ADMIN"}),
    r("PATCH", "/internal/orders/items/:itemId/kitchen-status", roles={"KITCHEN", "WAITER", "BRANCH_MANAGER", "SUPER_ADMIN", "COMPANY_ADMIN"}),
    r("GET", "/internal/cancel-requests/", roles={"WAITER", "KITCHEN", "CASHIER", "BRANCH_MANAGER", "COMPANY_ADMIN", "SUPER_ADMIN"}, safe=True),
    r("PATCH", "/internal/cancel-requests/:cancel_request_id/accept", roles={"KITCHEN", "BRANCH_MANAGER", "COMPANY_ADMIN", "SUPER_ADMIN"}),
    r("PATCH", "/internal/cancel-requests/:cancel_request_id/reject", roles={"KITCHEN", "BRANCH_MANAGER", "COMPANY_ADMIN", "SUPER_ADMIN"}, validated=True),
    r("PATCH", "/internal/cancel-requests/:cancel_request_id/withdraw", roles={"WAITER", "BRANCH_MANAGER", "COMPANY_ADMIN", "SUPER_ADMIN"}),
    # Employees, reports, branches
    *[r("GET", f"/internal/employees/{p}", roles=MANAGERS, safe=True) for p in ("roles", "kitchen-types")],
    r("GET", "/internal/employees/", roles=MANAGERS, safe=True), r("GET", "/internal/employees/:id", roles=MANAGERS, safe=True),
    r("POST", "/internal/employees/", roles=MANAGERS, validated=True), r("PUT", "/internal/employees/:id", roles=MANAGERS, validated=True),
    r("PATCH", "/internal/employees/:id/status", roles=MANAGERS, validated=True), r("POST", "/internal/employees/:id/reset-password", roles=MANAGERS, validated=True),
    *[r("GET", f"/internal/reports/{p}", roles=MANAGERS, safe=True) for p in ("dashboard", "admin-overview", "revenue", "top-items")],
    r("GET", "/internal/branches/", roles=MANAGERS, safe=True), r("GET", "/internal/branches/:id", roles=MANAGERS, safe=True),
    r("POST", "/internal/branches/", roles=MANAGERS, validated=True), r("PUT", "/internal/branches/:id", roles=MANAGERS, validated=True),
    r("PATCH", "/internal/branches/:id/status", roles=MANAGERS, validated=True), r("DELETE", "/internal/branches/:id", roles=MANAGERS),
    # Checkout
    r("POST", "/internal/checkout/create-invoice", roles={"CASHIER", *MANAGERS}, validated=True),
    r("GET", "/internal/checkout/intent/:tableId", roles={"WAITER", "CASHIER", *MANAGERS}, safe=True),
    r("DELETE", "/internal/checkout/intent/:tableId", roles={"WAITER", "CASHIER", *MANAGERS}),
    r("POST", "/internal/checkout/scan", roles={"WAITER", "CASHIER", *MANAGERS}, validated=True),
    r("POST", "/internal/checkout/validate-voucher", roles={"WAITER", "CASHIER", *MANAGERS}, validated=True),
    r("GET", "/internal/checkout/table/:tableId/voucher", roles={"WAITER", "CASHIER", *MANAGERS}, safe=True),
    *[r("POST", f"/internal/checkout/items/:order_item_id/{p}", roles={"CASHIER", *MANAGERS}, validated=True) for p in ("void", "discount", "reduce-quantity")],
    *[r("GET", f"/internal/checkout/table/:tableId/{p}", roles={"WAITER", "CASHIER", *MANAGERS}, safe=True) for p in ("kiem-mon", "latest-invoice")],
    r("POST", "/internal/checkout/table/:tableId/vat", roles={"WAITER", "CASHIER", *MANAGERS}),
    r("GET", "/internal/checkout/table/:tableId/vat", roles={"WAITER", "CASHIER", *MANAGERS}, safe=True),
    r("GET", "/internal/checkout/invoices", roles={"CASHIER", *MANAGERS}, safe=True),
    r("POST", "/internal/checkout/invoices/:invoiceId/pay", roles={"CASHIER", *MANAGERS}),
    # Inventory, audit, procurement
    *[r("GET", f"/internal/inventory/{p}", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "KITCHEN", "CASHIER", "WAITER"}, safe=True) for p in ("ingredients", "ingredients/low-stock", "ingredients/:id", "recipes/menu-item/:menuItemId", "transactions", "estimate/order/:orderId")],
    r("POST", "/internal/inventory/ingredients", roles=ADMINS, validated=True), r("PUT", "/internal/inventory/ingredients/:id", roles=ADMINS, validated=True), r("DELETE", "/internal/inventory/ingredients/:id", roles=ADMINS),
    r("PUT", "/internal/inventory/recipes/menu-item/:menuItemId", roles=ADMINS, validated=True), r("DELETE", "/internal/inventory/recipes/:id", roles=ADMINS),
    r("POST", "/internal/inventory/transactions", roles=MANAGERS, validated=True),
    r("GET", "/internal/audit-logs/", roles=MANAGERS, safe=True),
    r("GET", "/internal/procurement/suppliers", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "KITCHEN"}, safe=True),
    r("GET", "/internal/procurement/suppliers/:id", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "KITCHEN"}, safe=True),
    r("POST", "/internal/procurement/suppliers", roles=MANAGERS, validated=True), r("PUT", "/internal/procurement/suppliers/:id", roles=MANAGERS, validated=True), r("DELETE", "/internal/procurement/suppliers/:id", roles=MANAGERS),
    r("GET", "/internal/procurement/receipts", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "KITCHEN"}, safe=True),
    r("GET", "/internal/procurement/receipts/by-code/:code", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "KITCHEN"}, safe=True),
    r("POST", "/internal/procurement/receipts/import-by-code", roles=MANAGERS),
    r("GET", "/internal/procurement/receipts/:id", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "KITCHEN"}, safe=True),
    r("POST", "/internal/procurement/receipts", roles=MANAGERS, validated=True),
    *[r("POST", f"/internal/procurement/receipts/:id/{p}", roles=MANAGERS) for p in ("confirm", "email")],
    r("DELETE", "/internal/procurement/receipts/:id", roles=MANAGERS),
    # Reservations
    r("GET", "/internal/reservations/", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "RECEPTIONIST", "WAITER"}, safe=True),
    *[r("GET", f"/internal/reservations/{p}", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "RECEPTIONIST"}, safe=True) for p in ("alerts", "call-list", "stream")],
    r("GET", "/internal/reservations/:id", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "RECEPTIONIST", "WAITER"}, safe=True),
    r("PATCH", "/internal/reservations/:id/confirm-call", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "RECEPTIONIST"}, validated=True),
    r("GET", "/internal/reservations/:id/suggest-table", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "RECEPTIONIST"}, safe=True),
    r("POST", "/internal/reservations/", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "RECEPTIONIST"}, validated=True),
    r("PUT", "/internal/reservations/:id", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "RECEPTIONIST"}, validated=True),
    r("PATCH", "/internal/reservations/:id/status", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "RECEPTIONIST"}, validated=True),
    r("POST", "/internal/reservations/:id/assign-table", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "RECEPTIONIST"}, validated=True),
    r("POST", "/internal/reservations/:id/checkin", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "RECEPTIONIST"}, validated=True),
    r("DELETE", "/internal/reservations/:id", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "RECEPTIONIST"}),
]

for base in ("menu-categories", "menu-items", "combos"):
    INTERNAL += [r("GET", f"/internal/{base}/", roles=READ_MENU, safe=True), r("GET", f"/internal/{base}/:id", roles=READ_MENU, safe=True), r("POST", f"/internal/{base}/", roles=ADMINS, validated=True), r("PUT", f"/internal/{base}/:id", roles=ADMINS, validated=True), r("DELETE", f"/internal/{base}/:id", roles=ADMINS)]
INTERNAL += [
    r("PATCH", "/internal/menu-items/:id/availability", roles={"SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER"}, validated=True),
    r("GET", "/internal/companies/", roles=ADMINS, safe=True), r("GET", "/internal/companies/:id", roles=ADMINS, safe=True), r("POST", "/internal/companies/", roles=ADMINS, validated=True), r("PUT", "/internal/companies/:id", roles=ADMINS, validated=True),
    r("GET", "/internal/cashback-rates/", roles={"SUPER_ADMIN"}, safe=True), r("PUT", "/internal/cashback-rates/:rank", roles={"SUPER_ADMIN"}, validated=True),
    r("GET", "/internal/vouchers/", roles=ADMINS, safe=True), r("GET", "/internal/vouchers/:id", roles=ADMINS, safe=True), r("POST", "/internal/vouchers/", roles=ADMINS, validated=True), r("PUT", "/internal/vouchers/:id", roles=ADMINS, validated=True), r("DELETE", "/internal/vouchers/:id", roles=ADMINS), r("POST", "/internal/vouchers/:id/assign", roles=ADMINS, validated=True),
    r("POST", "/internal/customers/:id/points", roles={"SUPER_ADMIN"}, validated=True),
    r("GET", "/internal/home-banners/", roles={"SUPER_ADMIN"}, safe=True), r("POST", "/internal/home-banners/", roles={"SUPER_ADMIN"}, validated=True), r("DELETE", "/internal/home-banners/:id", roles={"SUPER_ADMIN"}),
    r("POST", "/internal/qr-payment/request", roles=ALL_STAFF - {"KITCHEN"}, validated=True), r("GET", "/internal/qr-payment/status/:requestId", roles=ALL_STAFF - {"KITCHEN"}, safe=True), r("POST", "/internal/qr-payment/cancel", roles=ALL_STAFF - {"KITCHEN"}, validated=True),
]

ROUTES = tuple(PUBLIC + CUSTOMER + INTERNAL)
assert len({route.id for route in ROUTES}) == len(ROUTES), "duplicate route catalog entries"
