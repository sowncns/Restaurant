import os

import pytest


def assert_forbidden_or_hidden(response):
    """Accept both explicit denial and hidden-resource responses for tenant isolation."""
    assert response.status_code in {403, 404}, (
        f"expected 403/404 isolation response, got HTTP {response.status_code}: "
        f"{response.text[:500]}"
    )


def require_env(*names):
    """Skip only the tests that need extra cross-branch demo records."""
    missing = [name for name in names if not os.getenv(name)]
    if missing:
        pytest.skip("missing cross-branch test configuration: " + ", ".join(missing))


def find_branch(payload, branch_id):
    """Return one branch row from the common list response shapes."""
    rows = payload.get("branches", payload.get("data", payload if isinstance(payload, list) else []))
    return next((row for row in rows if int(row["id"]) == int(branch_id)), None)


@pytest.mark.auth
def test_branch_manager_can_read_own_branch_table(staff_api_factory):
    """
    Muc dich: BRANCH_MANAGER phai xem duoc chi tiet 1 cai ban (dining table) thuoc DUNG chi
    nhanh cua minh - baseline duong (positive case) truoc khi test cac truong hop bi chan.

    Dau vao:
      - table_id: bien moi truong E2E_SALES_TABLE_ID (ban nay phai thuoc chi nhanh ma
        tai khoan E2E_MANAGER_USERNAME quan ly). Thieu bien -> skip.
      - manager: dang nhap qua staff_api_factory("BRANCH_MANAGER").
      - GET /internal/dining-tables/tables/{table_id}.

    Dau ra mong doi: HTTP 200 (assertBranchScope trong tables.service.js cho phep vi
    table.branch_id == currentUser.branch_id).

    Luu y: endpoint GET /internal/dining-tables/tables/:id nay hien CHUA duoc frontend
    igourmet-internal goi o bat ky man hinh nao (TablesPage, SectionsPage, FloorMapPage deu
    chi dung tablesApi.list() roi loc/tim tren client, khong co ham nao goi rieng theo id -
    xem igourmet-internal/src/api/tables.ts). Test nay chi xac nhan hanh vi phan quyen cua
    API o tang backend, khong phan anh viec UI da tich hop hay chua.
    """
    require_env("E2E_SALES_TABLE_ID")
    manager = staff_api_factory("BRANCH_MANAGER")

    response = manager.get(f"/internal/dining-tables/tables/{os.environ['E2E_SALES_TABLE_ID']}")

    assert response.status_code == 200, response.text[:500]


@pytest.mark.auth
def test_branch_manager_cannot_read_other_branch_table(staff_api_factory):
    """
    Muc dich: BRANCH_MANAGER chi nhanh A KHONG duoc xem chi tiet 1 cai ban thuoc chi nhanh
    B - kiem tra tuong tu du lieu da tenant (multi-branch data isolation) o tang doc.

    Dau vao:
      - table_id: bien moi truong E2E_OTHER_BRANCH_TABLE_ID (ban thuoc chi nhanh KHAC voi
        chi nhanh cua manager dang nhap). Thieu bien -> skip.
      - manager: dang nhap qua staff_api_factory("BRANCH_MANAGER").
      - GET /internal/dining-tables/tables/{table_id}.

    Dau ra mong doi: HTTP 403 hoac 404 (assert_forbidden_or_hidden) - backend co the chon
    tra 403 "khong co quyen" ro rang hoac 404 "an" du lieu, ca 2 deu chap nhan duoc mien la
    KHONG lo du lieu ban chi nhanh khac qua 200.
    """
    require_env("E2E_OTHER_BRANCH_TABLE_ID")
    manager = staff_api_factory("BRANCH_MANAGER")

    response = manager.get(f"/internal/dining-tables/tables/{os.environ['E2E_OTHER_BRANCH_TABLE_ID']}")

    assert_forbidden_or_hidden(response)


@pytest.mark.auth
@pytest.mark.destructive
def test_branch_manager_cannot_update_other_branch_table_status(staff_api_factory):

    require_env("E2E_OTHER_BRANCH_TABLE_ID")
    manager = staff_api_factory("BRANCH_MANAGER")

    response = manager.patch(
        f"/internal/dining-tables/tables/{os.environ['E2E_OTHER_BRANCH_TABLE_ID']}/status",
        json={"status": "AVAILABLE"},
    )

    assert_forbidden_or_hidden(response)


