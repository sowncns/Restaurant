# BÁO CÁO KIỂM THỬ iGOURMET

Ngày kiểm thử: 16/08/2026  
Workspace: `D:\Projects\NhaHang`  
Người thực hiện: Senior QA Engineer / Web Developer (AI-assisted)  
Trạng thái source: kiểm thử trên working tree hiện tại; không sửa source trong giai đoạn QA.

## 1. Phạm vi và nguyên tắc an toàn

- Chỉ đọc và chạy source trong workspace này.
- Không truy cập hoặc so sánh với website khác.
- Không in giá trị `.env`, token, API key, password hoặc connection string.
- Backend `.env` đang trỏ PostgreSQL và Redis tới đích ngoài máy (`EXTERNAL_OR_UNKNOWN`). Không thể chứng minh đây là sandbox nên backend không được khởi động trong phiên QA.
- Landing `.env` cũng trỏ API ngoài máy. Khi test local, `VITE_API_URL` được override tạm thời sang mock API ở `127.0.0.1:5999`; không sửa `.env`.
- Không tạo reservation thật, không thanh toán, không gửi email và không mutate database ngoài máy.
- Không chạy khai thác, brute force, DDoS hoặc concurrent write lên hệ thống ngoài máy.
- Các script mock/browser chỉ nằm trong `artifacts/qa/`; source ứng dụng không bị sửa bởi hoạt động QA.
- Một thay đổi không liên quan đã tồn tại trong `.github/workflows/deploy-backend.yml`; QA không sửa hoặc hoàn tác file này.

## 2. Tổng quan project

### 2.1 Cấu trúc

| Project | Vai trò | Công nghệ chính |
| --- | --- | --- |
| `backend` | REST API, nghiệp vụ, auth, payment, database | Node.js, Express 5, PostgreSQL, Redis, Zod, JWT, Pino |
| `igourmet-internal` | POS/ERP cho nhân viên | React 19, React Router 7, TypeScript 6, Vite 8, Tailwind 4 |
| `igourmet-app` | Ứng dụng khách hàng/PWA | React 19, React Router 7, TypeScript 6, Vite 8, Tailwind 4, Workbox |
| `igourmet-landing` | Landing công khai và form đặt bàn | React 19, TypeScript 6, Vite 8, Tailwind 4 |

### 2.2 Runtime và package manager

- Node yêu cầu: backend `>=20`; Vite 8 yêu cầu Node `^20.19.0 || >=22.12.0`.
- Node thực tế: `v24.11.0`.
- npm thực tế: `11.11.0`.
- Cả bốn project có `package-lock.json`, vì vậy package manager đúng là npm.
- Lệnh cài đặt sạch: `npm ci` trong từng project.

### 2.3 Port

| Thành phần | Port mặc định | Ghi chú |
| --- | ---: | --- |
| Backend | 5000 | Không khởi động vì data store ngoài máy chưa được xác nhận sandbox |
| Internal frontend | 5173 | Vite mặc định; QA dùng tạm 5182 |
| Customer frontend | 5173 | Vite mặc định; QA dùng tạm 5181 |
| Landing frontend | 5180 | Khai báo `strictPort: true` |
| PostgreSQL | Thường 5432 | Đích thực tế được giữ bí mật và phân loại ngoài máy |
| Redis | Thường 6379 | Đích thực tế được giữ bí mật và phân loại ngoài máy |
| Mock API QA | 5999 | Chỉ dùng fixture local, đã dừng sau test |

### 2.4 Lệnh hỗ trợ

| Project | Development | Build | Lint | Type check | Test |
| --- | --- | --- | --- | --- | --- |
| Backend | `npm run dev` | `npm run build` | `npm run lint` | N/A (JavaScript) | Không có script |
| Internal | `npm run dev` | `npm run build` | `npm run lint` | `npx tsc -b` | Không có script |
| Customer app | `npm run dev` | `npm run build` | `npm run lint` | `npx tsc -b` | Không có script |
| Landing | `npm run dev` | `npm run build` | Không có script | `npx tsc -b` | Không có script |

### 2.5 Biến môi trường

Tên biến được xác định từ `env.js`, `.env.example` và các chỗ dùng `import.meta.env`. Giá trị thực không được đưa vào báo cáo.

Backend:

`NODE_ENV`, `PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`, `RATE_LIMIT_ENABLED`, `CORS_ORIGINS`, `FRONTEND_URL`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `PAYOS_SUCCESS_URL`, `PAYOS_RETURN_URL`, `PAYOS_CANCEL_URL`, `PAYOS_WEBHOOK_URL`, `MAIL_USER`, `MAIL_PASS`, `RESEND_API_KEY`, `MAIL_FROM`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_AUTH_EMAIL_DOMAIN`, `RESERVATION_ALERT_MINUTES`, `RESERVATION_DEPOSIT_RATE`.

Frontend:

`VITE_API_URL` ở cả `igourmet-internal`, `igourmet-app` và `igourmet-landing`.

Sai lệch tài liệu:

- `.env.example` backend chưa liệt kê `RESEND_API_KEY`, `MAIL_FROM` và các URL callback/webhook PayOS.
- Ba frontend không có `.env.example`.
- Nếu `VITE_API_URL` thiếu, cả ba frontend fallback sang `http://localhost:5000`; trên production HTTPS điều này có thể gây mixed content hoặc gọi nhầm máy người dùng.

### 2.6 Dịch vụ ngoài

- PostgreSQL.
- Redis.
- PayOS.
- Supabase Auth và Realtime.
- Resend HTTP email API.
- Google Fonts.
- Ảnh ngoài origin (ví dụ Unsplash fallback).
- Camera/ZXing, QRCode và JsBarcode trên trình duyệt.
- PWA/Workbox ở customer app.

