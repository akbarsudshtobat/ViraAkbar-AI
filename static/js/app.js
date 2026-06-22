/* ═══════════════════════════════════════════════════════════
   ViraAkbar.AI — Chat Frontend Logic
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    // ───────────── DOM References ─────────────
    const chatInput       = document.getElementById('chatInput');
    const btnSend         = document.getElementById('btnSend');
    const btnNewChat      = document.getElementById('btnNewChat');
    const messagesContainer = document.getElementById('messagesContainer');
    const welcomeScreen   = document.getElementById('welcomeScreen');
    const sidebar         = document.getElementById('sidebar');
    const sidebarOverlay  = document.getElementById('sidebarOverlay');
    const btnMenu         = document.getElementById('btnMenu');
    const statMessages    = document.getElementById('statMessages');
    const statPrompts     = document.getElementById('statPrompts');
    const welcomeCards    = document.querySelectorAll('.wc-card');

    let messageCount = 0;
    let promptCount  = 0;
    let isProcessing = false;
    let chatHistory  = [];

    // ───────────── Configure Marked.js ─────────────
    marked.setOptions({
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true,
        gfm: true,
    });

    // ───────────── Auto-resize Textarea ─────────────
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
        btnSend.disabled = chatInput.value.trim() === '' || isProcessing;
    });

    // ───────────── Keyboard Shortcuts ─────────────
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!btnSend.disabled) sendMessage();
        }
    });

    btnSend.addEventListener('click', sendMessage);

    // ───────────── Welcome Card Clicks ─────────────
    welcomeCards.forEach(card => {
        card.addEventListener('click', () => {
            const prompt = card.getAttribute('data-prompt');
            chatInput.value = prompt;
            chatInput.dispatchEvent(new Event('input'));
            sendMessage();
        });
    });

    // ───────────── New Chat ─────────────
    btnNewChat.addEventListener('click', async () => {
        try {
            await fetch('/api/new-chat', { method: 'POST' });
        } catch (e) { /* ignore */ }

        // Clear messages from DOM
        const msgRows = messagesContainer.querySelectorAll('.message-row');
        msgRows.forEach(row => row.remove());

        // Show welcome screen again
        if (welcomeScreen) welcomeScreen.style.display = 'flex';

        // Reset stats
        messageCount = 0;
        promptCount = 0;
        chatHistory = [];
        updateStats();

        // Close sidebar on mobile
        closeSidebar();
    });

    // ───────────── Mobile Sidebar Toggle ─────────────
    if (btnMenu) {
        btnMenu.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('active');
        });
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    }

    // ───────────── Update Stats ─────────────
    function updateStats() {
        statMessages.textContent = messageCount;
        statPrompts.textContent  = promptCount;
    }

    // ───────────── Scroll to Bottom ─────────────
    function scrollToBottom() {
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    // ───────────── Create Message Element ─────────────
    function createMessageElement(role, content) {
        const row = document.createElement('div');
        row.className = `message-row ${role}-row`;

        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        avatar.textContent = role === 'user' ? '👤' : '✨';

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';

        const msgContent = document.createElement('div');
        msgContent.className = 'msg-content';

        if (role === 'assistant') {
            // Render markdown for assistant
            msgContent.innerHTML = marked.parse(content);
            // Add copy buttons to code blocks
            addCopyButtons(msgContent);
        } else {
            // Plain text for user (escape HTML)
            msgContent.textContent = content;
        }

        bubble.appendChild(msgContent);
        row.appendChild(avatar);
        row.appendChild(bubble);

        return row;
    }

    // ───────────── Add Copy Buttons to Code ─────────────
    function addCopyButtons(container) {
        const preBlocks = container.querySelectorAll('pre');
        preBlocks.forEach(pre => {
            pre.style.position = 'relative';
            const btn = document.createElement('button');
            btn.className = 'code-copy-btn';
            btn.textContent = 'Copy';
            btn.addEventListener('click', () => {
                const code = pre.querySelector('code');
                navigator.clipboard.writeText(code.textContent).then(() => {
                    btn.textContent = 'Copied!';
                    setTimeout(() => btn.textContent = 'Copy', 2000);
                });
            });
            pre.appendChild(btn);
        });
    }

    // ───────────── Create Typing Indicator ─────────────
    function createTypingIndicator() {
        const row = document.createElement('div');
        row.className = 'message-row assistant-row';
        row.id = 'typingRow';

        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        avatar.textContent = '✨';

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';

        const typing = document.createElement('div');
        typing.className = 'typing-indicator';
        typing.innerHTML = '<span></span><span></span><span></span>';

        bubble.appendChild(typing);
        row.appendChild(avatar);
        row.appendChild(bubble);

        return row;
    }

    // ───────────── Send Message ─────────────
    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text || isProcessing) return;

        isProcessing = true;
        btnSend.disabled = true;

        // Hide welcome screen
        if (welcomeScreen) welcomeScreen.style.display = 'none';

        // Add user message
        const userMsg = createMessageElement('user', text);
        messagesContainer.appendChild(userMsg);
        messageCount++;
        promptCount++;
        updateStats();

        // Clear input
        chatInput.value = '';
        chatInput.style.height = 'auto';
        scrollToBottom();

        // Show typing indicator
        const typingEl = createTypingIndicator();
        messagesContainer.appendChild(typingEl);
        scrollToBottom();

        try {
            const payload = {
                message: text,
                history: chatHistory
            };
            
            // Simpan pesan user ke history untuk request berikutnya
            chatHistory.push({ role: 'user', text: text });

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            // Remove typing indicator
            typingEl.remove();

            if (data.error) {
                const errorMsg = createMessageElement('assistant', `⚠️ Error: ${data.error}`);
                messagesContainer.appendChild(errorMsg);
            } else {
                // Simpan balasan AI ke history
                chatHistory.push({ role: 'assistant', text: data.reply });

                // Add assistant message with typing effect
                const assistantRow = document.createElement('div');
                assistantRow.className = 'message-row assistant-row';

                const avatar = document.createElement('div');
                avatar.className = 'msg-avatar';
                avatar.textContent = '✨';

                const bubble = document.createElement('div');
                bubble.className = 'msg-bubble';

                const msgContent = document.createElement('div');
                msgContent.className = 'msg-content';

                bubble.appendChild(msgContent);
                assistantRow.appendChild(avatar);
                assistantRow.appendChild(bubble);
                messagesContainer.appendChild(assistantRow);

                // Typing animation — reveal char by char, then render final markdown
                await typewriterEffect(msgContent, data.reply);

                messageCount++;
                updateStats();
            }
        } catch (error) {
            typingEl.remove();
            const errorMsg = createMessageElement('assistant', `⚠️ Gagal terhubung ke server: ${error.message}`);
            messagesContainer.appendChild(errorMsg);
        }

        isProcessing = false;
        btnSend.disabled = chatInput.value.trim() === '';
        scrollToBottom();
        chatInput.focus();
    }

    // ───────────── Typewriter Effect ─────────────
    async function typewriterEffect(element, text) {
        // Show plain text char by char
        let displayed = '';
        const speed = 6; // ms per character
        const chunkSize = 3; // characters per frame for faster rendering

        for (let i = 0; i < text.length; i += chunkSize) {
            displayed += text.slice(i, i + chunkSize);
            element.textContent = displayed + '▌';
            scrollToBottom();
            await sleep(speed);
        }

        // Final render — replace with full markdown
        element.innerHTML = marked.parse(text);
        addCopyButtons(element);
        scrollToBottom();
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

});
