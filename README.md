# 畫畫猜 AI

適合教室與聚會的手機／桌面繪圖遊戲。玩家加入最多 6 人的房間，由房主出題，限時三分鐘作畫，再由視覺模型評分與排名。

## 本機啟動

```bash
npm install
npm run dev
```

沒有 API 金鑰也能走完整個示範流程；AI 評分會使用友善的本機備援結果。

## 部署到 Vercel

1. 將此資料夾推送到 GitHub。
2. 在 Vercel 匯入 repository；Framework Preset 選 `Vite`。
3. 加入伺服器端環境變數 `OPENAI_API_KEY`。
4. 可選擇加入 `OPENAI_VISION_MODEL`；預設為 `gpt-5.6-luna`。
5. 部署後，`/api/score` 會用 OpenAI Responses API 的圖片輸入與結構化輸出評分。

請勿將 `OPENAI_API_KEY` 加上 `VITE_` 前綴，否則會被打包到瀏覽器。

## 目前多人模式

這個版本已提供房間代碼、QR Code、相機掃描、最多 6 人限制，以及同一瀏覽器多分頁的 BroadcastChannel 同步。跨裝置公開多人連線需要再接 Supabase Realtime、Firebase 或其他持久化服務；介面與遊戲狀態已拆分，可直接替換資料層。畫板、倒數、等待、AI 評分與排行榜皆可直接試玩。

視覺概念稿保存在 `design/ui-concept.png`。
