# 時光書廊 (初版)

極簡寫作平台，技術基礎為 React + Supabase（Auth + Database），可直接部署到 Render。

## 已完成模組

- Google 登入（Supabase Auth）
- 權限導向：未登入可看首頁與探索頁；登入後可進入寫作頁
- 寫作編輯器：標題 + 內文
- 草稿自動儲存（雲端 upsert）
- 發佈文章到探索頁

## 前端設定

1. 安裝依賴

```bash
cd frontend
npm install
```

2. 建立環境變數

- 複製 `frontend/.env.local.example` 成 `frontend/.env.local`
- 填入 Supabase 專案資訊

3. 啟動開發

```bash
npm run dev
```

## Supabase 設定

1. 到 SQL Editor 執行 `supabase/schema.sql`
2. Auth > Providers 啟用 Google
3. Auth > URL Configuration 設定：
   - Site URL: `https://my-awesome-site-test1.onrender.com/`
   - Redirect URLs: `https://my-awesome-site-test1.onrender.com/`

## 目前路由

- `/` 首頁
- `/explore` 探索作品（公開）
- `/write` 開始寫作（需登入）