## 3. Vai trò và phân quyền

| Role | Phạm vi/chức năng chính |
| --- | --- |
| `SUPER_ADMIN` | Toàn hệ thống, công ty, cashback, banner, quản trị tổng |
| `COMPANY_ADMIN` | Công ty hiện tại, chi nhánh, nhân viên, menu, voucher, báo cáo |
| `BRANCH_MANAGER` | Chi nhánh hiện tại, vận hành, kho, procurement, báo cáo |
| `RECEPTIONIST` | Sơ đồ bàn, đặt bàn, check-in, gọi xác nhận |
| `WAITER` | Mở bàn, gọi món, QR khách, yêu cầu hủy |
| `CASHIER` | Checkout, VAT, hóa đơn, công nợ |
| `KITCHEN` | Hàng đợi bếp, preorder, hủy món, kho đọc |

Frontend internal có `ProtectedRoute` theo role. Backend dùng `requireAuth`, `authorize()` và một số kiểm tra scope trong service. Các lỗi scope cụ thể được nêu ở mục bug.

## 4. Route frontend và chức năng

### 4.1 Internal

| Route | Role | Chức năng |
| --- | --- | --- |
| `/login` | Public | Đăng nhập nhân viên |
| `/403` | Public | Không có quyền |
| `/` | Manager hoặc redirect theo role | Dashboard KPI |
| `/floor` | Receptionist | Sơ đồ bàn, walk-in, reservation/check-in |
| `/reservation-calls` | Receptionist | Gọi xác nhận đặt bàn |
| `/tables` | Cashier | Chọn bàn, checkout, VAT, kiểm món, in bill |
| `/invoices` | Cashier | Hóa đơn và công nợ |
| `/orders` | Waiter | Gọi món, QR member/voucher, gửi bếp |
| `/kitchen` | Kitchen | Queue, scan, in ticket, preorder |
| `/cancel-requests` | Kitchen | Duyệt yêu cầu hủy món |
| `/inventory` | Manager/Kitchen | Nguyên liệu, tồn kho, điều chỉnh |
| `/inventory-transactions` | Manager/Kitchen | Lịch sử kho |
| `/procurement` | Manager | NCC, phiếu nhập, in/email |
| `/menu` | Manager | Danh mục, món, recipe |
| `/staff` | Manager | Nhân viên, role, reset password |
| `/branches` | Manager | Chi nhánh |
| `/sections` | Manager | Khu vực và bàn |
| `/sales-report` | Manager | Báo cáo doanh thu |
| `/audit-logs` | Manager | Audit log |
| `/companies` | Super/Company Admin | Công ty |
| `/vouchers` | Super/Company Admin | Voucher và phát voucher |
| `/cashback-rates` | Super Admin | Tỷ lệ cashback |
| `/home-banners` | Super Admin | Banner |

`ReservationsPage.tsx` có implementation nhưng không được gắn route/nav.

### 4.2 Customer app

| Route | Chức năng |
| --- | --- |
| `/` | Home, banner, voucher, wallet |
| `/login`, `/signup` | Auth |
| `/verify-email`, `/reset-password` | Token email/password |
| `/brands` | Công ty và chi nhánh |
| `/booking` | Đặt bàn, preorder/deposit |
| `/booking/history` | Lịch sử đặt bàn |
| `/delivery/:companyId/:branchId` | Menu và giỏ hàng |
| `/igo-card` | Hạng thành viên |
| `/topup` | PIN, ví, nạp PayOS |
| `/invoices` | Yêu cầu thanh toán và hóa đơn |
| `/my-qr` | QR member |

Không có wildcard 404 và không có route guard dùng chung.

### 4.3 Landing

Một trang tại `/` với các anchor `#top`, `#thuong-hieu`, `#thuc-don`, `#chi-nhanh`, `#dat-ban`. Chức năng gồm navbar, brand, menu/category/pagination, branch/telephone, form đặt bàn và footer.

## 5. Nhóm API

Backend mount dưới `/api`, có khoảng 178 method/path operations và `/health`.

| Prefix | Endpoint/chức năng chính |
| --- | --- |
| `/health` | Health check |
| `/api/public` | Companies, branches, menu, banners, public reservation |
| `/api/customer/auth` | Register, login, refresh, logout, forgot/reset/change password, email verification |
| `/api/customer/profile` | Profile, PIN, transaction, points |
| `/api/customer/voucher` | Voucher khách |
| `/api/customer/reservations` | Reservation của khách |
| `/api/customer/payment` | Tạo PayOS link |
| `/api/customer/qr-payment` | Pending, stream, invoice, confirm, token |
| `/api/internal/auth` | Auth nhân viên |
| `/api/internal/employees` | Employee/role/kitchen type |
| `/api/internal/reports` | Dashboard, revenue, top items |
| `/api/internal/branches` | Branch CRUD/status |
| `/api/internal/dining-tables` | Section/table CRUD/status |
| `/api/internal/orders` | Order, item, kitchen, preorder, scan, SSE |
| `/api/internal/cancel-requests` | Duyệt/rút yêu cầu hủy |
| `/api/internal/checkout` | Invoice, payment intent, voucher, VAT, kiểm món, void/discount |
| `/api/internal/inventory` | Ingredient, recipe, transaction, estimate |
| `/api/internal/procurement` | Supplier, receipt, import, email |
| `/api/internal/reservations` | Reservation vận hành, alert, assign, check-in |
| `/api/internal/menu-categories` | Category CRUD |
| `/api/internal/menu-items` | Item CRUD/availability |
| `/api/internal/companies` | Company CRUD |
| `/api/internal/cashback-rates` | Cashback |
| `/api/internal/vouchers` | Voucher CRUD/assign |
| `/api/internal/customers` | Điều chỉnh điểm bởi admin |
| `/api/internal/home-banners` | Banner CRUD |
| `/api/internal/qr-payment` | Staff request/status/cancel |
| `/api/webhook` | PayOS webhook công khai có verify payload |

