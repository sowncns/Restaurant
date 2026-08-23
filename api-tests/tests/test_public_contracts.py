import os

import pytest
import requests


def assert_envelope(response, key, kind):
    assert response.status_code == 200
    assert response.headers.get("content-type", "").startswith("application/json")
    payload = response.json()
    assert isinstance(payload.get("message"), str) and payload["message"]
    assert isinstance(payload.get(key), kind)
    return payload[key]


@pytest.mark.contract
def test_health_contract(api_config):
    """
    Muc dich: kiem tra endpoint GET /health (ngoai tien to /api) bao gio cung tra ve trang
    thai san sang cho cong cu giam sat/CI runner - day la endpoint dau tien duoc kiem tra
    truoc khi tin tuong backend con song.

    Dau vao: khong can du lieu/token gi - goi GET truc tiep toi <base_url_khong_/api>/health.

    Dau ra mong doi:
      - HTTP 200.
      - Body JSON co truong "status" == "ok" (dung app.js: res.json({status:"ok"})).
    """
    base = api_config["base_url"]
    health_url = base[:-4] + "/health" if base.endswith("/api") else base + "/health"
    response = requests.get(health_url, timeout=api_config["timeout"], verify=api_config["verify"])
    assert response.status_code == 200
    assert response.json().get("status") == "ok"


@pytest.mark.contract
def test_companies_contract(api):
    """
    Muc dich: kiem tra "hop dong" (contract) cua GET /public/companies - API cong khai,
    khong can dang nhap, tra danh sach cong ty dang ACTIVE.

    Dau vao: khong tham so, client an danh (khong token).

    Dau ra mong doi (qua assert_envelope):
      - HTTP 200, Content-Type bat dau bang application/json.
      - Body co "message" la chuoi khong rong.
      - Body co "companies" la 1 list (co the rong neu chua co du lieu).
    """
    assert_envelope(api.get("/public/companies"), "companies", list)


@pytest.mark.contract
def test_home_banners_contract(api):
    """
    Muc dich: kiem tra contract cua GET /public/home-banners - anh banner trang chu / "Hom
    nay an gi", API cong khai khong yeu cau dang nhap.

    Dau vao: khong tham so, client an danh.

    Dau ra mong doi: HTTP 200 + envelope {"message": str, "banners": list} (co the rong).
    """
    assert_envelope(api.get("/public/home-banners"), "banners", list)


@pytest.mark.contract
def test_company_children_contracts(api):
    """
    Muc dich: kiem tra chuoi 4 API public phu thuoc vao 1 company_id cu the: chi tiet cong
    ty, danh sach chi nhanh, danh muc mon, va thuc don gom nhom theo danh muc.

    Dau vao:
      - company_id: uu tien bien moi truong E2E_COMPANY_ID; neu khong co thi lay
        companies[0].company_id tu ket qua GET /public/companies (cong ty dau tien dang
        ACTIVE). Neu khong co ca 2 nguon -> skip test.
      - 4 request GET lien tiep: /public/companies/{id}, /public/companies/{id}/branches,
        /public/companies/{id}/categories, /public/companies/{id}/menu.

    Dau ra mong doi (moi request qua assert_envelope):
      - GET /public/companies/{id}: HTTP 200, envelope co key "company" la dict.
      - GET .../branches: HTTP 200, key "branches" la list.
      - GET .../categories: HTTP 200, key "categories" la list.
      - GET .../menu: HTTP 200, key "menu" la list (menu da duoc gom nhom theo danh muc,
        co the chua muc "Combo" neu cong ty co combo dang ACTIVE).
    """
    companies = assert_envelope(api.get("/public/companies"), "companies", list)
    company_id = os.getenv("E2E_COMPANY_ID") or (companies[0].get("company_id") if companies else None)
    if not company_id:
        pytest.skip("no public company and E2E_COMPANY_ID is absent")
    assert_envelope(api.get(f"/public/companies/{company_id}"), "company", dict)
    assert_envelope(api.get(f"/public/companies/{company_id}/branches"), "branches", list)
    assert_envelope(api.get(f"/public/companies/{company_id}/categories"), "categories", list)
    assert_envelope(api.get(f"/public/companies/{company_id}/menu"), "menu", list)


@pytest.mark.contract
def test_branch_contract(api):
    """
    Muc dich: kiem tra contract cua GET /public/branches/{branchId} - lay chi tiet 1 chi
    nhanh cu the (dung de FE hien thi thong tin chi nhanh, gio mo cua...).

    Dau vao: branchId lay tu bien moi truong E2E_BRANCH_ID (phai la chi nhanh dang ACTIVE
    co that trong DB test). Neu bien nay khong duoc cau hinh -> skip test.

    Dau ra mong doi: HTTP 200 + envelope {"message": str, "branch": dict}.
    """
    branch_id = os.getenv("E2E_BRANCH_ID")
    if not branch_id:
        pytest.skip("E2E_BRANCH_ID absent")
    assert_envelope(api.get(f"/public/branches/{branch_id}"), "branch", dict)


@pytest.mark.contract
def test_menu_item_contract(api):
    """
    Muc dich: kiem tra contract cua GET /public/menu-items/{menuItemId} - lay chi tiet 1
    mon an cu the tu thuc don cong khai.

    Dau vao: menuItemId lay tu bien moi truong E2E_MENU_ITEM_ID (phai la mon dang
    status='active' trong DB test). Neu bien nay khong duoc cau hinh -> skip test.

    Dau ra mong doi: HTTP 200 + envelope {"message": str, "item": dict}.
    """
    item_id = os.getenv("E2E_MENU_ITEM_ID")
    if not item_id:
        pytest.skip("E2E_MENU_ITEM_ID absent")
    assert_envelope(api.get(f"/public/menu-items/{item_id}"), "item", dict)
