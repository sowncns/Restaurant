import os
import time
from datetime import date, timedelta

import pytest
import requests


def require_flow_env(*names):
    if os.getenv("API_DESTRUCTIVE") != "1":
        pytest.skip("set API_DESTRUCTIVE=1 and run with -m business_flow")
    missing = [name for name in names if not os.getenv(name)]
    if missing:
        pytest.skip("missing flow configuration: " + ", ".join(missing))


def assert_ok(response, expected=(200,)):
    assert response.status_code in expected, (
        f"{response.request.method} {response.request.url}: "
        f"HTTP {response.status_code} {response.text[:1000]}"
    )
    return response.json() if response.content else {}


def object_id(value, *keys):
    candidates = [value]
    for wrapper in ("reservation", "receipt", "invoice", "order", "data"):
        if isinstance(value, dict) and isinstance(value.get(wrapper), dict):
            candidates.append(value[wrapper])
    for candidate in candidates:
        if isinstance(candidate, dict):
            for key in keys:
                if candidate.get(key) is not None:
                    return int(candidate[key])
    return None


def active_order(waiter, table_id):
    payload = assert_ok(waiter.get(f"/internal/orders/table/{table_id}/active"))
    assert "No active order" not in payload.get("message", ""), payload
    return payload.get("order", payload)


def ingredient(manager, ingredient_id):
    payload = assert_ok(manager.get("/internal/inventory/ingredients"))
    row = next((item for item in payload["ingredients"] if int(item["id"]) == ingredient_id), None)
    assert row is not None, f"ingredient {ingredient_id} was not returned"
    return row


def sold_quantity(manager, menu_item_id, branch_id):
    today = date.today().isoformat()
    payload = assert_ok(manager.get(
        "/internal/reports/top-items",
        params={"from": today, "to": today, "limit": 500, "branch_id": branch_id},
    ))
    rows = payload.get("data", payload)
    row = next((item for item in rows if item.get("menu_item_id") is not None and int(item["menu_item_id"]) == menu_item_id), None)
    return float(row["total_quantity"]) if row else 0.0


def wait_for_invoice_email(invoice_code):
    endpoint = os.environ["API_TEST_MAIL_URL"]
    deadline = time.time() + 20
    while time.time() < deadline:
        response = requests.get(endpoint, timeout=5)
        assert response.status_code == 200, response.text
        messages = response.json().get("messages", [])
        found = next((message for message in messages if invoice_code in message.get("Subject", "")), None)
        if found:
            return found
        time.sleep(0.5)
    pytest.fail(f"VAT email for invoice {invoice_code} was not received")


