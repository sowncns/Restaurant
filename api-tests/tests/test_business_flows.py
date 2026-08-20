import os
from datetime import date, timedelta

import pytest


def require_destructive(*names):
    if os.getenv("API_DESTRUCTIVE") != "1":
        pytest.skip("destructive API flows disabled: set API_DESTRUCTIVE=1 and run with -m destructive")
    missing = [name for name in names if not os.getenv(name)]
    if missing:
        pytest.skip("destructive fixture IDs absent: " + ", ".join(missing))


@pytest.mark.destructive
def test_customer_reservation_create_then_cancel(customer_api):
    require_destructive("E2E_BRANCH_ID")
    payload = {
        "branch_id": int(os.environ["E2E_BRANCH_ID"]),
        "reservation_date": (date.today() + timedelta(days=7)).isoformat(),
        "reservation_time": os.getenv("E2E_RESERVATION_TIME", "18:30"),
        "guest_count": 2,
        "customer_phone": os.getenv("E2E_CUSTOMER_PHONE", "0900000001"),
        "note": "pytest API destructive flow",
    }
    created = customer_api.post("/customer/reservations/", json=payload)
    assert created.status_code == 201, created.text
    reservation = created.json()["reservation"]
    reservation_id = reservation.get("reservation_id") or reservation.get("id")
    assert reservation_id
    cancelled = customer_api.delete(f"/customer/reservations/{reservation_id}")
    assert cancelled.status_code in {200, 204}, cancelled.text


@pytest.mark.destructive
def test_waiter_empty_order_create_then_cancel(staff_api_factory):
    require_destructive("E2E_SALES_TABLE_ID")
    waiter = staff_api_factory("WAITER")
    created = waiter.post("/internal/orders/", json={"table_id": int(os.environ["E2E_SALES_TABLE_ID"]), "guest_count": 2, "order_items": []})
    assert created.status_code == 201, created.text
    order = created.json().get("order", created.json())
    order_id = order.get("order_id") or order.get("id")
    assert order_id
    cancelled = waiter.post(f"/internal/orders/{order_id}/cancel-empty")
    assert cancelled.status_code in {200, 204}, cancelled.text
