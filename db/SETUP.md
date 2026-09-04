# Personal AI Team：資料庫與 Google Calendar 啟用

## 1. Supabase

在 Supabase SQL Editor 依序執行：

1. `db/schema.sql`
2. `db/migrations/002_app_data_sync.sql`

完成後會有 Projects、Tasks、Conversations、Memory、Calendar、Study Subjects、Today Blocks 等資料表。

## 2. Render 環境變數

在後端服務 `personal-ai-team` 設定：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI=https://personal-ai-team-1.onrender.com/api/calendar/oauth/callback`
- `FRONTEND_ORIGIN=https://312460040.github.io`

`SUPABASE_SERVICE_ROLE_KEY`、Google Secret 與 Gemini Key 絕對不要放進 GitHub Repo 或前端環境。

## 3. Google Cloud OAuth

在 Google Cloud Console 建立 OAuth Client（Web application），將下列網址加入 Authorized redirect URIs：

`https://personal-ai-team-1.onrender.com/api/calendar/oauth/callback`

Google OAuth scope 使用 Calendar：

`https://www.googleapis.com/auth/calendar`

## 4. 第一次啟動

前端開啟後會先檢查 `/api/persistence/health`。

- DB 未設定：繼續使用 localStorage，不宣稱已連線。
- DB 已設定但沒有資料：第一次會把既有 User Work / Study / Today 資料遷移到 Supabase。
- DB 已有資料：以 DB snapshot 為共享資料來源，再同步前端變更。

## 5. Calendar

首頁的「我的行事曆」會檢查 Google OAuth 連線狀態。完成授權後會同步 Calendar Events 到 `calendar_events`；Manager 排程會優先避開已同步的 Calendar 時段。

## 6. 驗證

在 Personal AI Team 的「資料庫」頁面確認 Projects / Tasks / Calendar / Study Subjects / Today Blocks 是否有資料。

若看到 `PERSISTENCE_NOT_CONFIGURED` 或 503，代表 Render 環境變數或 Supabase 尚未完成設定，而不是前端假裝已連線。