Lưu ý: customer app gọi `/api/customer/cart*`, nhưng backend hiện không mount module cart và migration đã drop cart tables. Đây là bug xác nhận ở mục BUG-005.

## 6. Kết quả kỹ thuật

### 6.1 Bảng tổng hợp

| Kiểm tra | Command | Kết quả | Ghi chú |
| --- | --- | --- | --- |
| Install backend | `npm ci` | Pass | 305/306 package sau thay đổi lock hiện tại |
| Install internal | `npm ci` | Pass | 119 package |
| Install customer | `npm ci` | Pass | 422 package |
| Install landing | `npm ci` | Pass | 75 package |
| Backend lint | `npm run lint` | Pass có cảnh báo | 0 error, 11 warning |
| Backend type check | N/A | N/A | JavaScript, không có TypeScript |
| Backend test | `npm test` | Blocked | Missing script `test` |
| Backend build | `npm run build` | Fail | `webpack` không tồn tại; tái hiện 2 lần |
| Internal lint | `npm run lint` | Pass có cảnh báo | 0 error, 10 warning |
| Internal type check | `npx tsc -b --pretty false` | Pass | Không output lỗi |
| Internal test | `npm test` | Blocked | Missing script `test` |
| Internal build | `npm run build` | Pass | Cảnh báo JS chunk >500 kB; khoảng 1.11 MB trước gzip |
| Customer lint | `npm run lint` | Pass có cảnh báo | 0 error, 9 warning |
| Customer type check | `npx tsc -b --pretty false` | Pass | Không output lỗi |
| Customer test | `npm test` | Blocked | Missing script `test` |
| Customer build | `npm run build` | Pass | PWA/Workbox tạo thành công |
| Landing lint | N/A | Blocked | Không có lint script/dependency |
| Landing type check | `npx tsc -b --pretty false` | Pass | Không output lỗi |
| Landing test | `npm test` | Blocked | Missing script `test` |
| Landing build | `npm run build` | Pass | Thành công |
| Run backend local | `npm start` | Blocked an toàn | Không chạy vì PostgreSQL/Redis ngoài máy chưa xác nhận sandbox |
| Run 3 frontend local | Vite + local mock | Pass | HTTP 200 trên 5180/5181/5182 |
| Browser automation | Playwright/Chrome, 8 tests | Pass | 8/8 ở vòng cuối, mock-only |
| Production dependency audit backend | `npm audit --omit=dev` | Pass | 0 vulnerability |
| Production dependency audit internal | `npm audit --omit=dev` | Fail | 2 High qua React Router advisory |
| Production dependency audit customer | `npm audit --omit=dev` | Fail | 2 High qua React Router advisory |
| Production dependency audit landing | `npm audit --omit=dev` | Pass | 0 vulnerability |

### 6.2 Console và Network

- Landing fixture có ảnh rỗng nên fallback Unsplash bị `ERR_BLOCKED_BY_ORB`; đây là giới hạn fixture/headless, không dùng làm bug release.
- Customer guest load gọi `/customer/profile/me` và refresh token nhiều lần, tạo 401 và `console.error`. Hành vi source được ghi thành BUG-014.
- Internal development StrictMode gọi refresh hai lần trên mount; 401 trong fixture là expected guest bootstrap, không phải lỗi production độc lập.
- Không có uncaught JavaScript exception trên các role page đã render bằng mock.
- Evidence: `artifacts/qa/browser-evidence.json`.

## 7. Danh sách test case

Quy ước: Pass = đạt kỳ vọng kiểm thử; Fail = xác nhận lỗi sản phẩm/kỹ thuật; Blocked = không thể chạy an toàn hoặc project không hỗ trợ.

