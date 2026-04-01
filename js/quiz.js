// ─────────────────────────────────────────────────────────────
// quiz.js — Lógica de Quiz e Simulado
// ─────────────────────────────────────────────────────────────

window.currentQuizQuestions = [];
window.currentQ             = 0;
window.score                = 0;
window.currentTopic         = '';
window.simuladoResults      = [];

// ── Helpers de UI ────────────────────────────────────────────

function showInlineError(containerId, message, retryFn) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
        <div class="quiz-error-box">
            <span>⚠️ ${message}</span>
            ${retryFn
                ? `<button class="btn-retry" onclick="(${retryFn.toString()})()">↻ Tentar novamente</button>`
                : ''}
        </div>`;
}

function showQuizLoading(questionTextId, progressId, message) {
    const q = document.getElementById(questionTextId);
    const p = document.getElementById(progressId);
    if (q) q.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;color:var(--text-muted);font-size:15px;">
            <div class="loader"></div>${message}
        </div>`;
    if (p) p.textContent = 'Aguarde…';
}

// ── Fallback: questões estáticas se API falhar ────────────────

function getStaticQuestions(topic, count) {
    if (typeof window.MODULES_DATA === 'undefined') return null;

    // Encontra o módulo cujo quizTopic bate com o tópico pedido
    const mod = Object.values(window.MODULES_DATA).find(
        m => m.quizTopic === topic || m.title === topic
    );
    if (!mod || !mod.fallbackQuiz || mod.fallbackQuiz.length === 0) return null;

    // Embaralha e retorna até 'count' questões
    const shuffled = [...mod.fallbackQuiz].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count || 3, shuffled.length));
}

// ── Score feedback text ───────────────────────────────────────

function getScoreText(score, total) {
    const pct = (score / total) * 100;
    if (pct === 100) return '🎉 Perfeito! Você acertou tudo!';
    if (pct >= 80)  return '✅ Excelente! Você está muito bem preparado.';
    if (pct >= 60)  return '👍 Bom trabalho! Ainda há espaço para melhorar.';
    if (pct >= 40)  return '📖 Revise os módulos e tente novamente.';
    return '🔄 Recomendamos rever o conteúdo antes de continuar.';
}

// ─────────────────────────────────────────────────────────────
// QUIZ por tópico
// ─────────────────────────────────────────────────────────────

window.generateQuizForTopic = async function (topic, count) {
    window.currentTopic = topic;
    const num = count || 3;

    window.navigateTo('page-quiz');

    const quizContainer = document.getElementById('quiz-container');
    const quizResult    = document.getElementById('quiz-result');

    quizResult.style.display    = 'none';
    quizContainer.style.display = 'block';

    document.getElementById('options-container').innerHTML  = '';
    document.getElementById('explanation-box').style.display = 'none';
    document.getElementById('btn-next-quiz').style.display   = 'none';

    showQuizLoading('question-text', 'quiz-progress', `Gerando questões sobre "${topic}"…`);

    try {
        const res  = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, count: num })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        window.currentQuizQuestions = data;
        window.currentQ = 0;
        window.score    = 0;
        loadDynamicQuestion();

    } catch (e) {
        // Tenta fallback estático
        const fb = getStaticQuestions(topic, num);
        if (fb) {
            window.currentQuizQuestions = fb;
            window.currentQ = 0;
            window.score    = 0;

            // Aviso sutil de fallback
            const qt = document.getElementById('question-text');
            if (qt) qt.dataset.fallback = 'true';

            loadDynamicQuestion();
        } else {
            showInlineError(
                'question-text',
                'Não foi possível gerar o quiz. Verifique sua conexão.',
                () => generateQuizForTopic(topic, num)
            );
            document.getElementById('quiz-progress').textContent = 'Erro';
        }
    }
};

function loadDynamicQuestion() {
    const q = window.currentQuizQuestions[window.currentQ];
    if (!q) return;

    document.getElementById('quiz-progress').textContent =
        `Questão ${window.currentQ + 1} de ${window.currentQuizQuestions.length}`;
    document.getElementById('question-text').textContent = q.question;

    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    document.getElementById('explanation-box').style.display  = 'none';
    document.getElementById('btn-next-quiz').style.display    = 'none';

    q.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'quiz-option';
        div.textContent = opt;
        div.onclick = () => selectDynamicOption(div, idx, q.correctAnswer, q.explanation);
        optionsContainer.appendChild(div);
    });
}

