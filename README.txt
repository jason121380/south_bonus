業績・投報率管理 App V3

新增：廣告補助回報、設計師下拉選單、達標按鈕、自動計算補助與匯出 CSV。

業績・投報率管理 App v2

直接使用：
1. 雙擊 index.html
2. 建議用 Google Chrome 開啟
3. 不需要 Python、不需要 Xcode

v2 新增：
- 編輯業績與廣告費紀錄
- 每月業績目標與進度條
- 每日報表 / 每月報表
- CSV 匯出
- Supabase 雲端上傳、下載、自動同步
- v1 瀏覽器資料會自動帶入 v2

Supabase 設定：
1. 建立 Supabase Project
2. SQL Editor 執行 supabase-setup.sql
3. 在 Project Settings/API 取得 Project URL 與 anon key
4. App > 雲端：填入 URL、Anon Key
5. 按「產生 Workspace Key」並儲存設定
6. 先按「上傳到雲端」建立第一份資料
7. 其他裝置輸入相同 URL、Anon Key、Workspace Key，即可從雲端下載

注意：Workspace Key 等同同步密碼，請勿公開。

V6 補助規則：ROAS 達 3.5 倍固定補助 50%，不疊加配合度；未達 3.5 倍才依三項條件計算，最高 40%。

V6：移除側欄「廣告費」入口；ROAS 達 3.5 倍時固定補助 50%，三項配合度按鈕自動清空並鎖定，無需填寫。


V7.3 新增：左側「流量型補助」，依實業績 15/20/25/30 萬自動補助 20/30/40/50%。