| ID | Chức năng | Các bước chính | Mong đợi | Thực tế | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| TC-001 | Runtime | Kiểm tra Node/npm | Đúng version hỗ trợ | Node 24/npm 11 phù hợp | Pass |
| TC-002 | Install backend | `npm ci` | Cài sạch | Thành công | Pass |
| TC-003 | Install internal | `npm ci` | Cài sạch | Thành công | Pass |
| TC-004 | Install customer | `npm ci` | Cài sạch | Thành công | Pass |
| TC-005 | Install landing | `npm ci` | Cài sạch | Thành công | Pass |
| TC-006 | Backend lint | `npm run lint` | 0 error | 0 error, 11 warning | Pass |
| TC-007 | Backend build | Chạy 2 lần | Build được | Thiếu `webpack` cả 2 lần | Fail |
| TC-008 | Backend test | `npm test` | Có test suite | Missing script | Blocked |
| TC-009 | Internal lint | `npm run lint` | 0 error | 0 error, 10 warning | Pass |
| TC-010 | Internal type | `npx tsc -b` | 0 error | Pass | Pass |
| TC-011 | Internal build | `npm run build` | Build được | Pass, chunk warning | Pass |
| TC-012 | Internal unit/integration | `npm test` | Có test suite | Missing script | Blocked |
| TC-013 | Customer lint | `npm run lint` | 0 error | 0 error, 9 warning | Pass |
| TC-014 | Customer type | `npx tsc -b` | 0 error | Pass | Pass |
| TC-015 | Customer build/PWA | `npm run build` | Build + SW | Pass | Pass |
| TC-016 | Customer unit/integration | `npm test` | Có test suite | Missing script | Blocked |
| TC-017 | Landing type | `npx tsc -b` | 0 error | Pass | Pass |
| TC-018 | Landing build | `npm run build` | Build được | Pass | Pass |
| TC-019 | Landing lint | Kiểm tra script | Có lint gate | Không có | Blocked |
| TC-020 | Landing test | `npm test` | Có test suite | Missing script | Blocked |
| TC-021 | Landing smoke | Mở `/` bằng mock | H1 và data render | Render đúng | Pass |
| TC-022 | Booking empty | Submit form trống | Báo validation | Báo đúng | Pass |
| TC-023 | Booking valid | Điền Unicode, phone, email, date/time; submit mock | Success, chống double khi loading | Success | Pass |
| TC-024 | Landing responsive | 375×667, 390×844 | Không document overflow | Không overflow document | Pass |
| TC-025 | Landing responsive | 768×1024 | Không vỡ | Pass | Pass |
| TC-026 | Landing responsive | 1366×768, 1920×1080 | Không vỡ | Pass | Pass |
| TC-027 | Customer login empty | Submit trống | Báo lỗi | Báo đúng | Pass |
| TC-028 | Customer login mock | Email/password hợp lệ | Vào home | Thành công | Pass |
| TC-029 | Customer history guest | Mở trực tiếp, chờ >2s, lặp 2 lần | Redirect login | Loader vô hạn | Fail |
| TC-030 | Customer unknown URL | `/does-not-exist`, `/booking/unknown` | 404/recovery | Trang content rỗng | Fail |
| TC-031 | Internal role routing | Login Cashier/Waiter/Kitchen/Reception/Admin | Đúng landing role | Cả 5 đúng | Pass |
| TC-032 | Internal cashier mobile | 375×667, 390×844 | Không overflow | Pass | Pass |
| TC-033 | Internal cashier tablet | 768×1024 | Không overflow | Pass | Pass |
| TC-034 | Internal cashier desktop | 1366×768, 1920×1080 | Không overflow | Pass | Pass |
| TC-035 | Internal unknown SPA route | Push 2 URL lạ sau login | 404 | Redirect về role home | Fail |
| TC-036 | Guest console/network | Reload guest routes | Không request protected vô ích | Nhiều profile/refresh 401 | Fail |
| TC-037 | Backend local start | Kết nối sandbox DB/Redis | Server/health hoạt động | Không có sandbox an toàn | Blocked |
| TC-038 | API CRUD end-to-end | Create/update/delete test data | Đúng validation/RBAC | Không có sandbox DB/seed | Blocked |
| TC-039 | Auth/RBAC 7 role API | Gọi endpoint bằng 7 role | 401/403/200 đúng | Không có credential sandbox | Blocked |
| TC-040 | Payment CASH | Checkout test | Invoice đúng | Không mutate data ngoài máy | Blocked |
| TC-041 | Payment TRANSFER/APP | Provider sandbox | Idempotent | Không có PayOS/wallet sandbox | Blocked |
| TC-042 | VAT email | Gửi mailbox sandbox | Email đúng | Không có mail sandbox | Blocked |
| TC-043 | Race condition | Parallel order/payment/reservation | Một mutation | Không có isolated DB | Blocked |
| TC-044 | Production audit | Audit runtime dependencies | 0 High | Internal/customer có 2 High | Fail |

Tổng test case: 44. Pass: 24. Fail: 7. Blocked: 13.

## 8. Danh sách bug đã xác nhận

Mỗi bug dưới đây đã được kiểm tra hai lần. Với lỗi runtime, hai lần là hai attempt/URL/viewport hoặc hai browser run. Với lỗi API nguy hiểm không được phép exploit, hai lần là hai trace độc lập qua route/controller và service/repository/schema.

### BUG-001: Khách hàng tự cộng điểm và tự nâng hạng

- Mức độ: **Critical**
- File/URL: `backend/src/modules/customer/profile/profile.route.js:23-26`, `profile.controller.js:30-32`, `profile.service.js:75-86`, `profile.schema.js:16-18`; `POST /api/customer/profile/add-points`.
- Thiết bị/viewport: REST API, không phụ thuộc viewport.
- Điều kiện: customer đăng nhập và verified email.
- Bước tái hiện an toàn: đọc route cho phép customer gọi `add-points`; trace controller truyền `req.body.points` và `req.user.id`; trace service cộng trực tiếp và tính rank.
- Dữ liệu test: `{"points":80000000}` (không gửi lên hệ thống thật).
- Thực tế: code chấp nhận mọi số nguyên dương, không có upper bound hoặc nguồn giao dịch đáng tin cậy.
- Mong đợi: điểm chỉ được cộng từ transaction server-side hoặc endpoint admin có audit/scope.
- Error: không có exception; đây là authorization/business logic flaw.
- Nguyên nhân: endpoint debug/business bị public cho customer verified.
- Đề xuất: xóa endpoint customer; chỉ cộng điểm sau payment idempotent; giữ endpoint admin riêng có RBAC/audit.
- Kiểm tra lại: trace route/controller lần 1; schema/service/repository transaction lần 2.

### BUG-002: Staff có thể truyền amount/invoice/table tùy ý vào QR payment

