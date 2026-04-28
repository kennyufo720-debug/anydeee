# TREEGEN 代代樹 — 部署說明

## 📁 檔案結構

```
TREEGEN/
└── treegen.html    ← 完整網站（單一檔案，無需其他依賴）
```

## 🚀 上架方式（任選一種）

### 方式一：Netlify（最快，免費）
1. 前往 https://app.netlify.com/drop
2. 將 `treegen.html` 改名為 `index.html`
3. 直接拖曳 `index.html` 到網頁上傳區
4. 取得免費網址，立即上線 ✅

### 方式二：GitHub Pages（免費）
1. 建立新 GitHub Repository
2. 上傳 `treegen.html`，改名為 `index.html`
3. 進入 Settings → Pages → 選 `main` branch → Save
4. 約 1 分鐘後取得 `https://yourusername.github.io/repo名稱` ✅

### 方式三：Vercel（免費）
1. 前往 https://vercel.com
2. 建立新專案，上傳 `index.html`
3. 自動部署，取得 `https://xxx.vercel.app` ✅

### 方式四：自有主機 / cPanel
1. 將 `treegen.html` 改名為 `index.html`
2. 上傳到主機的 `public_html/` 或 `www/` 資料夾
3. 完成 ✅

### 方式五：本地測試
```bash
# 需要 Python 3
python3 -m http.server 8080
# 瀏覽器開啟 http://localhost:8080/treegen.html
```

---

## ⚙️ 後台管理

- 點擊頁面**右側中間**的「後台 ⚙」按鈕開啟管理面板
- 可即時修改：**顏色、字體大小、圖片、所有文字**
- 點「儲存所有變更」後，設定存入瀏覽器 localStorage，重新整理仍保留
- 「匯出」可下載 JSON 設定備份

---

## 🌐 外部依賴（需要網路）

| 資源 | 來源 | 用途 |
|------|------|------|
| Noto Sans TC / Inter | Google Fonts | 字體 |
| RemixIcon 4.5.0 | cdnjs.cloudflare.com | 圖示 |
| 背景/服務/團隊圖片 | Unsplash | 圖片 |
| IP 地理位置 | ipapi.co | IP 顯示徽章 |

> ⚠️ 若要離線使用，請將圖片下載到本地並修改 `<img src>` 路徑。

---

## 📋 頁面結構

- **Hero** — 全螢幕森林背景 + 主標語
- **統計列** — 50,000+ 公頃、120+ 夥伴、8 據點、4 認證
- **品牌理念** — 技術需求、跨域專業、維運能力
- **產業挑戰** — 6 張挑戰卡片
- **TREE AI 核心技術** — 深綠背景區塊 + 5 技術卡 + AI 說明
- **三大服務** — SAF 解方、柚木生產、林業代工
- **CTA Banner** — 行動號召
- **關於我們** — 三大支柱 + 四大核心價值
- **為什麼選擇 TREEGEN** — 4 使命卡片
- **核心團隊** — 3 位成員
- **聯絡表單** — 含成功送出狀態
- **Footer** — 連結 + 版權

---

製作：Claude Code  
日期：2026-04-28