@pytest.mark.destructive
@pytest.mark.business_flow
def test_reservation_to_paid_invoice_and_email(customer_api, staff_api_factory):
    """
    Muc dich: kiem tra E2E toan bo luong nghiep vu chinh cua nha hang tu goc do API, xuyen
    5 vai tro khac nhau (khach hang + 4 nhan vien), dam bao du lieu chay dung qua tung
    buoc: dat ban -> le tan xac nhan/gan ban/check-in -> phuc vu goi mon -> bep nau (tru
    kho) -> thu ngan xuat VAT + thanh toan tien mat -> hoa don duoc gui email -> le tan
    dong phieu dat ban. Day la test "toan trinh" phat hien loi tich hop giua cac module
    (reservation, order, kitchen, checkout, email) ma cac test doc lap tung module khong
    the phat hien.

    Dau vao (bien moi truong bat buoc, thieu 1 trong so nay -> skip toan bo test):
      - E2E_BRANCH_ID: chi nhanh thuc hien luong.
      - E2E_RESERVATION_TABLE_ID: ban danh rieng cho test nay (se bi ep ve AVAILABLE truoc
        va sau khi chay, de test lap lai duoc nhieu lan).
      - E2E_MENU_ITEM_ID: mon an dung de goi mon (phai co cong thuc/recipe va dang ban).
      - E2E_CUSTOMER_EMAIL: email khach dang nhap (dung de nhan email hoa don VAT).
      - API_TEST_MAIL_URL: dia chi fake-resend server (vd http://127.0.0.1:8025/messages)
        de doc lai email da "gui".
      - Dang nhap: customer_api (khach), va 4 nhan vien qua staff_api_factory:
        RECEPTIONIST, WAITER, KITCHEN, CASHIER, BRANCH_MANAGER (manager dung de reset
        trang thai ban).
      - Payload dat ban: branch_id, reservation_date = hom nay + 7 ngay, reservation_time
        (mac dinh "18:30", doi qua E2E_RESERVATION_TIME), guest_count=2, customer_phone
        (mac dinh "0900000001"), note danh dau "pytest main flow <timestamp>".
      - Payload goi mon: {"items": [{"menu_item_id": ..., "quantity": 1, "note": "pytest
        main flow"}]}.
      - Payload VAT: companyName="iGourmet Pytest", taxCode="0312345678",
        address="API test environment", email=E2E_CUSTOMER_EMAIL.
      - Payload thanh toan: {"tableId": ..., "paymentMethod": "CASH"}.

    Cac buoc kiem tra va dau ra mong doi tuong ung:
      1. POST /customer/reservations/  -> HTTP 201, reservation.status == "PENDING".
      2. PATCH .../confirm-call {"confirmed": true} (RECEPTIONIST) -> tra dung
         reservation.id.
      3. POST .../assign-table {"table_id": ...} (RECEPTIONIST) -> reservation.table_id
         dung id da gan, reservation.status == "CONFIRMED".
      4. POST .../checkin {"table_id": ...} (RECEPTIONIST) -> reservation.status ==
         "CHECKED_IN".
      5. GET /internal/orders/table/{tableId}/active (WAITER) -> co order dang mo, status
         thuoc {PENDING, CONFIRMED, PREPARING, READY, SERVED} (checkin da tu tao order).
      6. PUT /internal/orders/{orderId}/items (WAITER, them mon) -> mon vua them xuat hien
         trong order.items voi kitchen_status == "WAITING".
      7. GET /internal/orders/kitchen/queue (KITCHEN) -> mon vua goi phai co mat trong
         hang cho bep.
      8. PATCH /internal/orders/items/{itemId}/kitchen-status {"status":"READY"}
         (KITCHEN) -> response.to == "READY" va response.stock_deducted == True (xac nhan
         da tru kho dung 1 lan khi mon chuyen sang da nau).
      9. POST /internal/checkout/table/{tableId}/vat (CASHIER, luu thong tin xuat VAT) ->
         HTTP 200.
      10. POST /internal/checkout/create-invoice {"paymentMethod":"CASH"} (CASHIER) ->
          invoice.status == "PAID", invoice.amount > 0.
      11. GET /internal/checkout/table/{tableId}/latest-invoice (CASHIER) ->
          invoice_code trung voi hoa don vua tao, status == "PAID".
      12. wait_for_invoice_email(invoice_code): cho toi 20s, poll API_TEST_MAIL_URL, phai
          tim thay 1 email co Subject chua invoice_code - xac nhan sendVatInvoiceEmail da
          duoc goi va gui thanh cong qua fake-resend.
      13. PATCH /internal/reservations/{id}/status {"status":"COMPLETED"} (RECEPTIONIST)
          -> reservation.status == "COMPLETED".

    Don dep (finally, luon chay du test pass/fail):
      - Neu phieu dat ban chua ve COMPLETED (loi giua chung) -> khach tu huy phieu qua
        DELETE /customer/reservations/{id}.
      - Manager luon PATCH ban ve lai "AVAILABLE" de lan chay sau khong bi ket trang thai
        SERVING (CASH khong tu dong tra ban ve AVAILABLE, cho nhan vien xac nhan khach da
        roi - day la hanh vi thiet ke, khong phai loi).
    """
    require_flow_env(
        "E2E_BRANCH_ID", "E2E_RESERVATION_TABLE_ID", "E2E_MENU_ITEM_ID",
        "E2E_CUSTOMER_EMAIL", "API_TEST_MAIL_URL",
    )
    branch_id = int(os.environ["E2E_BRANCH_ID"])
    table_id = int(os.environ["E2E_RESERVATION_TABLE_ID"])
    menu_item_id = int(os.environ["E2E_MENU_ITEM_ID"])
    receptionist = staff_api_factory("RECEPTIONIST")
    waiter = staff_api_factory("WAITER")
    kitchen = staff_api_factory("KITCHEN")
    cashier = staff_api_factory("CASHIER")
    manager = staff_api_factory("BRANCH_MANAGER")
    reservation_id = None
    reservation_completed = False

    # Ensure a repeatable starting state for the dedicated test table.
    assert_ok(manager.patch(f"/internal/dining-tables/tables/{table_id}/status", json={"status": "AVAILABLE"}))

    try:
        reservation_payload = {
            "branch_id": branch_id,
            "reservation_date": (date.today() + timedelta(days=7)).isoformat(),
            "reservation_time": os.getenv("E2E_RESERVATION_TIME", "18:30"),
            "guest_count": 2,
            "customer_phone": os.getenv("E2E_CUSTOMER_PHONE", "0900000001"),
            "note": f"pytest main flow {time.time_ns()}",
        }
        created = assert_ok(customer_api.post("/customer/reservations/", json=reservation_payload), (201,))
        reservation_id = object_id(created, "id", "reservation_id")
        assert reservation_id
        assert created["reservation"]["status"] == "PENDING"

        confirmed = assert_ok(receptionist.patch(
            f"/internal/reservations/{reservation_id}/confirm-call", json={"confirmed": True},
        ))
        assert int(confirmed["reservation"]["id"]) == reservation_id

        assigned = assert_ok(receptionist.post(
            f"/internal/reservations/{reservation_id}/assign-table", json={"table_id": table_id},
        ))
        assert int(assigned["reservation"]["table_id"]) == table_id
        assert assigned["reservation"]["status"] == "CONFIRMED"

        checked_in = assert_ok(receptionist.post(
            f"/internal/reservations/{reservation_id}/checkin", json={"table_id": table_id},
        ))
        assert checked_in["reservation"]["status"] == "CHECKED_IN"

        order = active_order(waiter, table_id)
        order_id = int(order["order_id"])
        assert order["status"] in {"PENDING", "CONFIRMED", "PREPARING", "READY", "SERVED"}

        assert_ok(waiter.put(
            f"/internal/orders/{order_id}/items",
            json={"items": [{"menu_item_id": menu_item_id, "quantity": 1, "note": "pytest main flow"}]},
        ))
        order = active_order(waiter, table_id)
        item = next(item for item in order["items"] if int(item["menu_item_id"]) == menu_item_id)
        item_id = int(item.get("order_item_id") or item["id"])
        assert item["kitchen_status"] == "WAITING"

        queue = assert_ok(kitchen.get("/internal/orders/kitchen/queue"))["items"]
        assert any(int(row["id"]) == item_id for row in queue)
        cooked = assert_ok(kitchen.patch(
            f"/internal/orders/items/{item_id}/kitchen-status", json={"status": "READY"},
        ))
        assert cooked["to"] == "READY"
        assert cooked["stock_deducted"] is True

        vat = {
            "companyName": "iGourmet Pytest",
            "taxCode": "0312345678",
            "address": "API test environment",
            "email": os.environ["E2E_CUSTOMER_EMAIL"],
        }
        assert_ok(cashier.post(f"/internal/checkout/table/{table_id}/vat", json=vat))
        invoice_result = assert_ok(cashier.post(
            "/internal/checkout/create-invoice", json={"tableId": table_id, "paymentMethod": "CASH"},
        ))
        invoice = invoice_result["invoice"]
        assert invoice["status"] == "PAID"
        assert float(invoice["amount"]) > 0

        latest = assert_ok(cashier.get(f"/internal/checkout/table/{table_id}/latest-invoice"))
        latest_invoice = latest.get("invoice", latest)
        assert latest_invoice["invoice_code"] == invoice["invoice_code"]
        assert latest_invoice["status"] == "PAID"
        wait_for_invoice_email(invoice["invoice_code"])

        completed = assert_ok(receptionist.patch(
            f"/internal/reservations/{reservation_id}/status", json={"status": "COMPLETED"},
        ))
        assert completed["reservation"]["status"] == "COMPLETED"
        reservation_completed = True
    finally:
        if reservation_id and not reservation_completed:
            customer_api.delete(f"/customer/reservations/{reservation_id}")
        # CASH intentionally leaves the table in SERVING until staff confirms that guests left.
        manager.patch(f"/internal/dining-tables/tables/{table_id}/status", json={"status": "AVAILABLE"})


