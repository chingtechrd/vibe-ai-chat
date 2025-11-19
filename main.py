"""FastAPI 主程式，處理前端請求並整合 Claude CLI"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import uuid

from claude_client import ClaudeClient


# 建立 FastAPI 應用程式
app = FastAPI(
    title="Claude AI Chat API",
    description="使用 Claude CLI 的即時串流對話 API",
    version="1.0.0"
)

# 設定 CORS，允許前端存取
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生產環境應該限制特定來源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化 Claude 客戶端
claude_client = ClaudeClient()

# 記憶體儲存 session 資訊
sessions = {}


class ChatRequest(BaseModel):
    """聊天請求模型"""
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    """聊天回應模型"""
    session_id: str
    message: str


@app.get("/")
async def root():
    """API 根路徑"""
    return {
        "message": "Claude AI Chat API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.post("/api/chat", response_model=ChatResponse)
async def create_chat(request: ChatRequest):
    """
    建立或繼續對話

    Args:
        request: 包含使用者訊息和可選的 session_id

    Returns:
        包含 session_id 的回應（用於後續串流）
    """
    # 如果沒有提供 session_id，生成新的
    session_id = request.session_id or str(uuid.uuid4())

    # 儲存 session 資訊
    if session_id not in sessions:
        sessions[session_id] = {
            "messages": []
        }

    # 記錄使用者訊息
    sessions[session_id]["messages"].append({
        "role": "user",
        "content": request.message
    })

    return ChatResponse(
        session_id=session_id,
        message="對話已建立，請使用 /api/stream/{session_id} 接收回應"
    )


@app.get("/api/stream/{session_id}")
async def stream_chat(session_id: str, message: str):
    """
    使用 Server-Sent Events (SSE) 串流 Claude 的回應

    Args:
        session_id: 對話 session ID
        message: 使用者的問題

    Returns:
        SSE 串流回應
    """
    print(f"[DEBUG] 收到串流請求: session_id={session_id}, message={message}")

    async def event_generator():
        """生成 SSE 事件"""
        import json
        print(f"[DEBUG] 開始生成 SSE 事件")
        try:
            # 使用 Claude 客戶端串流回應
            print(f"[DEBUG] 呼叫 claude_client.stream_response")
            async for chunk in claude_client.stream_response(message, session_id):
                print(f"[DEBUG] 收到 chunk: {chunk}")
                # 檢查是否有錯誤
                if "error" in chunk:
                    yield f"data: {json.dumps({'error': chunk['error']})}\n\n"
                    break

                # 提取實際的資料
                data = chunk.get("data", {})

                # 轉換為 SSE 格式
                yield f"data: {json.dumps(data)}\n\n"

            # 發送結束訊號
            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    # 回傳 SSE 串流
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.get("/api/sessions")
async def list_sessions():
    """列出所有 session"""
    return {
        "sessions": list(sessions.keys()),
        "count": len(sessions)
    }


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """刪除指定的 session"""
    if session_id in sessions:
        del sessions[session_id]
        # 同時從 Claude 客戶端的追蹤中移除
        claude_client.reset_session(session_id)
        return {"message": f"Session {session_id} 已刪除"}
    return {"error": "Session 不存在"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
