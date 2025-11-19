"""Claude CLI 整合模組，負責呼叫 claude 指令並處理串流輸出"""

import subprocess
import json
import uuid
from typing import AsyncGenerator, Optional


class ClaudeClient:
    """封裝 Claude CLI 呼叫邏輯"""

    def __init__(self):
        """初始化 Claude 客戶端"""
        # 追蹤已經使用過的 session（用於判斷是新對話還是繼續對話）
        self.used_sessions = set()

    def reset_session(self, session_id: str):
        """重置 session，允許以新對話方式重新使用同一個 session ID"""
        if session_id in self.used_sessions:
            self.used_sessions.remove(session_id)
            print(f"[DEBUG] 重置 session: {session_id}")

    async def stream_response(
        self,
        user_message: str,
        session_id: Optional[str] = None
    ) -> AsyncGenerator[dict, None]:
        """
        呼叫 claude CLI 並串流回應

        Args:
            user_message: 使用者的問題
            session_id: 對話 session ID（如果沒有會自動生成）

        Yields:
            包含串流內容的字典
        """
        # 如果沒有 session_id，生成新的 UUID
        if not session_id:
            session_id = str(uuid.uuid4())

        # 判斷是新對話還是繼續對話
        is_new_session = session_id not in self.used_sessions

        # 建構 claude 指令
        if is_new_session:
            # 新對話：使用 --session-id 創建
            cmd = [
                "claude",
                "--print",
                "--verbose",
                "--output-format", "stream-json",
                "--session-id", session_id,
                "--dangerously-skip-permissions",
                user_message
            ]
            # 標記為已使用
            self.used_sessions.add(session_id)
            print(f"[DEBUG] 創建新對話: session_id={session_id}")
        else:
            # 繼續對話：使用 --resume 參數
            cmd = [
                "claude",
                "--print",
                "--verbose",
                "--output-format", "stream-json",
                "--resume", session_id,
                "--dangerously-skip-permissions",
                user_message
            ]
            print(f"[DEBUG] 繼續現有對話: session_id={session_id}")

        print(f"[DEBUG] 執行指令: {' '.join(cmd)}")

        # 啟動 subprocess
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1  # 行緩衝
        )

        print(f"[DEBUG] Subprocess 已啟動, PID={process.pid}")

        try:
            # 逐行讀取輸出
            for line in process.stdout:
                line = line.strip()
                if not line:
                    continue

                # DEBUG: 印出原始輸出
                print(f"[DEBUG] 原始輸出: {line}")

                try:
                    # 解析 JSON 格式的串流資料
                    data = json.loads(line)

                    # DEBUG: 印出解析後的資料
                    print(f"[DEBUG] 解析成功: {data}")

                    # 只回傳有效的 Claude API 回應
                    # 忽略日誌訊息和其他非串流資料
                    if isinstance(data, dict):
                        print(f"[DEBUG] 回傳資料: type={data.get('type')}")
                        yield {
                            "session_id": session_id,
                            "data": data
                        }

                except json.JSONDecodeError as e:
                    # 如果不是有效的 JSON，可能是日誌訊息，略過
                    print(f"[DEBUG] JSON 解析失敗: {e} | 內容: {line}")
                    continue

            # 等待程序結束
            process.wait()

            # 檢查錯誤
            if process.returncode != 0:
                stderr = process.stderr.read()
                print(f"[ERROR] Claude CLI 失敗: returncode={process.returncode}, stderr={stderr}")
                yield {
                    "session_id": session_id,
                    "error": stderr or "Claude CLI 執行失敗"
                }
            else:
                print(f"[DEBUG] Claude CLI 正常結束")

        finally:
            # 確保程序被終止
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=5)
