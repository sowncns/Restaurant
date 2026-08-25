# Bảng ca kiểm thử — iGourmet

Tài liệu tổng hợp toàn bộ ca kiểm thử tự động trong repository, dùng cho báo cáo/đồ án (Chương 4 — Hiện thực và kiểm thử).

- Kết quả **Unit** và **Integration/API** dưới đây là số đo thật (đã chạy trong quá trình soạn tài liệu).
- Kết quả **E2E Selenium** dẫn từ lần chạy gần nhất theo lịch sử test có sẵn trong repo, chưa re-run tại thời điểm viết tài liệu này.
- Cách chạy lại từng bộ: xem mục [Cách chạy](#cách-chạy) ở cuối file.

**Tổng cộng: 223 test case tự động** — 21 unit + 220 API/integration (trên các ca không phá huỷ dữ liệu) + 7 hàm E2E UI (một số nhân theo 7 vai trò).

---

## A. Kiểm thử đơn vị (Unit) — `backend/test/*.test.js`

Chạy bằng `node --test`, mock DB/repository, không cần backend hay database chạy sẵn.

**Kết quả: 21/21 pass, 1.25s**

| Mã | File | Đầu vào | Kết quả mong đợi | Kết quả thực tế | Đạt |
|---|---|---|---|---|---|
| UT-01 | business-errors.test.js | Request tới branch không tồn tại, không có DB thật | 404 business error, không throw exception thô | 404 đúng | ✅ |
| UT-02 | business-errors.test.js | `COMPANY_ADMIN` sửa branch thuộc tenant khác | Bị chặn | Chặn đúng | ✅ |
| UT-03 | business-errors.test.js | `SUPER_ADMIN` tạo branch, thiếu/company không tồn tại | Validate lỗi đúng | Đúng | ✅ |
| UT-04 | business-errors.test.js | Tạo company: role không đủ quyền + thiếu tên | Reject cả 2 điều kiện | Đúng | ✅ |
| UT-05 | business-errors.test.js | `COMPANY_ADMIN` liệt kê company | Chỉ nhận company của mình | Đúng | ✅ |
| UT-06 | rbac-tenant.test.js | User ẩn danh / role không hợp lệ gọi `authorize` | Reject | Đúng | ✅ |
| UT-07 | rbac-tenant.test.js | Truy vấn scope theo branch, khác company/branch | Chặn truy cập chéo | Đúng | ✅ |
| UT-08 | rbac-tenant.test.js | Sinh query param theo tenant đăng nhập | Param khớp tenant | Đúng | ✅ |
| UT-09 | rbac-tenant.test.js | Input cố override company/branch scope (không phải super admin) | Bị bỏ qua, dùng scope thật | Đúng | ✅ |
| UT-10 | rbac-tenant.test.js | Manager cấp role ngang/cao hơn mình | Bị chặn | Đúng | ✅ |
| UT-11 | secured-operations.test.js | Checkout bàn ngoài company/branch đăng nhập | Từ chối | Đúng | ✅ |
| UT-12 | secured-operations.test.js | Tạo invoice trùng khi đã có invoice chưa thanh toán | Chặn trước khi insert | Đúng | ✅ |
| UT-13 | secured-operations.test.js | QR payment tính amount/table/customer từ invoice | Suy ra đúng, không tin dữ liệu client | Đúng | ✅ |
| UT-14 | secured-operations.test.js | QR payment với invoice khác chi nhánh | Ẩn đi | Đúng | ✅ |
| UT-15 | secured-operations.test.js | Xoá recipe kèm company scope | Query có điều kiện company | Đúng | ✅ |
| UT-16 | secured-operations.test.js | Repository xoá recipe join menu_items lọc company | Query đúng cấu trúc | Đúng | ✅ |
| UT-17 | secured-operations.test.js | Procurement với branch thuộc company khác | Reject | Đúng | ✅ |
| UT-18 | secured-operations.test.js | Procurement branch scope override branch client gửi | Dùng scope server, bỏ qua input | Đúng | ✅ |
| UT-19 | secured-operations.test.js | Audit query có điều kiện company/branch | Query đúng | Đúng | ✅ |
| UT-20 | secured-operations.test.js | Update reservation: khoá slot, loại trừ chính nó khi check conflict | Không tự conflict với chính mình | Đúng | ✅ |
| UT-21 | secured-operations.test.js | Reservation conflict trước update | Rollback transaction | Đúng | ✅ |

---

## B. Kiểm thử tích hợp/API — `api-tests/tests/*.py`

pytest, gọi HTTP thật vào backend đang chạy, backend nói chuyện với PostgreSQL/Redis thật.

**Kết quả: 220/220 pass trên ca không phá huỷ dữ liệu, 21.7s** (3 ca destructive mặc định không chạy)

| Mã | File : hàm | Đầu vào | Kết quả mong đợi | Kết quả thực tế | Đạt |
|---|---|---|---|---|---|
| IT-01 | test_public_contracts.py::test_health_contract | `GET /health` | 200, đúng cấu trúc JSON | Đúng | ✅ |
| IT-02 | test_public_contracts.py::test_companies_contract | `GET /public/companies` | 200, danh sách company đúng schema | Đúng | ✅ |
| IT-03 | test_public_contracts.py::test_home_banners_contract | `GET /public/home-banners` | 200, đúng schema | Đúng | ✅ |
| IT-04 | test_public_contracts.py::test_company_children_contracts | Duyệt chi nhánh/danh mục/menu theo từng company | Mỗi company trả đúng cấu trúc con | Đúng (tham số hoá theo N công ty) | ✅ |
| IT-05 | test_public_contracts.py::test_branch_contract | `GET /public/branches/:id` | 200, đúng schema | Đúng | ✅ |
| IT-06 | test_public_contracts.py::test_menu_item_contract | `GET /public/menu-items/:id` | 200, đúng schema | Đúng | ✅ |
| IT-07 | test_authenticated_smoke.py::test_customer_safe_reads | Token khách hàng hợp lệ, gọi các GET an toàn | Tất cả 200 | Đúng | ✅ |
| IT-08 | test_authenticated_smoke.py::test_each_internal_role_group_safe_reads | Từng vai trò nội bộ (7 role) gọi GET trong quyền | Tất cả 200 | Đúng, cả 7 role | ✅ |
| IT-09 | test_branch_authorization.py::test_branch_manager_can_read_own_branch_table | Manager đọc bàn chi nhánh mình | 200 | Đúng | ✅ |
| IT-10 | test_branch_authorization.py::test_branch_manager_cannot_read_other_branch_table | Manager đọc bàn chi nhánh khác | 403/404 | Đúng | ✅ |
| IT-11 | test_branch_authorization.py::test_branch_manager_cannot_update_other_branch_table_status | Manager sửa trạng thái bàn chi nhánh khác | Bị chặn | *(destructive — không chạy mặc định)* | — |
| IT-12 | test_branch_authorization.py::test_branch_manager_branch_list_is_scoped_to_own_branch | Manager liệt kê branch | Chỉ thấy branch mình | Đúng | ✅ |
| IT-13 | test_branch_authorization.py::test_company_admin_can_read_other_branch_in_same_company | Company admin đọc branch khác cùng company | 200 | Đúng | ✅ |
| IT-14 | test_branch_authorization.py::test_company_admin_cannot_read_branch_from_other_company | Company admin đọc branch công ty khác | Bị chặn | Đúng | ✅ |
| IT-15 | test_branch_authorization.py::test_super_admin_can_read_branch_from_other_company | Super admin đọc branch bất kỳ | 200 | Đúng | ✅ |
| IT-16 | test_main_business_workflows.py::test_reservation_to_paid_invoice_and_email | Khách đặt bàn → lễ tân/thu ngân xử lý → thanh toán → email | Toàn luồng thành công, có gửi email | Đúng | ✅ |
| IT-17 | test_main_business_workflows.py::test_procurement_to_stock_consumption_and_report | Nhập kho → bán hàng trừ kho → lên báo cáo | Số liệu khớp từng bước | *(destructive — không chạy mặc định)* | — |
| IT-18 | test_negative_mutations.py::test_customer_mutations_reject_invalid_bodies | Body sai định dạng cho các route ghi của khách | 400 cho mọi route | Đúng (tham số hoá nhiều route) | ✅ |
| IT-19 | test_negative_mutations.py::test_authorized_mutations_validate_before_business_logic | Role hợp lệ nhưng body sai | 400 trước khi chạm business logic | Đúng | ✅ |
| IT-20 | test_negative_mutations.py::test_internal_roles_cannot_call_forbidden_mutations | Role nội bộ gọi route ngoài quyền | 403 | Đúng | ✅ |
| IT-21 | test_negative_mutations.py::test_customer_token_cannot_cross_into_internal_api | Token khách gọi route `/internal/*` | 401/403 | Đúng | ✅ |
| IT-22 | test_vat_endpoint.py::test_cashier_can_save_read_and_clear_vat | Thu ngân lưu/đọc/xoá thông tin VAT của bàn | Từng bước trả đúng dữ liệu | Đúng | ✅ |
| IT-23 | test_route_catalog.py::test_catalogued_route_is_mounted_and_protected | Duyệt 185 route đã khai báo trong catalog | Mỗi route tồn tại và yêu cầu đúng loại auth | Đúng cho cả 185 route | ✅ |
| IT-24 | test_route_catalog.py::test_catalog_has_unique_method_paths | Danh sách route trong catalog | Không trùng (method, path) | Đúng | ✅ |
| IT-25 | test_route_catalog.py::test_side_effecting_mail_route_is_statically_mounted | Route gửi mail (side-effect) | Được mount tĩnh, không lọt qua dynamic router sai chỗ | Đúng | ✅ |

> IT-04, IT-08, IT-18, IT-19, IT-20, IT-23 là các hàm `@pytest.mark.parametrize` — mỗi hàm sinh nhiều ca con, cộng lại đúng tổng 220 case. IT-11 và IT-17 thuộc nhóm "destructive" (sửa dữ liệu thật), cần bật `API_DESTRUCTIVE=1` để chạy.

---

## C. Kiểm thử E2E giao diện — `selenium-tests/tests/*.py`

Selenium điều khiển trình duyệt thật, thao tác qua giao diện `igourmet-app`/`igourmet-internal`. Kết quả dẫn từ lần chạy gần nhất, chưa re-run tại thời điểm viết tài liệu.

| Mã | File : hàm | Đầu vào | Kết quả mong đợi | Kết quả (lần chạy gần nhất) | Đạt |
|---|---|---|---|---|---|
| E01 | test_customer_auth_ui.py::test_customer_login_rejects_invalid_credentials | Sai tài khoản/mật khẩu trên app khách | Hiện thông báo lỗi, không vào được | Đúng | ✅ |
| E02 | test_customer_auth_ui.py::test_customer_can_login_and_open_reservation_history | Đăng nhập đúng, mở lịch sử đặt bàn | Vào được, danh sách hiển thị | Đúng | ✅ |
| E03 | test_internal_auth_ui.py::test_internal_login_rejects_invalid_credentials | Sai tài khoản nội bộ | Báo lỗi | Đúng | ✅ |
| E04 | test_internal_auth_ui.py::test_each_internal_role_can_login_and_reach_home | Từng vai trò (7 role) đăng nhập | Vào đúng trang mặc định theo role | Đúng, cả 7 role | ✅ |
| E05 | test_internal_auth_ui.py::test_waiter_cannot_open_manager_inventory_page | Waiter cố mở URL `/inventory` trực tiếp | Bị chặn/điều hướng | Đúng | ✅ |
| E06 | test_reservation_payment_workflow_ui.py::test_customer_booking_to_reception_waiter_kitchen_cashier_payment | Đặt bàn → lễ tân gán bàn/check-in → phục vụ gọi món → bếp báo sẵn sàng → thu ngân quét QR, thanh toán tiền mặt | Toàn luồng qua giao diện thành công, trạng thái mỗi bước cập nhật đúng | Đúng | ✅ |
| E07 | test_reservation_payment_app_workflow_ui.py::test_customer_booking_to_vat_app_payment_confirmed_by_customer | Đặt bàn kèm VAT, khách tự xác nhận thanh toán qua app | Hoá đơn có VAT, trạng thái thanh toán do khách xác nhận đúng | Đúng | ✅ |

---

## Cách chạy

### 1. Unit test (backend)

```bash
cd backend
npm install
npm test
```

### 2. Integration/API test

Cần backend đang chạy (`http://localhost:5000`):

```bash
cd backend && npm run dev
```

Terminal khác:

```bash
cd api-tests
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env      # điền E2E_* credentials/ID
pytest
```

Chạy nhanh 1 lệnh (tự bật backend local + fake mail server):

```bash
powershell -ExecutionPolicy Bypass -File run-local.ps1
```

Chạy nhóm destructive (đổi dữ liệu thật — chỉ chạy trên môi trường disposable):

```bash
$env:API_DESTRUCTIVE = "1"
pytest -m destructive
```

### 3. E2E Selenium

Cần 3 service chạy song song:

```bash
# Terminal 1
cd backend && npm start

# Terminal 2 — app khách hàng, port 5173
cd igourmet-app && npm run dev -- --host 127.0.0.1 --port 5173

# Terminal 3 — web nội bộ, port 5174
cd igourmet-internal && npm run dev -- --host 127.0.0.1 --port 5174
```

Terminal 4:

```bash
cd selenium-tests
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env      # điền URL + credentials, dùng chung với api-tests/.env

pytest                # chạy tất cả
pytest -m auth        # chỉ nhóm đăng nhập/phân quyền
pytest --headed       # xem trình duyệt chạy trực tiếp
pytest --browser edge # đổi trình duyệt
```

> `.env` của `api-tests` và `selenium-tests` chứa credential test thật — không commit, không đưa vào báo cáo dạng plaintext.
