# PostgreSQL Persistence

Personal AI Team 的長期資料層以 PostgreSQL 為核心。`schema.sql` 是第一版資料模型。

## 設計原則

- Conversation 是原始對話歷史，不直接等於 Memory。
- Work Record 是 Manager 對對話做分類後的可追蹤工作紀錄。
- Memory 分成 episodic / semantic / procedural / preference / problem / decision / pattern。
- Memory 必須帶 domain scope：`global`、`work`、`study`，必要時再綁定 project/task。
- `source` 與 `confidence` 用來避免一次觀察就變成永久偏好。
- Focus Session 與 Google Calendar Event 都是可被 Diagnosis / Adaptive Planning 使用的歷史資料。
- Google Calendar 第一階段以 read/sync 為主，不自動寫回行事曆。

## 建議部署

可直接部署到 Supabase / Neon 等 PostgreSQL 服務。正式環境請透過環境變數提供資料庫連線資訊，不要把密碼寫進 repo。

## 下一步

1. 建立 server-side PostgreSQL client。
2. 建立 conversations / work_records / memories / focus_sessions / calendar_events API。
3. 將前端 localStorage Focus 與 Chat 歷史逐步同步到 DB，保留離線 fallback。
4. 建立 scoped memory retrieval：Manager 讀 global + relevant scope；Work / Study Agent 僅讀各自 domain 與相關 project/task。
5. 加入 Google OAuth 與 Calendar incremental sync。