@pytest.mark.auth
def test_branch_manager_branch_list_is_scoped_to_own_branch(staff_api_factory):
    """
    Muc dich: khi BRANCH_MANAGER goi danh sach chi nhanh (GET /internal/branches/), ket
    qua tra ve phai TU DONG loc chi con chi nhanh cua chinh ho (buildScopedBranchWhere),
    khong duoc liet ke chi nhanh khac du la cung cong ty.

    Dau vao:
      - E2E_BRANCH_ID: chi nhanh CUA manager dang nhap.
      - E2E_OTHER_BRANCH_ID: 1 chi nhanh KHAC (bat ky, khac branch cua manager).
      - manager: dang nhap BRANCH_MANAGER.
      - GET /internal/branches/ (khong query param loc).

    Dau ra mong doi:
      - HTTP 200.
      - Danh sach tra ve (payload["branches"], hoac payload["data"], hoac payload neu la
        list truc tiep - xem find_branch) PHAI chua ban ghi co id == E2E_BRANCH_ID.
      - Danh sach do KHONG duoc chua ban ghi co id == E2E_OTHER_BRANCH_ID.
    """
    require_env("E2E_BRANCH_ID", "E2E_OTHER_BRANCH_ID")
    manager = staff_api_factory("BRANCH_MANAGER")

    response = manager.get("/internal/branches/")

    assert response.status_code == 200, response.text[:500]
    payload = response.json()

    assert find_branch(payload, os.environ["E2E_BRANCH_ID"]) is not None
    assert find_branch(payload, os.environ["E2E_OTHER_BRANCH_ID"]) is None


@pytest.mark.auth
def test_company_admin_can_read_other_branch_in_same_company(staff_api_factory):
    """
    Muc dich: COMPANY_ADMIN co pham vi RONG HON BRANCH_MANAGER - phai xem duoc chi tiet
    chi nhanh B, mien la chi nhanh B thuoc CUNG cong ty voi minh (khac voi test truoc,
    day la truong hop cho phep, khong bi chan).

    Dau vao:
      - branch_id: E2E_OTHER_BRANCH_ID (mot chi nhanh KHAC voi chi nhanh chinh nhung van
        thuoc cong ty ma E2E_COMPANY_ADMIN_USERNAME quan ly).
      - company_admin: dang nhap qua staff_api_factory("COMPANY_ADMIN").
      - GET /internal/branches/{branch_id}.

    Dau ra mong doi: HTTP 200 (assertBranchScope cho phep vi branch.company_id ==
    currentUser.company_id, bat ke branch_id nao trong cong ty).
    """
    require_env("E2E_OTHER_BRANCH_ID")
    company_admin = staff_api_factory("COMPANY_ADMIN")

    response = company_admin.get(f"/internal/branches/{os.environ['E2E_OTHER_BRANCH_ID']}")

    assert response.status_code == 200, response.text[:500]


@pytest.mark.auth
def test_company_admin_cannot_read_branch_from_other_company(staff_api_factory):
    """
    Muc dich: pham vi cua COMPANY_ADMIN dung o ranh gioi CONG TY - khong duoc xem chi
    nhanh thuoc mot cong ty KHAC voi cong ty minh dang quan ly.

    Dau vao:
      - branch_id: E2E_OTHER_COMPANY_BRANCH_ID (chi nhanh thuoc cong ty KHAC voi cong ty
        cua E2E_COMPANY_ADMIN_USERNAME).
      - company_admin: dang nhap qua staff_api_factory("COMPANY_ADMIN").
      - GET /internal/branches/{branch_id}.

    Dau ra mong doi: HTTP 403 hoac 404 (assert_forbidden_or_hidden).
    """
    require_env("E2E_OTHER_COMPANY_BRANCH_ID")
    company_admin = staff_api_factory("COMPANY_ADMIN")

    response = company_admin.get(f"/internal/branches/{os.environ['E2E_OTHER_COMPANY_BRANCH_ID']}")

    assert_forbidden_or_hidden(response)


@pytest.mark.auth
def test_super_admin_can_read_branch_from_other_company(staff_api_factory):
    """
    Muc dich: SUPER_ADMIN co pham vi TOAN HE THONG (khong bi rang buoc cong ty/chi nhanh)
    - phai xem duoc chi nhanh cua BAT KY cong ty nao, bao gom cong ty khac voi cong ty
    "chinh" cua tai khoan Super Admin (neu co).

    Dau vao:
      - branch_id: E2E_OTHER_COMPANY_BRANCH_ID (chi nhanh thuoc cong ty bat ky).
      - super_admin: dang nhap qua staff_api_factory("SUPER_ADMIN").
      - GET /internal/branches/{branch_id}.

    Dau ra mong doi: HTTP 200 (assertBranchScope: role == "SUPER_ADMIN" -> return ngay,
    khong kiem tra company_id/branch_id).
    """
    require_env("E2E_OTHER_COMPANY_BRANCH_ID")
    super_admin = staff_api_factory("SUPER_ADMIN")

    response = super_admin.get(f"/internal/branches/{os.environ['E2E_OTHER_COMPANY_BRANCH_ID']}")

    assert response.status_code == 200, response.text[:500]
