document.addEventListener('DOMContentLoaded', () => {
    const pages = document.querySelectorAll('.page');
    const btnBack = document.getElementById('btn-back');

    window.updateProgress = function() {
        const completedQuizzes = Store.load('completedQuizzes') || [];
        const totalTopics = 5;
        const progressCount = Math.min(completedQuizzes.length, totalTopics);

        const progressText = document.querySelector('.card--progress p');
        const progressFill = document.querySelector('.progress-fill');

        if (progressText && progressFill) {
            progressText.textContent = `Você revisou ${progressCount} de ${totalTopics} tópicos`;
            progressFill.style.width = `${(progressCount / totalTopics) * 100}%`;
        }
    };

    window.updateProgress();

    window.navigateTo = function(pageId) {
        pages.forEach(p => p.classList.remove('active'));
        const target = document.getElementById(pageId);
        if (target) target.classList.add('active');

        if (pageId === 'page-home') {
            btnBack.classList.add('hidden');
        } else {
            btnBack.classList.remove('hidden');
        }
        window.scrollTo(0, 0);
    };

    btnBack.addEventListener('click', () => navigateTo('page-home'));

    document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            navigateTo(e.currentTarget.dataset.nav);
        });
    });

    document.querySelectorAll('.checklist-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const checkbox = item.querySelector('input');
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
            }
            if (checkbox.checked) {
                item.classList.add('checked');
            } else {
                item.classList.remove('checked');
            }
        });
    });

    // -------------------------------------------------------
    // Chat Widget
    // -------------------------------------------------------
    const chatToggle   = document.getElementById('chat-toggle');
    const chatWindow   = document.getElementById('chat-window');
    const chatClose    = document.getElementById('chat-close');
    const chatInput    = document.getElementById('chat-input');
    const chatSend     = document.getElementById('chat-send');
    const chatMessages = document.getElementById('chat-messages');
    const chatModel    = document.getElementById('chat-model');

    let chatHistory = [];

    chatToggle.addEventListener('click', () => {
        chatWindow.classList.toggle('hidden');
        if (!chatWindow.classList.contains('hidden') && chatHistory.length === 0) {
            appendMessage('model', 'Olá! 👋 Sou seu tutor de matemática. Pode me perguntar qualquer coisa sobre os tópicos do curso — vou explicar passo a passo!');
        }
    });

    chatClose.addEventListener('click', () => {
        chatWindow.classList.add('hidden');
    });

    chatSend.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        appendMessage('user', text);
        chatInput.value = '';
        chatSend.disabled = true;

        const loadingId = 'loading-' + Date.now();
        appendMessage('model', '<div class="loader" style="border-top-color: var(--blue-ink);"></div>', loadingId);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    history: chatHistory,
                    message: text,
                    model: chatModel.value
                })
            });
            const data = await res.json();

            const loaderEl = document.getElementById(loadingId);
            if (loaderEl) loaderEl.remove();

            if (data.error) throw new Error(data.error);

            appendMessage('model', data.text);
            chatHistory.push({ role: 'user',  parts: [{ text }] });
            chatHistory.push({ role: 'model', parts: [{ text: data.text }] });
        } catch (e) {
            const loaderEl = document.getElementById(loadingId);
            if (loaderEl) loaderEl.remove();
            appendMessage('model', '⚠️ Desculpe, ocorreu um erro. Verifique sua conexão e tente novamente.');
        } finally {
            chatSend.disabled = false;
        }
    }

    function appendMessage(role, text, id = null) {
        const div = document.createElement('div');
        div.className = `chat-message ${role}`;
        if (id) div.id = id;

        // Markdown básico → HTML
        let formatted = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');

        div.innerHTML = formatted;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});

// -------------------------------------------------------
// Wrapper: botão "Simulado Completo" na home
// -------------------------------------------------------
window.generateSimulado = function() {
    window.navigateTo('page-simulado');
    // Reseta a tela do simulado para o estado inicial (intro)
    const intro     = document.getElementById('simulado-intro');
    const container = document.getElementById('simulado-container');
    const result    = document.getElementById('simulado-result');
    if (intro)     intro.style.display     = 'block';
    if (container) container.style.display = 'none';
    if (result)    result.style.display    = 'none';
};

// -------------------------------------------------------
// Integração com Gemini — Explicar tópico
// -------------------------------------------------------
window.explainTopic = async function(topic, btnElement) {
    const container = btnElement.closest('.ai-section').querySelector('.ai-response-box');
    container.classList.remove('hidden');
    container.innerHTML = '<div style="display:flex;align-items:center;gap:10px;"><div class="loader"></div><span style="color:var(--text-muted);">Gerando explicação com Gemini...</span></div>';

    try {
        const res  = await fetch('/api/explain-topic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        container.innerHTML = `<h4 style="margin-top:0;color:var(--blue-ink);">✨ Explicação do Gemini</h4>${data.explanation}`;
    } catch (e) {
        container.innerHTML = '<p style="color:var(--red-ink);">⚠️ Erro ao gerar explicação. Verifique sua conexão.</p>';
    }
};

// -------------------------------------------------------
// Integração com Gemini — Revisão rápida
// -------------------------------------------------------
window.generateReview = async function(topic, btnElement) {
    const container = btnElement.closest('.ai-section').querySelector('.ai-response-box');
    container.classList.remove('hidden');
    container.innerHTML = '<div style="display:flex;align-items:center;gap:10px;"><div class="loader"></div><span style="color:var(--text-muted);">Gerando revisão com Gemini...</span></div>';

    try {
        const res  = await fetch('/api/generate-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        container.innerHTML = `<h4 style="margin-top:0;color:var(--blue-ink);">✨ Revisão Rápida</h4>${data.review}`;
    } catch (e) {
        container.innerHTML = '<p style="color:var(--red-ink);">⚠️ Erro ao gerar revisão. Verifique sua conexão.</p>';
    }
};

// -------------------------------------------------------
// Integração com Gemini — Exercícios adicionais
// -------------------------------------------------------
window.generateExercises = async function(topic, btnElement) {
    const container = btnElement.closest('.ai-section').querySelector('.ai-response-box');
    container.classList.remove('hidden');
    container.innerHTML = '<div style="display:flex;align-items:center;gap:10px;"><div class="loader"></div><span style="color:var(--text-muted);">Gerando exercícios com Gemini...</span></div>';

    try {
        const res  = await fetch('/api/generate-exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        container.innerHTML = `<h4 style="margin-top:0;color:var(--blue-ink);">✨ Exercícios Adicionais</h4>${data.exercises}`;
    } catch (e) {
        container.innerHTML = '<p style="color:var(--red-ink);">⚠️ Erro ao gerar exercícios. Verifique sua conexão.</p>';
    }
};
