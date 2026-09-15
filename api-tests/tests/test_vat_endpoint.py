import os

import pytest


@pytest.mark.smoke
def test_cashier_can_save_read_and_clear_vat(staff_api_factory):
    """
    Muc dich: CASHIER phai luu duoc thong tin xuat hoa don VAT cho 1 ban (ten cong ty, ma
    so thue, dia chi, email nguoi mua), doc lai dung y nguyen du lieu vua luu (du lieu nam
    trong Redis key table_vat_{tableId}, TTL 3600s - checkout.service.js saveTableVat /
    getTableVat), va xoa duoc (ghi de bang chuoi rong) khi khong con can nua.

    Dau vao:
      - table_id: bien moi truong E2E_SALES_TABLE_ID. Thieu bien -> skip.
      - cashier: dang nhap qua staff_api_factory("CASHIER").
      - Buoc 1 (luu): POST /internal/checkout/table/{table_id}/vat voi body
        {"companyName": "iGourmet API Test", "taxCode": "0312345678",
         "address": "Test environment", "email": "vat-test@example.test"}.
      - Buoc 2 (doc): GET /internal/checkout/table/{table_id}/vat (khong body).
      - Buoc 3 (xoa): POST cung endpoint voi body toan chuoi rong
        {"companyName": "", "taxCode": "", "address": "", "email": ""}.

    Dau ra mong doi:
      - Buoc 1: HTTP 200.
      - Buoc 2: HTTP 200 va JSON tra ve PHAI bang chinh xac (==) object `vat` da gui o
        buoc 1 - xac nhan Redis luu/doc dung, khong bi sai lech field.
      - Buoc 3: HTTP 200 (ghi de thanh cong, coi nhu da "xoa" thong tin VAT cua ban).
    """
    table_id = os.getenv("E2E_SALES_TABLE_ID")
    if not table_id:
        pytest.skip("E2E_SALES_TABLE_ID is absent")

    client = staff_api_factory("CASHIER")
    vat = {
        "companyName": "iGourmet API Test",
        "taxCode": "0312345678",
        "address": "Test environment",
        "email": "vat-test@example.test",
    }
    saved = client.post(f"/internal/checkout/table/{table_id}/vat", json=vat)
    assert saved.status_code == 200, saved.text

    loaded = client.get(f"/internal/checkout/table/{table_id}/vat")
    assert loaded.status_code == 200, loaded.text
    assert loaded.json() == vat

    cleared = client.post(
        f"/internal/checkout/table/{table_id}/vat",
        json={"companyName": "", "taxCode": "", "address": "", "email": ""},
    )
    assert cleared.status_code == 200, cleared.text
