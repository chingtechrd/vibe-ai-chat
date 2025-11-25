// ==========================================================================
// Claude AI Chat - 前端應用程式
// ==========================================================================

// API 基礎 URL（使用相對路徑）
const API_BASE_URL = '';

// ==========================================================================
// Markdown 渲染器
// ==========================================================================
const MarkdownRenderer = {
    init() {
        // 設定 marked 選項
        marked.setOptions({
            breaks: true,
            gfm: true,
            highlight: (code, lang) => {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (e) {
                        console.error('Highlight error:', e);
                    }
                }
                return hljs.highlightAuto(code).value;
            }
        });

        // 自訂程式碼區塊渲染
        const renderer = new marked.Renderer();
        const originalCode = renderer.code.bind(renderer);

        renderer.code = ({text, lang}) => {
            const code = text;
            const validLang = lang || 'plaintext';
            let highlighted;
            try {
                highlighted = hljs.getLanguage(validLang)
                    ? hljs.highlight(code, { language: validLang }).value
                    : hljs.highlightAuto(code).value;
            } catch (e) {
                highlighted = this.escapeHtml(code);
            }

            return `
                <div class="code-block">
                    <div class="code-header">
                        <span class="code-language">${validLang}</span>
                        <button class="copy-code-btn" onclick="MessageOperations.copyCode(this, \`${this.escapeForAttr(code)}\`)">
                            <svg><use href="#icon-copy"/></svg>
                            <span>複製</span>
                        </button>
                    </div>
                    <pre><code class="hljs language-${validLang}">${highlighted}</code></pre>
                </div>
            `;
        };

        marked.use({ renderer });
    },

    render(text) {
        if (!text) return '';
        try {
            const html = marked.parse(text);
            return DOMPurify.sanitize(html, {
                ADD_ATTR: ['onclick'],
                ADD_TAGS: ['use']
            });
        } catch (e) {
            console.error('Markdown parse error:', e);
            return this.escapeHtml(text);
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    escapeForAttr(text) {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$');
    }
};

// ==========================================================================
// 打字機效果
// ==========================================================================
class TypewriterEffect {
    constructor(element, options = {}) {
        this.element = element;
        this.speed = options.speed || 15;
        this.buffer = '';
        this.displayedLength = 0;
        this.isTyping = false;
        this.animationFrame = null;
        this.lastRenderTime = 0;
        this.onUpdate = options.onUpdate || (() => {});
    }

    addText(text) {
        this.buffer += text;
        if (!this.isTyping) {
            this.startTyping();
        }
    }

    startTyping() {
        this.isTyping = true;
        this.lastRenderTime = performance.now();
        this.tick();
    }

    tick() {
        const now = performance.now();
        const elapsed = now - this.lastRenderTime;

        if (this.displayedLength < this.buffer.length) {
            // 計算應該顯示多少字元
            const charsToAdd = Math.max(1, Math.floor(elapsed / this.speed));
            const newLength = Math.min(this.displayedLength + charsToAdd, this.buffer.length);

            if (newLength > this.displayedLength) {
                this.displayedLength = newLength;
                this.renderContent();
                this.lastRenderTime = now;
            }
        }

        // 繼續動畫
        if (this.displayedLength < this.buffer.length || this.isTyping) {
            this.animationFrame = requestAnimationFrame(() => this.tick());
        }
    }

    renderContent() {
        const visibleText = this.buffer.substring(0, this.displayedLength);

        // 檢查是否有未關閉的程式碼區塊
        const codeBlockCount = (visibleText.match(/```/g) || []).length;
        const hasUnclosedBlock = codeBlockCount % 2 !== 0;

        if (hasUnclosedBlock) {
            // 暫時關閉程式碼區塊以便渲染
            const rendered = MarkdownRenderer.render(visibleText + '\n```');
            this.element.innerHTML = rendered;
        } else {
            this.element.innerHTML = MarkdownRenderer.render(visibleText);
        }

        // 添加游標
        this.addCursor();
        this.onUpdate(visibleText);
    }

    addCursor() {
        // 移除現有游標
        this.element.querySelectorAll('.typing-cursor').forEach(c => c.remove());

        // 在最後添加游標
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';
        cursor.textContent = '|';
        this.element.appendChild(cursor);
    }

    finish() {
        this.isTyping = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        // 立即顯示所有內容
        this.displayedLength = this.buffer.length;
        this.element.innerHTML = MarkdownRenderer.render(this.buffer);

        // 移除游標
        this.element.querySelectorAll('.typing-cursor').forEach(c => c.remove());
    }

    getFullText() {
        return this.buffer;
    }
}

// ==========================================================================
// 訊息操作
// ==========================================================================
const MessageOperations = {
    async copy(messageElement) {
        const rawContent = messageElement.dataset.rawContent;
        const content = rawContent || messageElement.querySelector('.message-content').textContent;

        try {
            await navigator.clipboard.writeText(content);
            this.showCopyFeedback(messageElement.querySelector('[data-action="copy"]'));
        } catch (err) {
            console.error('複製失敗:', err);
        }
    },

    async copyCode(button, code) {
        try {
            // 解碼轉義的字元
            const decodedCode = code
                .replace(/\\`/g, '`')
                .replace(/\\\$/g, '$')
                .replace(/\\\\/g, '\\');

            await navigator.clipboard.writeText(decodedCode);
            this.showCopyFeedback(button);
        } catch (err) {
            console.error('複製程式碼失敗:', err);
        }
    },

    showCopyFeedback(button) {
        if (!button) return;

        button.classList.add('copied');
        const originalText = button.querySelector('span');
        if (originalText) {
            const original = originalText.textContent;
            originalText.textContent = '已複製';
            setTimeout(() => {
                button.classList.remove('copied');
                originalText.textContent = original;
            }, 2000);
        }
    },

    edit(messageElement) {
        const rawContent = messageElement.dataset.rawContent;
        const contentEl = messageElement.querySelector('.message-content');

        messageElement.classList.add('editing');

        // 創建編輯區域
        const editArea = document.createElement('div');
        editArea.className = 'edit-area';
        editArea.innerHTML = `
            <textarea class="edit-textarea">${this.escapeHtml(rawContent || contentEl.textContent)}</textarea>
            <div class="edit-actions">
                <button class="btn btn--secondary" data-edit-action="cancel">取消</button>
                <button class="btn btn--primary" data-edit-action="save">儲存並重新發送</button>
            </div>
        `;

        messageElement.appendChild(editArea);

        const textarea = editArea.querySelector('.edit-textarea');
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        // 處理編輯動作
        editArea.addEventListener('click', async (e) => {
            const action = e.target.dataset.editAction;
            if (action === 'cancel') {
                messageElement.classList.remove('editing');
                editArea.remove();
            } else if (action === 'save') {
                const newText = textarea.value.trim();
                if (newText && newText !== rawContent) {
                    // 移除此訊息之後的所有訊息
                    let nextSibling = messageElement.nextElementSibling;
                    while (nextSibling) {
                        const toRemove = nextSibling;
                        nextSibling = nextSibling.nextElementSibling;
                        toRemove.remove();
                    }

                    // 更新訊息內容
                    messageElement.classList.remove('editing');
                    editArea.remove();
                    messageElement.dataset.rawContent = newText;
                    contentEl.innerHTML = MarkdownRenderer.render(newText);

                    // 重新發送
                    await App.resendMessage(newText);
                } else {
                    messageElement.classList.remove('editing');
                    editArea.remove();
                }
            }
        });
    },

    async regenerate(messageElement) {
        // 找到前一則使用者訊息
        const userMessage = messageElement.previousElementSibling;
        if (!userMessage || !userMessage.classList.contains('message--user')) {
            console.error('找不到對應的使用者訊息');
            return;
        }

        const userText = userMessage.dataset.rawContent ||
            userMessage.querySelector('.message-content').textContent;

        // 刪除當前助手訊息
        messageElement.remove();

        // 重新發送
        await App.resendMessage(userText);
    },

    delete(messageElement) {
        messageElement.classList.add('deleting');
        setTimeout(() => {
            messageElement.remove();
        }, 250);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ==========================================================================
// 主應用程式
// ==========================================================================
const App = {
    // 狀態
    currentSessionId: null,
    currentEventSource: null,
    isStreaming: false,
    messageIdCounter: 0,

    // DOM 元素
    chatContainer: null,
    messageInput: null,
    chatForm: null,
    sendButton: null,
    statusText: null,
    newChatButton: null,

    init() {
        // 取得 DOM 元素
        this.chatContainer = document.getElementById('chatContainer');
        this.messageInput = document.getElementById('messageInput');
        this.chatForm = document.getElementById('chatForm');
        this.sendButton = document.getElementById('sendButton');
        this.statusText = document.getElementById('statusText');
        this.newChatButton = document.getElementById('newChatButton');

        // 初始化 Markdown 渲染器
        MarkdownRenderer.init();

        // 綁定事件
        this.chatForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.newChatButton.addEventListener('click', () => this.startNewChat());
        this.messageInput.addEventListener('input', () => this.autoResize());

        // Enter 發送，Shift+Enter 換行
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.chatForm.dispatchEvent(new Event('submit'));
            }
        });

        // 訊息操作事件委派
        this.chatContainer.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (!actionBtn) return;

            const message = actionBtn.closest('.message');
            const action = actionBtn.dataset.action;

            switch (action) {
                case 'copy':
                    MessageOperations.copy(message);
                    break;
                case 'edit':
                    MessageOperations.edit(message);
                    break;
                case 'regenerate':
                    MessageOperations.regenerate(message);
                    break;
                case 'delete':
                    MessageOperations.delete(message);
                    break;
            }
        });

        this.updateStatus('準備就緒');
    },

    async handleSubmit(e) {
        e.preventDefault();

        const message = this.messageInput.value.trim();
        if (!message || this.isStreaming) return;

        // 清空輸入
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';

        // 移除歡迎訊息
        const welcome = this.chatContainer.querySelector('.welcome-message');
        if (welcome) welcome.remove();

        // 顯示使用者訊息
        this.addMessage('user', message);

        // 發送請求
        await this.sendMessage(message);
    },

    async sendMessage(message) {
        this.setInputEnabled(false);
        this.updateStatus('正在發送...', true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    session_id: this.currentSessionId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.currentSessionId = data.session_id;

            // 開始接收串流
            this.streamResponse(this.currentSessionId, message);

        } catch (error) {
            console.error('發送失敗:', error);
            this.addMessage('assistant', `錯誤：${error.message}`);
            this.setInputEnabled(true);
            this.updateStatus('發送失敗');
        }
    },

    async resendMessage(message) {
        await this.sendMessage(message);
    },

    streamResponse(sessionId, message) {
        this.isStreaming = true;
        this.updateStatus('Claude 正在思考...', true);

        const url = `${API_BASE_URL}/api/stream/${sessionId}?message=${encodeURIComponent(message)}`;
        this.currentEventSource = new EventSource(url);

        // 創建助手訊息
        const messageElement = this.addMessage('assistant', '', true);
        const contentElement = messageElement.querySelector('.message-content');

        // 創建打字機效果
        const typewriter = new TypewriterEffect(contentElement, {
            speed: 12,
            onUpdate: () => this.scrollToBottom()
        });

        this.currentEventSource.onmessage = (event) => {
            const data = event.data;

            if (data === '[DONE]') {
                typewriter.finish();
                messageElement.dataset.rawContent = typewriter.getFullText();
                this.currentEventSource.close();
                this.isStreaming = false;
                this.setInputEnabled(true);
                this.updateStatus('準備就緒');
                this.messageInput.focus();
                return;
            }

            try {
                const parsed = JSON.parse(data);

                if (parsed.error) {
                    contentElement.innerHTML = `<p style="color: var(--error)">錯誤：${parsed.error}</p>`;
                    typewriter.finish();
                    this.currentEventSource.close();
                    this.isStreaming = false;
                    this.setInputEnabled(true);
                    this.updateStatus('發生錯誤');
                    return;
                }

                // 處理串流事件
                if (parsed.type === 'stream_event') {
                    const evt = parsed.event;
                    if (evt?.type === 'content_block_delta' && evt?.delta?.type === 'text_delta') {
                        typewriter.addText(evt.delta.text);
                    }
                } else if (parsed.type === 'assistant') {
                    // 完整訊息（備用）
                    if (parsed.message?.content?.[0]?.text && typewriter.buffer === '') {
                        typewriter.addText(parsed.message.content[0].text);
                    }
                } else if (parsed.type === 'result') {
                    // 結果訊息（備用）
                    if (parsed.result && typewriter.buffer === '') {
                        typewriter.addText(parsed.result);
                    }
                }

            } catch (error) {
                console.error('解析錯誤:', error, data);
            }
        };

        this.currentEventSource.onerror = (error) => {
            console.error('EventSource 錯誤:', error);
            typewriter.finish();

            if (typewriter.buffer === '') {
                contentElement.innerHTML = '<p style="color: var(--error)">連線錯誤，請稍後再試</p>';
            }

            this.currentEventSource.close();
            this.isStreaming = false;
            this.setInputEnabled(true);
            this.updateStatus('連線錯誤');
        };
    },

    addMessage(role, content, isStreaming = false) {
        const messageId = `msg-${++this.messageIdCounter}`;
        const isUser = role === 'user';
        const roleClass = isUser ? 'message--user' : 'message--assistant';

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${roleClass}`;
        messageDiv.dataset.id = messageId;
        messageDiv.dataset.rawContent = content;

        // 訊息頭部
        const header = document.createElement('div');
        header.className = 'message-header';
        header.innerHTML = `<span class="message-role">${isUser ? 'You' : 'Claude'}</span>`;

        // 訊息內容
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        if (!isStreaming && content) {
            contentDiv.innerHTML = MarkdownRenderer.render(content);
        }

        // 操作按鈕
        const actions = document.createElement('div');
        actions.className = 'message-actions';

        if (isUser) {
            actions.innerHTML = `
                <button class="action-btn" data-action="copy">
                    <svg><use href="#icon-copy"/></svg>
                    <span>複製</span>
                </button>
                <button class="action-btn" data-action="edit">
                    <svg><use href="#icon-edit"/></svg>
                    <span>編輯</span>
                </button>
                <button class="action-btn action-btn--danger" data-action="delete">
                    <svg><use href="#icon-trash"/></svg>
                    <span>刪除</span>
                </button>
            `;
        } else {
            actions.innerHTML = `
                <button class="action-btn" data-action="copy">
                    <svg><use href="#icon-copy"/></svg>
                    <span>複製</span>
                </button>
                <button class="action-btn" data-action="regenerate">
                    <svg><use href="#icon-refresh"/></svg>
                    <span>重新生成</span>
                </button>
                <button class="action-btn action-btn--danger" data-action="delete">
                    <svg><use href="#icon-trash"/></svg>
                    <span>刪除</span>
                </button>
            `;
        }

        messageDiv.appendChild(header);
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(actions);
        this.chatContainer.appendChild(messageDiv);

        this.scrollToBottom();
        return messageDiv;
    },

    scrollToBottom() {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    },

    updateStatus(text, streaming = false) {
        this.statusText.textContent = text;
        this.statusText.classList.toggle('streaming', streaming);
    },

    setInputEnabled(enabled) {
        this.messageInput.disabled = !enabled;
        this.sendButton.disabled = !enabled;
    },

    autoResize() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = this.messageInput.scrollHeight + 'px';
    },

    async startNewChat() {
        if (this.isStreaming) {
            if (!confirm('正在進行對話中，確定要開始新對話嗎？')) {
                return;
            }

            if (this.currentEventSource) {
                this.currentEventSource.close();
            }
            this.isStreaming = false;
            this.setInputEnabled(true);
        }

        // 刪除後端 session
        if (this.currentSessionId) {
            try {
                await fetch(`${API_BASE_URL}/api/sessions/${this.currentSessionId}`, {
                    method: 'DELETE'
                });
            } catch (error) {
                console.error('刪除 session 失敗:', error);
            }
        }

        this.currentSessionId = null;

        // 重置畫面
        this.chatContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                        <line x1="9" y1="9" x2="9.01" y2="9"/>
                        <line x1="15" y1="9" x2="15.01" y2="9"/>
                    </svg>
                </div>
                <h2>嗨，有什麼我可以幫忙的嗎？</h2>
                <p>輸入訊息開始對話</p>
            </div>
        `;

        this.updateStatus('準備就緒');
        this.messageInput.focus();
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => App.init());