- Mức độ: **Critical**
- File/URL: `backend/src/modules/qr_payment/qr_payment.internal.controller.js:5-8`, `qr_payment.service.js:234-264`, `qr_payment.repository.js:65-81`; `POST /api/internal/qr-payment/request`.
- Thiết bị/viewport: REST API.
- Điều kiện: staff hợp lệ và token `PAY-*` hợp lệ.
- Bước: controller nhận trực tiếp `amount`, `tableId`, `invoiceId`; service dùng các giá trị đó để `settle`; không load invoice canonical để đối chiếu amount/table/branch/status.
- Dữ liệu test: amount tăng cao và ID không cùng invoice (không gửi thực tế).
- Thực tế: đường code có thể debit ví, mark invoice và complete table dựa trên ID do client gửi.
- Mong đợi: server load invoice theo tenant/branch, derive amount/table, lock invoice, kiểm tra status và idempotency.
- Error: không có validation error cho mismatch.
- Nguyên nhân: tin dữ liệu tài chính từ frontend.
- Đề xuất: chỉ nhận invoice ID/token; derive toàn bộ dữ liệu còn lại trong transaction có lock và scope.
- Kiểm tra lại: controller/service trace; repository mutation trace độc lập.

### BUG-003: Checkout mark-paid không scope tenant và bỏ qua nghiệp vụ settlement

- Mức độ: **Critical**
- File/URL: `backend/src/modules/internal/checkout/checkout.route.js:50-52`, `checkout.service.js:488-496`, `checkout.repository.js:290-292`; `POST /api/internal/checkout/invoices/:invoiceId/pay`.
- Thiết bị/viewport: REST API.
- Điều kiện: role cashier trở lên, biết invoice ID.
- Bước: route chỉ authorize role; service không truyền current user; repository update chỉ theo `invoice_id`.
- Dữ liệu test: invoice ID của tenant/branch khác (không gửi thực tế).
- Thực tế: không kiểm tra company/branch, không lock status, không set `paid_at`, không complete order/table, points/cashback có thể lệch.
- Mong đợi: scope theo user, transaction settlement duy nhất, idempotent và cập nhật đầy đủ.
- Error: không có 403/409 trong đường code.
- Nguyên nhân: repository mutation không scoped.
- Đề xuất: hợp nhất với payment settlement service và query `WHERE company_id/branch_id/status`.
- Kiểm tra lại: route/service trace; SQL repository trace.

### BUG-004: Voucher discount dùng `orderTotal` do client cung cấp

- Mức độ: **Critical**
- File/URL: `backend/src/modules/internal/checkout/checkout.schema.js`, `checkout.service.js:217-276`, create invoice dùng Redis voucher; `POST /api/internal/checkout/validate-voucher`.
- Thiết bị/viewport: REST API.
- Điều kiện: staff và voucher customer hợp lệ.
- Bước: gửi `orderTotal` lớn; service dùng nó để kiểm tra min order và tính percent; cache discount rồi invoice trừ discount cache.
- Dữ liệu test: bill nhỏ, `orderTotal=100000000` (không gửi thực tế).
- Thực tế: order total không được query canonical tại bước validate.
- Mong đợi: server query order theo table/scope và tính discount lại trong transaction checkout.
- Error: không có mismatch validation.
- Nguyên nhân: trust client amount và cache kết quả tài chính.
- Đề xuất: bỏ `orderTotal` khỏi request, derive server-side, revalidate khi create invoice.
- Kiểm tra lại: schema/controller-to-service; create-invoice voucher consumption trace.

### BUG-005: Customer delivery gọi cart API không tồn tại ở backend

- Mức độ: **High**
- File/URL: `igourmet-app/src/pages/DeliveryMenu.tsx:41-67`; backend `src/routes/index.js`; README migration ghi cart tables/module đã drop.
- Thiết bị/viewport: mọi thiết bị, `/delivery/:companyId/:branchId`.
- Điều kiện: mở menu delivery.
- Bước: frontend GET `/customer/cart`, sau 404 lại POST `/customer/cart/create`; tìm route backend lần hai không có kết quả.
- Dữ liệu test: company/branch hợp lệ.
- Thực tế: backend không mount `/customer/cart`; persistence cart thất bại và console log lỗi tạo giỏ.
- Mong đợi: frontend dùng luồng preorder hiện có hoặc backend có cart API/schema tương ứng.
- Error: 404 cho cart endpoints.
- Nguyên nhân: frontend/backend drift sau migration drop cart.
- Đề xuất: chọn một contract duy nhất; không khôi phục compatibility nếu feature đã bị bỏ, hãy thay flow frontend.
- Kiểm tra lại: frontend call trace; backend route/module search và migration documentation.

### BUG-006: Login trả refresh/access token và Supabase session trong JSON

- Mức độ: **High**
- File/URL: `backend/src/modules/customer/auth/auth.controller.js:46-70`, `internal/auth/auth.controller.js:21-44`.
- Thiết bị/viewport: web/mobile API.
- Điều kiện: login/refresh thành công.
- Bước: inspect response builder của customer và staff; cả hai set HttpOnly cookie nhưng đồng thời trả token body.
- Dữ liệu test: credential sandbox.
- Thực tế: JavaScript có thể đọc refresh token và Supabase session, làm giảm giá trị HttpOnly khi có XSS.
- Mong đợi: web response chỉ trả profile; token body chỉ ở endpoint/client mode tách biệt có kiểm soát.
- Error: không có.
- Nguyên nhân: dùng một response cho web và native.
- Đề xuất: tách auth flow web/native hoặc require explicit trusted client grant.
- Kiểm tra lại: customer controller; internal controller.

### BUG-007: Public `test-mail` gửi email và lộ stack

- Mức độ: **High**
- File/URL: `backend/src/modules/customer/auth/auth.route.js:41`, `auth.controller.js:94-106`; `GET /api/customer/auth/test-mail`.
- Thiết bị/viewport: REST API.
- Điều kiện: không cần auth.
- Bước: route public; controller gọi provider email; catch trả `error.message` và `error.stack`.
- Dữ liệu test: GET đơn giản (không gọi để tránh gửi email thật).
- Thực tế: endpoint có thể bị abuse quota và leak stack/provider detail.
- Mong đợi: xóa khỏi production hoặc manager-only, rate limit và generic error.
- Error: stack được serialize khi provider fail.
- Nguyên nhân: debug endpoint còn trong route production.
- Đề xuất: remove route; health email dùng internal observability.
- Kiểm tra lại: route auth absence; controller side-effect/error response.

