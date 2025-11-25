// API 基礎 URL（使用相對路徑，因為前後端由同一伺服器提供）
const API_BASE_URL = '';

// 全域變數
let currentSessionId = null;
let currentEventSource = null;
let isStreaming = false;

// DOM 元素
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const chatForm = document.getElementById('chatForm');
const sendButton = document.getElementById('sendButton');
const statusText = document.getElementById('statusText');
const newChatButton = document.getElementById('newChatButton');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 綁定事件
    chatForm.addEventListener('submit', handleSubmit);
    newChatButton.addEventListener('click', startNewChat);

    // 自動調整 textarea 高度
    messageInput.addEventListener('input', autoResize);

    // Enter 鍵發送，Shift+Enter 換行
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });

    updateStatus('準備就緒');
});

// 處理表單提交
async function handleSubmit(e) {
    e.preventDefault();

    const message = messageInput.value.trim();
    if (!message || isStreaming) return;

    // 清空輸入框
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // 如果是第一則訊息，移除歡迎訊息
    const welcomeMessage = chatContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    // 顯示使用者訊息
    addMessage('user', message);

    // 禁用輸入
    setInputEnabled(false);
    updateStatus('正在發送...');

    try {
        // 發送訊息到後端
        console.log('[DEBUG] 發送訊息:', message, 'session_id:', currentSessionId);

        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                session_id: currentSessionId
            })
        });

        console.log('[DEBUG] API 回應狀態:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[DEBUG] API 回應資料:', data);

        currentSessionId = data.session_id;

        // 開始接收串流回應
        streamResponse(currentSessionId, message);

    } catch (error) {
        console.error('發送訊息失敗:', error);
        addMessage('assistant', `錯誤：${error.message}`);
        setInputEnabled(true);
        updateStatus('發送失敗');
    }
}

// 使用 EventSource 接收串流回應
function streamResponse(sessionId, message) {
    isStreaming = true;
    updateStatus('Claude 正在思考...');

    // 建立 EventSource
    const url = `${API_BASE_URL}/api/stream/${sessionId}?message=${encodeURIComponent(message)}`;
    console.log('[DEBUG] 建立 EventSource:', url);
    currentEventSource = new EventSource(url);

    // 建立訊息容器
    const messageElement = addMessage('assistant', '');
    const contentElement = messageElement.querySelector('.message-content');

    // 添加打字游標
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    contentElement.appendChild(cursor);

    let fullText = '';

    // 監聽訊息事件
    currentEventSource.onmessage = (event) => {
        const data = event.data;

        console.log('[DEBUG] 收到 SSE 訊息:', data);

        // 檢查是否結束
        if (data === '[DONE]') {
            console.log('[DEBUG] 串流結束');
            currentEventSource.close();
            isStreaming = false;
            cursor.remove();
            setInputEnabled(true);
            updateStatus('準備就緒');
            messageInput.focus();
            return;
        }

        try {
            const parsed = JSON.parse(data);
            console.log('[DEBUG] 解析後的資料:', parsed);

            // 檢查錯誤
            if (parsed.error) {
                console.error('[ERROR] 收到錯誤:', parsed.error);
                contentElement.textContent = `錯誤：${parsed.error}`;
                cursor.remove();
                currentEventSource.close();
                isStreaming = false;
                setInputEnabled(true);
                updateStatus('發生錯誤');
                return;
            }

            // 處理 Claude CLI 的訊息格式
            if (parsed.type === 'stream_event') {
                // 新的串流格式：事件包在 event 裡面
                const event = parsed.event;
                if (event && event.type === 'content_block_delta') {
                    console.log('[DEBUG] stream_event content_block_delta:', event.delta);
                    const delta = event.delta;
                    if (delta && delta.type === 'text_delta') {
                        fullText += delta.text;
                        contentElement.textContent = fullText;
                        contentElement.appendChild(cursor);
                        scrollToBottom();
                    }
                }
            } else if (parsed.type === 'assistant') {
                // Claude CLI 格式：完整訊息（備用，不覆蓋已有的串流文字）
                console.log('[DEBUG] assistant 訊息:', parsed.message);
                if (parsed.message && parsed.message.content && parsed.message.content.length > 0) {
                    const content = parsed.message.content[0];
                    if (content.type === 'text' && content.text && !fullText) {
                        fullText = content.text;
                        contentElement.textContent = fullText;
                        contentElement.appendChild(cursor);
                        scrollToBottom();
                    }
                }
            } else if (parsed.type === 'result') {
                // 結果訊息（備用，不覆蓋已有的串流文字）
                console.log('[DEBUG] result 訊息:', parsed.result);
                if (parsed.result && !fullText) {
                    fullText = parsed.result;
                    contentElement.textContent = fullText;
                    contentElement.appendChild(cursor);
                    scrollToBottom();
                }
            } else if (parsed.type === 'system') {
                console.log('[DEBUG] 系統初始化訊息');
            } else if (parsed.type === 'content_block_delta') {
                // 標準 Anthropic API 串流格式（備用）
                console.log('[DEBUG] content_block_delta:', parsed.delta);
                const delta = parsed.delta;
                if (delta && delta.type === 'text_delta') {
                    fullText += delta.text;
                    contentElement.textContent = fullText;
                    contentElement.appendChild(cursor);
                    scrollToBottom();
                }
            } else {
                console.log('[DEBUG] 未知類型:', parsed.type, parsed);
            }

        } catch (error) {
            console.error('[ERROR] 解析串流資料失敗:', error, data);
        }
    };

    // 監聽錯誤事件
    currentEventSource.onerror = (error) => {
        console.error('EventSource 錯誤:', error);
        cursor.remove();

        if (fullText === '') {
            contentElement.textContent = '連線錯誤，請稍後再試';
        }

        currentEventSource.close();
        isStreaming = false;
        setInputEnabled(true);
        updateStatus('連線錯誤');
    };
}

// 添加訊息到聊天容器
function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const header = document.createElement('div');
    header.className = 'message-header';
    header.textContent = role === 'user' ? '你' : 'Claude';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;

    messageDiv.appendChild(header);
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);

    scrollToBottom();

    return messageDiv;
}

// 滾動到底部
function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 更新狀態文字
function updateStatus(text) {
    statusText.textContent = text;
}

// 設定輸入框啟用/禁用
function setInputEnabled(enabled) {
    messageInput.disabled = !enabled;
    sendButton.disabled = !enabled;
}

// 自動調整 textarea 高度
function autoResize() {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
}

// 開始新對話
async function startNewChat() {
    if (isStreaming) {
        if (!confirm('正在進行對話中，確定要開始新對話嗎？')) {
            return;
        }

        // 關閉當前串流
        if (currentEventSource) {
            currentEventSource.close();
        }

        isStreaming = false;
        setInputEnabled(true);
    }

    // 如果有當前 session，從後端刪除
    if (currentSessionId) {
        try {
            await fetch(`${API_BASE_URL}/api/sessions/${currentSessionId}`, {
                method: 'DELETE'
            });
            console.log('[DEBUG] 已刪除舊 session:', currentSessionId);
        } catch (error) {
            console.error('[ERROR] 刪除 session 失敗:', error);
        }
    }

    // 重置 session
    currentSessionId = null;

    // 清空聊天記錄
    chatContainer.innerHTML = `
        <div class="welcome-message">
            <h2>歡迎使用 Claude AI Chat</h2>
            <p>開始提問吧！</p>
        </div>
    `;

    updateStatus('準備就緒');
    messageInput.focus();
}
