document.addEventListener('DOMContentLoaded', () => {
    const pages = document.querySelectorAll('.page');
    const btnBack = document.getElementById('btn-back');

    window.updateProgress = function() {
        const completedQuizzes = Store.load('completedQuizzes') || [];
        const totalTopics = 5; // We have 5 modules now
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
        document.getElementById(pageId).classList.add('active');
        
        if(pageId === 'page-home') {
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
            if(checkbox.checked) {
                item.classList.add('checked');
            } else {
                item.classList.remove('checked');
            }
        });
    });

    // Chat Logic
    const chatToggle = document.getElementById('chat-toggle');
    const chatWindow = document.getElementById('chat-window');
    const chatClose = document.getElementById('chat-close');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const chatMessages = document.getElementById('chat-messages');
    const chatModel = document.getElementById('chat-model');

    let chatHistory = [];

    chatToggle.addEventListener('click', () => {
        chatWindow.classList.toggle('hidden');
        if (!chatWindow.classList.contains('hidden') && chatHistory.length === 0) {
            appendMessage('model', 'Olá! Sou seu tutor de matemática. Como posso ajudar você hoje?');
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

            chatHistory.push({ role: 'user', parts: [{ text }] });
            chatHistory.push({ role: 'model', parts: [{ text: data.text }] });
        } catch (e) {
            const loaderEl = document.getElementById(loadingId);
            if (loaderEl) loaderEl.remove();
            appendMessage('model', 'Desculpe, ocorreu um erro ao processar sua mensagem.');
        }
    }

    function appendMessage(role, text, id = null) {
        const div = document.createElement('div');
        div.className = `chat-message ${role}`;
        if (id) div.id = id;
        
        // Basic markdown to HTML for bold and line breaks
        let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedText = formattedText.replace(/\n/g, '<br>');
        
        div.innerHTML = formattedText;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});

// Integração com Gemini
window.explainTopic = async function(topic, btnElement) {
    const container = btnElement.parentElement.querySelector('.ai-response-box');
    container.classList.remove('hidden');
    container.innerHTML = '<div style="display:flex; align-items:center; gap:8px;"><div class="loader"></div> Gerando explicação com Gemini...</div>';
    
    try {
        const res = await fetch('/api/explain-topic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        const data = await res.json();
        container.innerHTML = `<h4 style="margin-top:0; color:var(--blue-ink);">✨ Explicação do Gemini</h4>${data.explanation}`;
    } catch (e) {
        container.innerHTML = '<p style="color:var(--red-ink);">Erro ao gerar explicação.</p>';
    }
};

window.generateReview = async function(topic, btnElement) {
    const container = btnElement.parentElement.querySelector('.ai-response-box');
    container.classList.remove('hidden');
    container.innerHTML = '<div style="display:flex; align-items:center; gap:8px;"><div class="loader"></div> Gerando revisão com Gemini...</div>';
    
    try {
        const res = await fetch('/api/generate-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        const data = await res.json();
        container.innerHTML = `<h4 style="margin-top:0; color:var(--blue-ink);">✨ Revisão Rápida</h4>${data.review}`;
    } catch (e) {
        container.innerHTML = '<p style="color:var(--red-ink);">Erro ao gerar revisão.</p>';
    }
};

window.generateExercises = async function(topic, btnElement) {
    const container = btnElement.parentElement.querySelector('.ai-response-box');
    container.classList.remove('hidden');
    container.innerHTML = '<div style="display:flex; align-items:center; gap:8px;"><div class="loader"></div> Gerando exercícios com Gemini...</div>';
    
    try {
        const res = await fetch('/api/generate-exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        const data = await res.json();
        container.innerHTML = `<h4 style="margin-top:0; color:var(--blue-ink);">✨ Exercícios Adicionais</h4>${data.exercises}`;
    } catch (e) {
        container.innerHTML = '<p style="color:var(--red-ink);">Erro ao gerar exercícios.</p>';
    }
};