function selectDynamicOption(selectedDiv, selectedIndex, correctIndex, explanation) {
    document.getElementById('options-container')
        .querySelectorAll('.quiz-option')
        .forEach(opt => opt.classList.add('disabled'));

    if (selectedIndex === correctIndex) {
        selectedDiv.classList.add('correct');
        window.score++;
    } else {
        selectedDiv.classList.add('wrong');
        document.getElementById('options-container')
            .querySelectorAll('.quiz-option')[correctIndex]
            ?.classList.add('correct');
    }

    document.getElementById('explanation-text').textContent = explanation;
    document.getElementById('explanation-box').style.display = 'block';

    const btnNext = document.getElementById('btn-next-quiz');
    btnNext.style.display = 'block';
    btnNext.onclick = () => {
        window.currentQ++;
        if (window.currentQ < window.currentQuizQuestions.length) {
            loadDynamicQuestion();
        } else {
            showDynamicResult();
        }
    };
}

function showDynamicResult() {
    document.getElementById('quiz-container').style.display = 'none';
    const result = document.getElementById('quiz-result');
    result.style.display = 'block';

    const total = window.currentQuizQuestions.length;
    document.getElementById('score-number').textContent = `${window.score}/${total}`;
    document.getElementById('score-text').textContent   = getScoreText(window.score, total);

    // Salva progresso
    let completed = Store.load('completedQuizzes') || [];
    if (!completed.includes(window.currentTopic)) {
        completed.push(window.currentTopic);
        Store.save('completedQuizzes', completed);
        if (window.updateProgress) window.updateProgress();
    }
}

// ─────────────────────────────────────────────────────────────
// GERAR MAIS QUESTÕES
// ─────────────────────────────────────────────────────────────

window.generateMoreQuestions = async function (count) {
    const btns = document.querySelectorAll('.btn-more-questions');
    const originals = [];
    btns.forEach((btn, i) => {
        originals[i] = btn.innerHTML;
        btn.innerHTML = '<div class="loader" style="margin:0 auto;"></div>';
        btn.disabled  = true;
    });

    try {
        const res  = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: window.currentTopic, count, difficulty: 'variado' })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        window.currentQuizQuestions = window.currentQuizQuestions.concat(data);

        const resultScreen = document.getElementById('quiz-result');
        if (resultScreen && resultScreen.style.display === 'block') {
            resultScreen.style.display = 'none';
            document.getElementById('quiz-container').style.display = 'block';
            loadDynamicQuestion();
        } else {
            const p = document.getElementById('quiz-progress');
            if (p) p.textContent = `Questão ${window.currentQ + 1} de ${window.currentQuizQuestions.length}`;
        }
    } catch (e) {
        // Sem alert nativo — feedback inline no primeiro botão
        const firstBtn = btns[0];
        if (firstBtn) {
            firstBtn.innerHTML = '⚠️ Erro — tente novamente';
            firstBtn.style.color = 'var(--red-ink)';
            setTimeout(() => {
                firstBtn.innerHTML = originals[0];
                firstBtn.style.color = '';
            }, 3000);
        }
    } finally {
        btns.forEach((btn, i) => {
            if (btn.disabled) {
                btn.innerHTML = originals[i];
                btn.disabled  = false;
            }
        });
    }
};

// ─────────────────────────────────────────────────────────────
// SIMULADO
// ─────────────────────────────────────────────────────────────

window.startSimulado = async function () {
    const intro     = document.getElementById('simulado-intro');
    const container = document.getElementById('simulado-container');
    const result    = document.getElementById('simulado-result');
    const progress  = document.getElementById('simulado-progress');

    intro.style.display     = 'none';
    result.style.display    = 'none';
    container.style.display = 'block';

    document.getElementById('simulado-options-container').innerHTML   = '';
    document.getElementById('simulado-explanation-box').style.display = 'none';
    document.getElementById('btn-next-simulado').style.display        = 'none';

    showQuizLoading('simulado-question-text', 'simulado-progress', 'Gerando simulado completo…');

    const topic = 'Matemática Básica: Conjuntos, Intervalos, Álgebra, Potenciação, Radiciação, Reta Real';

    try {
        const res  = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, count: 10, difficulty: 'variado' })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        window.currentQuizQuestions = data;
        window.currentQ     = 0;
        window.score        = 0;
        window.simuladoResults = [];
        loadSimuladoQuestion();

    } catch (e) {
        // Fallback: junta questões de todos os módulos
        const fallback = buildSimuladoFallback(10);
        if (fallback.length > 0) {
            window.currentQuizQuestions = fallback;
            window.currentQ     = 0;
            window.score        = 0;
            window.simuladoResults = [];
            progress.textContent = '⚠️ Usando questões do banco local';
            loadSimuladoQuestion();
        } else {
            showInlineError(
                'simulado-question-text',
                'Não foi possível gerar o simulado. Verifique sua conexão.',
                () => startSimulado()
            );
            progress.textContent = 'Erro';
            intro.style.display = 'block';
            container.style.display = 'none';
        }
    }
};

