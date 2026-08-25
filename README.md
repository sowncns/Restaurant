# iGourmet — Hệ thống quản lý chuỗi nhà hàng

Monorepo gồm 1 backend (Node.js/Express) và 3 frontend (React + Vite), phục vụ quản lý chuỗi nhà hàng đa công ty — đa chi nhánh: đặt bàn, order/POS, bếp, thanh toán, kho nguyên liệu, nhân viên & phân quyền.

```
NhaHang/
├── backend/                  REST API (Node.js + Express, PostgreSQL, Redis)
├── igourmet-internal/        Web quản lý nội bộ (nhân viên, quản lý) — Vite port mặc định 5173
├── igourmet-app/             Ứng dụng khách hàng (đặt bàn, gọi món, thanh toán) — PWA
├── igourmet-landing/         Trang giới thiệu
├── selenium-tests/           Kiểm thử E2E giao diện (Python + Selenium)
├── api-tests/                Kiểm thử tích hợp API (Python + pytest)
└── docs/test-cases.md        Bảng ca kiểm thử chi tiết (unit/integration/E2E)
```

## 1. Yêu cầu hệ thống

- Node.js ≥ 20 (khuyến nghị 24, khớp CI)
- Python 3.11+ (cho `api-tests/` và `selenium-tests/`)
- PostgreSQL và Redis — có thể dùng dịch vụ cloud (Supabase Postgres, Upstash Redis) như cấu hình mặc định trong `.env`, không bắt buộc cài local
- Git

## 2. Cấu hình (`.env`)

Mỗi thư mục có `.env.example` riêng — copy thành `.env` rồi điền giá trị thật, **không commit file `.env`**.

| Thư mục | File mẫu | Biến quan trọng |
|---|---|---|
| `backend/` | `.env.example` | `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `PAYOS_*`, `SUPABASE_*` |
| `igourmet-internal/` | — | `VITE_API_URL` (mặc định trỏ `http://localhost:5000`) |
| `igourmet-app/` | — | `VITE_API_URL` |
| `igourmet-landing/` | — | `VITE_API_URL` |
| `api-tests/` | `.env.example` | `API_BASE_URL`, `E2E_*_USERNAME`/`PASSWORD` (tài khoản test theo vai trò), `E2E_COMPANY_ID`/`BRANCH_ID`/... (ID dữ liệu test) |
| `selenium-tests/` | `.env.example` | `CUSTOMER_WEB_URL`, `INTERNAL_WEB_URL` — tự động dùng chung credentials từ `api-tests/.env` |

```bash
cd backend && cp .env.example .env    # điền DATABASE_URL, REDIS_URL, JWT secrets...
cd api-tests && cp .env.example .env  # điền tài khoản + ID test (xem mục 5)
cd selenium-tests && cp .env.example .env
```

## 3. Chạy Backend

```bash
cd backend
npm install
npm run dev      # nodemon, tự reload khi sửa code
# hoặc: npm start  (production, không reload)
```

Mặc định chạy tại `http://localhost:5000`, API dưới tiền tố `/api`. Khởi động thành công sẽ log `PostgreSQL connected`, `Redis connected`, `Server chạy tại http://localhost:5000`.

## 4. Chạy 3 Frontend

Mỗi app là một Vite project độc lập, chạy riêng terminal. Vite mặc định port 5173 — khi chạy nhiều app cùng lúc cần chỉ định port khác nhau để tránh trùng:

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

Build production: `npm run build` (mỗi thư mục) — output ở `dist/`, deploy qua Vercel.

## 5. Chạy kiểm thử

Xem chi tiết đầy đủ (bảng ca kiểm thử, mã hoá từng ca) tại [`docs/test-cases.md`](docs/test-cases.md). Tóm tắt cách chạy:

### 5.1. Unit test (backend, không cần server chạy)

```bash
cd backend
npm test
```

### 5.2. Integration/API test (cần backend đang chạy)

```bash
cd backend && npm run dev
```

Terminal khác:

```bash
cd api-tests
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
cp .env.example .env      # điền E2E_*_USERNAME/PASSWORD + E2E_COMPANY_ID/BRANCH_ID/...
pytest
```

Tài khoản test (`E2E_MANAGER_USERNAME=e2e_manager`,...) và ID dữ liệu (`E2E_COMPANY_ID`, `E2E_BRANCH_ID`,...) phải trỏ tới các bản ghi có thật trong database đang kết nối — nếu để trống, các test cần đăng nhập sẽ bị skip và vài test route sẽ fail do URL bị build sai (xem ghi chú trong `.env.example`).

Chạy cả nhóm destructive (đổi dữ liệu thật — chỉ chạy trên môi trường disposable):

```bash
$env:API_DESTRUCTIVE = "1"
pytest -m destructive
```

### 5.3. E2E Selenium (cần backend + 2 FE chạy song song)

```bash
# Terminal 1
cd backend && npm start

# Terminal 2 — app khách hàng
cd igourmet-app && npm run dev -- --host 127.0.0.1 --port 5174

# Terminal 3 — web nội bộ
cd igourmet-internal && npm run dev -- --host 127.0.0.1 --port 5173
```

Terminal 4:

```bash
cd selenium-tests
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
cp .env.example .env      # điền CUSTOMER_WEB_URL/INTERNAL_WEB_URL đúng port ở trên

pytest                # chạy tất cả
pytest -m auth        # chỉ nhóm đăng nhập/phân quyền
pytest --headed       # xem trình duyệt chạy trực tiếp
pytest --browser edge # đổi trình duyệt
```

## 6. Ghi chú

- Đăng nhập nội bộ và khách hàng dùng cookie JWT tách riêng (`internalAccessToken` / `customerAccessToken`), đồng thời hỗ trợ header `Authorization: Bearer <token>` cho app native.
- Danh sách đầy đủ 183 route API: xem [`backend/README.md`](backend/README.md).
- File `.env` ở mọi thư mục đều gitignore — không commit, không dán vào tài liệu/báo cáo dạng plaintext.
