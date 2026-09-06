# iGourmet — Hướng dẫn triển khai & kiểm thử đầy đủ

Tài liệu này gộp: cách triển khai toàn bộ hệ thống (backend + 3 frontend), danh sách vai trò (role) và tài khoản test theo từng role, cách cấu hình biến môi trường, và cách chạy toàn bộ các loại test (unit / integration / E2E).

> Tổng quan kiến trúc & lệnh chạy nhanh xem thêm ở [`README.md`](README.md). File này đi sâu hơn vào **triển khai** và **tài khoản/role dùng cho test**.

---

## Mục lục

1. [Kiến trúc & thành phần](#1-kiến-trúc--thành-phần)
2. [Chuẩn bị hạ tầng](#2-chuẩn-bị-hạ-tầng)
3. [Triển khai Backend](#3-triển-khai-backend)
4. [Triển khai Frontend (3 app)](#4-triển-khai-frontend-3-app)
5. [Danh sách Role & tài khoản test](#5-danh-sách-role--tài-khoản-test)
6. [Chạy Test theo từng loại](#6-chạy-test-theo-từng-loại)
7. [Checklist trước khi go-live](#7-checklist-trước-khi-go-live)

---

## 1. Kiến trúc & thành phần

```
NhaHang/
├── backend/                  REST API — Node.js + Express, PostgreSQL, Redis
├── igourmet-internal/        Web quản lý nội bộ (nhân viên/quản lý) — Vite/React
├── igourmet-app/             Ứng dụng khách hàng (đặt bàn, order, thanh toán) — PWA
├── igourmet-landing/         Trang giới thiệu
├── selenium-tests/           E2E UI test — Python + Selenium
├── api-tests/                Integration/API test — Python + pytest
└── docs/test-cases.md        Bảng ca kiểm thử chi tiết
```

- **Backend**: REST API dưới tiền tố `/api`, xác thực JWT (cookie `internalAccessToken` cho nội bộ, `customerAccessToken` cho khách hàng, hoặc header `Authorization: Bearer <token>` cho app native).
- **Database**: PostgreSQL (khuyến nghị Supabase Postgres cho production, hoặc PostgreSQL local khi dev).
- **Cache/session**: Redis (khuyến nghị Upstash cho production).
- **Thanh toán**: PayOS.
- **Mail**: Nodemailer / Resend API.

---

## 2. Chuẩn bị hạ tầng

| Thành phần | Lựa chọn khuyến nghị | Ghi chú |
|---|---|---|
| Node.js | ≥ 20 (khuyến nghị 24, khớp CI) | dùng cho backend + 3 frontend |
| Python | 3.11+ | dùng cho `api-tests/`, `selenium-tests/` |
| PostgreSQL | Supabase Postgres (cloud) hoặc local | connection string dạng `postgresql://user:password@host:5432/postgres` |
| Redis | Upstash Redis (cloud) hoặc local | connection string dạng `redis://...` |
| Hosting Backend | VPS / Render / Railway (chạy Node lâu dài) | cần mở port, cấu hình biến môi trường |
| Hosting Frontend | Vercel / Netlify | mỗi app build ra `dist/`, deploy độc lập |
| Cổng thanh toán | Tài khoản PayOS (Client ID, API Key, Checksum Key) | bắt buộc nếu dùng module thanh toán |
| Mail | Tài khoản Resend hoặc SMTP (Nodemailer) | dùng gửi email xác nhận/đặt lại mật khẩu |

---

## 3. Triển khai Backend

### 3.1. Cấu hình biến môi trường (`backend/.env`)

Copy `backend/.env.example` thành `backend/.env` rồi điền giá trị thật (**không commit file `.env`**):

```bash
cd backend
cp .env.example .env
```

Các biến quan trọng cần điền:

| Biến | Mô tả |
|---|---|
| `NODE_ENV` | `development` hoặc `production` |
| `PORT` | Cổng chạy API (mặc định `5000`) |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL |
| `REDIS_URL` | Chuỗi kết nối Redis |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Chuỗi bí mật tự sinh (khuyến nghị ≥ 32 ký tự ngẫu nhiên), **không dùng giá trị mặc định** |
| `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES` | Thời hạn token (mặc định `1d` / `7d`) |
| `CORS_ORIGINS` / `FRONTEND_URL` | Domain của các frontend được phép gọi API |
| `PAYOS_CLIENT_ID` / `PAYOS_API_KEY` / `PAYOS_CHECKSUM_KEY` | Thông tin tích hợp PayOS |
| `MAIL_USER` / `MAIL_PASS` hoặc `RESEND_API_KEY` / `MAIL_FROM` | Cấu hình gửi mail |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Nếu dùng Supabase (Realtime/Auth hybrid). `SERVICE_ROLE_KEY` chỉ dùng ở backend, **không đưa ra frontend** |
| `INTERNAL_AUTH_EMAIL_DOMAIN` | Domain email ảo cho tài khoản nội bộ (nhân viên) |
| `RESERVATION_ALERT_MINUTES` / `RESERVATION_DEPOSIT_RATE` | Cấu hình nghiệp vụ đặt bàn |
| `RATE_LIMIT_ENABLED` | Bật/tắt rate limit API |

### 3.2. Chạy local (development)

```bash
cd backend
npm install
npm run dev      # nodemon, tự reload khi sửa code
```

### 3.3. Chạy production

```bash
cd backend
npm install --omit=dev
npm start
```

Backend chạy tại `http://localhost:5000` (hoặc `PORT` đã cấu hình), API dưới tiền tố `/api`. Log khởi động thành công: `PostgreSQL connected`, `Redis connected`, `Server chạy tại http://localhost:<PORT>`.

### 3.4. Triển khai lên hosting (VPS/Render/Railway...)

1. Push code lên Git remote đã liên kết với dịch vụ hosting.
2. Cấu hình toàn bộ biến môi trường ở mục 3.1 trên dashboard của dịch vụ (không dùng file `.env`, dùng UI/secret manager).
3. Build command: `npm install`. Start command: `npm start`.
4. Đảm bảo `DATABASE_URL`/`REDIS_URL` trỏ tới instance production, `CORS_ORIGINS` khớp domain frontend production.
5. Kiểm tra log sau deploy để chắc chắn kết nối DB/Redis thành công.

---

## 4. Triển khai Frontend (3 app)

Mỗi app là một Vite project độc lập. Biến môi trường quan trọng: `VITE_API_URL` — trỏ tới URL backend (local: `http://localhost:5000`, production: domain backend thật).

### 4.1. Chạy local (dev)

```bash
# Web quản lý nội bộ — http://localhost:5173
cd igourmet-internal
npm install
npm run dev

# Ứng dụng khách hàng — http://localhost:5174
cd igourmet-app
npm install
npm run dev -- --port 5174

# Trang giới thiệu — http://localhost:5175
cd igourmet-landing
npm install
npm run dev -- --port 5175
```

### 4.2. Build production

```bash
npm run build   # chạy trong từng thư mục app
```

Output nằm ở `dist/`.

### 4.3. Deploy lên Vercel/Netlify

1. Tạo project mới trên Vercel (hoặc Netlify — repo đã có `netlify.toml` cho `igourmet-app` và `igourmet-internal`) trỏ tới thư mục app tương ứng (`igourmet-internal`, `igourmet-app`, `igourmet-landing`) làm root directory.
2. Build command: `npm run build`. Output directory: `dist`.
3. Khai báo biến môi trường `VITE_API_URL` = domain backend production trên dashboard Vercel/Netlify.
4. Sau khi deploy, cập nhật `CORS_ORIGINS`/`FRONTEND_URL` ở backend cho khớp domain frontend vừa deploy.

---

## 5. Danh sách Role & tài khoản test

Hệ thống có các role sau (theo cấu hình trong `.env.example` của `api-tests/` và `selenium-tests/`). Khi thiết lập môi trường test, **tạo sẵn các tài khoản này trong database test/disposable** rồi điền username/password vào file `.env` tương ứng — không dùng tài khoản thật.

| Role | Biến username | Biến password | Mô tả quyền hạn (tham khảo nghiệp vụ) |
|---|---|---|---|
| Khách hàng | `E2E_CUSTOMER_EMAIL` | `E2E_CUSTOMER_PASSWORD` | Đặt bàn, gọi món, xem hoá đơn, thanh toán qua app khách hàng |
| Lễ tân (Receptionist) | `E2E_RECEPTIONIST_USERNAME` | `E2E_RECEPTIONIST_PASSWORD` | Quản lý đặt bàn, xếp bàn, check-in khách |
| Phục vụ (Waiter) | `E2E_WAITER_USERNAME` | `E2E_WAITER_PASSWORD` | Tạo/sửa order tại bàn, chuyển món xuống bếp |
| Bếp (Kitchen) | `E2E_KITCHEN_USERNAME` | `E2E_KITCHEN_PASSWORD` | Xem/cập nhật trạng thái chế biến món |
| Thu ngân (Cashier) | `E2E_CASHIER_USERNAME` | `E2E_CASHIER_PASSWORD` | Lập hoá đơn, xử lý thanh toán, đóng ca |
| Quản lý chi nhánh (Manager) | `E2E_MANAGER_USERNAME` | `E2E_MANAGER_PASSWORD` | Quản lý nhân viên/thực đơn/kho trong phạm vi 1 chi nhánh |
| Quản trị công ty (Company Admin) | `E2E_COMPANY_ADMIN_USERNAME` | `E2E_COMPANY_ADMIN_PASSWORD` | Quản lý toàn bộ chi nhánh thuộc 1 công ty |
| Siêu quản trị (Super Admin) | `E2E_SUPER_ADMIN_USERNAME` | `E2E_SUPER_ADMIN_PASSWORD` | Quản trị toàn hệ thống, đa công ty |

> **Đăng nhập nội bộ** (Receptionist → Super Admin) dùng username; **đăng nhập khách hàng** dùng email. Cả hai đều xác thực bằng JWT nhưng lưu ở cookie tách riêng (`internalAccessToken` / `customerAccessToken`).

### 5.1. Điền tài khoản test vào `.env`

`api-tests/.env`:

```bash
E2E_CUSTOMER_EMAIL=<điền email test>
E2E_CUSTOMER_PASSWORD=<điền password test>
E2E_RECEPTIONIST_USERNAME=<điền username test>
E2E_RECEPTIONIST_PASSWORD=<điền password test>
E2E_WAITER_USERNAME=<điền username test>
E2E_WAITER_PASSWORD=<điền password test>
E2E_KITCHEN_USERNAME=<điền username test>
E2E_KITCHEN_PASSWORD=<điền password test>
E2E_CASHIER_USERNAME=<điền username test>
E2E_CASHIER_PASSWORD=<điền password test>
E2E_MANAGER_USERNAME=<điền username test>
E2E_MANAGER_PASSWORD=<điền password test>
E2E_COMPANY_ADMIN_USERNAME=<điền username test>
E2E_COMPANY_ADMIN_PASSWORD=<điền password test>
E2E_SUPER_ADMIN_USERNAME=<điền username test>
E2E_SUPER_ADMIN_PASSWORD=<điền password test>
```

`selenium-tests/.env` dùng đúng bộ biến trên (có thể copy lại từ `api-tests/.env`).

Ngoài tài khoản, `api-tests/.env` còn cần các **ID dữ liệu test** cố định trong tenant test (không đổi giữa các lần chạy):

```bash
E2E_COMPANY_ID=<điền>
E2E_BRANCH_ID=<điền>
E2E_OTHER_BRANCH_ID=<điền>
E2E_OTHER_BRANCH_TABLE_ID=<điền>
E2E_OTHER_COMPANY_BRANCH_ID=<điền>
E2E_RESERVATION_TABLE_ID=<điền>
E2E_SALES_TABLE_ID=<điền>
E2E_MENU_ITEM_ID=<điền>
E2E_INGREDIENT_ID=<điền>
E2E_SUPPLIER_ID=<điền>
```

> Nếu để trống tài khoản/role nào, các test cần đăng nhập role đó sẽ tự **skip**; nếu để trống ID dữ liệu, một số test route sẽ **fail** do URL build sai. Xem thêm ghi chú trong `api-tests/.env.example`.

---

## 6. Chạy Test theo từng loại

### 6.1. Unit test (backend — không cần server chạy)

```bash
cd backend
npm test
```

### 6.2. Integration/API test (cần backend đang chạy)

Terminal 1 — chạy backend:

```bash
cd backend
npm run dev
```

Terminal 2 — chạy test:

```bash
cd api-tests
py -m venv .venv
.\.venv\Scripts\Activate.ps1        # Windows PowerShell
# source .venv/bin/activate         # macOS/Linux
python -m pip install -r requirements.txt
cp .env.example .env                # điền tài khoản role (mục 5.1) + ID dữ liệu test
pytest
```

Chạy nhóm test theo role/tính năng cụ thể (nếu có marker tương ứng, xem `api-tests/pytest.ini`):

```bash
pytest -k customer      # test liên quan customer
pytest -k manager       # test liên quan manager
```

Chạy nhóm **destructive** (đổi dữ liệu thật — chỉ chạy trên môi trường disposable):

```bash
$env:API_DESTRUCTIVE = "1"     # PowerShell
pytest -m destructive
```

### 6.3. E2E Selenium (cần backend + 2 frontend chạy song song)

Terminal 1 — backend:

```bash
cd backend
npm start
```

Terminal 2 — app khách hàng:

```bash
cd igourmet-app
npm run dev -- --host 127.0.0.1 --port 5174
```

Terminal 3 — web nội bộ:

```bash
cd igourmet-internal
npm run dev -- --host 127.0.0.1 --port 5173
```

Terminal 4 — chạy test:

```bash
cd selenium-tests
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
cp .env.example .env       # điền CUSTOMER_WEB_URL/INTERNAL_WEB_URL đúng port ở trên + tài khoản role (mục 5.1)

pytest                # chạy tất cả
pytest -m auth        # chỉ nhóm đăng nhập/phân quyền theo role
pytest --headed       # xem trình duyệt chạy trực tiếp
pytest --browser edge # đổi trình duyệt (mặc định chrome)
```

### 6.4. Bảng ca kiểm thử chi tiết

Xem đầy đủ mã hoá từng ca kiểm thử (unit/integration/E2E) tại [`docs/test-cases.md`](docs/test-cases.md).

---

## 7. Checklist trước khi go-live

- [ ] Đổi toàn bộ secret mặc định (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) sang giá trị ngẫu nhiên mạnh.
- [ ] `DATABASE_URL`/`REDIS_URL` trỏ đúng instance production, không dùng chung với môi trường test.
- [ ] `CORS_ORIGINS`/`FRONTEND_URL` khớp chính xác domain frontend production (không để `*` hoặc localhost).
- [ ] Tài khoản test (mục 5) **không tồn tại** trên database production, hoặc bị vô hiệu hoá nếu bắt buộc phải seed.
- [ ] `PAYOS_*` dùng key production (không phải sandbox) trước khi nhận thanh toán thật.
- [ ] File `.env` mọi thư mục **không được commit** (đã có trong `.gitignore`) — không dán vào tài liệu/báo cáo dạng plaintext.
- [ ] Chạy đủ 3 loại test (unit, integration/API, E2E) ở môi trường staging trước khi deploy production.
