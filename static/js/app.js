document.addEventListener('DOMContentLoaded', () => {
    // === Variables & Elements ===
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);

    const btnThemeToggle = document.getElementById('btnThemeToggle');
    const btnToggleSidebar = document.getElementById('btnToggleSidebar');
    const btnOpenSidebar = document.getElementById('btnOpenSidebar');
    const sidebar = document.getElementById('sidebar');
    const chatInput = document.getElementById('chatInput');
    const btnSend = document.getElementById('btnSend');
    const messagesContainer = document.getElementById('messagesContainer');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const btnNewChat = document.getElementById('btnNewChat');
    const chatArea = document.getElementById('chatArea');
    const historyList = document.getElementById('historyList');

    let isProcessing = false;
    let chatHistory = [];
    
    // --- State History ---
    let chats = JSON.parse(localStorage.getItem('vira_chats')) || [];
    let currentChatId = null;

    // === Configuration ===
    marked.setOptions({
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true,
        gfm: true
    });

    // === Init ===
    renderHistoryList();

    // === Event Listeners ===
    
    // Global click to close dropdowns
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.history-options-btn') && !e.target.closest('.history-dropdown')) {
            document.querySelectorAll('.history-dropdown').forEach(d => d.remove());
            document.querySelectorAll('.history-options-btn.active').forEach(b => b.classList.remove('active'));
        }
        
        // Account menu click-outside logic
        if (typeof menuOpen !== 'undefined' && menuOpen && accountMenu && profileBtn && !accountMenu.contains(e.target) && !profileBtn.contains(e.target)) {
            menuOpen = false;
            accountMenu.classList.add('opacity-0', 'pointer-events-none', 'translate-y-2');
            accountMenu.classList.remove('opacity-100', 'translate-y-0');
        }
    });

    // Account Dropdown Logic
    const profileBtn = document.getElementById('profile-btn');
    const accountMenu = document.getElementById('account-menu');
    let menuOpen = false;

    if (profileBtn && accountMenu) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menuOpen = !menuOpen;
            if (menuOpen) {
                accountMenu.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-2');
                accountMenu.classList.add('opacity-100', 'translate-y-0');
            } else {
                accountMenu.classList.add('opacity-0', 'pointer-events-none', 'translate-y-2');
                accountMenu.classList.remove('opacity-100', 'translate-y-0');
            }
        });
    }

    btnThemeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    btnToggleSidebar.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.add('collapsed');
            btnOpenSidebar.style.display = 'block';
        } else {
            if (sidebar.classList.contains('sidebar-expanded')) {
                sidebar.classList.remove('sidebar-expanded');
                sidebar.classList.add('sidebar-collapsed');
            } else {
                sidebar.classList.remove('sidebar-collapsed');
                sidebar.classList.add('sidebar-expanded');
            }
        }
    });

    btnOpenSidebar.addEventListener('click', () => {
        sidebar.classList.remove('collapsed');
        btnOpenSidebar.style.display = 'none';
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768 && !sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('collapsed');
            btnOpenSidebar.style.display = 'block';
        } else if (window.innerWidth > 768 && sidebar.classList.contains('collapsed')) {
            sidebar.classList.remove('collapsed');
            btnOpenSidebar.style.display = 'none';
        }
    });

    btnNewChat.addEventListener('click', () => {
        startNewChat();
        if (window.innerWidth <= 768) {
            sidebar.classList.add('collapsed');
            btnOpenSidebar.style.display = 'block';
        }
    });

    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
        btnSend.disabled = chatInput.value.trim() === '' || isProcessing;
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!btnSend.disabled) sendMessage();
        }
    });

    btnSend.addEventListener('click', sendMessage);

    // === Functions ===

    function startNewChat() {
        currentChatId = null;
        chatHistory = [];
        messagesContainer.innerHTML = '';
        welcomeScreen.style.display = 'flex';
        renderHistoryList(); // updates active state
        fetch('/api/new-chat', { method: 'POST' }).catch(() => {});
    }

    function generateId() {
        return Math.random().toString(36).substring(2, 15);
    }

    function saveChats() {
        localStorage.setItem('vira_chats', JSON.stringify(chats));
    }

    function generateTitle(firstMessage) {
        const words = firstMessage.trim().split(/\s+/);
        if (words.length <= 4) return firstMessage;
        return words.slice(0, 4).join(' ') + '...';
    }

    function renderHistoryList() {
        // Hapus semua history items kecuali title
        const items = historyList.querySelectorAll('.history-item');
        items.forEach(item => item.remove());

        if (chats.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'history-item';
            emptyMsg.style.color = 'var(--text-secondary)';
            emptyMsg.style.cursor = 'default';
            emptyMsg.style.fontSize = '12px';
            emptyMsg.textContent = 'Belum ada percakapan.';
            historyList.appendChild(emptyMsg);
            return;
        }

        // Urutkan chats: terbaru di atas
        const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

        sortedChats.forEach(chat => {
            const item = document.createElement('div');
            item.className = 'history-item';
            if (chat.id === currentChatId) item.classList.add('active');

            const iconSvg = document.createElement('div');
            iconSvg.className = 'menu-icon text-gray-500 mr-2 flex-shrink-0';
            iconSvg.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

            const titleSpan = document.createElement('span');
            titleSpan.className = 'history-title-text hide-on-collapse text-black dark:text-white';
            titleSpan.textContent = chat.title;

            // Options Button (3 dots)
            const optBtn = document.createElement('button');
            optBtn.className = 'history-options-btn hide-on-collapse';
            optBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;
            
            optBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent chat selection
                showDropdown(optBtn, chat.id, titleSpan);
            });

            item.appendChild(iconSvg);
            item.appendChild(titleSpan);
            item.appendChild(optBtn);

            // Select chat
            item.addEventListener('click', () => {
                loadChat(chat.id);
                if (window.innerWidth <= 768) {
                    sidebar.classList.add('collapsed');
                    btnOpenSidebar.style.display = 'block';
                }
            });

            historyList.appendChild(item);
        });
    }

    function showDropdown(buttonEl, chatId, titleSpanEl) {
        // Close existing
        document.querySelectorAll('.history-dropdown').forEach(d => d.remove());
        document.querySelectorAll('.history-options-btn.active').forEach(b => b.classList.remove('active'));

        buttonEl.classList.add('active');

        const dropdown = document.createElement('div');
        dropdown.className = 'history-dropdown';

        // Edit Button
        const editBtn = document.createElement('button');
        editBtn.className = 'dropdown-item';
        editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> Ubah Nama`;
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.remove();
            buttonEl.classList.remove('active');
            enableEditMode(chatId, titleSpanEl);
        });

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'dropdown-item delete';
        deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Hapus`;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.remove();
            deleteChat(chatId);
        });

        dropdown.appendChild(editBtn);
        dropdown.appendChild(deleteBtn);
        
        buttonEl.parentElement.appendChild(dropdown);
    }

    function enableEditMode(chatId, titleSpanEl) {
        const chat = chats.find(c => c.id === chatId);
        if (!chat) return;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'history-edit-input';
        input.value = chat.title;

        const saveTitle = () => {
            const newTitle = input.value.trim();
            if (newTitle) {
                chat.title = newTitle;
                saveChats();
            }
            renderHistoryList();
        };

        input.addEventListener('blur', saveTitle);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveTitle();
            if (e.key === 'Escape') renderHistoryList(); // cancel
        });

        input.addEventListener('click', e => e.stopPropagation());

        titleSpanEl.replaceWith(input);
        input.focus();
    }

    function deleteChat(chatId) {
        chats = chats.filter(c => c.id !== chatId);
        saveChats();
        
        if (currentChatId === chatId) {
            startNewChat();
        } else {
            renderHistoryList();
        }
    }

    function loadChat(chatId) {
        const chat = chats.find(c => c.id === chatId);
        if (!chat) return;

        currentChatId = chat.id;
        chatHistory = [...chat.history];
        
        welcomeScreen.style.display = 'none';
        messagesContainer.innerHTML = '';

        // Render existing messages
        chatHistory.forEach(msg => {
            if (msg.role === 'user') {
                const userRow = document.createElement('div');
                userRow.className = 'message-row user-row';
                userRow.innerHTML = `<div class="user-bubble">${escapeHTML(msg.text)}</div>`;
                messagesContainer.appendChild(userRow);
            } else {
                const aiRow = document.createElement('div');
                aiRow.className = 'message-row ai-row';
                aiRow.innerHTML = `
                    <div class="ai-avatar overflow-hidden">
                        <img src="/static/img/technology.png" alt="AI" style="width: 100%; height: 100%; object-fit: contain;">
                    </div>
                    <div class="ai-content">${marked.parse(msg.text)}</div>
                `;
                messagesContainer.appendChild(aiRow);
                aiRow.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
            }
        });

        renderHistoryList();
        scrollToBottom();
    }

    function scrollToBottom() {
        chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
    }

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text || isProcessing) return;

        isProcessing = true;
        btnSend.disabled = true;
        welcomeScreen.style.display = 'none';

        // 1. Create chat if it doesn't exist
        if (!currentChatId) {
            currentChatId = generateId();
            chats.push({
                id: currentChatId,
                title: generateTitle(text),
                history: [],
                updatedAt: Date.now()
            });
            renderHistoryList();
        }

        // Render User Message
        const userRow = document.createElement('div');
        userRow.className = 'message-row user-row';
        userRow.innerHTML = `<div class="user-bubble">${escapeHTML(text)}</div>`;
        messagesContainer.appendChild(userRow);

        chatInput.value = '';
        chatInput.style.height = 'auto';
        scrollToBottom();

        // Render AI placeholder
        const aiRow = document.createElement('div');
        aiRow.className = 'message-row ai-row';
        aiRow.innerHTML = `
            <div class="ai-avatar overflow-hidden">
                <img src="/static/img/technology.png" alt="AI" style="width: 100%; height: 100%; object-fit: contain;">
            </div>
            <div class="ai-content"><i style="color: var(--text-secondary);">Mengetik...</i></div>
        `;
        messagesContainer.appendChild(aiRow);
        scrollToBottom();

        try {
            chatHistory.push({ role: 'user', text: text });
            
            // Save immediately after user sends
            updateCurrentChatHistory();

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, history: chatHistory })
            });
            const data = await response.json();

            if (data.error) {
                aiRow.querySelector('.ai-content').innerHTML = `<p style="color: #ef4444;">⚠️ Error: ${data.error}</p>`;
            } else {
                chatHistory.push({ role: 'assistant', text: data.reply });
                updateCurrentChatHistory();
                
                // Render markdown
                aiRow.querySelector('.ai-content').innerHTML = marked.parse(data.reply);
                
                // Highlight syntax
                aiRow.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
            }
        } catch (error) {
            aiRow.querySelector('.ai-content').innerHTML = `<p style="color: #ef4444;">⚠️ Gagal terhubung ke server. Periksa koneksi internet Anda.</p>`;
        }

        isProcessing = false;
        btnSend.disabled = chatInput.value.trim() === '';
        scrollToBottom();
        chatInput.focus();
    }

    function updateCurrentChatHistory() {
        const chat = chats.find(c => c.id === currentChatId);
        if (chat) {
            chat.history = [...chatHistory];
            chat.updatedAt = Date.now();
            saveChats();
        }
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
});
