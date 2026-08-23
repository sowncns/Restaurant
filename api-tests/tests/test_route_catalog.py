from pathlib import Path

import pytest

from route_catalog import ROUTES


def _is_unmounted(response):
    if response.status_code != 404:
        return False
    try:
        return str(response.json().get("message", "")).startswith("Không tìm thấy route ")
    except ValueError:
        return False


@pytest.mark.catalog
@pytest.mark.parametrize("route", ROUTES, ids=lambda route: route.id)
def test_catalogued_route_is_mounted_and_protected(api, route_path, route):
    """
    Muc dich: voi MOI route khai bao trong route_catalog.py (183 route), kiem tra route
    do thuc su duoc mount tren backend (khong 404 "khong tim thay route") va neu la route
    protected (customer/internal) thi phai tu choi request an danh (chua dang nhap).

    Dau vao:
      - route.method + route.path duoc dien gia tri gia (concrete_path): companyId/branchId/
        tableId/menuItemId/requestId = 2147483647, rank = "INVALID_TEST_RANK", code = "API_TEST_MISSING".
      - Khong gui cookie/Authorization (client an danh).
      - Body: {} cho method != GET, None cho GET.

    Dau ra mong doi:
      - response khong phai 404 kem message "Khong tim thay route ..." (tuc route co ton tai
        trong routes/index.js, chi la co the loi 400/401/403/404-nghiep-vu do id gia).
      - Neu route.protected == True (audience "customer" hoac "internal"): status_code phai
        dung 401 (chua xac thuc), KHONG duoc la 200/403/500 - dam bao middleware requireAuth
        chan truoc khi request cham toi logic nghiep vu.
      - Route public (audience "public") khong bi rang buoc status cu the o day.
    """
    if not route.live_probe:
        pytest.skip("live probe intentionally disabled because this endpoint sends email")
    response = api.request(route.method, route_path(route.path), json={} if route.method != "GET" else None)
    assert not _is_unmounted(response), f"catalogued route is not mounted: {route.id}"
    if route.protected:
        assert response.status_code == 401, f"anonymous {route.id} returned {response.status_code}, expected 401"


def test_catalog_has_unique_method_paths():
    """
    Muc dich: dam bao chinh ban than route_catalog.py khong khai bao trung mot cap
    (method, path) hai lan - tranh viec 1 route bi test 2 lan hoac ghi de nham roles/audience.

    Dau vao: danh sach ROUTES lay truc tiep tu route_catalog.py (khong goi API, thuan Python).

    Dau ra mong doi: so luong id ("METHOD /path") phai bang so luong id sau khi loai trung
    (len(ids) == len(set(ids))) - tuc khong co phan tu nao trung lap.
    """
    ids = [route.id for route in ROUTES]
    assert len(ids) == len(set(ids))


def test_side_effecting_mail_route_is_statically_mounted():
    """
    Muc dich: endpoint GET /customer/auth/test-mail gui email THAT nen KHONG duoc goi song
    (live probe) trong test_catalogued_route_is_mounted_and_protected (live_probe=False o
    route_catalog.py). Test nay bu lai bang cach kiem tra tinh (static) rang route van con
    duoc khai bao trong source code, tranh truong hop route bi xoa ma khong ai biet.

    Dau vao: doc noi dung file backend/src/modules/customer/auth/auth.route.js tu dia.

    Dau ra mong doi:
      - Neu khong tim thay file source (moi truong khong co ma nguon backend ke ben) -> skip.
      - Neu co file: chuoi 'router.get("/test-mail", controller.testMail)' phai xuat hien
        nguyen van trong noi dung file.
    """
    source = Path(__file__).parents[2] / "backend/src/modules/customer/auth/auth.route.js"
    if not source.exists():
        pytest.skip("backend source is unavailable; live mail probe remains intentionally disabled")
    assert 'router.get("/test-mail", controller.testMail)' in source.read_text(encoding="utf-8")
