# Railway 與用戶管理實作計畫

**目標：** 將 south_bonus 改為 Node.js 與 PostgreSQL 應用，完成管理員／一般用戶權限、移除雲端介面，測試後推送 GitHub。

**設計：** railway-architecture.md。原生前端搭配同來源 Express API；PostgreSQL 保存用戶、session、逐筆紀錄與個人設定。

**執行方式：** 在目前對話由同一位 agent 實作與驗證，最後依審查技能使用一次只讀獨立審查。

## 全域限制
- 保留繁體中文 UI、5% 廣告費加成、3.5 倍門檻，以及 15／20／25／30 萬流量補助門檻。
- 一般用戶只能操作自己的資料；管理員操作所有資料。
- 不提交帳密、不建立 Railway 線上專案；推送到 jason121380/south_bonus 的 main。
- Node.js 22 LTS，PostgreSQL 16 以上；以環境變數取得 PORT、DATABASE_URL 與管理員初始帳密。

## 重點驗證
- 修改 record ID 或 owner_id 不能取得他人的資料。
- 停用帳號或重設密碼後，舊 session 不能繼續使用。
- 同一位設計師同月重複紀錄與過期版本更新不能靜默覆蓋。
- 不合法匯入不造成部分寫入；計算結果由後端重新產生。
- 連線失敗不顯示儲存成功；session 與 API 回應不進入離線快取。

## 1. 資料庫與計算模組
檔案：package.json、server/db.js、server/migrations/001.sql、server/calculations.js、tests/calculations.test.js。

- [x] 先寫補助門檻與非法數值測試，確認缺少模組時失敗。
- [x] 建立 users、sessions、records、user_settings 資料表與索引。records 以 kind、owner_id、designer、month 識別補助，另保存版本與經驗證的 JSON 欄位。
- [x] 實作 calculateSubsidy(input)、calculateTrafficSubsidy(input)，拒絕非有限、負數或缺少必要值，強制重算金額。
- [x] 透過 migration tracking 與 transaction 建表；測試重跑 migration 不改變資料。
- [x] 驗證月費 10000、實際費 10500、網路業績 36750 時為 50%；流量門檻逐一驗證。

## 2. 登入、用戶管理與逐筆 API
檔案：server/auth.js、server/app.js、server/index.js、server/records.js、tests/api.test.js。

- [x] 先寫 API 測試：未登入 401、一般用戶管理帳號 403、存取他人紀錄 404、角色與 owner_id 不可由新增請求越權指定。
- [x] 實作 POST /api/login、POST /api/logout、GET /api/me，session 隨機 token 雜湊入庫，HttpOnly/SameSite cookie；正式環境 Secure cookie。
- [x] 實作 /api/users 管理 API，驗證 username、角色與密碼；撤銷被停用或重設密碼帳號的 session，鎖定最後一位管理員保護操作。
- [x] 實作 GET /api/state 與 /api/records CRUD；每個查詢套用權限，後端計算，更新檢查 version，衝突回傳 409。
- [x] 實作個人設定、限制範圍內清除與 JSON 匯入；匯入使用 transaction，非法／重複資料回報並不部分寫入。
- [x] 使用同來源檢查、JSON 限制與登入嘗試節流；完整測試真實 PostgreSQL 的登入、CRUD、停用與版本衝突。

## 3. 前端接入與資料遷移
檔案：public/index.html、public/styles.css、public/app.js、public/api.js、public/legacy-export.html、public/manifest.json、public/service-worker.js。

- [x] 搬移網站檔案至 public；登入頁與用戶管理頁維持中文。
- [x] 以 API 模組替換 localStorage 主儲存與 Supabase 同步；資料修改只傳送受影響紀錄，成功後重新取得可見資料。
- [x] 管理員可選擇資料擁有者；一般用戶使用自己的帳號。補上流量補助編輯與管理員用戶操作，原本隱藏的業績／廣告費與報表不新增選單入口。
- [x] 移除雲端 nav/view、舊同步函式與 Supabase SQL；在設定提供 JSON 匯入、備份匯出。
- [x] 提供同源舊資料匯出頁，讀取舊 key 並輸出 JSON，不刪除原資料。
- [x] Service worker 只處理靜態資源，不快取 API；登入失效、連線失敗、重複紀錄和版本衝突均有可理解的提示。
- [x] 瀏覽器驗證兩種角色：登入、表單儲存／修改／刪除、權限可見性、用戶管理、匯入、CSV 匯出。

## 4. Railway 部署與交付
檔案：Dockerfile、.dockerignore、.gitignore、.env.example、railway.json、README.md、package-lock.json。

- [x] Node 服務監聽 0.0.0.0:$PORT；/health 檢查資料庫可用性。啟動前執行 migration，建立一次性首位管理員。
- [x] 編寫 Railway PostgreSQL 連線、環境變數、部署與備份說明，不包含實際密碼。
- [x] 執行完整測試、程式語法檢查、健康檢查與瀏覽器操作；記錄無法實際驗證的環境限制。
- [x] 自行審查所有 diff，確認資料隔離、帳號撤銷、最後管理員保護與部署設定，修正後重跑相關測試。
- [x] Commit、push main，確認遠端 commit 相符。提供 GitHub 連結與 Railway 必填變數。

驗證限制：本機使用 PGlite 執行 PostgreSQL SQL，沒有 Docker 或 PostgreSQL server，尚未實測 Railway 建置及正式資料庫網路／TLS。
