// ─────────────────────────────────────────────────────────────
// app.js — Navegação, Chat e Funções de IA Globais
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

    const pages  = document.querySelectorAll('.page');
    const btnBack = document.getElementById('btn-back');

    // ── Progresso ──────────────────────────────────────────
    window.updateProgress = function () {
        const completed   = Store.load('completedQuizzes') || [];
        const totalTopics = 5;
        const count       = Math.min(completed.length, totalTopics);

        const progressText = document.querySelector('.card--progress p');
        const progressFill = document.querySelector('.progress-fill');
        if (progressText) progressText.textContent = `Você revisou ${count} de ${totalTopics} tópicos`;
        if (progressFill) progressFill.style.width  = `${(count / totalTopics) * 100}%`;
    };

    window.updateProgress();

    // ── Navegação ──────────────────────────────────────────
    window.navigateTo = function (pageId) {
        pages.forEach(p => p.classList.remove('active'));
        const target = document.getElementById(pageId);
        if (target) target.classList.add('active');
        btnBack.classList.toggle('hidden', pageId === 'page-home');
        window.scrollTo(0, 0);
    };

    btnBack.addEventListener('click', () => navigateTo('page-home'));

    document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', e => navigateTo(e.currentTarget.dataset.nav));
    });

    // ── Checklist ──────────────────────────────────────────
    document.querySelectorAll('.checklist-item').forEach(item => {
        item.addEventListener('click', e => {
            const cb = item.querySelector('input');
            if (e.target !== cb) cb.checked = !cb.checked;
            item.classList.toggle('checked', cb.checked);
        });
    });

    // ── Chat Widget ────────────────────────────────────────
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
            appendMessage('model',
                'Olá! 👋 Sou seu tutor de matemática. Pode me perguntar qualquer coisa sobre os tópicos do curso — respondo passo a passo!'
            );
        }
    });

    chatClose.addEventListener('click', () => chatWindow.classList.add('hidden'));

    chatSend.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendChatMessage(); });

    async function sendChatMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        appendMessage('user', text);
        chatInput.value  = '';
        chatSend.disabled = true;

        const loadingId = 'chat-loading-' + Date.now();
        appendMessage('model', '<div class="loader" style="border-top-color:var(--blue-ink);"></div>', loadingId);

        try {
            const res  = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: chatHistory, message: text, model: chatModel.value })
            });
            const data = await res.json();

            document.getElementById(loadingId)?.remove();
            if (data.error) throw new Error(data.error);

            appendMessage('model', data.text);
            chatHistory.push({ role: 'user',  parts: [{ text }] });
            chatHistory.push({ role: 'model', parts: [{ text: data.text }] });

        } catch (err) {
            document.getElementById(loadingId)?.remove();
            appendMessage('model', '⚠️ Não consegui processar sua mensagem. Tente novamente.');
        } finally {
            chatSend.disabled = false;
            chatInput.focus();
        }
    }

    function appendMessage(role, html, id = null) {
        const div = document.createElement('div');
        div.className = `chat-message ${role}`;
        if (id) div.id = id;

        const formatted = html
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g,     '<em>$1</em>')
            .replace(/\n/g,            '<br>');

        div.innerHTML = formatted;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});

// ─────────────────────────────────────────────────────────────
// Simulado — wrapper para o botão da home
// ─────────────────────────────────────────────────────────────

window.generateSimulado = function () {
    window.navigateTo('page-simulado');
    const intro     = document.getElementById('simulado-intro');
    const container = document.getElementById('simulado-container');
    const result    = document.getElementById('simulado-result');
    if (intro)     intro.style.display     = 'block';
    if (container) container.style.display = 'none';
    if (result)    result.style.display    = 'none';
};

// ─────────────────────────────────────────────────────────────
// Helpers de IA — UI compartilhada
// ─────────────────────────────────────────────────────────────

function getAIContainer(btnElement) {
    return btnElement.closest('.ai-section')?.querySelector('.ai-response-box') || null;
}

function setAILoading(container, msg) {
    if (!container) return;
    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="ai-loading-state">
            <div class="loader"></div>
            <span>${msg}</span>
        </div>`;
}

function setAIError(container, msg, retryFn) {
    if (!container) return;
    container.innerHTML = `
        <div class="ai-error-state">
            <span>⚠️ ${msg}</span>
            <button class="btn-retry" onclick="(${retryFn.toString()})()">↻ Tentar novamente</button>
        </div>`;
}

function setAIResult(container, title, html) {
    if (!container) return;
    container.innerHTML = `<h4 class="ai-result-title">${title}</h4>${html}`;
}

// ─────────────────────────────────────────────────────────────
// explainTopic
// ─────────────────────────────────────────────────────────────

window.explainTopic = async function (topic, btnElement) {
    const container = getAIContainer(btnElement);
    if (!container) return;

    setAILoading(container, 'Gerando explicação com Gemini…');

    try {
        const res  = await fetch('/api/explain-topic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setAIResult(container, '✨ Explicação do Gemini', data.explanation);
    } catch (e) {
        setAIError(container, 'Falha ao gerar explicação.', () => explainTopic(topic, btnElement));
    }
};

// ─────────────────────────────────────────────────────────────
// generateReview
// ─────────────────────────────────────────────────────────────

window.generateReview = async function (topic, btnElement) {
    const container = getAIContainer(btnElement);
    if (!container) return;

    setAILoading(container, 'Gerando revisão com Gemini…');

    try {
        const res  = await fetch('/api/generate-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setAIResult(container, '✨ Revisão Rápida', data.review);
    } catch (e) {
        setAIError(container, 'Falha ao gerar revisão.', () => generateReview(topic, btnElement));
    }
};

// ─────────────────────────────────────────────────────────────
// generateExercises
// ─────────────────────────────────────────────────────────────

window.generateExercises = async function (topic, btnElement) {
    const container = getAIContainer(btnElement);
    if (!container) return;

    setAILoading(container, 'Gerando exercícios com Gemini…');

    try {
        const res  = await fetch('/api/generate-exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setAIResult(container, '✨ Exercícios Adicionais', data.exercises);
    } catch (e) {
        setAIError(container, 'Falha ao gerar exercícios.', () => generateExercises(topic, btnElement));
    }
};