### BUG-008: Backend production build luôn thất bại trên clean install

- Mức độ: **High**
- File/URL: `backend/package.json:8-12,35-39`.
- Thiết bị/viewport: terminal Windows, Node 24.
- Điều kiện: `npm ci` thành công.
- Bước: chạy `npm run build` hai lần.
- Dữ liệu test: source hiện tại.
- Thực tế: `'webpack' is not recognized as an internal or external command`.
- Mong đợi: build pass hoặc bỏ build script nếu backend chạy source trực tiếp.
- Error: chính xác như trên.
- Nguyên nhân: script dùng `webpack` nhưng package/config không được khai báo.
- Đề xuất: hoặc thêm webpack config/dependency có mục tiêu rõ, hoặc đổi quality gate sang syntax/test/start validation.
- Kiểm tra lại: hai lần command độc lập đều fail cùng lỗi.

### BUG-009: Guest vào lịch sử đặt bàn bị loader vô hạn

- Mức độ: **High**
- File/URL: `igourmet-app/src/pages/ReservationHistory.tsx:15-43,64-70`; `/booking/history`.
- Thiết bị/viewport: Chrome, 1280×720 trong evidence; không phụ thuộc viewport.
- Điều kiện: không đăng nhập.
- Bước: mở direct URL, chờ 2.2 giây; lặp lại với query `attempt=1` và `attempt=2`.
- Dữ liệu test: guest session.
- Thực tế: `useEffect` return khi `user` null nên không gọi hàm redirect và không set loading false.
- Mong đợi: redirect `/login` sau khi auth bootstrap hoàn tất.
- Console/network: profile/refresh 401 expected guest.
- Nguyên nhân: guard nằm trong hàm không được gọi.
- Đề xuất: ProtectedRoute hoặc effect phụ thuộc `authLoading` và redirect khi loading hoàn tất.
- Ảnh: `artifacts/qa/customer-history-guest-loader.png`.
- Kiểm tra lại: hai direct URL attempt trong Playwright đều giữ loader.

### BUG-010: Manual “KT. Thanh toán” coi mất intent là đã thanh toán

- Mức độ: **High**
- File/URL: `igourmet-internal/src/components/CheckoutPanel.tsx:210-221`.
- Thiết bị/viewport: cashier UI.
- Điều kiện: APP/TRANSFER intent bị expire, cancel hoặc xóa mà invoice chưa PAID.
- Bước: trace manual check; so sánh lần hai với auto-poll path có fetch latest invoice/status.
- Dữ liệu test: `hasIntent=false`, invoice `UNPAID`.
- Thực tế: manual path alert success và set paid modal chỉ từ `hasIntent=false`.
- Mong đợi: fetch invoice by ID và require `status=PAID`.
- Error: false-positive UI, không exception.
- Nguyên nhân: intent lifecycle bị dùng như payment truth.
- Đề xuất: invoice/payment record là source of truth; giữ real invoice ID, không placeholder `1`.
- Kiểm tra lại: manual path trace; auto-poll comparison.

### BUG-011: Stored HTML injection trong print phiếu nhập kho

- Mức độ: **High**
- File/URL: `igourmet-internal/src/pages/ProcurementPage.tsx:346-361`.
- Thiết bị/viewport: browser print window.
- Điều kiện: receipt chứa supplier/note/ingredient/unit do user nhập.
- Bước: trace template nội suy trực tiếp; trace `document.write`; xác nhận không dùng `escapeHtml` như renderer hóa đơn mới.
- Dữ liệu test: `<img src=x onerror=alert(1)>` (không lưu vào DB thật).
- Thực tế: stored text được đưa nguyên văn vào HTML same-origin popup.
- Mong đợi: escape mọi giá trị hoặc render DOM text nodes/component.
- Error: có khả năng script execution trong popup.
- Nguyên nhân: xây HTML string từ dữ liệu không trusted.
- Đề xuất: dùng shared safe renderer và escape bắt buộc.
- Kiểm tra lại: ingredient row; supplier/note/header path độc lập.

### BUG-012: `/invoices` customer không có auth guard và che lỗi thành empty state

- Mức độ: **High**
- File/URL: `igourmet-app/src/App.tsx:20-36`, `src/pages/Invoices.tsx`.
- Thiết bị/viewport: mọi thiết bị.
- Điều kiện: guest hoặc refresh token hết hạn.
- Bước: route trực tiếp không có ProtectedRoute; page gọi ba API protected và catch chỉ log.
- Dữ liệu test: guest session.
- Thực tế: request 401/refresh, sau đó UI có thể trông như danh sách hợp lệ rỗng.
- Mong đợi: redirect login hoặc error/retry rõ ràng.
- Console/network: repeated 401 pattern được xác nhận ở các guest route local.
- Nguyên nhân: thiếu route guard và catch không set error state.
- Đề xuất: guard declarative ở router; tách empty/error/loading.
- Kiểm tra lại: route inventory; page request/error branch.

### BUG-013: Customer app không có trang 404