function buildSimuladoFallback(total) {
    if (typeof window.MODULES_DATA === 'undefined') return [];
    const all = [];
    Object.values(window.MODULES_DATA).forEach(mod => {
        if (mod.fallbackQuiz) all.push(...mod.fallbackQuiz);
    });
    return all.sort(() => Math.random() - 0.5).slice(0, total);
}

function loadSimuladoQuestion() {
    const q = window.currentQuizQuestions[window.currentQ];
    if (!q) return;

    document.getElementById('simulado-progress').textContent =
        `Questão ${window.currentQ + 1} de ${window.currentQuizQuestions.length}`;
    document.getElementById('simulado-question-text').textContent = q.question;

    const optionsContainer = document.getElementById('simulado-options-container');
    optionsContainer.innerHTML = '';
    document.getElementById('simulado-explanation-box').style.display = 'none';
    document.getElementById('btn-next-simulado').style.display        = 'none';

    q.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'quiz-option';
        div.textContent = opt;
        div.onclick = () => selectSimuladoOption(div, idx, q.correctAnswer, q.explanation, q.difficulty);
        optionsContainer.appendChild(div);
    });
}

function selectSimuladoOption(selectedDiv, selectedIndex, correctIndex, explanation, difficulty) {
    document.getElementById('simulado-options-container')
        .querySelectorAll('.quiz-option')
        .forEach(opt => opt.classList.add('disabled'));

    const isCorrect = selectedIndex === correctIndex;

    window.simuladoResults.push({
        question:      window.currentQuizQuestions[window.currentQ].question,
        isCorrect,
        difficulty,
        selectedOption: window.currentQuizQuestions[window.currentQ].options[selectedIndex],
        correctOption:  window.currentQuizQuestions[window.currentQ].options[correctIndex],
        explanation
    });

    if (isCorrect) {
        selectedDiv.classList.add('correct');
        window.score++;
    } else {
        selectedDiv.classList.add('wrong');
        document.getElementById('simulado-options-container')
            .querySelectorAll('.quiz-option')[correctIndex]
            ?.classList.add('correct');
    }

    document.getElementById('simulado-explanation-text').textContent = explanation;
    document.getElementById('simulado-explanation-box').style.display = 'block';

    const btnNext = document.getElementById('btn-next-simulado');
    btnNext.style.display = 'block';
    btnNext.onclick = () => {
        window.currentQ++;
        if (window.currentQ < window.currentQuizQuestions.length) {
            loadSimuladoQuestion();
        } else {
            showSimuladoResult();
        }
    };
}

function showSimuladoResult() {
    document.getElementById('simulado-container').style.display = 'none';
    const result = document.getElementById('simulado-result');
    result.style.display = 'block';

    const total = window.currentQuizQuestions.length;
    document.getElementById('simulado-score-number').textContent = `${window.score}/${total}`;
    document.getElementById('simulado-score-text').textContent   = getScoreText(window.score, total);

    const feedbackContainer = document.getElementById('simulado-feedback');
    feedbackContainer.innerHTML = '<h4 style="margin-bottom:16px;">Revisão das Questões:</h4>';

    window.simuladoResults.forEach((res, idx) => {
        const qDiv = document.createElement('div');
        qDiv.className = 'box ' + (res.isCorrect ? 'box--tip' : 'box--mistake');
        qDiv.style.cssText = 'margin-bottom:14px;text-align:left;';
        qDiv.innerHTML = `
            <h5 style="margin:0 0 8px;font-size:13px;">
                Questão ${idx + 1} ${res.isCorrect ? '✅' : '❌'}
                <span style="opacity:.6;font-weight:400;margin-left:6px;">${res.difficulty || ''}</span>
            </h5>
            <p style="margin:0 0 8px;font-size:14px;font-weight:600;">${res.question}</p>
            <p style="margin:0 0 4px;font-size:13px;"><b>Sua resposta:</b> ${res.selectedOption}</p>
            ${!res.isCorrect
                ? `<p style="margin:0 0 8px;font-size:13px;color:var(--green-ink);"><b>Correta:</b> ${res.correctOption}</p>`
                : ''}
            <p style="margin:8px 0 0;font-size:13px;padding-top:8px;border-top:1px solid rgba(0,0,0,.08);">
                <b>Explicação:</b> ${res.explanation}
            </p>`;
        feedbackContainer.appendChild(qDiv);
    });

    Store.save('lastSimuladoScore', { score: window.score, total, date: new Date().toISOString() });
}
