# South Bonus 業績・補助管理 v8

原生 HTML/CSS/JavaScript + Node.js/Express API + PostgreSQL。原本補助回報、流量型補助、補助紀錄與設定流程保留，不新增業績／廣告費或報表選單。個人帳號登入後直接讀寫資料庫，已移除 Supabase 與手動雲端同步。

## 權限

- 管理員：新增用戶、修改名稱／角色、停用或啟用、重設密碼；查看、編輯及刪除全部紀錄，新增紀錄時可指定擁有者。
- 一般用戶：只能查看、新增、編輯、刪除自己的紀錄。報表與匯出只包含自己可見的資料。
- 不開放公開註冊。至少保留一位啟用中的管理員；停用、角色變更或重設密碼會撤銷該帳號所有登入。
- Settings 與目標按帳號儲存；管理員選取某帳號可管理其設定。選擇「全部用戶」時顯示全部紀錄，但設定及目標仍使用管理員自己的設定。

## 本機啟動

Node.js 22 以上：

```sh
npm ci
cp .env.example .env
```

編輯 `.env`，設定資料庫與首位管理員帳密，然後 `npm run dev`。帳號為 3–64 位英文／數字及 `_.@-`，密碼為 6–128 字元。資料庫首次啟動會建立資料表與首位管理員；之後改環境變數不會重設既有帳密。

本機沒有 PostgreSQL 時，移除 `.env` 的 `NODE_ENV=production`，設定 `LOCAL_DB=1`，使用開發依賴 PGlite。資料保存在 `.local-db/`，不提交 Git。正式環境禁止這個模式。

## Railway 部署

1. 建立 Railway Project，加入 PostgreSQL 服務。
2. 新增 GitHub Service，選擇 `jason121380/south_bonus` 的 `main` 分支。
3. 在 App Service Variables 設定：

| 變數 | 值 |
| --- | --- |
| `DATABASE_URL` | 透過 reference variable 連到 PostgreSQL 的 `DATABASE_URL`，通常為 `${{Postgres.DATABASE_URL}}`；服務名稱不同則依實際名稱調整 |
| `NODE_ENV` | `production` |
| `BOOTSTRAP_ADMIN_USERNAME` | 你設定的首位管理員帳號 |
| `BOOTSTRAP_ADMIN_PASSWORD` | 你設定的獨立強密碼，至少 6 字元 |

4. Railway 依 Dockerfile 建置，啟動時執行資料庫 migration，監聽 `0.0.0.0:$PORT`。
5. 在 Networking 產生 HTTPS 網域，開啟網頁並登入；首次管理員建立成功後可移除 bootstrap 帳密變數。
6. 管理員在「用戶管理」建立一般用戶，提供各自的帳密。

App 資料存於 PostgreSQL，應用服務不需掛 volume。不把資料庫帳密送到瀏覽器。正式環境 cookie 為 Secure／HttpOnly，請使用 HTTPS。

參考：[Railway Express 部署](https://docs.railway.com/guides/express)、[GitHub 服務部署](https://docs.railway.com/services)。

## 資料與同步

- 每筆紀錄獨立保存，後端重新計算補助；同類補助同一位設計師同月份最多一筆（涵蓋所有帳號）。
- 更新、刪除檢查版本，其他裝置已更新時回傳衝突，重新載入後再確認。
- 實際廣告費為月費 × 1.05；ROAS ≥ 3.5 固定補助 50%，否則三項配合度各 10%，全部達標再加 10%。
- 流量型補助：實業績 15／20／25／30 萬分別為 20／30／40／50%。
- 無離線寫入功能；API 失敗會提示。離線快取已停用，避免帳號資料殘留。
- 「清除我的紀錄」只清除登入者自己的四類紀錄，保留設定，不清除其他用戶資料。

## 舊資料遷移及備份

原本 localhost 的 localStorage 與正式網站資料不共用。

1. 將 `public/legacy-export.html`、`public/legacy-export.js` 與 `public/styles.css` 放在舊網站提供檔案的目錄（或以新服務使用同一個 host、port 與瀏覽器），開啟原網址的 `/legacy-export.html`。
2. 下載 JSON；工具僅讀取舊 key，不刪除資料、不匯出 Supabase 密鑰。
3. 正式網站以資料應歸屬的帳號登入，在「設定」匯入 JSON。所有匯入紀錄歸該登入帳號所有；不同帳號應分別匯入。
4. 匯入最多 5 MB／10000 筆，只匯入紀錄、不匯入舊設定或帳號。非法或重複紀錄會取消整次匯入，保留原有資料；移除衝突紀錄後可再次匯入。

設定可匯出可見紀錄 JSON；管理員選「全部用戶」可匯出全部可見紀錄，但這個 JSON 匯入工具不保留帳號歸屬。完整復原（包含帳號、設定及 ownership）請使用 PostgreSQL 備份／`pg_dump`，並設定 Railway 資料庫備份。

## 測試與目錄

```sh
npm test
```

測試以記憶體 PGlite 執行真實 PostgreSQL SQL：權限隔離、補助邊界、伺服器重算、匯入 transaction、版本衝突、帳號撤銷與最後管理員保護。PGlite 不取代正式 PostgreSQL 網路／TLS／Docker 部署驗證。

```text
public/          網頁、API client、事件處理、舊資料匯出工具
server/auth.js   密碼雜湊、session、首位管理員
server/records.js 紀錄權限、個人設定、匯入
server/calculations.js 欄位驗證與補助規則
server/migrations/ SQL migrations
server/app.js    HTTP API 與靜態資源
tests/           計算、API 與前端錯誤處理測試
```

## 樣式規範

全站字級、間距、元件尺寸、響應式比例與維護方式請參考 [style.md](style.md)。共用樣式集中在 `public/styles.css`，自訂元件集中在 `public/ui.js`。