- Mức độ: **Medium**
- File/URL: `igourmet-app/src/App.tsx:20-36`.
- Thiết bị/viewport: Chrome.
- Điều kiện: bất kỳ session.
- Bước: mở `/does-not-exist`; mở `/booking/unknown`.
- Dữ liệu test: hai URL trên.
- Thực tế: layout rỗng, không title/message/recovery.
- Mong đợi: branded 404 và link home.
- Console: guest bootstrap 401, không phải nguyên nhân content rỗng.
- Nguyên nhân: thiếu wildcard route.
- Đề xuất: thêm `path="*"` NotFound.
- Ảnh: `artifacts/qa/customer-missing-404.png`.
- Kiểm tra lại: hai URL độc lập cùng kết quả.

### BUG-014: Home customer gọi profile protected cho guest và log lỗi

- Mức độ: **Medium**
- File/URL: `igourmet-app/src/pages/Home.tsx:123-135`, `src/lib/api.ts`.
- Thiết bị/viewport: Chrome mobile/desktop.
- Điều kiện: guest.
- Bước: mở/reload home; React StrictMode làm effect chạy hai lần trong dev.
- Dữ liệu test: không cookie.
- Thực tế: gọi profile, refresh, nhận 401 và `console.error('Lỗi tải thông tin tiền')`.
- Mong đợi: không gọi wallet/profile nếu `user` null; chờ auth loading.
- Console/network: evidence có hai profile 401 và refresh 401.
- Nguyên nhân: effect không check `user` và dependency không có user.
- Đề xuất: guard bằng auth state và dependency đúng.
- Kiểm tra lại: browser evidence; source effect trace.

### BUG-015: Company Admin không thấy category menu

- Mức độ: **Medium**
- File/URL: `igourmet-internal/src/pages/MenuPage.tsx:17-29,107-110`.
- Thiết bị/viewport: internal desktop/mobile.
- Điều kiện: role `COMPANY_ADMIN` có category.
- Bước: filterCompanyId chỉ được set cho Super Admin; render category yêu cầu truthy filterCompanyId.
- Dữ liệu test: Company Admin company 1.
- Thực tế: predicate trả false cho mọi category.
- Mong đợi: Company Admin mặc định company của chính mình.
- Error: empty list không có error.
- Nguyên nhân: state company filter không khởi tạo theo role.
- Đề xuất: derive scoped company ID từ auth hoặc API response.
- Kiểm tra lại: initialization path; render predicate path.

### BUG-016: Waiter không nhận trạng thái món mới từ kitchen

- Mức độ: **Medium**
- File/URL: `igourmet-internal/src/pages/OrdersPage.tsx` order loading/actions; không có polling/SSE cho active order.
- Thiết bị/viewport: waiter page.
- Điều kiện: waiter đang mở order; kitchen đổi WAITING→READY.
- Bước: inventory effect/lifecycle lần 1; search subscription/polling lần 2 không có.
- Dữ liệu test: order 101, item READY ở backend.
- Thực tế: UI chỉ reload khi đổi bàn hoặc local action.
- Mong đợi: SSE/poll/refresh để waiter phục vụ món kịp thời.
- Error: stale state, không exception.
- Nguyên nhân: thiếu realtime subscription trên waiter.
- Đề xuất: dùng shared `useRealtime` hoặc refresh có cancellation.
- Kiểm tra lại: load triggers review; toàn file search SSE/poll.

### BUG-017: Runtime dependency audit có 2 High ở internal và customer

- Mức độ: **Medium**
- File/URL: `igourmet-internal/package-lock.json`, `igourmet-app/package-lock.json`.
- Thiết bị/viewport: build/dependency.
- Điều kiện: clean install.
- Bước: `npm ci` audit; sau đó `npm audit --omit=dev` độc lập.
- Dữ liệu test: current lockfiles.
- Thực tế: React Router `7.12.0-7.18.1`, advisory `GHSA-qwww-vcr4-c8h2`, 2 High mỗi app.
- Mong đợi: không có High unresolved trước release.
- Ghi chú: advisory liên quan RSC Mode; hai app hiện là SPA, nên exploitability cần đánh giá thêm nhưng dependency vẫn bị audit fail.
- Nguyên nhân: version lock nằm trong range advisory.
- Đề xuất: chạy update có kiểm soát, regression route/auth và audit lại.
- Kiểm tra lại: install audit; production-only audit.

### BUG-018: Accessible label/document language không đúng

- Mức độ: **Low**
- File/URL: `igourmet-app/index.html:2`, `igourmet-internal/index.html:2`, customer/internal login form labels.
- Thiết bị/viewport: keyboard/screen reader.
- Điều kiện: mở login.
- Bước: Playwright `getByLabel('Email')` và `getByLabel('Tên đăng nhập')` không tìm được input; source cho thấy label không `htmlFor` và input không `id`; HTML đặt `lang="en"` cho UI tiếng Việt.
- Dữ liệu test: keyboard/accessible tree.
- Thực tế: input không có programmatic label, pronunciation language sai.
- Mong đợi: `<label htmlFor>`, matching `id`, `lang="vi"`.
- Error: Playwright locator timeout lần chạy đầu.
- Nguyên nhân: label chỉ đứng cạnh input về mặt hình ảnh.
- Đề xuất: nối label/input, thêm autocomplete đúng, đổi lang.
- Kiểm tra lại: browser accessible locator; source markup.

## 9. Rủi ro code/API chưa được ghi là bug xác nhận

Các mục sau có bằng chứng source đáng lo nhưng cần isolated PostgreSQL/Redis fixture để xác nhận behavior và mức ảnh hưởng. Không tính vào bug count:

- Parallel QR confirm/token scan có thể debit hai lần do consume Redis không atomic.
- Deposit refund có thể double-refund do đọc status ngoài transaction/không lock.
- Parallel create order có thể tạo nhiều active order cho một bàn.
- APP/TRANSFER failure sau commit có thể để invoice/table ở partial state.
- Voucher usage limit/scope/branch và concurrent reuse cần test DB.
- Existing JWT không bị revoke ngay khi account disabled/role changed.
- CSRF cần test với cookie production `SameSite=None`, Origin/Referer và HTTPS sandbox.
- Reservation assign/check-in cùng bàn có race.
- Menu item/inventory/procurement cross-company ID cần multi-tenant fixture.
- Redis TLS đang đặt `rejectUnauthorized:false`.
- Rate limit dùng MemoryStore, không shared giữa nhiều instance.
- Query SQL nhìn chung parameterized; chưa phát hiện SQL injection xác nhận.

## 10. Responsive và giao diện

Đã test bằng Chrome/Playwright:

- 375×667.
- 390×844.
- 768×1024.
- 1366×768.
- 1920×1080.

Kết quả:

- Internal cashier không có document horizontal overflow ở cả bốn nhóm viewport.
- Landing không có document horizontal overflow trong fixture 71 món; pagination cần kiểm tra thêm touch target trên thiết bị thật.
- Customer guest history và missing 404 được chụp ảnh.
- 5 role internal render thành công với mock: Cashier, Waiter, Kitchen, Receptionist, Super Admin.
- Không kiểm tra được modal/form sâu trên mọi management page vì thiếu sandbox data/API đầy đủ.

Ảnh evidence:

- `artifacts/qa/landing-375x667.png`
- `artifacts/qa/landing-390x844.png`
- `artifacts/qa/landing-768x1024.png`
- `artifacts/qa/landing-1366x768.png`
- `artifacts/qa/landing-1920x1080.png`
- `artifacts/qa/landing-booking-success.png`
- `artifacts/qa/customer-home-authenticated-mobile.png`
- `artifacts/qa/customer-history-guest-loader.png`
- `artifacts/qa/customer-missing-404.png`
- `artifacts/qa/internal-cashier-375x667.png`
- `artifacts/qa/internal-cashier-390x844.png`
- `artifacts/qa/internal-cashier-768x1024.png`
- `artifacts/qa/internal-cashier-1366x768.png`
- `artifacts/qa/internal-cashier-1920x1080.png`
- `artifacts/qa/internal-waiter-1366x768.png`
- `artifacts/qa/internal-kitchen-1366x768.png`
- `artifacts/qa/internal-reception-1366x768.png`
- `artifacts/qa/internal-admin-1366x768.png`

## 11. Chức năng chưa thể kiểm tra

- Backend startup/health với đúng schema hiện tại.
- Unit test/integration test vì không có test framework/script.
- Migration từ database rỗng vì repo không có baseline schema/seed hoàn chỉnh và Docker daemon không chạy.
- Login thật, logout thật, refresh rotation, disable account và 7-role API matrix.
- CRUD thật cho company, branch, staff, table, menu, inventory, supplier, voucher, banner.
- Reservation assign/check-in/cancel và conflict transaction.
- Cash/PayOS/APP/debt payment end-to-end.
- Wallet/PIN/topup/cashback/points transaction.
- VAT email, supplier email và provider failure.
- Supabase Realtime và RLS.
- Camera thật, QR replay/expiry và barcode printer.
- File upload: source hiện không có frontend upload flow; middleware backend upload không được nối route.
- Performance/Lighthouse trên dữ liệu production-like.

## 12. Kết luận

### 12.1 Số liệu

- Test case: **44**.
- Pass: **24**.
- Fail: **7**.
- Blocked: **13**.
- Bug xác nhận: **18**.
- Critical: **4**.
- High: **8**.
- Medium: **5**.
- Low: **1**.

### 12.2 Năm lỗi nghiêm trọng nhất

1. Customer tự cộng điểm/nâng hạng.
2. QR payment tin amount/invoice/table từ staff request.
3. Checkout mark-paid không tenant scope và không settlement đầy đủ.
4. Voucher discount tin `orderTotal` từ client.
5. Customer delivery phụ thuộc cart API đã bị backend xóa.

### 12.3 Đánh giá release

**Không đủ điều kiện release.** Bốn lỗi Critical nằm trực tiếp trên financial/loyalty/tenant boundary. Backend production build fail và không có bất kỳ automated test suite nào. Thêm vào đó, 13 test case trọng yếu bị blocked vì repository không cung cấp isolated database/Redis seed.

### 12.4 Bắt buộc sửa trước release

1. Đóng endpoint customer tự cộng điểm.
2. Server-side derive và lock dữ liệu payment; thêm idempotency.
3. Scope toàn bộ checkout/invoice mutation theo company/branch.
4. Tính voucher từ order canonical trong transaction.
5. Quyết định và đồng bộ cart/preorder contract giữa customer app và backend.
6. Xóa public `test-mail` và không trả refresh token/session cho web JavaScript.
7. Sửa backend build và bổ sung unit/integration/RBAC/payment concurrency tests.
8. Sửa guest route guards, loader vô hạn và wildcard 404.
9. Escape dữ liệu trong mọi print renderer.
10. Cung cấp local sandbox: baseline migration, seed 7 role, PostgreSQL/Redis container và fake PayOS/mail.

## 13. Evidence và command đã chạy

Các command chính:

```text
npm ci
npm run lint
npx tsc -b --pretty false
npm test
npm run build
npm audit --omit=dev
npx @playwright/test test artifacts/qa/local-ui.spec.js --workers=1
```

Artifacts:

- `artifacts/qa/browser-evidence.json`
- `artifacts/qa/local-ui.spec.js`
- `artifacts/qa/mock-api.mjs`
- Các screenshot liệt kê ở mục 10.

Không có source fix nào được thực hiện sau báo cáo. Chờ phê duyệt trước khi sửa code.
