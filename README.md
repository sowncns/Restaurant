# Hướng dẫn chạy hệ thống & test

File `.env` đã được cấu hình sẵn ở `backend/`, `api-tests/`, `selenium-tests/` (không cần copy `.env.example` hay điền lại tài khoản). Chỉ cần cài dependency rồi chạy theo thứ tự dưới.

## 0. Yêu cầu

- Node.js ≥ 20, Python 3.11+, Git

## 1. Chạy Backend

```bash
cd backend
npm install
npm run dev
```
→ `http://localhost:5000`
```
[11:22:43.367] INFO (13036): PostgreSQL connected
[11:22:43.652] INFO (13036): Redis connected
[11:22:43.652] WARN (13036): PAYOS_WEBHOOK_URL chưa được cấu hình
[11:22:43.674] INFO (13036): Server chạy tại http://localhost:5000
[11:22:45.346] INFO (13036): Supabase Realtime da subscribe
```
cho den khi log nay xuat hien


## 2. Chạy 3 Frontend (mỗi cái 1 terminal)

```bash
cd igourmet-internal
npm install 
npm run dev    
```

```bash    
cd igourmet-app     
npm install
npm run dev -- --port 5174
```

```bash
cd igourmet-landing
 npm install
 npm run dev -- --port 5175
```

## 3. Chạy test

```bash
# Unit test backend (không cần server chạy)
cd backend
npm test

# API integration test (cần backend đang chạy)
cd api-tests
py -m venv .venv 
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
pytest

# E2E Selenium (cần backend + igourmet-app + igourmet-internal đang chạy đúng port ở bước 2)
cd selenium-tests
py -m venv .venv 
 .\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python.exe -m pip install --upgrade pip
 .\run-prod.ps1  #CHAY CHO PROD
  .\run-local.ps1 # CHAY CHO LOCAL pahi chay be  va 2 fe kia trong nen
```

Không commit file `.env` hay dán tài khoản/mật khẩu thật vào báo cáo.