@pytest.mark.destructive
@pytest.mark.business_flow
def test_procurement_to_stock_consumption_and_report(staff_api_factory):
    """
    Muc dich: kiem tra E2E toan bo chuoi kho: nha cung cap nhap hang -> ton kho tang dung
    so luong -> ban 1 mon co dung cong thuc (recipe) -> ton kho tu dong TRU dung theo dinh
    luong khi bep nau -> bao cao "mon ban chay" (top-items) phan anh dung so luong da ban
    -> lich su giao dich kho (inventory_transactions) co ghi ca 2 loai PURCHASE va
    SALE_CONSUMPTION. Day la test tich hop giua 3 module doc lap: procurement, order/
    kitchen (consumption.service.js), va report.

    Dau vao (bien moi truong bat buoc, thieu -> skip toan bo test):
      - E2E_BRANCH_ID, E2E_SALES_TABLE_ID: chi nhanh va ban dung de ban hang.
      - E2E_MENU_ITEM_ID: mon an co khai bao recipe (cong thuc nguyen lieu).
      - E2E_INGREDIENT_ID: 1 nguyen lieu co trong recipe cua mon tren.
      - E2E_SUPPLIER_ID: nha cung cap dung de tao phieu nhap.
      - E2E_RECEIPT_QUANTITY (mac dinh 10), E2E_RECEIPT_UNIT_PRICE (mac dinh 10000): so
        luong va don gia nhap kho.
      - Dang nhap: BRANCH_MANAGER (quan ly kho/bao cao), WAITER (tao don), KITCHEN (nau),
        CASHIER (thanh toan).
      - Trang thai truoc test: doc stock_before (ton kho hien tai cua ingredient) va
        report_before (so luong mon da ban hom nay theo top-items) de so sanh delta thay
        vi so sanh tuyet doi - test chay lap lai nhieu lan trong ngay van dung.

    Cac buoc kiem tra va dau ra mong doi tuong ung:
      1. POST /internal/procurement/receipts (MANAGER) voi 1 dong nguyen lieu so luong=
         E2E_RECEIPT_QUANTITY, don gia=E2E_RECEIPT_UNIT_PRICE -> HTTP 201,
         receipt.status == "DRAFT".
      2. POST /internal/procurement/receipts/{id}/confirm (MANAGER) -> receipt.status ==
         "CONFIRMED"; ton kho SAU xac nhan == stock_before + receipt_quantity (xap xi, dung
         pytest.approx vi so thap phan).
      3. GET /internal/inventory/recipes/menu-item/{menuItemId} -> lay dinh luong
         (expected_consumption) cua ingredient_id trong cong thuc mon nay.
      4. POST /internal/orders/ (WAITER) tao don moi tren ban voi 1 mon so luong=1 -> HTTP
         201, lay duoc order_id va item_id tuong ung.
      5. PATCH /internal/orders/items/{itemId}/kitchen-status {"status":"READY"}
         (KITCHEN) -> response.stock_deducted == True; ton kho SAU khi nau ==
         (ton kho sau nhap) - expected_consumption (xap xi).
      6. POST /internal/checkout/create-invoice {"paymentMethod":"CASH"} (CASHIER) ->
         invoice.status == "PAID".
      7. sold_quantity (bao cao top-items, loc theo hom nay + branch_id) SAU giao dich >=
         report_before + 1 - xac nhan bao cao cap nhat kip thoi sau khi thanh toan.
      8. GET /internal/inventory/transactions loc theo ingredient_id -> danh sach giao
         dich phai chua IT NHAT 1 dong loai "PURCHASE" (tu buoc nhap kho) VA it nhat 1 dong
         loai "SALE_CONSUMPTION" (tu buoc bep nau) - xac nhan ca 2 huong bien dong kho deu
         duoc ghi log day du.

    Don dep (finally, luon chay du test pass/fail):
      - Manager PATCH ban ve lai "AVAILABLE".
      - Manager goi POST /internal/inventory/transactions loai "STOCK_COUNT" voi
        actualStock = stock_before de KHOI PHUC dung ton kho ban dau - dam bao chay lap
        lai test nhieu lan khong lam sai lech du lieu ton kho that trong moi truong test.
    """
    require_flow_env(
        "E2E_BRANCH_ID", "E2E_SALES_TABLE_ID", "E2E_MENU_ITEM_ID",
        "E2E_INGREDIENT_ID", "E2E_SUPPLIER_ID",
    )
    branch_id = int(os.environ["E2E_BRANCH_ID"])
    table_id = int(os.environ["E2E_SALES_TABLE_ID"])
    menu_item_id = int(os.environ["E2E_MENU_ITEM_ID"])
    ingredient_id = int(os.environ["E2E_INGREDIENT_ID"])
    supplier_id = int(os.environ["E2E_SUPPLIER_ID"])
    receipt_quantity = float(os.getenv("E2E_RECEIPT_QUANTITY", "10"))
    unit_price = float(os.getenv("E2E_RECEIPT_UNIT_PRICE", "10000"))
    manager = staff_api_factory("BRANCH_MANAGER")
    waiter = staff_api_factory("WAITER")
    kitchen = staff_api_factory("KITCHEN")
    cashier = staff_api_factory("CASHIER")
    stock_before = float(ingredient(manager, ingredient_id)["current_stock"])
    report_before = sold_quantity(manager, menu_item_id, branch_id)

    assert_ok(manager.patch(f"/internal/dining-tables/tables/{table_id}/status", json={"status": "AVAILABLE"}))
    try:
        receipt_code = f"PYTEST-{int(time.time() * 1000)}"
        receipt_payload = {
            "supplier_id": supplier_id,
            "branch_id": branch_id,
            "receipt_code": receipt_code,
            "receipt_date": date.today().isoformat(),
            "note": "pytest inventory flow",
            "items": [{
                "ingredient_id": ingredient_id,
                "quantity": receipt_quantity,
                "unit_price": unit_price,
            }],
        }
        created = assert_ok(manager.post("/internal/procurement/receipts", json=receipt_payload), (201,))
        receipt_id = object_id(created, "id", "receiptId")
        assert receipt_id
        assert created["receipt"]["status"] == "DRAFT"

        confirmed = assert_ok(manager.post(f"/internal/procurement/receipts/{receipt_id}/confirm", json={}))
        assert confirmed["receipt"]["status"] == "CONFIRMED"
        stock_after_import = float(ingredient(manager, ingredient_id)["current_stock"])
        assert stock_after_import == pytest.approx(stock_before + receipt_quantity)

        recipe = assert_ok(manager.get(f"/internal/inventory/recipes/menu-item/{menu_item_id}"))
        recipe_line = next(row for row in recipe["recipe"] if int(row["ingredient_id"]) == ingredient_id)
        expected_consumption = float(recipe_line["quantity"])

        order_response = assert_ok(waiter.post("/internal/orders/", json={
            "table_id": table_id,
            "guest_count": 1,
            "note": "pytest inventory flow",
            "order_items": [{"menu_item_id": menu_item_id, "quantity": 1}],
        }), (201,))
        order_id = object_id(order_response, "order_id", "id")
        assert order_id
        order = assert_ok(waiter.get(f"/internal/orders/{order_id}"))
        item = next(row for row in order["items"] if int(row["menu_item_id"]) == menu_item_id)
        item_id = int(item.get("order_item_id") or item["id"])

        cooked = assert_ok(kitchen.patch(
            f"/internal/orders/items/{item_id}/kitchen-status", json={"status": "READY"},
        ))
        assert cooked["stock_deducted"] is True
        stock_after_sale = float(ingredient(manager, ingredient_id)["current_stock"])
        assert stock_after_sale == pytest.approx(stock_after_import - expected_consumption)

        invoice_result = assert_ok(cashier.post(
            "/internal/checkout/create-invoice", json={"tableId": table_id, "paymentMethod": "CASH"},
        ))
        assert invoice_result["invoice"]["status"] == "PAID"

        report_after = sold_quantity(manager, menu_item_id, branch_id)
        assert report_after >= report_before + 1

        transactions = assert_ok(manager.get(
            "/internal/inventory/transactions",
            params={"ingredientId": ingredient_id, "page": 1, "limit": 100},
        ))["transactions"]
        assert any(row.get("transaction_type", row.get("type")) == "PURCHASE" for row in transactions)
        assert any(row.get("transaction_type", row.get("type")) == "SALE_CONSUMPTION" for row in transactions)
    finally:
        manager.patch(f"/internal/dining-tables/tables/{table_id}/status", json={"status": "AVAILABLE"})
        # Restore stock so the destructive suite remains repeatable.
        manager.post("/internal/inventory/transactions", json={
            "ingredientId": ingredient_id,
            "type": "STOCK_COUNT",
            "actualStock": stock_before,
            "note": "restore after pytest inventory flow",
            "branchId": branch_id,
        })
