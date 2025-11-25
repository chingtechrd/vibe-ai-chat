# Claude AI Chat

一個使用 FastAPI + Vanilla JavaScript 建立的即時串流對話 Web 應用程式，後端透過 `claude` CLI 與 Claude AI 互動。

## 功能特色

- ✨ 即時串流回應（類似 ChatGPT 的打字效果）
- 💬 多輪對話支援（自動維護 session）
- 🎨 現代化聊天介面
- 🚀 FastAPI 高效能後端
- 📦 使用 `uv` 進行快速套件管理
- 🔄 Server-Sent Events (SSE) 即時通訊

## 專案結構

```
vibe-ai-chat/
├── backend/              # FastAPI 後端
│   ├── main.py          # FastAPI 主程式
│   ├── claude_client.py # Claude CLI 整合
│   ├── pyproject.toml   # uv 專案配置
│   └── .python-version  # Python 版本
├── frontend/            # 前端介面
│   ├── index.html       # 聊天介面
│   ├── style.css        # UI 樣式
│   └── app.js           # 前端邏輯
├── .gitignore
└── README.md
```

## 系統需求

- Python 3.10+
- [uv](https://github.com/astral-sh/uv) - Python 套件管理工具
- [Claude CLI](https://github.com/anthropics/claude-code) - Anthropic 官方 CLI
- 現代瀏覽器（支援 EventSource API）

## 安裝步驟

### 1. 安裝 Claude CLI

```bash
# 請參考官方文件安裝 Claude CLI
# https://github.com/anthropics/claude-code
```

### 2. 安裝 uv（如果還沒安裝）

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# 或使用 pip
pip install uv
```

### 3. 安裝後端依賴

```bash
cd backend
uv sync
```

## 使用方法

### 啟動後端伺服器

```bash
cd backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

伺服器將在 `http://localhost:8000` 啟動。

### 開啟前端介面

在瀏覽器中開啟：

```bash
cd frontend
# 使用任何 HTTP 伺服器，例如：
python -m http.server 8080
```

然後訪問 `http://localhost:8080`

或者直接在瀏覽器中開啟 `frontend/index.html` 檔案。

## API 文件

後端啟動後，可以訪問：

- API 文件：`http://localhost:8000/docs`
- ReDoc 文件：`http://localhost:8000/redoc`

### 主要 API 端點

#### POST /api/chat
建立或繼續對話

**請求：**
```json
{
  "message": "你好，Claude！",
  "session_id": "可選的 session ID"
}
```

**回應：**
```json
{
  "session_id": "生成的或提供的 session ID",
  "message": "對話已建立..."
}
```

#### GET /api/stream/{session_id}
串流接收 Claude 的回應（SSE）

**參數：**
- `session_id`: 對話 session ID
- `message`: 使用者問題（query parameter）

**回應格式：** Server-Sent Events

## 技術架構

### 後端
- **FastAPI**: 高效能 Web 框架
- **uvicorn**: ASGI 伺服器
- **subprocess**: 呼叫 `claude` CLI
- **uv**: 快速套件管理

### 前端
- **Vanilla JavaScript**: 無框架依賴
- **EventSource API**: 接收 SSE 串流
- **CSS3**: 現代化 UI 設計

### 通訊流程

```
使用者輸入 → 前端 POST → FastAPI → claude CLI → SSE 串流 → 前端顯示
```

## 開發說明

### 修改後端

後端程式碼位於 `backend/` 目錄：

- `main.py`: FastAPI 路由和端點
- `claude_client.py`: Claude CLI 整合邏輯

修改後，uvicorn 會自動重載（如果使用 `--reload` 參數）。

### 修改前端

前端檔案位於 `frontend/` 目錄，直接編輯 HTML/CSS/JS 即可，重新整理瀏覽器查看變更。

## 常見問題

### Q: Claude CLI 找不到？
A: 確保 `claude` 命令在系統 PATH 中，可以執行 `claude --version` 檢查。

### Q: CORS 錯誤？
A: 確保後端 CORS 設定正確，或使用 HTTP 伺服器（而非直接開啟 HTML 檔案）。

### Q: 串流中斷？
A: 檢查後端日誌，確保 `claude` CLI 正常執行。

## 授權

MIT License

## 貢獻

歡迎提交 Issue 或 Pull Request！
