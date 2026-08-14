# 畫畫猜 AI

適合教室與聚會的手機／桌面繪圖遊戲。玩家加入最多 6 人的房間，由房主出題，限時三分鐘作畫，再由視覺模型評分與排名。

## 本機啟動

```bash
npm install
npm run dev
```

若尚未設定 API 金鑰，作品會停在等待頁並提示管理員設定；系統不會產生假的 AI 分數。

## 部署到 Vercel

1. 將此資料夾推送到 GitHub。
2. 在 Vercel 匯入 repository；Framework Preset 選 `Vite`。
3. 加入伺服器端環境變數 `OPENAI_API_KEY`。
4. 可選擇加入 `OPENAI_VISION_MODEL`；預設為支援圖片與結構化輸出的 `gpt-4o-mini`。
5. 加入 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`，讓不同裝置共用房間。
6. 部署後，`/api/score` 會用 OpenAI Responses API 的圖片輸入與結構化輸出評分。

請勿將 `OPENAI_API_KEY` 加上 `VITE_` 前綴，否則會被打包到瀏覽器。

## 設定跨裝置多人房間

1. 在 Supabase 建立一個 Project。
2. 開啟 **SQL Editor**，將 `supabase/schema.sql` 全部貼上並執行。這會建立房間資料表、最多 6 人的原子加入函式、房主驗證、RLS 與 Realtime publication。
   - 如果先前已經執行過舊版 `schema.sql`，改執行 `supabase/multiplayer_results.sql`，加入多人交卷、等待全員與排名同步功能。
3. 在 Supabase 的 **Project Settings → API** 複製 Project URL 與 anon public key。
4. 到 Vercel 專案的 **Settings → Environment Variables** 新增：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. 在 Vercel 重新 Deploy。

設定完成後，公開房間、玩家加入、房主開始與公布題目會透過 Supabase Realtime 在電腦和手機同步。房間會在建立 6 小時後停止顯示。沒有設定 Supabase 時不會顯示任何假房間，並會在大廳提示尚未設定多人服務。

視覺概念稿保存在 `design/ui-concept.png`。
