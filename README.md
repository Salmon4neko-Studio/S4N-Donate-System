# S4N Donate System (S4N 贊助系統)

一個開源的實況主贊助平台，支援 ECPay (綠界) 和 O'Pay (歐付寶) 金流，並提供 OBS 即時通知功能。

## 功能特色

- **公開贊助頁面**：觀眾可以輸入暱稱、金額、留言並選擇支付方式。
- **實況主後台**：查看最近贊助紀錄，設定通知樣式 (圖片、音效、字型)。
- **OBS 通知**：專屬的 Browser Source 網址，贊助成功後即時顯示動畫與播放音效。
- **現代化日系 UI**：採用 ([**Tocas UI**](https://tocas-ui.com/)) 設計系統，提供柔和、現代的視覺體驗。
- **Docker 支援**：提供 Docker Image ([lokisalmonneko/s4n-donate-system](https://hub.docker.com/r/lokisalmonneko/s4n-donate-system)) 與 Docker Compose 配置。

## 網站頁面說明

- **首頁 (`/`)**: 系統首頁。
- **管理後台 (`/dashboard`)**: 實況主或管理員使用的後台，可設定通知樣式、金流開關、查看贊助紀錄。
- **OBS 瀏覽器來源 (`/obs`)**: 專為 OBS 設計的通知頁面，請將此網址加入 OBS 的瀏覽器來源。
- **管理員登入 (`/login`)**: 後台登入頁面。

## 快速部署 (Zeabur)

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/PZ7FR9?referralCode=LokiSalmonNeko)

本專案已發布為 [Zeabur Template](https://zeabur.com/zh-TW/templates/PZ7FR9)，您可以透過以下步驟一鍵部署：

1. 點擊上方的 "Deploy on Zeabur" 按鈕。
2. 系統將引導您至 Zeabur Dashboard 並自動建立專案。
3. 依照提示填入環境變數。
    - 若您要使用綠界或歐付寶金流，請填入您的商店代號與金鑰。
    - **請務必設定 JWT_SECRET 環境變數，這是用於加密身份驗證 token 的密鑰。**
4. 部署時，Zeabur會提供一組自訂子網域供您訪問。

**注意**：
- 資料庫 (PostgreSQL) 會自動建立並連接，無需額外設定。
- 若您需要修改程式碼，請 Fork 本專案後使用 Git 部署方式。

## 環境變數說明

| 變數名稱 | 必填 | 說明 |
|---------|------|------|
| DATABASE_URL | 是 | 資料庫連線字串 |
| ADMIN_USERNAME | 是 | 管理員帳號 |
| ADMIN_PASSWORD | 是 | 管理員密碼 |
| JWT_SECRET | 是 | JWT 加密密鑰，用於身份驗證 |
| NEXT_PUBLIC_BASE_URL | 是 | 網站基礎 URL |
| ECPAY_MERCHANT_ID | 否 | 綠界商店代號 |
| ECPAY_HASH_KEY | 否 | 綠界 Hash Key |
| ECPAY_HASH_IV | 否 | 綠界 Hash IV |
| OPAY_MERCHANT_ID | 否 | 歐付寶商店代號 |
| OPAY_HASH_KEY | 否 | 歐付寶 Hash Key |
| OPAY_HASH_IV | 否 | 歐付寶 Hash IV |

## 自訂網域

若您需要自訂網域，請在 Zeabur Dashboard 的 "網域" 中設定。

## 本地開發

1. 安裝依賴：
   ```bash
   npm install
   ```

2. 啟動資料庫 (Docker)：
   ```bash
   docker-compose up -d db
   ```

3. 同步資料庫 Schema：
   ```bash
   npx prisma db push
   ```

4. 啟動開發伺服器：
   ```bash
   npm run dev
   ```

## 相關連結

- [Docker Hub](https://hub.docker.com/r/lokisalmonneko/s4n-donate-system)
- [Zeabur Template](https://zeabur.com/zh-TW/templates/PZ7FR9)

## 授權

本專案採用 [MIT License](LICENSE) 授權。

詳細說明請參閱 [中文授權說明](LICENSE_zh_TW.md)。